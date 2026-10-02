import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listPublishedProducts } = vi.hoisted(() => ({
  listPublishedProducts: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/catalog")>()),
  listPublishedProducts,
}));

import { GET } from "./route";

function request(query = "") {
  return new NextRequest(`http://localhost/api/products${query}`);
}

beforeEach(() => {
  listPublishedProducts.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/products", () => {
  it("returns published products", async () => {
    listPublishedProducts.mockResolvedValue([{ slug: "a" }]);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ products: [{ slug: "a" }] });
    expect(listPublishedProducts).toHaveBeenCalledWith({ type: undefined });
  });

  it("returns an empty list when there are none", async () => {
    listPublishedProducts.mockResolvedValue([]);

    expect(await (await GET(request())).json()).toEqual({ products: [] });
  });

  it("passes a valid type filter through", async () => {
    listPublishedProducts.mockResolvedValue([]);

    await GET(request("?type=SERVICE"));

    expect(listPublishedProducts).toHaveBeenCalledWith({ type: "SERVICE" });
  });

  it("rejects an unknown type without querying", async () => {
    const response = await GET(request("?type=nope"));

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_type");
    expect(listPublishedProducts).not.toHaveBeenCalled();
  });

  it("hides failure details behind a generic 500", async () => {
    listPublishedProducts.mockRejectedValue(
      new Error("connect failed postgresql://user:secret@host/db"),
    );

    const response = await GET(request());
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(text)).toEqual({
      error: { code: "internal_error", message: "Something went wrong." },
    });
    expect(text).not.toContain("secret");
  });
});
