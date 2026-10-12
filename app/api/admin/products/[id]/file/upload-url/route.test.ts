import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser, db, bucketConfig, startDirectUpload } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  db: { product: { findFirst: vi.fn() } },
  bucketConfig: vi.fn(),
  startDirectUpload: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/object-storage", () => ({ bucketConfig }));
vi.mock("@/lib/product-files", () => ({ startDirectUpload }));

import { POST } from "./route";

const admin = { id: "a1", role: "ADMIN" };
const KEY = "products/p1/0123456789abcdef/Guide.pdf";

function call(
  body: unknown,
  { id = "p1", headers = {} }: { id?: string; headers?: Record<string, string> } = {},
) {
  const request = new NextRequest(
    `http://localhost/api/admin/products/${id}/file/upload-url`,
    {
      method: "POST",
      headers: { host: "localhost", "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
  );
  return POST(request, { params: Promise.resolve({ id }) });
}

async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect((await response.json()).error.code).toBe(code);
}

const valid = { fileName: "Guide.pdf", size: 10 * 1024 * 1024 };

beforeEach(() => {
  getCurrentUser.mockReset().mockResolvedValue(admin);
  db.product.findFirst.mockReset().mockResolvedValue({ id: "p1" });
  bucketConfig.mockReset().mockReturnValue({ bucket: "abody-files" });
  startDirectUpload.mockReset().mockResolvedValue({
    ok: true,
    key: KEY,
    url: "https://bucket.example/signed",
    contentType: "application/pdf",
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/admin/products/[id]/file/upload-url", () => {
  it("returns a signed link for a digital product", async () => {
    const response = await call(valid);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      url: "https://bucket.example/signed",
      key: KEY,
      contentType: "application/pdf",
    });
    expect(startDirectUpload).toHaveBeenCalledWith(
      "p1",
      "Guide.pdf",
      valid.size,
      25 * 1024 * 1024,
    );
    expect(db.product.findFirst.mock.calls[0][0].where).toEqual({
      id: "p1",
      type: "DIGITAL_PRODUCT",
    });
  });

  it.each([null, { id: "c1", role: "CUSTOMER" }])(
    "returns 404 for a non-admin (%o)",
    async (user) => {
      getCurrentUser.mockResolvedValue(user);
      await expectError(await call(valid), 404, "not_found");
      expect(startDirectUpload).not.toHaveBeenCalled();
    },
  );

  it("rejects a cross-origin request", async () => {
    await expectError(
      await call(valid, { headers: { origin: "https://evil.example" } }),
      403,
      "forbidden",
    );
    expect(startDirectUpload).not.toHaveBeenCalled();
  });

  it("returns 409 without a bucket", async () => {
    bucketConfig.mockReturnValue(null);
    await expectError(await call(valid), 409, "direct_upload_unavailable");
    expect(startDirectUpload).not.toHaveBeenCalled();
  });

  it("returns 404 for a service or unknown product", async () => {
    db.product.findFirst.mockResolvedValue(null);
    await expectError(await call(valid, { id: "s1" }), 404, "not_found");
    expect(startDirectUpload).not.toHaveBeenCalled();
  });

  it.each([
    ["no body", ""],
    ["not JSON", "{"],
    ["an array", [valid]],
    ["no name", { size: 10 }],
    ["an empty name", { fileName: "", size: 10 }],
    ["a long name", { fileName: "a".repeat(252) + ".pdf", size: 10 }],
    ["a fractional size", { fileName: "a.pdf", size: 1.5 }],
    ["a text size", { fileName: "a.pdf", size: "10" }],
    ["a large body", { fileName: "a.pdf", size: 10, pad: "x".repeat(3000) }],
  ])("returns 400 for %s", async (_, body) => {
    await expectError(await call(body), 400, "invalid_request");
    expect(startDirectUpload).not.toHaveBeenCalled();
  });

  it.each([
    ["file_too_large", 413],
    ["empty_file", 400],
    ["invalid_file_type", 400],
  ])("passes on %s", async (error, status) => {
    startDirectUpload.mockResolvedValue({ ok: false, error });
    await expectError(await call(valid), status, error);
  });

  it("hides storage failures", async () => {
    startDirectUpload.mockRejectedValue(new Error("https://bucket.example/secret"));
    await expectError(await call(valid), 500, "internal_error");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "bucket.example",
    );
  });
});
