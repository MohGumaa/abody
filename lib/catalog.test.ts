import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, findFirst } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { product: { findMany, findFirst } },
}));

import {
  getPublishedProductBySlug,
  isProductType,
  listPublishedProducts,
  toPublicProduct,
} from "@/lib/catalog";

const row = {
  id: "p1",
  name: "Digital Marketing Template",
  slug: "digital-marketing-template",
  shortDescription: "Short",
  description: "Long",
  priceCents: 4900,
  type: "DIGITAL_PRODUCT" as const,
  category: "Templates",
  image: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T03:04:05.678Z"),
};

beforeEach(() => {
  findMany.mockReset();
  findFirst.mockReset();
});

describe("isProductType", () => {
  it("accepts the two product types", () => {
    expect(isProductType("DIGITAL_PRODUCT")).toBe(true);
    expect(isProductType("SERVICE")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isProductType("")).toBe(false);
    expect(isProductType("service")).toBe(false);
    expect(isProductType("nope")).toBe(false);
  });
});

describe("toPublicProduct", () => {
  it("passes cents through, adds USD, and formats dates as ISO strings", () => {
    expect(toPublicProduct(row)).toEqual({
      id: "p1",
      name: "Digital Marketing Template",
      slug: "digital-marketing-template",
      shortDescription: "Short",
      description: "Long",
      priceCents: 4900,
      currency: "USD",
      type: "DIGITAL_PRODUCT",
      category: "Templates",
      image: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T03:04:05.678Z",
    });
  });

  it("drops private fields even if a row carries them", () => {
    const leaky = { ...row, digitalFile: "private/key.pdf", status: "PUBLISHED" };
    const result = toPublicProduct(leaky);
    expect(result).not.toHaveProperty("digitalFile");
    expect(result).not.toHaveProperty("status");
  });
});

describe("listPublishedProducts", () => {
  it("queries published rows only, newest first, without private fields", async () => {
    findMany.mockResolvedValue([row]);

    const result = await listPublishedProducts();

    const query = findMany.mock.calls[0][0];
    expect(query.where).toEqual({ status: "PUBLISHED", type: undefined });
    expect(query.orderBy).toEqual([{ createdAt: "desc" }, { id: "asc" }]);
    expect(query.select).not.toHaveProperty("digitalFile");
    expect(query.select).not.toHaveProperty("status");
    expect(result).toHaveLength(1);
    expect(result[0].currency).toBe("USD");
  });

  it("filters by type when given", async () => {
    findMany.mockResolvedValue([]);

    expect(await listPublishedProducts({ type: "SERVICE" })).toEqual([]);
    expect(findMany.mock.calls[0][0].where).toEqual({
      status: "PUBLISHED",
      type: "SERVICE",
    });
  });
});

describe("getPublishedProductBySlug", () => {
  it("looks up a published row by slug without private fields", async () => {
    findFirst.mockResolvedValue(row);

    const result = await getPublishedProductBySlug("digital-marketing-template");

    const query = findFirst.mock.calls[0][0];
    expect(query.where).toEqual({
      slug: "digital-marketing-template",
      status: "PUBLISHED",
    });
    expect(query.select).not.toHaveProperty("digitalFile");
    expect(result?.slug).toBe("digital-marketing-template");
  });

  it("returns null when nothing matches", async () => {
    findFirst.mockResolvedValue(null);

    expect(await getPublishedProductBySlug("missing")).toBeNull();
  });
});
