import path from "node:path";
import {
  CATEGORY_MAX,
  DESCRIPTION_MAX,
  DURATION_MAX_DAYS,
  DURATION_MIN_DAYS,
  IMAGE_MAX,
  INCLUDED_LINE_MAX,
  INCLUDED_MAX_LINES,
  NAME_MAX,
  PRICE_MAX_CENTS,
  PRICE_MIN_CENTS,
  SHORT_DESCRIPTION_MAX,
  SLUG_MAX,
  type ProductField,
  type ProductFieldErrors,
  type ProductFormValues,
} from "@/lib/admin-product-rules";
import { checklistLines, isValidSlug, publicImageSrc } from "@/lib/catalog";
import type { ProductType } from "@/lib/generated/prisma/enums";

// Admin product and service form parsing (features 13 and 14) and storage keys. Server code only:
// it loads lib/catalog. No next/* imports, so Vitest can load it.

const FILE_NAME_MAX = 100;

export interface ProductFormData {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  priceCents: number;
  category: string;
  image: string | null;
  included: string[];
  nameAr: string | null;
  categoryAr: string | null;
  shortDescriptionAr: string | null;
  descriptionAr: string | null;
  includedAr: string[];
  // Services only; always null for digital products.
  durationDays: number | null;
  requirements: string | null;
  requirementsAr: string | null;
}

export type ParsedProductForm =
  | { ok: true; data: ProductFormData; values: ProductFormValues }
  | { ok: false; fieldErrors: ProductFieldErrors; values: ProductFormValues };

const FIELDS: readonly ProductField[] = [
  "name",
  "slug",
  "shortDescription",
  "description",
  "price",
  "category",
  "image",
  "included",
  "nameAr",
  "categoryAr",
  "shortDescriptionAr",
  "descriptionAr",
  "includedAr",
];

const SERVICE_FIELDS: readonly ProductField[] = [
  "durationDays",
  "requirements",
  "requirementsAr",
];

const PRICE_PATTERN = /^(\d{1,5})(?:\.(\d{1,2}))?$/;
const DURATION_PATTERN = /^\d{1,3}$/;

// Dollars as typed ("49", "49.5", "49.50") to whole cents with integer math.
export function parsePriceToCents(input: string): number | null {
  const match = PRICE_PATTERN.exec(input.trim());
  if (!match) return null;
  const cents =
    Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return cents >= PRICE_MIN_CENTS && cents <= PRICE_MAX_CENTS ? cents : null;
}

// Cents back to the form's dollar text, such as 4950 to "49.50".
export function centsToPriceInput(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

// Browsers submit textarea line breaks as CRLF but count each as one character
// for maxLength, so breaks become LF before any length check.
function text(formData: FormData, field: ProductField): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
}

// The type comes from the calling action, never from the form. Service fields
// are read only for services.
export function parseProductForm(
  formData: FormData,
  type: ProductType,
): ParsedProductForm {
  const isService = type === "SERVICE";
  const values: ProductFormValues = {};
  for (const field of isService ? [...FIELDS, ...SERVICE_FIELDS] : FIELDS) {
    values[field] = text(formData, field);
  }
  const fieldErrors: ProductFieldErrors = {};

  function required(field: ProductField, max: number): string {
    const value = values[field] ?? "";
    if (value.length === 0) fieldErrors[field] = "required";
    else if (value.length > max) fieldErrors[field] = "too_long";
    return value;
  }

  function optional(field: ProductField, max: number): string | null {
    const value = values[field] ?? "";
    if (value.length > max) fieldErrors[field] = "too_long";
    return value.length > 0 ? value : null;
  }

  function lines(field: ProductField): string[] {
    const list = checklistLines(values[field] ?? "");
    if (list.length > INCLUDED_MAX_LINES) fieldErrors[field] = "too_many_lines";
    else if (list.some((line) => line.length > INCLUDED_LINE_MAX)) {
      fieldErrors[field] = "too_long";
    }
    return list;
  }

  const name = required("name", NAME_MAX);
  const slug = required("slug", SLUG_MAX);
  if (!fieldErrors.slug && !isValidSlug(slug)) fieldErrors.slug = "invalid_slug";
  const shortDescription = required("shortDescription", SHORT_DESCRIPTION_MAX);
  const description = required("description", DESCRIPTION_MAX);
  const category = required("category", CATEGORY_MAX);

  let priceCents = 0;
  if (!values.price) fieldErrors.price = "required";
  else {
    const cents = parsePriceToCents(values.price);
    if (cents === null) fieldErrors.price = "invalid_price";
    else priceCents = cents;
  }

  const image = optional("image", IMAGE_MAX);
  if (image !== null && !fieldErrors.image && publicImageSrc(image) === null) {
    fieldErrors.image = "invalid_image";
  }

  const included = lines("included");
  const includedAr = lines("includedAr");
  const nameAr = optional("nameAr", NAME_MAX);
  const categoryAr = optional("categoryAr", CATEGORY_MAX);
  const shortDescriptionAr = optional("shortDescriptionAr", SHORT_DESCRIPTION_MAX);
  const descriptionAr = optional("descriptionAr", DESCRIPTION_MAX);

  let durationDays: number | null = null;
  let requirements: string | null = null;
  let requirementsAr: string | null = null;
  if (isService) {
    const duration = values.durationDays ?? "";
    if (duration !== "") {
      const days = DURATION_PATTERN.test(duration) ? Number(duration) : NaN;
      if (days >= DURATION_MIN_DAYS && days <= DURATION_MAX_DAYS) durationDays = days;
      else fieldErrors.durationDays = "invalid_duration";
    }
    // Stored as the cleaned lines; the storefront splits them again.
    const joined = (list: string[]) => (list.length > 0 ? list.join("\n") : null);
    requirements = joined(lines("requirements"));
    requirementsAr = joined(lines("requirementsAr"));
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, values };
  }
  return {
    ok: true,
    values,
    data: {
      name,
      slug,
      shortDescription,
      description,
      priceCents,
      category,
      image,
      included,
      nameAr,
      categoryAr,
      shortDescriptionAr,
      descriptionAr,
      includedAr,
      durationDays,
      requirements,
      requirementsAr,
    },
  };
}

// A name that is safe as a storage key segment and as a download file name:
// only ASCII letters, digits, ".", "_", and "-", starting with a letter or digit.
// Callers check the extension first; it is kept, lowercased.
export function uploadFileName(originalName: string): string {
  const extension = path.posix.extname(originalName).toLowerCase();
  const base = path.posix
    .basename(originalName.replaceAll("\\", "/"), path.posix.extname(originalName))
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/[.-]+$/, "")
    .slice(0, FILE_NAME_MAX - extension.length)
    .replace(/[.-]+$/, "");
  return `${base || "download"}${extension}`;
}

// Every upload gets its own folder, so a replacement never overwrites the file
// a buyer may be downloading, and the download keeps the clean file name.
export function productFileKey(
  productId: string,
  token: string,
  fileName: string,
): string {
  return `${productUploadPrefix(productId)}${token}/${fileName}`;
}

export function productUploadPrefix(productId: string): string {
  return `products/${productId}/`;
}

// Only files the admin uploaded for this product are ever deleted; seed keys
// and other products' files never match.
export function isOwnUploadKey(productId: string, key: string | null): boolean {
  return key !== null && key.startsWith(productUploadPrefix(productId));
}
