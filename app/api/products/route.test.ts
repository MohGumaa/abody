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
    expect(listPublishedProducts).toHaveBeenCalledWith({
      type: undefined,
      locale: "en",
    });
  });

  it("returns an empty list when there are none", async () => {
    listPublishedProducts.mockResolvedValue([]);

    expect(await (await GET(request())).json()).toEqual({ products: [] });
  });

  it("passes a valid type filter through", async () => {
    listPublishedProducts.mockResolvedValue([]);

    await GET(request("?type=SERVICE"));

    expect(listPublishedProducts).toHaveBeenCalledWith({
      type: "SERVICE",
      locale: "en",
    });
  });

  it("rejects an unknown type without querying", async () => {
    const response = await GET(request("?type=nope"));

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_type");
    expect(listPublishedProducts).not.toHaveBeenCalled();
  });

  it("passes a valid lang through, alone and with a type", async () => {
    listPublishedProducts.mockResolvedValue([]);

    await GET(request("?lang=ar"));
    await GET(request("?type=SERVICE&lang=ar"));
    await GET(request("?lang=en"));

    expect(listPublishedProducts.mock.calls).toEqual([
      [{ type: undefined, locale: "ar" }],
      [{ type: "SERVICE", locale: "ar" }],
      [{ type: undefined, locale: "en" }],
    ]);
  });

  it("rejects an unknown lang without querying", async () => {
    for (const query of ["?lang=fr", "?lang=AR", "?lang="]) {
      const response = await GET(request(query));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: { code: "invalid_lang", message: "lang must be en or ar." },
      });
    }
    expect(listPublishedProducts).not.toHaveBeenCalled();
  });

  it("reports the type first when both type and lang are invalid", async () => {
    const response = await GET(request("?type=nope&lang=fr"));

    expect((await response.json()).error.code).toBe("invalid_type");
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
