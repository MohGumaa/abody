import { describe, expect, it } from "vitest";
import { ProductType } from "@/lib/generated/prisma/enums";
import { selectHomeSections } from "@/lib/home";

const { DIGITAL_PRODUCT, SERVICE } = ProductType;

function item(id: string, type: ProductType, category: string) {
  return { id, type, category };
}

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
      { type: DIGITAL_PRODUCT, category: "Guides", count: 1 },
      { type: DIGITAL_PRODUCT, category: "Templates", count: 1 },
    ]);
  });

  it("handles services only", () => {
    const items = [item("s1", SERVICE, "Marketing Services")];
    const sections = selectHomeSections(items);
    expect(sections.heroProduct).toBeNull();
    expect(sections.featured).toEqual([]);
    expect(sections.services).toEqual(items);
    expect(sections.categories).toEqual([
      { type: SERVICE, category: "Marketing Services", count: 1 },
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
      { type: DIGITAL_PRODUCT, category: "Guides", count: 3 },
      { type: DIGITAL_PRODUCT, category: "Templates", count: 2 },
      { type: SERVICE, category: "Ads", count: 3 },
    ]);
  });

  it("gives a category used by both types one tile per type", () => {
    const sections = selectHomeSections([
      item("s1", SERVICE, "Social"),
      item("p1", DIGITAL_PRODUCT, "Social"),
    ]);
    expect(sections.categories).toEqual([
      { type: DIGITAL_PRODUCT, category: "Social", count: 1 },
      { type: SERVICE, category: "Social", count: 1 },
    ]);
  });
});
