import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import {
  isOwnUploadKey,
  productFileKey,
  productUploadPrefix,
  uploadFileName,
} from "@/lib/admin-products";
import { isSafeStorageKey, storagePath } from "@/lib/delivery";
import { STORAGE_ROOT } from "@/lib/downloads";
import { bucketConfig, deletePrefix, putObjectFromFile } from "@/lib/object-storage";

// Server code only: admin writes and removals of private product files, in the
// bucket when one is configured, otherwise under storage/. Local paths always
// resolve through storagePath(), so no key can reach outside the storage root.

// The first bytes every file of each allowed type starts with.
const SIGNATURES: Record<string, Buffer> = {
  ".pdf": Buffer.from("%PDF-"),
  ".zip": Buffer.from([0x50, 0x4b, 0x03, 0x04]),
};

export type UploadError = "file_too_large" | "empty_file" | "invalid_file_type";

export type SaveResult =
  | { ok: true; key: string; fileName: string }
  | { ok: false; error: UploadError };

class TooLargeError extends Error {}

// Fails the pipeline once more than `limit` bytes arrive, so a body with a
// missing or false Content-Length still never fills the disk.
function byteLimit(limit: number, counter: { bytes: number }): Transform {
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      counter.bytes += chunk.length;
      if (counter.bytes > limit) callback(new TooLargeError());
      else callback(null, chunk);
    },
  });
}

async function startsWith(filePath: string, signature: Buffer): Promise<boolean> {
  const file = await open(filePath, "r");
  try {
    const head = Buffer.alloc(signature.length);
    const { bytesRead } = await file.read(head, 0, signature.length, 0);
    return bytesRead === signature.length && head.equals(signature);
  } finally {
    await file.close();
  }
}

// Streams an upload to a temporary file, checks its size and type, then moves
// it to a new key of its own: into the bucket when one is configured, otherwise
// under storage/. The file is never held in memory. Callers check the extension
// first. On any failure nothing is left behind.
export async function saveProductUpload(
  productId: string,
  body: ReadableStream<Uint8Array>,
  originalName: string,
  limit: number,
): Promise<SaveResult> {
  const fileName = uploadFileName(originalName);
  const signature = SIGNATURES[path.posix.extname(fileName)];
  const token = randomBytes(8).toString("hex");
  const key = productFileKey(productId, token, fileName);
  const useBucket = bucketConfig() !== null;
  const tempPath = useBucket
    ? path.join(tmpdir(), `abody-upload-${token}.tmp`)
    : storagePath(STORAGE_ROOT, `${productUploadPrefix(productId)}upload-${token}.tmp`);
  const finalPath = useBucket ? null : storagePath(STORAGE_ROOT, key);
  if (!signature || !tempPath || !isSafeStorageKey(key) || (!useBucket && !finalPath)) {
    return { ok: false, error: "invalid_file_type" };
  }

  const counter = { bytes: 0 };
  try {
    await mkdir(path.dirname(tempPath), { recursive: true });
    await pipeline(
      Readable.fromWeb(body as WebReadableStream<Uint8Array>),
      byteLimit(limit, counter),
      createWriteStream(tempPath, { flags: "wx" }),
    );
    if (counter.bytes === 0) {
      await rm(tempPath, { force: true });
      return { ok: false, error: "empty_file" };
    }
    if (!(await startsWith(tempPath, signature))) {
      await rm(tempPath, { force: true });
      return { ok: false, error: "invalid_file_type" };
    }
    if (finalPath) {
      await mkdir(path.dirname(finalPath), { recursive: true });
      await rename(tempPath, finalPath);
    } else {
      await putObjectFromFile(key, tempPath, counter.bytes);
      await rm(tempPath, { force: true });
    }
    return { ok: true, key, fileName };
  } catch (error) {
    await rm(tempPath, { force: true });
    if (error instanceof TooLargeError) return { ok: false, error: "file_too_large" };
    throw error;
  }
}

// A replaced upload and its folder. Only this product's own uploads are
// removed; seed files and anything else are left alone.
export async function removeOwnUpload(
  productId: string,
  key: string | null,
): Promise<void> {
  if (key === null || !isOwnUploadKey(productId, key)) return;
  const folder = path.posix.dirname(key);
  if (bucketConfig()) {
    await deletePrefix(`${folder}/`);
    return;
  }
  const dir = storagePath(STORAGE_ROOT, folder);
  if (dir) await rm(dir, { recursive: true, force: true });
}

// Every file the admin uploaded for one product. Seed files live elsewhere.
export async function removeProductUploads(productId: string): Promise<void> {
  const prefix = productUploadPrefix(productId);
  if (bucketConfig()) {
    await deletePrefix(prefix);
    return;
  }
  const dir = storagePath(STORAGE_ROOT, prefix.slice(0, -1));
  if (dir) await rm(dir, { recursive: true, force: true });
}
