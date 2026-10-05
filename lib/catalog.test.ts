import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, findFirst } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { product: { findMany, findFirst } },
}));

import {
  checklistLines,
  formatDurationDays,
  getPublishedProductBySlug,
  isProductType,
  isValidSlug,
  listCartSuggestions,
  listPublishedProducts,
  listPublishedProductsByIds,
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
  nameAr: null as string | null,
  categoryAr: null as string | null,
  shortDescriptionAr: null as string | null,
  descriptionAr: null as string | null,
  includedAr: [] as string[],
  requirementsAr: null as string | null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T03:04:05.678Z"),
};

const arabic = {
  nameAr: "قالب التسويق الرقمي",
  categoryAr: "قوالب",
  shortDescriptionAr: "قصير",
  descriptionAr: "طويل",
  includedAr: ["واحد", "اثنان"],
  requirementsAr: "السطر الأول\nالسطر الثاني",
};

const ARABIC_KEYS = Object.keys(arabic);

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
    expect(toPublicProduct(row, "en")).toEqual({
      id: "p1",
      name: "Digital Marketing Template",
      slug: "digital-marketing-template",
      shortDescription: "Short",
      description: "Long",
      priceCents: 4900,
      currency: "USD",
      type: "DIGITAL_PRODUCT",
      category: "Templates",
      categoryLabel: "Templates",
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
    const result = toPublicProduct(leaky, "en");
    expect(result).not.toHaveProperty("digitalFile");
    expect(result).not.toHaveProperty("status");
  });

  it("ignores Arabic content in English", () => {
    const result = toPublicProduct({ ...row, ...arabic }, "en");
    expect(result.name).toBe("Digital Marketing Template");
    expect(result.shortDescription).toBe("Short");
    expect(result.description).toBe("Long");
    expect(result.included).toEqual(["One", "Two"]);
    expect(result.requirements).toBe("Line one\nLine two");
    expect(result.categoryLabel).toBe("Templates");
  });

  it("returns Arabic content in Arabic under the same field names", () => {
    const result = toPublicProduct({ ...row, ...arabic }, "ar");
    expect(result.name).toBe(arabic.nameAr);
    expect(result.shortDescription).toBe(arabic.shortDescriptionAr);
    expect(result.description).toBe(arabic.descriptionAr);
    expect(result.included).toEqual(arabic.includedAr);
    expect(result.requirements).toBe(arabic.requirementsAr);
    expect(result.category).toBe("Templates");
    expect(result.categoryLabel).toBe(arabic.categoryAr);
  });

  it("falls back to English per field when Arabic text is missing or blank", () => {
    for (const blank of [null, "", "  \n "]) {
      const result = toPublicProduct(
        {
          ...row,
          ...arabic,
          categoryAr: blank,
          shortDescriptionAr: blank,
          requirementsAr: blank,
        },
        "ar",
      );
      expect(result.name).toBe(arabic.nameAr);
      expect(result.categoryLabel).toBe("Templates");
      expect(result.shortDescription).toBe("Short");
      expect(result.description).toBe(arabic.descriptionAr);
      expect(result.requirements).toBe("Line one\nLine two");
    }
  });

  it("falls back to the English list when no Arabic line has text", () => {
    for (const includedAr of [[], ["", "  "]]) {
      const result = toPublicProduct({ ...row, ...arabic, includedAr }, "ar");
      expect(result.included).toEqual(["One", "Two"]);
    }
  });

  it("keeps requirements null when neither language has them", () => {
    const result = toPublicProduct({ ...row, requirements: null }, "ar");
    expect(result.requirements).toBeNull();
  });

  it("never exposes the Arabic columns as their own keys", () => {
    for (const locale of ["en", "ar"] as const) {
      const result = toPublicProduct({ ...row, ...arabic }, locale);
      for (const key of ARABIC_KEYS) {
        expect(result).not.toHaveProperty(key);
      }
    }
  });
});

describe("listPublishedProducts", () => {
  it("queries published rows only, newest first, without private fields", async () => {
    findMany.mockResolvedValue([row]);

    const result = await listPublishedProducts({ locale: "en" });

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

    expect(
      await listPublishedProducts({ type: "SERVICE", locale: "en" }),
    ).toEqual([]);
    expect(findMany.mock.calls[0][0].where).toEqual({
      status: "PUBLISHED",
      type: "SERVICE",
    });
  });

  it("returns content in the requested language", async () => {
    findMany.mockResolvedValue([{ ...row, ...arabic }]);

    const [product] = await listPublishedProducts({ locale: "ar" });

    expect(product.name).toBe(arabic.nameAr);
  });
});

describe("listPublishedProductsByIds", () => {
  it("returns an empty list without querying when there are no ids", async () => {
    expect(await listPublishedProductsByIds([], "en")).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("queries published rows with the given ids, without private fields", async () => {
    findMany.mockResolvedValue([row]);

    const result = await listPublishedProductsByIds(["p1", "p2"], "en");

    const query = findMany.mock.calls[0][0];
    expect(query.where).toEqual({
      status: "PUBLISHED",
      id: { in: ["p1", "p2"] },
    });
    expect(query.select).not.toHaveProperty("digitalFile");
    expect(result.map((product) => product.id)).toEqual(["p1"]);
  });

  it("returns content in the requested language", async () => {
    findMany.mockResolvedValue([{ ...row, ...arabic }]);

    const [product] = await listPublishedProductsByIds(["p1"], "ar");

    expect(product.name).toBe(arabic.nameAr);
  });
});

describe("getPublishedProductBySlug", () => {
  it("looks up a published row by slug without private fields", async () => {
    findFirst.mockResolvedValue(row);

    const result = await getPublishedProductBySlug(
      "digital-marketing-template",
      "en",
    );

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

    expect(await getPublishedProductBySlug("missing", "en")).toBeNull();
  });

  it("returns null for a malformed slug without querying", async () => {
    expect(await getPublishedProductBySlug("Bad_Slug", "en")).toBeNull();
    expect(await getPublishedProductBySlug("a\u0000b", "ar")).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("returns content in the requested language", async () => {
    findFirst.mockResolvedValue({ ...row, ...arabic });

    const result = await getPublishedProductBySlug(
      "digital-marketing-template",
      "ar",
    );

    expect(result?.name).toBe(arabic.nameAr);
    expect(result?.slug).toBe("digital-marketing-template");
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

describe("checklistLines", () => {
  it("returns no lines for missing or blank text", () => {
    expect(checklistLines(null)).toEqual([]);
    expect(checklistLines("")).toEqual([]);
    expect(checklistLines("  \n\t\n ")).toEqual([]);
  });

  it("splits on LF and CRLF, trimming and dropping blank lines", () => {
    expect(checklistLines(" One \r\n\r\nTwo\n  Three  \n")).toEqual([
      "One",
      "Two",
      "Three",
    ]);
  });

  it("keeps each seeded requirement as one line", () => {
    expect(
      checklistLines(
        "Business name and website\nAccess to your advertising account\nCampaign goals and monthly budget",
      ),
    ).toEqual([
      "Business name and website",
      "Access to your advertising account",
      "Campaign goals and monthly budget",
    ]);
  });
});

describe("listCartSuggestions", () => {
  it("queries the newest published items not in the cart, without private fields", async () => {
    findMany.mockResolvedValue([{ ...row, id: "p3" }]);

    const result = await listCartSuggestions(["p1", "p2"], "en");

    const query = findMany.mock.calls[0][0];
    expect(query.where).toEqual({
      status: "PUBLISHED",
      id: { notIn: ["p1", "p2"] },
    });
    expect(query.orderBy).toEqual([{ createdAt: "desc" }, { id: "asc" }]);
    expect(query.take).toBe(4);
    expect(query.select).not.toHaveProperty("digitalFile");
    expect(query.select).not.toHaveProperty("status");
    expect(result.map((product) => product.id)).toEqual(["p3"]);
  });

  it("returns content in the requested language", async () => {
    findMany.mockResolvedValue([{ ...row, ...arabic }]);

    const [product] = await listCartSuggestions(["p9"], "ar");

    expect(product.name).toBe(arabic.nameAr);
  });
});

describe("listRelatedProducts", () => {
  const current = { id: "p1", type: "DIGITAL_PRODUCT" as const, category: "Templates" };

  it("fills from other categories after the same category", async () => {
    findMany
      .mockResolvedValueOnce([{ ...row, id: "p2" }])
      .mockResolvedValueOnce([{ ...row, id: "p3", category: "Guides" }]);

    const result = await listRelatedProducts(current, "en");

    expect(result.map((product) => product.id)).toEqual(["p2", "p3"]);
    const [same, other] = findMany.mock.calls.map(([query]) => query);
    expect(same.where).toEqual({
      status: "PUBLISHED",
      type: "DIGITAL_PRODUCT",
      id: { not: "p1" },
      category: "Templates",
    });
    expect(same.take).toBe(4);
    expect(other.where).toEqual({
      status: "PUBLISHED",
      type: "DIGITAL_PRODUCT",
      id: { not: "p1" },
      category: { not: "Templates" },
    });
    expect(other.take).toBe(3);
    for (const query of [same, other]) {
      expect(query.orderBy).toEqual([{ createdAt: "desc" }, { id: "asc" }]);
      expect(query.select).not.toHaveProperty("digitalFile");
      expect(query.select).not.toHaveProperty("status");
    }
  });

  it("stops at four items from the same category", async () => {
    findMany.mockResolvedValueOnce([
      { ...row, id: "p2" },
      { ...row, id: "p3" },
      { ...row, id: "p4" },
      { ...row, id: "p5" },
    ]);

    expect(await listRelatedProducts(current, "en")).toHaveLength(4);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("returns an empty list when nothing else is published", async () => {
    findMany.mockResolvedValue([]);

    expect(await listRelatedProducts(current, "en")).toEqual([]);
  });

  it("matches the same category in Arabic and returns Arabic content", async () => {
    findMany
      .mockResolvedValueOnce([{ ...row, ...arabic, id: "p2" }])
      .mockResolvedValueOnce([]);

    const result = await listRelatedProducts(current, "ar");

    expect(findMany.mock.calls[0][0].where.category).toBe("Templates");
    expect(result[0].name).toBe(arabic.nameAr);
  });
});
