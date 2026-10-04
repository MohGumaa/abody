// No next/* or db imports here: Vitest loads this module directly.

export interface CategorySummary {
  category: string;
  count: number;
}

// The `category` query value. A missing, empty, or repeated parameter means
// "All", so a hand-edited URL never errors.
export function parseCategoryParam(
  value: string | string[] | undefined,
): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

// Category is stored in one language, so the order is the same on both sites.
export function summarizeCategories(
  products: { category: string }[],
): CategorySummary[] {
  const counts = new Map<string, number>();
  for (const { category } of products) {
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return [...counts]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => a.category.localeCompare(b.category, "en"));
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
