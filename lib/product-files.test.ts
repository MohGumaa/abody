import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { bucketConfig, deletePrefix, putObjectFromFile } = vi.hoisted(() => ({
  bucketConfig: vi.fn(),
  deletePrefix: vi.fn(),
  putObjectFromFile: vi.fn(),
}));

vi.mock("@/lib/object-storage", () => ({ bucketConfig, deletePrefix, putObjectFromFile }));
vi.mock("@/lib/downloads", async () => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  return { STORAGE_ROOT: mkdtempSync(join(tmpdir(), "abody-files-")) };
});

import { STORAGE_ROOT } from "@/lib/downloads";
import {
  removeOwnUpload,
  removeProductUploads,
  saveProductUpload,
} from "@/lib/product-files";

const PDF = Buffer.from("%PDF-1.7\nhello");
const LIMIT = 64;

function streamOf(bytes: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      if (bytes.length > 0) controller.enqueue(new Uint8Array(bytes));
      controller.close();
    },
  });
}

// Temp files this module writes to the OS temp folder in bucket mode.
function leftoverTempFiles(): string[] {
  return readdirSync(tmpdir()).filter((name) => /^abody-upload-[0-9a-f]{16}\.tmp$/.test(name));
}

function writeLocal(key: string) {
  const file = path.join(STORAGE_ROOT, key);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, PDF);
}

beforeEach(() => {
  rmSync(STORAGE_ROOT, { recursive: true, force: true });
  mkdirSync(STORAGE_ROOT, { recursive: true });
  bucketConfig.mockReset().mockReturnValue(null);
  deletePrefix.mockReset().mockResolvedValue(undefined);
  putObjectFromFile.mockReset().mockResolvedValue(undefined);
});

afterAll(() => {
  rmSync(STORAGE_ROOT, { recursive: true, force: true });
});

describe("with a bucket", () => {
  beforeEach(() => {
    bucketConfig.mockReturnValue({ bucket: "abody-files" });
  });

  it("uploads a checked file to its new key and removes the temp file", async () => {
    let uploaded: Buffer | null = null;
    putObjectFromFile.mockImplementation(async (_key, file: string) => {
      uploaded = readFileSync(file);
    });

    const result = await saveProductUpload("p1", streamOf(PDF), "Guide.pdf", LIMIT);

    expect(result).toMatchObject({ ok: true, fileName: "Guide.pdf" });
    const key = (result as { key: string }).key;
    expect(key).toMatch(/^products\/p1\/[0-9a-f]{16}\/Guide\.pdf$/);
    expect(putObjectFromFile).toHaveBeenCalledWith(key, expect.any(String), PDF.length);
    expect(uploaded).toEqual(PDF);
    expect(leftoverTempFiles()).toEqual([]);
    expect(readdirSync(STORAGE_ROOT)).toEqual([]);
  });

  it.each([
    ["file_too_large", Buffer.concat([PDF, Buffer.alloc(LIMIT)]), "a.pdf"],
    ["empty_file", Buffer.alloc(0), "a.pdf"],
    ["invalid_file_type", Buffer.from("not a pdf"), "a.pdf"],
    ["invalid_file_type", PDF, "a.zip"],
  ])("returns %s without writing an object", async (error, bytes, name) => {
    expect(await saveProductUpload("p1", streamOf(bytes), name, LIMIT)).toEqual({
      ok: false,
      error,
    });
    expect(putObjectFromFile).not.toHaveBeenCalled();
    expect(leftoverTempFiles()).toEqual([]);
  });

  it("removes the temp file when the bucket upload fails", async () => {
    const failure = new Error("network down");
    putObjectFromFile.mockRejectedValue(failure);

    await expect(saveProductUpload("p1", streamOf(PDF), "a.pdf", LIMIT)).rejects.toBe(failure);
    expect(leftoverTempFiles()).toEqual([]);
  });

  it("removes only the replaced upload's own folder", async () => {
    await removeOwnUpload("p1", "products/p1/abc123/old.pdf");
    expect(deletePrefix).toHaveBeenCalledWith("products/p1/abc123/");
  });

  it.each([
    ["a seed file", "seed/facebook-ads-guide.pdf"],
    ["another product's upload", "products/p2/abc123/old.pdf"],
    ["no file", null],
  ])("never removes %s", async (_, key) => {
    await removeOwnUpload("p1", key);
    expect(deletePrefix).not.toHaveBeenCalled();
  });

  it("removes every upload of one product", async () => {
    await removeProductUploads("p1");
    expect(deletePrefix).toHaveBeenCalledWith("products/p1/");
  });
});

describe("with local storage", () => {
  it("removes only one product's uploads", async () => {
    writeLocal("products/p1/abc/a.pdf");
    writeLocal("products/p2/def/b.pdf");
    writeLocal("seed/c.pdf");

    await removeProductUploads("p1");

    expect(existsSync(path.join(STORAGE_ROOT, "products", "p1"))).toBe(false);
    expect(existsSync(path.join(STORAGE_ROOT, "products", "p2", "def", "b.pdf"))).toBe(true);
    expect(existsSync(path.join(STORAGE_ROOT, "seed", "c.pdf"))).toBe(true);
    expect(deletePrefix).not.toHaveBeenCalled();
  });

  it("saves to storage/ without touching the bucket", async () => {
    const result = await saveProductUpload("p1", streamOf(PDF), "a.pdf", LIMIT);

    expect(result.ok).toBe(true);
    const key = (result as { key: string }).key;
    expect(readFileSync(path.join(STORAGE_ROOT, key))).toEqual(PDF);
    expect(putObjectFromFile).not.toHaveBeenCalled();
  });
});
