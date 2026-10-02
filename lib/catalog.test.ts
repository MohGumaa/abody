import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, findFirst } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { product: { findMany, findFirst } },
}));

import {
  formatDurationDays,
  getPublishedProductBySlug,
  isProductType,
  isValidSlug,
  listPublishedProducts,
  listRelatedProducts,
  productPath,
  publicImageSrc,
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
  included: ["One", "Two"],
  durationDays: 30,
  requirements: "Line one\nLine two",
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
      included: ["One", "Two"],
      durationDays: 30,
      requirements: "Line one\nLine two",
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

  it("returns null for a malformed slug without querying", async () => {
    expect(await getPublishedProductBySlug("Bad_Slug")).toBeNull();
    expect(await getPublishedProductBySlug("a\u0000b")).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
});

describe("isValidSlug", () => {
  it("accepts lowercase letters, digits, and single hyphens", () => {
    expect(isValidSlug("ads-management")).toBe(true);
    expect(isValidSlug("guide2")).toBe(true);
  });

  it("rejects everything else", () => {
    for (const slug of [
      "",
      "Ads",
      "ads_management",
      "-ads",
      "ads-",
      "ads--management",
      "ads\u0000",
      "ads/management",
    ]) {
      expect(isValidSlug(slug)).toBe(false);
    }
  });
});

describe("productPath", () => {
  it("routes each type to its own section", () => {
    expect(productPath({ type: "DIGITAL_PRODUCT", slug: "guide" })).toBe(
      "/products/guide",
    );
    expect(productPath({ type: "SERVICE", slug: "ads" })).toBe("/services/ads");
  });
});

describe("publicImageSrc", () => {
  it("keeps root-relative paths and https URLs", () => {
    expect(publicImageSrc("/seed/a.svg")).toBe("/seed/a.svg");
    expect(publicImageSrc("https://cdn.example.com/a.png")).toBe(
      "https://cdn.example.com/a.png",
    );
  });

  it("returns null for anything else", () => {
    for (const image of [
      null,
      "",
      "//evil.example.com/a.png",
      "/\\evil.example.com/a.png",
      "http://example.com/a.png",
      "https://",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "seed/a.png",
    ]) {
      expect(publicImageSrc(image)).toBeNull();
    }
  });
});

describe("formatDurationDays", () => {
  it("uses the singular for one day in English", () => {
    expect(formatDurationDays(1, "en")).toBe("1 day");
    expect(formatDurationDays(30, "en")).toBe("30 days");
  });

  // The exact Arabic wording comes from the runtime, so it is not asserted.
  it("uses Arabic words with Latin digits in Arabic", () => {
    const result = formatDurationDays(30, "ar");
    expect(result).toMatch(/[ء-ي]/);
    expect(result).toContain("30");
    expect(result).not.toMatch(/[٠-٩]/);
  });
});

describe("listRelatedProducts", () => {
  const current = { id: "p1", type: "DIGITAL_PRODUCT" as const, category: "Templates" };

  it("fills from other categories after the same category", async () => {
    findMany
      .mockResolvedValueOnce([{ ...row, id: "p2" }])
      .mockResolvedValueOnce([{ ...row, id: "p3", category: "Guides" }]);

    const result = await listRelatedProducts(current);

    expect(result.map((product) => product.id)).toEqual(["p2", "p3"]);
    const [same, other] = findMany.mock.calls.map(([query]) => query);
    expect(same.where).toEqual({
      status: "PUBLISHED",
      type: "DIGITAL_PRODUCT",
      id: { not: "p1" },
      category: "Templates",
    });
    expect(same.take).toBe(3);
    expect(other.where).toEqual({
      status: "PUBLISHED",
      type: "DIGITAL_PRODUCT",
      id: { not: "p1" },
      category: { not: "Templates" },
    });
    expect(other.take).toBe(2);
    for (const query of [same, other]) {
      expect(query.orderBy).toEqual([{ createdAt: "desc" }, { id: "asc" }]);
      expect(query.select).not.toHaveProperty("digitalFile");
      expect(query.select).not.toHaveProperty("status");
    }
  });

  it("stops at three items from the same category", async () => {
    findMany.mockResolvedValueOnce([
      { ...row, id: "p2" },
      { ...row, id: "p3" },
      { ...row, id: "p4" },
    ]);

    expect(await listRelatedProducts(current)).toHaveLength(3);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("returns an empty list when nothing else is published", async () => {
    findMany.mockResolvedValue([]);

    expect(await listRelatedProducts(current)).toEqual([]);
  });
});
