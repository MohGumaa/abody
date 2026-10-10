import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  canDownload,
  contentDisposition,
  contentTypeFor,
  isSafeStorageKey,
  storagePath,
} from "@/lib/delivery";

const ROOT = path.resolve("storage-root");

describe("canDownload", () => {
  it.each(["PAID", "PROCESSING", "COMPLETED"] as const)(
    "allows %s",
    (status) => {
      expect(canDownload(status)).toBe(true);
    },
  );

  it.each(["PENDING", "CANCELLED", "REFUNDED"] as const)(
    "denies %s",
    (status) => {
      expect(canDownload(status)).toBe(false);
    },
  );
});

describe("storagePath", () => {
  it("resolves a key under the root", () => {
    expect(storagePath(ROOT, "seed/a.pdf")).toBe(
      path.join(ROOT, "seed", "a.pdf"),
    );
  });

  it("accepts nested folders and a top-level file", () => {
    expect(storagePath(ROOT, "a/b/c_d-1.v2.zip")).toBe(
      path.join(ROOT, "a", "b", "c_d-1.v2.zip"),
    );
    expect(storagePath(ROOT, "file.pdf")).toBe(path.join(ROOT, "file.pdf"));
  });

  it.each([
    ["empty", ""],
    ["too long", `${"a".repeat(252)}.pdf`],
    ["absolute", "/etc/passwd"],
    ["parent segment", "../secret.pdf"],
    ["nested parent", "seed/../../secret.pdf"],
    ["current segment", "./a.pdf"],
    ["dot-led segment", "seed/.hidden"],
    ["backslash", "seed\\a.pdf"],
    ["drive letter", "C:/a.pdf"],
    ["empty segment", "seed//a.pdf"],
    ["trailing slash", "seed/"],
    ["space", "seed/a b.pdf"],
    ["control character", "seed/a\n.pdf"],
    ["null byte", "seed/a\0.pdf"],
    ["quote", 'seed/a".pdf'],
  ])("rejects a %s key", (_, key) => {
    expect(storagePath(ROOT, key)).toBeNull();
    expect(isSafeStorageKey(key)).toBe(false);
  });

  it("shares its key rule with isSafeStorageKey", () => {
    expect(isSafeStorageKey("seed/a.pdf")).toBe(true);
    expect(isSafeStorageKey("products/p1/abc/a.zip")).toBe(true);
  });

  it("accepts a key of exactly 255 characters", () => {
    expect(storagePath(ROOT, `${"a".repeat(251)}.pdf`)).not.toBeNull();
  });
});

describe("contentTypeFor", () => {
  it.each([
    ["seed/a.pdf", "application/pdf"],
    ["seed/A.PDF", "application/pdf"],
    ["seed/a.zip", "application/zip"],
    ["seed/a.Zip", "application/zip"],
    ["seed/a.docx", "application/octet-stream"],
    ["seed/no-extension", "application/octet-stream"],
  ])("maps %s to %s", (key, type) => {
    expect(contentTypeFor(key)).toBe(type);
  });
});

describe("contentDisposition", () => {
  it("names the attachment after the key's last segment", () => {
    expect(contentDisposition("seed/facebook-ads-guide.pdf")).toBe(
      'attachment; filename="facebook-ads-guide.pdf"',
    );
    expect(contentDisposition("file.zip")).toBe(
      'attachment; filename="file.zip"',
    );
  });
});
