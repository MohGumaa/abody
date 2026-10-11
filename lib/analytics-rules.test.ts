import { describe, expect, it } from "vitest";
import {
  conversionRate,
  parseRangeDays,
  parseTrackedPath,
  type PopularProduct,
  rangeStart,
  rankPopularProducts,
} from "@/lib/analytics-rules";

describe("parseTrackedPath", () => {
  it("accepts a language home page", () => {
    expect(parseTrackedPath("/en")).toEqual({ path: "/en", locale: "en", detail: null });
    expect(parseTrackedPath("/ar")).toEqual({ path: "/ar", locale: "ar", detail: null });
  });

  it("accepts a listing and a nested account page", () => {
    expect(parseTrackedPath("/ar/services")?.detail).toBeNull();
    expect(parseTrackedPath("/en/account/services/cm1abc_9")?.path).toBe(
      "/en/account/services/cm1abc_9",
    );
  });

  it("finds product and service detail pages", () => {
    expect(parseTrackedPath("/en/products/seo-guide")?.detail).toEqual({
      type: "DIGITAL_PRODUCT",
      slug: "seo-guide",
    });
    expect(parseTrackedPath("/ar/services/ads-management")?.detail).toEqual({
      type: "SERVICE",
      slug: "ads-management",
    });
  });

  it("does not treat deeper or other sections as detail pages", () => {
    expect(parseTrackedPath("/en/products/a/b")?.detail).toBeNull();
    expect(parseTrackedPath("/en/account/orders")?.detail).toBeNull();
  });

  it("rejects paths without a supported language", () => {
    expect(parseTrackedPath("/")).toBeNull();
    expect(parseTrackedPath("/products")).toBeNull();
    expect(parseTrackedPath("/fr/products")).toBeNull();
    expect(parseTrackedPath("/admin")).toBeNull();
    expect(parseTrackedPath("/english")).toBeNull();
  });

  it("rejects queries, hashes, trailing slashes, files, and encoded text", () => {
    expect(parseTrackedPath("/en/success?session_id=x")).toBeNull();
    expect(parseTrackedPath("/en#top")).toBeNull();
    expect(parseTrackedPath("/en/")).toBeNull();
    expect(parseTrackedPath("/en/og.png")).toBeNull();
    expect(parseTrackedPath("/en/%3Cb%3E")).toBeNull();
    expect(parseTrackedPath("/en/<b>")).toBeNull();
    expect(parseTrackedPath("/en//products")).toBeNull();
  });

  it("rejects too many segments and overlong paths", () => {
    expect(parseTrackedPath("/en/a/b/c/d/e/f")).not.toBeNull();
    expect(parseTrackedPath("/en/a/b/c/d/e/f/g")).toBeNull();
    expect(parseTrackedPath(`/en/${"a".repeat(101)}`)).toBeNull();
    expect(parseTrackedPath(`/en/${"a".repeat(100)}/${"b".repeat(100)}`)).toBeNull();
  });

  it("rejects values that are not strings", () => {
    expect(parseTrackedPath(undefined)).toBeNull();
    expect(parseTrackedPath(null)).toBeNull();
    expect(parseTrackedPath(42)).toBeNull();
    expect(parseTrackedPath(["/en"])).toBeNull();
  });
});

describe("parseRangeDays", () => {
  it("accepts 7, 30, and 90", () => {
    expect(parseRangeDays("7")).toBe(7);
    expect(parseRangeDays("30")).toBe(30);
    expect(parseRangeDays("90")).toBe(90);
  });

  it("falls back to 30 for anything else", () => {
    expect(parseRangeDays(undefined)).toBe(30);
    expect(parseRangeDays("")).toBe(30);
    expect(parseRangeDays("14")).toBe(30);
    expect(parseRangeDays("7days")).toBe(30);
    expect(parseRangeDays(["7"])).toBe(30);
    expect(parseRangeDays(7)).toBe(30);
  });
});

describe("rangeStart", () => {
  it("starts at 00:00 UTC on the first day of the period", () => {
    const now = new Date("2026-10-11T23:59:00Z");
    expect(rangeStart(7, now)).toEqual(new Date("2026-10-05T00:00:00Z"));
    expect(rangeStart(30, now)).toEqual(new Date("2026-09-12T00:00:00Z"));
    expect(rangeStart(90, now)).toEqual(new Date("2026-07-14T00:00:00Z"));
  });

  it("uses the UTC day, not the local one", () => {
    expect(rangeStart(7, new Date("2026-10-11T00:00:00Z"))).toEqual(
      new Date("2026-10-05T00:00:00Z"),
    );
    expect(rangeStart(7, new Date("2026-03-01T01:00:00Z"))).toEqual(
      new Date("2026-02-23T00:00:00Z"),
    );
  });
});

describe("conversionRate", () => {
  it("is null when nothing could convert", () => {
    expect(conversionRate(0, 0)).toBeNull();
    expect(conversionRate(3, 0)).toBeNull();
  });

  it("rounds to a whole percent", () => {
    expect(conversionRate(0, 5)).toBe(0);
    expect(conversionRate(1, 3)).toBe(33);
    expect(conversionRate(2, 3)).toBe(67);
    expect(conversionRate(5, 5)).toBe(100);
  });
});

function product(overrides: Partial<PopularProduct>): PopularProduct {
  return {
    id: "p",
    name: "P",
    type: "DIGITAL_PRODUCT",
    views: 0,
    addsToCart: 0,
    unitsSold: 0,
    salesCents: 0,
    ...overrides,
  };
}

describe("rankPopularProducts", () => {
  it("orders by units, then sales, then views, then name", () => {
    const ranked = rankPopularProducts([
      product({ id: "views", name: "A", views: 50 }),
      product({ id: "sales", name: "B", unitsSold: 2, salesCents: 9000 }),
      product({ id: "units", name: "C", unitsSold: 3, salesCents: 100 }),
      product({ id: "cheaper", name: "D", unitsSold: 2, salesCents: 5000 }),
      product({ id: "zed", name: "Zed", views: 50 }),
    ]);
    expect(ranked.map((row) => row.id)).toEqual(["units", "sales", "cheaper", "views", "zed"]);
  });

  it("keeps at most ten and does not change its input", () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      product({ id: `p${index}`, name: `P${index}`, views: index }),
    );
    const ranked = rankPopularProducts(rows);
    expect(ranked).toHaveLength(10);
    expect(ranked[0].id).toBe("p11");
    expect(rows[0].id).toBe("p0");
  });
});
