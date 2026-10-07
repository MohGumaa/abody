import { describe, expect, it } from "vitest";
import { categoryOptions, initialCategoryPick } from "./admin-product-rules";

describe("categoryOptions", () => {
  it("keeps one option per category with the newest Arabic name", () => {
    expect(
      categoryOptions([
        { category: "Guides", categoryAr: "أدلة" },
        { category: "Templates", categoryAr: null },
        { category: "Guides", categoryAr: "قديم" },
      ]),
    ).toEqual([
      { category: "Guides", categoryAr: "أدلة" },
      { category: "Templates", categoryAr: null },
    ]);
  });

  it("falls back to an older Arabic name when newer rows leave it blank", () => {
    expect(
      categoryOptions([
        { category: "Guides", categoryAr: null },
        { category: "Guides", categoryAr: "   " },
        { category: "Guides", categoryAr: " أدلة " },
      ]),
    ).toEqual([{ category: "Guides", categoryAr: "أدلة" }]);
  });

  it("treats names that differ in case as different categories", () => {
    expect(
      categoryOptions([
        { category: "guides", categoryAr: null },
        { category: "Guides", categoryAr: null },
      ]).map((option) => option.category),
    ).toEqual(["guides", "Guides"]);
  });

  it("sorts by name and handles an empty list", () => {
    expect(
      categoryOptions([
        { category: "Templates", categoryAr: null },
        { category: "Ads", categoryAr: null },
      ]).map((option) => option.category),
    ).toEqual(["Ads", "Templates"]);
    expect(categoryOptions([])).toEqual([]);
  });
});

describe("initialCategoryPick", () => {
  const options = [
    { category: "Guides", categoryAr: "أدلة" },
    { category: "Templates", categoryAr: null },
  ];

  it("selects an exact match", () => {
    expect(initialCategoryPick(options, "Templates")).toEqual({
      mode: "existing",
      index: 1,
    });
  });

  it("shows nothing chosen for an empty value", () => {
    expect(initialCategoryPick(options, "")).toEqual({ mode: "none" });
  });

  it("opens the new-category field for an unknown or differently cased value", () => {
    expect(initialCategoryPick(options, "Checklists")).toEqual({
      mode: "new",
      text: "Checklists",
    });
    expect(initialCategoryPick(options, "guides")).toEqual({
      mode: "new",
      text: "guides",
    });
  });

  it("opens the new-category field when no categories exist", () => {
    expect(initialCategoryPick([], "")).toEqual({ mode: "new", text: "" });
  });
});
