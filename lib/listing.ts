// No next/* or db imports here: Vitest loads this module directly.

export interface CategorySummary {
  category: string;
  // The localized name to show; the first item in the group supplies it.
  label: string;
  count: number;
}

// The `category` query value. A missing, empty, or repeated parameter means
// "All", so a hand-edited URL never errors.
export function parseCategoryParam(
  value: string | string[] | undefined,
): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

// Sorted by the language-neutral key, so the order is the same on both sites.
// Items arrive newest first, so the newest item's label names the category.
export function summarizeCategories(
  products: { category: string; categoryLabel: string }[],
): CategorySummary[] {
  const summaries = new Map<string, CategorySummary>();
  for (const { category, categoryLabel } of products) {
    const summary = summaries.get(category);
    if (summary) summary.count += 1;
    else summaries.set(category, { category, label: categoryLabel, count: 1 });
  }
  return [...summaries.values()].sort((a, b) =>
    a.category.localeCompare(b.category, "en"),
  );
}

export function filterByCategory<T extends { category: string }>(
  products: T[],
  category: string | null,
): T[] {
  return category === null
    ? products
    : products.filter((product) => product.category === category);
}

export function categoryHref(basePath: string, category: string | null): string {
  if (category === null) return basePath;
  return `${basePath}?${new URLSearchParams({ category })}`;
}
