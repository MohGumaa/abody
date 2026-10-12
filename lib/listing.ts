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

export type ListingSort = "newest" | "price-asc" | "price-desc";

export const SEARCH_MAX_LENGTH = 100;

// The `q` query value, trimmed with inner whitespace collapsed. A missing,
// blank, or repeated parameter means no search.
export function parseSearchParam(
  value: string | string[] | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const query = value.trim().replace(/\s+/g, " ").slice(0, SEARCH_MAX_LENGTH);
  return query === "" ? null : query;
}

// Anything but an exact price sort falls back to the default, newest first.
export function parseSortParam(
  value: string | string[] | undefined,
): ListingSort {
  return value === "price-asc" || value === "price-desc" ? value : "newest";
}

// Plain substrings, never a pattern: every term must appear in some field.
export function matchesSearch(
  fields: (string | null)[],
  query: string,
): boolean {
  const haystacks = fields
    .filter((field): field is string => field !== null)
    .map((field) => field.toLowerCase());
  return query
    .toLowerCase()
    .split(" ")
    .filter((term) => term !== "")
    .every((term) => haystacks.some((field) => field.includes(term)));
}

// Items arrive newest first, and the stable sort keeps that order on ties.
export function sortProducts<T extends { priceCents: number }>(
  products: T[],
  sort: ListingSort,
): T[] {
  if (sort === "newest") return [...products];
  const direction = sort === "price-asc" ? 1 : -1;
  return [...products].sort(
    (a, b) => (a.priceCents - b.priceCents) * direction,
  );
}

// Only non-default values go in the URL, always in the same order.
export function listingHref(
  basePath: string,
  state: { category: string | null; q: string | null; sort: ListingSort },
): string {
  const params = new URLSearchParams();
  if (state.category !== null) params.set("category", state.category);
  if (state.q !== null) params.set("q", state.q);
  if (state.sort !== "newest") params.set("sort", state.sort);
  const query = params.toString();
  return query === "" ? basePath : `${basePath}?${query}`;
}
