import { createReadStream } from "node:fs";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { contentDisposition, contentTypeFor, isSafeStorageKey } from "@/lib/delivery";

// Server code only: private product files in an S3-compatible bucket
// (Cloudflare R2 or AWS S3, feature 18). Without any S3_* variable the app
// keeps files in the local storage/ folder instead. Never log the values.

export const SIGNED_URL_SECONDS = 300;

const REQUIRED = [
  "S3_BUCKET",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const;
const OPTIONAL = ["S3_ENDPOINT"] as const;

export interface BucketConfig {
  bucket: string;
  region: string;
  endpoint: string | undefined;
  accessKeyId: string;
  secretAccessKey: string;
}

export class StorageConfigError extends Error {}

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

// null when no S3_* variable is set (local storage). A partial setup throws, so
// a misconfigured deployment never quietly writes to the local disk.
export function bucketConfig(): BucketConfig | null {
  if ([...REQUIRED, ...OPTIONAL].every((name) => env(name) === undefined)) {
    return null;
  }
  const missing = REQUIRED.filter((name) => env(name) === undefined);
  if (missing.length > 0) {
    throw new StorageConfigError(
      `Object storage is partly configured; missing ${missing.join(", ")}`,
    );
  }
  return {
    bucket: env("S3_BUCKET")!,
    region: env("S3_REGION")!,
    endpoint: env("S3_ENDPOINT"),
    accessKeyId: env("S3_ACCESS_KEY_ID")!,
    secretAccessKey: env("S3_SECRET_ACCESS_KEY")!,
  };
}

let cached: { client: S3Client; bucket: string } | null = null;

// Created on first use, so local mode and tests never build a client.
function bucket(): { client: S3Client; bucket: string } {
  if (cached) return cached;
  const config = bucketConfig();
  if (!config) throw new StorageConfigError("Object storage is not configured");
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Checksums only where S3 requires them, which every S3-compatible
    // provider accepts.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  cached = { client, bucket: config.bucket };
  return cached;
}

function safeKey(key: string): string {
  if (!isSafeStorageKey(key)) throw new Error("Unsafe storage key");
  return key;
}

export async function putObjectFromFile(
  key: string,
  filePath: string,
  size: number,
): Promise<void> {
  const { client, bucket: Bucket } = bucket();
  await client.send(
    new PutObjectCommand({
      Bucket,
      Key: safeKey(key),
      Body: createReadStream(filePath),
      ContentLength: size,
      ContentType: contentTypeFor(key),
    }),
  );
}

export async function objectExists(key: string): Promise<boolean> {
  const { client, bucket: Bucket } = bucket();
  try {
    await client.send(new HeadObjectCommand({ Bucket, Key: safeKey(key) }));
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "NotFound" ||
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode === 404)
    ) {
      return false;
    }
    throw error;
  }
}

// Deletes every object under a folder-like prefix such as "products/p1/". The
// trailing slash and the key rule keep it from matching a sibling or seed/.
export async function deletePrefix(prefix: string): Promise<void> {
  if (!prefix.endsWith("/") || !isSafeStorageKey(prefix.slice(0, -1))) {
    throw new Error("Unsafe storage prefix");
  }
  const { client, bucket: Bucket } = bucket();
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken: token }),
    );
    const keys = (page.Contents ?? []).flatMap((item) =>
      item.Key ? [{ Key: item.Key }] : [],
    );
    if (keys.length > 0) {
      const result = await client.send(
        new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys, Quiet: true } }),
      );
      if (result.Errors?.length) {
        throw new Error(`${result.Errors.length} objects were not deleted`);
      }
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
}

// A GET link for one object that expires after SIGNED_URL_SECONDS. It names the
// file itself, because browsers ignore the download attribute across origins.
export async function signedDownloadUrl(key: string): Promise<string> {
  const { client, bucket: Bucket } = bucket();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket,
      Key: safeKey(key),
      ResponseContentDisposition: contentDisposition(key),
      ResponseContentType: contentTypeFor(key),
    }),
    { expiresIn: SIGNED_URL_SECONDS },
  );
}
