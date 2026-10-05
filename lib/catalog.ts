import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { ProductStatus, ProductType } from "@/lib/generated/prisma/enums";
import type { Locale } from "@/lib/i18n/config";

// The only fields public code may read. digitalFile and status stay out of the
// query itself so a private file reference can never reach a response.
const publicProductSelect = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  description: true,
  priceCents: true,
  type: true,
  category: true,
  image: true,
  included: true,
  durationDays: true,
  requirements: true,
  nameAr: true,
  categoryAr: true,
  shortDescriptionAr: true,
  descriptionAr: true,
  includedAr: true,
  requirementsAr: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

type PublicProductRow = Prisma.ProductGetPayload<{
  select: typeof publicProductSelect;
}>;

export interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  priceCents: number;
  currency: "USD";
  type: ProductType;
  // Language-neutral key for filters, URLs, and related items.
  category: string;
  // What pages show for the category.
  categoryLabel: string;
  image: string | null;
  included: string[];
  durationDays: number | null;
  requirements: string | null;
  createdAt: string;
  updatedAt: string;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Fills the mockup's four-card row on the detail and cart pages.
const RELATED_LIMIT = 4;

export function isProductType(value: string): value is ProductType {
  return value === ProductType.DIGITAL_PRODUCT || value === ProductType.SERVICE;
}

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

export function productPath(product: Pick<PublicProduct, "type" | "slug">): string {
  const base = product.type === ProductType.SERVICE ? "/services" : "/products";
  return `${base}/${product.slug}`;
}

// Only root-relative paths and https URLs are rendered. Storage keys and other
// schemes fall back to the placeholder.
export function publicImageSrc(image: string | null): string | null {
  if (!image) return null;
  // Browsers read "//" and "/\" as protocol-relative, so those are not local.
  if (image.startsWith("/")) return /^\/[/\\]/.test(image) ? null : image;
  if (!image.startsWith("https://")) return null;
  return URL.canParse(image) ? image : null;
}

// Latin digits in Arabic too, so numbers match prices and order numbers.
const DURATION_LOCALES: Record<Locale, string> = {
  en: "en",
  ar: "ar-u-nu-latn",
};

export function formatDurationDays(days: number, locale: Locale): string {
  return new Intl.NumberFormat(DURATION_LOCALES[locale], {
    style: "unit",
    unit: "day",
    unitDisplay: "long",
  }).format(days);
}

// Free-text fields such as requirements hold one item per line.
export function checklistLines(text: string | null): string[] {
  if (text === null) {
    return [];
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

function hasText(value: string | null): value is string {
  return value !== null && value.trim() !== "";
}

export function localizedName(
  row: { name: string; nameAr: string | null },
  locale: Locale,
): string {
  return locale === "ar" && hasText(row.nameAr) ? row.nameAr : row.name;
}

// Arabic content is optional, so each field falls back to English on its own.
export function toPublicProduct(
  row: PublicProductRow,
  locale: Locale,
): PublicProduct {
  const arabic = locale === "ar";
  return {
    id: row.id,
    name: localizedName(row, locale),
    slug: row.slug,
    shortDescription:
      arabic && hasText(row.shortDescriptionAr)
        ? row.shortDescriptionAr
        : row.shortDescription,
    description:
      arabic && hasText(row.descriptionAr)
        ? row.descriptionAr
        : row.description,
    priceCents: row.priceCents,
    currency: "USD",
    type: row.type,
    category: row.category,
    categoryLabel:
      arabic && hasText(row.categoryAr) ? row.categoryAr : row.category,
    image: row.image,
    included:
      arabic && row.includedAr.some(hasText) ? row.includedAr : row.included,
    durationDays: row.durationDays,
    requirements:
      arabic && hasText(row.requirementsAr)
        ? row.requirementsAr
        : row.requirements,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPublishedProducts(options: {
  type?: ProductType;
  locale: Locale;
}): Promise<PublicProduct[]> {
  const rows = await db.product.findMany({
    where: { status: ProductStatus.PUBLISHED, type: options.type },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: publicProductSelect,
  });
  return rows.map((row) => toPublicProduct(row, options.locale));
}

export async function getPublishedProductBySlug(
  slug: string,
  locale: Locale,
): Promise<PublicProduct | null> {
  if (!isValidSlug(slug)) return null;
  const row = await db.product.findFirst({
    where: { slug, status: ProductStatus.PUBLISHED },
    select: publicProductSelect,
  });
  return row ? toPublicProduct(row, locale) : null;
}

// Cart lookups: only published rows; order is left to the caller.
export async function listPublishedProductsByIds(
  ids: string[],
  locale: Locale,
): Promise<PublicProduct[]> {
  if (ids.length === 0) return [];
  const rows = await db.product.findMany({
    where: { status: ProductStatus.PUBLISHED, id: { in: ids } },
    select: publicProductSelect,
  });
  return rows.map((row) => toPublicProduct(row, locale));
}

// The cart's "You might also like" row: newest items of any type that are not
// already in the cart.
export async function listCartSuggestions(
  excludeIds: string[],
  locale: Locale,
): Promise<PublicProduct[]> {
  const rows = await db.product.findMany({
    where: { status: ProductStatus.PUBLISHED, id: { notIn: excludeIds } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: RELATED_LIMIT,
    select: publicProductSelect,
  });
  return rows.map((row) => toPublicProduct(row, locale));
}

// Same type only: same category first, then other categories, newest first.
// Matching uses the category key, so it is the same in both languages.
export async function listRelatedProducts(
  product: Pick<PublicProduct, "id" | "type" | "category">,
  locale: Locale,
): Promise<PublicProduct[]> {
  const where = {
    status: ProductStatus.PUBLISHED,
    type: product.type,
    id: { not: product.id },
  } satisfies Prisma.ProductWhereInput;
  const orderBy = [
    { createdAt: "desc" },
    { id: "asc" },
  ] satisfies Prisma.ProductOrderByWithRelationInput[];

  const sameCategory = await db.product.findMany({
    where: { ...where, category: product.category },
    orderBy,
    take: RELATED_LIMIT,
    select: publicProductSelect,
  });
  const remaining = RELATED_LIMIT - sameCategory.length;
  const otherCategories =
    remaining > 0
      ? await db.product.findMany({
          where: { ...where, category: { not: product.category } },
          orderBy,
          take: remaining,
          select: publicProductSelect,
        })
      : [];

  return [...sameCategory, ...otherCategories].map((row) =>
    toPublicProduct(row, locale),
  );
}
