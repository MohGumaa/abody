import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser, db, bucketConfig, finishDirectUpload, removeOwnUpload } = vi.hoisted(
  () => ({
    getCurrentUser: vi.fn(),
    db: { product: { findFirst: vi.fn(), updateMany: vi.fn() } },
    bucketConfig: vi.fn(),
    finishDirectUpload: vi.fn(),
    removeOwnUpload: vi.fn(),
  }),
);

vi.mock("@/lib/session", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/object-storage", () => ({ bucketConfig }));
vi.mock("@/lib/product-files", () => ({ finishDirectUpload, removeOwnUpload }));

import { POST } from "./route";

const admin = { id: "a1", role: "ADMIN" };
const KEY = "products/p1/0123456789abcdef/Guide.pdf";
const OLD = "products/p1/fedcba9876543210/old.pdf";

function call(
  body: unknown,
  { id = "p1", headers = {} }: { id?: string; headers?: Record<string, string> } = {},
) {
  const request = new NextRequest(`http://localhost/api/admin/products/${id}/file/complete`, {
    method: "POST",
    headers: { host: "localhost", "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return POST(request, { params: Promise.resolve({ id }) });
}

async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect((await response.json()).error.code).toBe(code);
}

beforeEach(() => {
  getCurrentUser.mockReset().mockResolvedValue(admin);
  db.product.findFirst.mockReset().mockResolvedValue({ digitalFile: OLD });
  db.product.updateMany.mockReset().mockResolvedValue({ count: 1 });
  bucketConfig.mockReset().mockReturnValue({ bucket: "abody-files" });
  finishDirectUpload
    .mockReset()
    .mockResolvedValue({ ok: true, key: KEY, fileName: "Guide.pdf" });
  removeOwnUpload.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/admin/products/[id]/file/complete", () => {
  it("points the product at the checked file and removes the old one", async () => {
    const response = await call({ key: KEY });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ fileName: "Guide.pdf" });
    expect(finishDirectUpload).toHaveBeenCalledWith("p1", KEY, 25 * 1024 * 1024);
    expect(db.product.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", type: "DIGITAL_PRODUCT" },
      data: { digitalFile: KEY },
    });
    expect(removeOwnUpload).toHaveBeenCalledTimes(1);
    expect(removeOwnUpload).toHaveBeenCalledWith("p1", OLD);
  });

  it("succeeds when removing the old file fails", async () => {
    removeOwnUpload.mockRejectedValue(new Error("down"));
    expect((await call({ key: KEY })).status).toBe(200);
  });

  it("removes nothing when the product already uses the key", async () => {
    db.product.findFirst.mockResolvedValue({ digitalFile: KEY });
    const response = await call({ key: KEY });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ fileName: "Guide.pdf" });
    expect(finishDirectUpload).not.toHaveBeenCalled();
    expect(db.product.updateMany).not.toHaveBeenCalled();
    expect(removeOwnUpload).not.toHaveBeenCalled();
  });

  it.each([null, { id: "c1", role: "CUSTOMER" }])(
    "returns 404 for a non-admin (%o)",
    async (user) => {
      getCurrentUser.mockResolvedValue(user);
      await expectError(await call({ key: KEY }), 404, "not_found");
      expect(db.product.findFirst).not.toHaveBeenCalled();
      expect(removeOwnUpload).not.toHaveBeenCalled();
    },
  );

  it("rejects a cross-origin request", async () => {
    await expectError(
      await call({ key: KEY }, { headers: { origin: "https://evil.example" } }),
      403,
      "forbidden",
    );
    expect(db.product.findFirst).not.toHaveBeenCalled();
  });

  it("returns 409 without a bucket", async () => {
    bucketConfig.mockReturnValue(null);
    await expectError(await call({ key: KEY }), 409, "direct_upload_unavailable");
    expect(db.product.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ["no body", ""],
    ["no key", {}],
    ["another product's key", { key: "products/p2/0123456789abcdef/Guide.pdf" }],
    ["a seed key", { key: "seed/facebook-ads-guide.pdf" }],
    ["a traversal", { key: "products/p1/0123456789abcdef/../../seed/a.pdf" }],
  ])("returns 400 for %s and touches nothing", async (_, body) => {
    await expectError(await call(body), 400, "invalid_request");
    expect(db.product.findFirst).not.toHaveBeenCalled();
    expect(removeOwnUpload).not.toHaveBeenCalled();
  });

  it("removes the upload when the product is a service or gone", async () => {
    db.product.findFirst.mockResolvedValue(null);
    await expectError(await call({ key: KEY }), 404, "not_found");
    expect(removeOwnUpload).toHaveBeenCalledWith("p1", KEY);
  });

  it.each([
    ["file_too_large", 413],
    ["empty_file", 400],
    ["invalid_file_type", 400],
  ])("passes on %s without changing the product", async (error, status) => {
    finishDirectUpload.mockResolvedValue({ ok: false, error });
    await expectError(await call({ key: KEY }), status, error);
    expect(db.product.updateMany).not.toHaveBeenCalled();
    expect(removeOwnUpload).not.toHaveBeenCalled();
  });

  it("removes the upload when the product disappears mid-check", async () => {
    db.product.updateMany.mockResolvedValue({ count: 0 });
    await expectError(await call({ key: KEY }), 404, "not_found");
    expect(removeOwnUpload).toHaveBeenCalledWith("p1", KEY);
    expect(removeOwnUpload).not.toHaveBeenCalledWith("p1", OLD);
  });

  it("removes the upload when the database update fails", async () => {
    db.product.updateMany.mockRejectedValue(new Error("down"));
    await expectError(await call({ key: KEY }), 500, "internal_error");
    expect(removeOwnUpload).toHaveBeenCalledWith("p1", KEY);
    expect(removeOwnUpload).not.toHaveBeenCalledWith("p1", OLD);
  });

  it("never logs the key", async () => {
    finishDirectUpload.mockRejectedValue(new Error(`HEAD ${KEY} failed`));
    await expectError(await call({ key: KEY }), 500, "internal_error");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(KEY);
  });
});
