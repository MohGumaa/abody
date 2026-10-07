import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser, db } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  db: { product: { findFirst: vi.fn(), updateMany: vi.fn() } },
}));

vi.mock("@/lib/session", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/downloads", async () => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  return { STORAGE_ROOT: mkdtempSync(join(tmpdir(), "abody-upload-")) };
});

import { STORAGE_ROOT } from "@/lib/downloads";
import { PUT } from "./route";

const PDF = Buffer.from("%PDF-1.7\nhello");
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
const admin = { id: "a1", role: "ADMIN" };

function streamOf(chunks: Buffer[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk));
      controller.close();
    },
  });
}

function call(
  body: Buffer | ReadableStream<Uint8Array> | null,
  {
    id = "p1",
    name = "Facebook Ads Guide.pdf",
    headers = {},
  }: { id?: string; name?: string | null; headers?: Record<string, string> } = {},
) {
  const allHeaders: Record<string, string> = { host: "localhost", ...headers };
  if (name !== null) allHeaders["x-file-name"] = encodeURIComponent(name);
  if (Buffer.isBuffer(body) && !("content-length" in allHeaders)) {
    allHeaders["content-length"] = String(body.length);
  }
  const request = new NextRequest(`http://localhost/api/admin/products/${id}/file`, {
    method: "PUT",
    headers: allHeaders,
    body: Buffer.isBuffer(body) ? new Uint8Array(body) : body,
    // Needed by undici for a stream body.
    duplex: "half",
  } as ConstructorParameters<typeof NextRequest>[1]);
  return PUT(request, { params: Promise.resolve({ id }) });
}

async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect((await response.json()).error.code).toBe(code);
}

function productDir(id = "p1") {
  return path.join(STORAGE_ROOT, "products", id);
}

function storedKey(): string {
  return db.product.updateMany.mock.calls[0][0].data.digitalFile;
}

beforeEach(() => {
  rmSync(path.join(STORAGE_ROOT, "products"), { recursive: true, force: true });
  getCurrentUser.mockReset().mockResolvedValue(admin);
  db.product.findFirst.mockReset().mockResolvedValue({ digitalFile: null });
  db.product.updateMany.mockReset().mockResolvedValue({ count: 1 });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  rmSync(STORAGE_ROOT, { recursive: true, force: true });
});

describe("PUT /api/admin/products/[id]/file", () => {
  it("stores the file under a new key and points the product at it", async () => {
    const response = await call(PDF);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ fileName: "Facebook-Ads-Guide.pdf" });
    const key = storedKey();
    expect(key).toMatch(/^products\/p1\/[0-9a-f]{16}\/Facebook-Ads-Guide\.pdf$/);
    expect(readFileSync(path.join(STORAGE_ROOT, key))).toEqual(PDF);
    expect(db.product.updateMany.mock.calls[0][0].where).toEqual({
      id: "p1",
      type: "DIGITAL_PRODUCT",
    });
    // No temporary file is left behind.
    expect(readdirSync(productDir()).filter((entry) => entry.endsWith(".tmp"))).toEqual([]);
  });

  it("accepts a ZIP sent in chunks without a length", async () => {
    const response = await call(streamOf([ZIP.subarray(0, 2), ZIP.subarray(2)]), {
      name: "pack.ZIP",
    });
    expect(response.status).toBe(200);
    expect(readFileSync(path.join(STORAGE_ROOT, storedKey()))).toEqual(ZIP);
  });

  it("removes the replaced upload but keeps a seed file", async () => {
    const oldKey = "products/p1/0000000000000000/old.pdf";
    mkdirSync(path.join(STORAGE_ROOT, path.dirname(oldKey)), { recursive: true });
    writeFileSync(path.join(STORAGE_ROOT, oldKey), PDF);
    db.product.findFirst.mockResolvedValue({ digitalFile: oldKey });
    expect((await call(PDF)).status).toBe(200);
    expect(existsSync(path.join(STORAGE_ROOT, path.dirname(oldKey)))).toBe(false);

    const seedKey = "seed/keep.pdf";
    mkdirSync(path.join(STORAGE_ROOT, "seed"), { recursive: true });
    writeFileSync(path.join(STORAGE_ROOT, seedKey), PDF);
    db.product.findFirst.mockResolvedValue({ digitalFile: seedKey });
    expect((await call(PDF)).status).toBe(200);
    expect(existsSync(path.join(STORAGE_ROOT, seedKey))).toBe(true);
  });

  it.each([null, { id: "c1", role: "CUSTOMER" }])(
    "returns 404 for a non-admin (%o)",
    async (user) => {
      getCurrentUser.mockResolvedValue(user);
      await expectError(await call(PDF), 404, "not_found");
      expect(db.product.findFirst).not.toHaveBeenCalled();
    },
  );

  it("rejects a cross-origin upload", async () => {
    await expectError(
      await call(PDF, { headers: { origin: "https://evil.example" } }),
      403,
      "forbidden",
    );
    expect(db.product.findFirst).not.toHaveBeenCalled();
  });

  it("allows a same-origin upload", async () => {
    expect((await call(PDF, { headers: { origin: "http://localhost" } })).status).toBe(200);
  });

  it("returns 404 for a service or unknown product", async () => {
    db.product.findFirst.mockResolvedValue(null);
    await expectError(await call(PDF, { id: "s1" }), 404, "not_found");
    expect(existsSync(productDir("s1"))).toBe(false);
  });

  it.each([["guide.exe"], ["guide"], [null]])("rejects the name %s", async (name) => {
    await expectError(await call(PDF, { name }), 400, "invalid_file_type");
  });

  it("rejects content that does not match the extension", async () => {
    await expectError(await call(ZIP), 400, "invalid_file_type");
    expect(db.product.updateMany).not.toHaveBeenCalled();
    expect(readdirSync(productDir())).toEqual([]);
  });

  it("rejects an oversized length before reading", async () => {
    await expectError(
      await call(PDF, { headers: { "content-length": String(25 * 1024 * 1024 + 1) } }),
      413,
      "file_too_large",
    );
    expect(db.product.findFirst).not.toHaveBeenCalled();
  });

  it("stops a stream that passes the limit", async () => {
    const chunk = Buffer.alloc(1024 * 1024, 0x41);
    chunk.write("%PDF-");
    const chunks = Array.from({ length: 26 }, () => chunk);
    await expectError(await call(streamOf(chunks)), 413, "file_too_large");
    expect(db.product.updateMany).not.toHaveBeenCalled();
    expect(readdirSync(productDir())).toEqual([]);
  });

  it("rejects an empty file", async () => {
    await expectError(await call(Buffer.alloc(0)), 400, "empty_file");
    await expectError(await call(streamOf([])), 400, "empty_file");
  });

  it("cleans up the new file when the database update fails", async () => {
    db.product.updateMany.mockRejectedValue(new Error("down"));
    await expectError(await call(PDF), 500, "internal_error");
    expect(readdirSync(productDir())).toEqual([]);
  });

  it("cleans up when the product disappears mid-upload", async () => {
    db.product.updateMany.mockResolvedValue({ count: 0 });
    await expectError(await call(PDF), 404, "not_found");
    expect(readdirSync(productDir())).toEqual([]);
  });
});
