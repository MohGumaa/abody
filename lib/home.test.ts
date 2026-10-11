import { describe, expect, it } from "vitest";
import { ProductType } from "@/lib/generated/prisma/enums";
import { selectHomeSections } from "@/lib/home";

const { DIGITAL_PRODUCT, SERVICE } = ProductType;

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
    expect(selectHomeSections([])).toEqual({
      heroProduct: null,
      featured: [],
      services: [],
      categories: [],
    });
  });

  it("handles products only", () => {
    const items = [
      item("p1", DIGITAL_PRODUCT, "Templates"),
      item("p2", DIGITAL_PRODUCT, "Guides"),
    ];
    const sections = selectHomeSections(items);
    expect(sections.heroProduct).toBe(items[0]);
    expect(sections.featured).toEqual(items);
    expect(sections.services).toEqual([]);
    expect(sections.categories).toEqual([
      { type: DIGITAL_PRODUCT, category: "Guides", label: "Guides label", count: 1 },
      { type: DIGITAL_PRODUCT, category: "Templates", label: "Templates label", count: 1 },
    ]);
  });

  it("handles services only", () => {
    const items = [item("s1", SERVICE, "Marketing Services")];
    const sections = selectHomeSections(items);
    expect(sections.heroProduct).toBeNull();
    expect(sections.featured).toEqual([]);
    expect(sections.services).toEqual(items);
    expect(sections.categories).toEqual([
      { type: SERVICE, category: "Marketing Services", label: "Marketing Services label", count: 1 },
    ]);
  });

  it("keeps the newest four products and two services in input order", () => {
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
    const sections = selectHomeSections(items);
    expect(sections.heroProduct?.id).toBe("p1");
    expect(sections.featured.map(({ id }) => id)).toEqual([
      "p1",
      "p2",
      "p3",
      "p4",
    ]);
    expect(sections.services.map(({ id }) => id)).toEqual(["s1", "s2"]);
    expect(sections.categories).toEqual([
      { type: DIGITAL_PRODUCT, category: "Guides", label: "Guides label", count: 3 },
      { type: DIGITAL_PRODUCT, category: "Templates", label: "Templates label", count: 2 },
      { type: SERVICE, category: "Ads", label: "Ads label", count: 3 },
    ]);
  });

  it("gives a category used by both types one tile per type", () => {
    const sections = selectHomeSections([
      item("s1", SERVICE, "Social"),
      item("p1", DIGITAL_PRODUCT, "Social"),
    ]);
    expect(sections.categories).toEqual([
      { type: DIGITAL_PRODUCT, category: "Social", label: "Social label", count: 1 },
      { type: SERVICE, category: "Social", label: "Social label", count: 1 },
    ]);
  });

  describe("featured picks", () => {
    it("orders picks by position, the lowest product as the hero", () => {
      const sections = selectHomeSections([
        item("p1", DIGITAL_PRODUCT, "Guides", 3),
        item("p2", DIGITAL_PRODUCT, "Guides", 1),
        item("p3", DIGITAL_PRODUCT, "Guides", 2),
        item("p4", DIGITAL_PRODUCT, "Guides", 4),
      ]);
      expect(sections.heroProduct?.id).toBe("p2");
      expect(ids(sections.featured)).toEqual(["p2", "p3", "p1", "p4"]);
    });

    it("fills open slots with the newest unpicked items", () => {
      const sections = selectHomeSections([
        item("p1", DIGITAL_PRODUCT, "Guides"),
        item("p2", DIGITAL_PRODUCT, "Guides"),
        item("p3", DIGITAL_PRODUCT, "Guides", 2),
        item("p4", DIGITAL_PRODUCT, "Guides"),
        item("p5", DIGITAL_PRODUCT, "Guides", 1),
      ]);
      expect(ids(sections.featured)).toEqual(["p5", "p3", "p1", "p2"]);
    });

    it("keeps newest first for equal positions", () => {
      const sections = selectHomeSections([
        item("p1", DIGITAL_PRODUCT, "Guides", 5),
        item("p2", DIGITAL_PRODUCT, "Guides", 5),
        item("p3", DIGITAL_PRODUCT, "Guides", 1),
      ]);
      expect(ids(sections.featured)).toEqual(["p3", "p1", "p2"]);
    });

    it("orders services apart from products", () => {
      const sections = selectHomeSections([
        item("s1", SERVICE, "Ads"),
        item("p1", DIGITAL_PRODUCT, "Guides", 1),
        item("s2", SERVICE, "Ads"),
        item("s3", SERVICE, "Ads", 1),
        item("p2", DIGITAL_PRODUCT, "Guides"),
      ]);
      expect(ids(sections.services)).toEqual(["s3", "s1"]);
      expect(ids(sections.featured)).toEqual(["p1", "p2"]);
      expect(sections.heroProduct?.id).toBe("p1");
    });
  });
});
