// Admin product limits and form types (feature 13). No imports: the admin
// client components load this module next to the server code.

export const NAME_MAX = 120;
export const SLUG_MAX = 80;
export const SHORT_DESCRIPTION_MAX = 300;
export const DESCRIPTION_MAX = 10_000;
export const CATEGORY_MAX = 60;
export const IMAGE_MAX = 500;
export const INCLUDED_MAX_LINES = 20;
export const INCLUDED_LINE_MAX = 200;
// Stripe's minimum USD charge is $0.50.
export const PRICE_MIN_CENTS = 50;
export const PRICE_MAX_CENTS = 9_999_999;
// Services only (feature 14): an optional whole number of days.
export const DURATION_MIN_DAYS = 1;
export const DURATION_MAX_DAYS = 365;

export const PRODUCT_FILE_MAX_BYTES = 25 * 1024 * 1024;
export const PRODUCT_FILE_EXTENSIONS = [".pdf", ".zip"] as const;

export type ProductField =
  | "name"
  | "slug"
  | "shortDescription"
  | "description"
  | "price"
  | "category"
  | "image"
  | "included"
  | "nameAr"
  | "categoryAr"
  | "shortDescriptionAr"
  | "descriptionAr"
  | "includedAr"
  // Services only.
  | "durationDays"
  | "requirements"
  | "requirementsAr";

export type ProductFieldError =
  | "required"
  | "too_long"
  | "invalid_slug"
  | "slug_taken"
  | "invalid_price"
  | "invalid_image"
  | "too_many_lines"
  | "invalid_duration";

export type ProductFieldErrors = Partial<Record<ProductField, ProductFieldError>>;

// What the form sends back after a failed submit, as typed.
export type ProductFormValues = Partial<Record<ProductField, string>>;

// The extension of an allowed upload name, lowercased, else null. Like
// path.extname, a leading dot (".pdf") is a hidden file, not an extension.
export function productFileExtension(name: string): string | null {
  const base = name.slice(Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\")) + 1);
  const dot = base.lastIndexOf(".");
  const extension = dot > 0 ? base.slice(dot).toLowerCase() : "";
  return (PRODUCT_FILE_EXTENSIONS as readonly string[]).includes(extension)
    ? extension
    : null;
}

// One category in the admin category picker, with the Arabic name to fill in.
export interface CategoryOption {
  category: string;
  categoryAr: string | null;
}

// The picker's options from product rows ordered newest first: one per exact
// category name (case matters, as in the store filter), with the newest
// non-blank Arabic name seen for it, sorted by name.
export function categoryOptions(
  rows: readonly { category: string; categoryAr: string | null }[],
): CategoryOption[] {
  const byName = new Map<string, string | null>();
  for (const { category, categoryAr } of rows) {
    const arabic = categoryAr?.trim() ? categoryAr.trim() : null;
    if (!byName.has(category)) byName.set(category, arabic);
    else if (byName.get(category) === null && arabic) byName.set(category, arabic);
  }
  return [...byName]
    .map(([category, categoryAr]) => ({ category, categoryAr }))
    .sort((a, b) => a.category.localeCompare(b.category, "en"));
}

export type CategoryPick =
  | { mode: "none" }
  | { mode: "existing"; index: number }
  | { mode: "new"; text: string };

// What the picker shows for a category value: the matching option, nothing
// chosen yet, or the new-category field (also when no options exist).
export function initialCategoryPick(
  options: readonly CategoryOption[],
  value: string,
): CategoryPick {
  const index = options.findIndex((option) => option.category === value);
  if (index >= 0) return { mode: "existing", index };
  if (value === "" && options.length > 0) return { mode: "none" };
  return { mode: "new", text: value };
}
