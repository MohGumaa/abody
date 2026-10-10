import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bucketConfig,
  deletePrefix,
  signedDownloadUrl,
  StorageConfigError,
} from "@/lib/object-storage";

const FULL = {
  S3_BUCKET: "abody-files",
  S3_REGION: "auto",
  S3_ENDPOINT: "https://account123.r2.cloudflarestorage.com",
  S3_ACCESS_KEY_ID: "AKIDEXAMPLE",
  S3_SECRET_ACCESS_KEY: "secret-value-123",
};

function setEnv(values: Partial<Record<keyof typeof FULL, string>>) {
  for (const name of Object.keys(FULL)) {
    vi.stubEnv(name, values[name as keyof typeof FULL] ?? "");
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("bucketConfig", () => {
  it("is null when no S3 variable is set", () => {
    setEnv({});
    expect(bucketConfig()).toBeNull();
  });

  it("reads a full configuration", () => {
    setEnv(FULL);
    expect(bucketConfig()).toEqual({
      bucket: "abody-files",
      region: "auto",
      endpoint: "https://account123.r2.cloudflarestorage.com",
      accessKeyId: "AKIDEXAMPLE",
      secretAccessKey: "secret-value-123",
    });
  });

  it("leaves the endpoint out for AWS", () => {
    setEnv({ ...FULL, S3_ENDPOINT: "", S3_REGION: "us-east-1" });
    expect(bucketConfig()?.endpoint).toBeUndefined();
  });

  it("throws on a partial setup, naming only missing variables", () => {
    setEnv({ S3_BUCKET: "abody-files", S3_SECRET_ACCESS_KEY: "secret-value-123" });
    let error: unknown;
    try {
      bucketConfig();
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(StorageConfigError);
    const message = (error as Error).message;
    expect(message).toContain("S3_REGION");
    expect(message).toContain("S3_ACCESS_KEY_ID");
    expect(message).not.toContain("secret-value-123");
    expect(message).not.toContain("abody-files");
  });

  it("treats an endpoint alone as a partial setup", () => {
    setEnv({ S3_ENDPOINT: FULL.S3_ENDPOINT });
    expect(() => bucketConfig()).toThrow(StorageConfigError);
  });
});

describe("with a bucket", () => {
  it("signs a short-lived download link that names the file", async () => {
    setEnv(FULL);
    const url = new URL(await signedDownloadUrl("seed/facebook-ads-guide.pdf"));

    expect(url.pathname).toContain("seed/facebook-ads-guide.pdf");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("response-content-disposition")).toBe(
      'attachment; filename="facebook-ads-guide.pdf"',
    );
    expect(url.searchParams.get("response-content-type")).toBe("application/pdf");
    expect(url.href).not.toContain("secret-value-123");
  });

  it.each(["../secret.pdf", "seed/a b.pdf", ""])(
    "refuses to sign the unsafe key %j",
    async (key) => {
      setEnv(FULL);
      await expect(signedDownloadUrl(key)).rejects.toThrow("Unsafe storage key");
    },
  );

  it.each(["products/p1", "products/../", "/", "seed//"])(
    "refuses to delete the unsafe prefix %j",
    async (prefix) => {
      setEnv(FULL);
      await expect(deletePrefix(prefix)).rejects.toThrow("Unsafe storage prefix");
    },
  );
});
