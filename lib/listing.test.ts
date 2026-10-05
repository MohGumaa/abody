import { describe, expect, it } from "vitest";
import {
  categoryHref,
  filterByCategory,
  parseCategoryParam,
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

describe("categoryHref", () => {
  it("returns the base path for All", () => {
    expect(categoryHref("/en/products", null)).toBe("/en/products");
  });

  it.each(["Guides", "Tips & Tricks", "Ads plus more", "قوالب"])(
    "round-trips %s through the query string",
    (category) => {
      const href = categoryHref("/ar/products", category);
      const url = new URL(href, "https://example.com");
      expect(url.pathname).toBe("/ar/products");
      expect(url.searchParams.get("category")).toBe(category);
    },
  );
});
