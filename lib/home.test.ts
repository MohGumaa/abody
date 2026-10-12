import { describe, expect, it } from "vitest";
import { ProductType } from "@/lib/generated/prisma/enums";
import { selectHomeSections } from "@/lib/home";

const { DIGITAL_PRODUCT, SERVICE } = ProductType;
const NO_SALES: ReadonlyMap<string, number> = new Map();

function item(
  id: string,
  type: ProductType,
  category: string,
  featuredRank: number | null = null,
) {
  return { id, type, category, categoryLabel: `${category} label`, featuredRank };
}

const ids = (list: { id: string }[]) => list.map(({ id }) => id);

describe("selectHomeSections", () => {
  it("returns empty sections for an empty catalog", () => {
    expect(selectHomeSections([], NO_SALES)).toEqual({
      heroProduct: null,
      featuredTabs: { bestSellers: [], newest: [], templates: [] },
      services: [],
      categories: [],
    });
  });

  it("handles products only", () => {
    const items = [
      item("p1", DIGITAL_PRODUCT, "Templates"),
      item("p2", DIGITAL_PRODUCT, "Guides"),
    ];
    const sections = selectHomeSections(items, NO_SALES);
    expect(sections.heroProduct).toBe(items[0]);
    expect(sections.featuredTabs.newest).toEqual(items);
    expect(sections.services).toEqual([]);
    expect(sections.categories).toEqual([
      { type: DIGITAL_PRODUCT, category: "Guides", label: "Guides label", count: 1 },
      { type: DIGITAL_PRODUCT, category: "Templates", label: "Templates label", count: 1 },
    ]);
  });

  it("handles services only", () => {
    const items = [item("s1", SERVICE, "Marketing Services")];
    const sections = selectHomeSections(items, new Map([["s1", 9]]));
    expect(sections.heroProduct).toBeNull();
    expect(sections.featuredTabs).toEqual({
      bestSellers: [],
      newest: [],
      templates: [],
    });
    expect(sections.services).toEqual(items);
    expect(sections.categories).toEqual([
      { type: SERVICE, category: "Marketing Services", label: "Marketing Services label", count: 1 },
    ]);
  });

  it("keeps the newest three products and two services in input order", () => {
    const items = [
      item("s1", SERVICE, "Ads"),
      item("p1", DIGITAL_PRODUCT, "Templates"),
      item("p2", DIGITAL_PRODUCT, "Templates"),
      item("s2", SERVICE, "Ads"),
      item("p3", DIGITAL_PRODUCT, "Guides"),
      item("s3", SERVICE, "Ads"),
      item("p4", DIGITAL_PRODUCT, "Guides"),
      item("p5", DIGITAL_PRODUCT, "Guides"),
    ];
    const sections = selectHomeSections(items, NO_SALES);
    expect(sections.heroProduct?.id).toBe("p1");
    expect(ids(sections.featuredTabs.newest)).toEqual(["p1", "p2", "p3"]);
    expect(ids(sections.services)).toEqual(["s1", "s2"]);
    expect(sections.categories).toEqual([
      { type: DIGITAL_PRODUCT, category: "Guides", label: "Guides label", count: 3 },
      { type: DIGITAL_PRODUCT, category: "Templates", label: "Templates label", count: 2 },
      { type: SERVICE, category: "Ads", label: "Ads label", count: 3 },
    ]);
  });

  it("gives a category used by both types one tile per type", () => {
    const sections = selectHomeSections(
      [item("s1", SERVICE, "Social"), item("p1", DIGITAL_PRODUCT, "Social")],
      NO_SALES,
    );
    expect(sections.categories).toEqual([
      { type: DIGITAL_PRODUCT, category: "Social", label: "Social label", count: 1 },
      { type: SERVICE, category: "Social", label: "Social label", count: 1 },
    ]);
  });

  describe("best sellers", () => {
    const products = [
      item("p1", DIGITAL_PRODUCT, "Guides"),
      item("p2", DIGITAL_PRODUCT, "Guides"),
      item("p3", DIGITAL_PRODUCT, "Guides"),
      item("p4", DIGITAL_PRODUCT, "Guides"),
      item("p5", DIGITAL_PRODUCT, "Guides"),
    ];

    it("orders by units sold, ties and unsold products newest first", () => {
      const sections = selectHomeSections(
        products,
        new Map([
          ["p4", 2],
          ["p5", 7],
          ["p2", 2],
        ]),
      );
      expect(ids(sections.featuredTabs.bestSellers)).toEqual(["p5", "p2", "p4"]);
    });

    it("shows the newest three with no sales", () => {
      const sections = selectHomeSections(products, NO_SALES);
      expect(ids(sections.featuredTabs.bestSellers)).toEqual(["p1", "p2", "p3"]);
    });

    it("ignores sales of items that are not listed products", () => {
      const sections = selectHomeSections(
        [item("s1", SERVICE, "Ads"), ...products.slice(0, 2)],
        new Map([
          ["s1", 50],
          ["gone", 40],
          ["p2", 1],
        ]),
      );
      expect(ids(sections.featuredTabs.bestSellers)).toEqual(["p2", "p1"]);
    });

    it("ignores featured positions", () => {
      const sections = selectHomeSections(
        [item("p1", DIGITAL_PRODUCT, "Guides"), item("p2", DIGITAL_PRODUCT, "Guides", 1)],
        NO_SALES,
      );
      expect(ids(sections.featuredTabs.bestSellers)).toEqual(["p1", "p2"]);
      expect(ids(sections.featuredTabs.newest)).toEqual(["p1", "p2"]);
    });
  });

  describe("templates", () => {
    it("matches the category ignoring case and outer spaces, newest first", () => {
      const sections = selectHomeSections(
        [
          item("p1", DIGITAL_PRODUCT, "Templates"),
          item("p2", DIGITAL_PRODUCT, " templates "),
          item("p3", DIGITAL_PRODUCT, "Template"),
          item("p4", DIGITAL_PRODUCT, "TEMPLATES"),
          item("p5", DIGITAL_PRODUCT, "Templates Pro"),
          item("s1", SERVICE, "Templates"),
        ],
        NO_SALES,
      );
      expect(ids(sections.featuredTabs.templates)).toEqual(["p1", "p2", "p4"]);
    });

    it("is empty without a templates product", () => {
      const sections = selectHomeSections(
        [item("p1", DIGITAL_PRODUCT, "Guides")],
        NO_SALES,
      );
      expect(sections.featuredTabs.templates).toEqual([]);
    });

    it("caps at three", () => {
      const sections = selectHomeSections(
        ["p1", "p2", "p3", "p4"].map((id) => item(id, DIGITAL_PRODUCT, "Templates")),
        NO_SALES,
      );
      expect(ids(sections.featuredTabs.templates)).toEqual(["p1", "p2", "p3"]);
    });
  });

  describe("featured picks", () => {
    it("makes the lowest picked product the hero", () => {
      const sections = selectHomeSections(
        [
          item("p1", DIGITAL_PRODUCT, "Guides", 3),
          item("p2", DIGITAL_PRODUCT, "Guides", 1),
          item("p3", DIGITAL_PRODUCT, "Guides", 2),
        ],
        NO_SALES,
      );
      expect(sections.heroProduct?.id).toBe("p2");
    });

    it("keeps the newest product as the hero with no picks", () => {
      const sections = selectHomeSections(
        [item("p1", DIGITAL_PRODUCT, "Guides"), item("p2", DIGITAL_PRODUCT, "Guides")],
        new Map([["p2", 5]]),
      );
      expect(sections.heroProduct?.id).toBe("p1");
    });

    it("keeps newest first for equal positions", () => {
      const sections = selectHomeSections(
        [
          item("p1", DIGITAL_PRODUCT, "Guides", 5),
          item("p2", DIGITAL_PRODUCT, "Guides", 5),
        ],
        NO_SALES,
      );
      expect(sections.heroProduct?.id).toBe("p1");
    });

    it("orders services by position, filling with the newest", () => {
      const sections = selectHomeSections(
        [
          item("s1", SERVICE, "Ads"),
          item("p1", DIGITAL_PRODUCT, "Guides", 1),
          item("s2", SERVICE, "Ads"),
          item("s3", SERVICE, "Ads", 1),
          item("p2", DIGITAL_PRODUCT, "Guides"),
        ],
        NO_SALES,
      );
      expect(ids(sections.services)).toEqual(["s3", "s1"]);
      expect(sections.heroProduct?.id).toBe("p1");
    });
  });
});
