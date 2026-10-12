import { describe, expect, it } from "vitest";
import {
  filterByCategory,
  listingHref,
  matchesSearch,
  parseCategoryParam,
  parseSearchParam,
  parseSortParam,
  SEARCH_MAX_LENGTH,
  sortProducts,
  summarizeCategories,
} from "@/lib/listing";

const products = [
  { id: "a", category: "Templates", categoryLabel: "قوالب" },
  { id: "b", category: "Guides", categoryLabel: "أدلة" },
  { id: "c", category: "Templates", categoryLabel: "قوالب قديمة" },
  { id: "d", category: "Marketing Resources", categoryLabel: "موارد تسويقية" },
];

describe("parseCategoryParam", () => {
  it("returns a single non-empty value", () => {
    expect(parseCategoryParam("Guides")).toBe("Guides");
  });

  it("treats missing, empty, and repeated values as All", () => {
    expect(parseCategoryParam(undefined)).toBeNull();
    expect(parseCategoryParam("")).toBeNull();
    expect(parseCategoryParam(["Guides", "Templates"])).toBeNull();
  });
});

describe("summarizeCategories", () => {
  it("counts each category, sorts by key, and labels it from the first item", () => {
    expect(summarizeCategories(products)).toEqual([
      { category: "Guides", label: "أدلة", count: 1 },
      { category: "Marketing Resources", label: "موارد تسويقية", count: 1 },
      { category: "Templates", label: "قوالب", count: 2 },
    ]);
  });

  it("returns nothing for an empty list", () => {
    expect(summarizeCategories([])).toEqual([]);
  });
});

describe("filterByCategory", () => {
  it("returns every product for All", () => {
    expect(filterByCategory(products, null)).toBe(products);
  });

  it("keeps only the matching category, in order", () => {
    expect(filterByCategory(products, "Templates").map((p) => p.id)).toEqual([
      "a",
      "c",
    ]);
  });

  it("returns an empty list for an unknown category", () => {
    expect(filterByCategory(products, "Nope")).toEqual([]);
  });
});

describe("parseSearchParam", () => {
  it("trims and collapses whitespace", () => {
    expect(parseSearchParam("  facebook \t  ads\n")).toBe("facebook ads");
  });

  it("treats missing, empty, blank, and repeated values as no search", () => {
    expect(parseSearchParam(undefined)).toBeNull();
    expect(parseSearchParam("")).toBeNull();
    expect(parseSearchParam("   ")).toBeNull();
    expect(parseSearchParam(["ads", "guide"])).toBeNull();
  });

  it("cuts long queries to the maximum length", () => {
    expect(parseSearchParam("a".repeat(150))).toBe("a".repeat(SEARCH_MAX_LENGTH));
  });

  it("keeps Arabic text", () => {
    expect(parseSearchParam(" قوالب ")).toBe("قوالب");
  });
});

describe("parseSortParam", () => {
  it("accepts the price sorts", () => {
    expect(parseSortParam("price-asc")).toBe("price-asc");
    expect(parseSortParam("price-desc")).toBe("price-desc");
  });

  it("falls back to newest for anything else", () => {
    expect(parseSortParam(undefined)).toBe("newest");
    expect(parseSortParam("")).toBe("newest");
    expect(parseSortParam("newest")).toBe("newest");
    expect(parseSortParam("PRICE-ASC")).toBe("newest");
    expect(parseSortParam(["price-asc", "price-desc"])).toBe("newest");
  });
});

describe("matchesSearch", () => {
  const fields = [
    "Facebook Ads Guide",
    "دليل إعلانات فيسبوك",
    "A step-by-step guide.",
    null,
    "Guides",
    "أدلة",
  ];

  it("matches a single term case-insensitively", () => {
    expect(matchesSearch(fields, "FACEBOOK")).toBe(true);
  });

  it("requires every term, which may sit in different fields", () => {
    expect(matchesSearch(fields, "facebook step")).toBe(true);
    expect(matchesSearch(fields, "facebook template")).toBe(false);
  });

  it("matches Arabic text", () => {
    expect(matchesSearch(fields, "إعلانات")).toBe(true);
    expect(matchesSearch(fields, "أدلة")).toBe(true);
  });

  it("treats query characters literally", () => {
    expect(matchesSearch(fields, ".*")).toBe(false);
    expect(matchesSearch(fields, "step-by-step")).toBe(true);
  });

  it("skips null fields", () => {
    expect(matchesSearch([null, null], "null")).toBe(false);
  });
});

describe("sortProducts", () => {
  const items = [
    { id: "new", priceCents: 2900 },
    { id: "mid", priceCents: 4900 },
    { id: "old", priceCents: 2900 },
    { id: "oldest", priceCents: 1900 },
  ];

  it("keeps the incoming newest-first order for newest", () => {
    const sorted = sortProducts(items, "newest");
    expect(sorted).toEqual(items);
    expect(sorted).not.toBe(items);
  });

  it("sorts by price low to high, newest first on ties", () => {
    expect(sortProducts(items, "price-asc").map((p) => p.id)).toEqual([
      "oldest",
      "new",
      "old",
      "mid",
    ]);
  });

  it("sorts by price high to low, newest first on ties", () => {
    expect(sortProducts(items, "price-desc").map((p) => p.id)).toEqual([
      "mid",
      "new",
      "old",
      "oldest",
    ]);
  });

  it("does not mutate the input", () => {
    const copy = [...items];
    sortProducts(items, "price-desc");
    expect(items).toEqual(copy);
  });
});

describe("listingHref", () => {
  const none = { category: null, q: null, sort: "newest" as const };

  it("returns the base path when nothing is set", () => {
    expect(listingHref("/en/products", none)).toBe("/en/products");
  });

  it("leaves out defaults and keeps a fixed parameter order", () => {
    expect(listingHref("/en/products", { ...none, sort: "price-asc" })).toBe(
      "/en/products?sort=price-asc",
    );
    expect(
      listingHref("/en/products", {
        sort: "price-desc",
        q: "ads",
        category: "Guides",
      }),
    ).toBe("/en/products?category=Guides&q=ads&sort=price-desc");
  });

  it.each(["Guides", "Tips & Tricks", "Ads plus more", "قوالب"])(
    "round-trips %s through the query string",
    (value) => {
      const href = listingHref("/ar/products", {
        category: value,
        q: value,
        sort: "newest",
      });
      const url = new URL(href, "https://example.com");
      expect(url.pathname).toBe("/ar/products");
      expect(url.searchParams.get("category")).toBe(value);
      expect(url.searchParams.get("q")).toBe(value);
      expect(url.searchParams.has("sort")).toBe(false);
    },
  );
});
