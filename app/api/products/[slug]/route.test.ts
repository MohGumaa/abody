import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPublishedProductBySlug } = vi.hoisted(() => ({
  getPublishedProductBySlug: vi.fn(),
}));

vi.mock("@/lib/catalog", () => ({ getPublishedProductBySlug }));

import { GET } from "./route";

function call(slug: string) {
  return GET(new NextRequest(`http://localhost/api/products/${slug}`), {
    params: Promise.resolve({ slug }),
  });
}

beforeEach(() => {
  getPublishedProductBySlug.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/products/[slug]", () => {
  it("returns the product", async () => {
    getPublishedProductBySlug.mockResolvedValue({ slug: "ads-management" });

    const response = await call("ads-management");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      product: { slug: "ads-management" },
    });
    expect(getPublishedProductBySlug).toHaveBeenCalledWith("ads-management");
  });

  it("returns 404 when the product is missing or unpublished", async () => {
    getPublishedProductBySlug.mockResolvedValue(null);

    const response = await call("missing");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "not_found", message: "Product not found." },
    });
  });

  it("hides failure details behind a generic 500", async () => {
    getPublishedProductBySlug.mockRejectedValue(new Error("secret detail"));

    const response = await call("ads-management");
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toContain("secret");
    expect(JSON.parse(text).error.code).toBe("internal_error");
  });
});
