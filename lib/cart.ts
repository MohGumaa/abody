import type { PublicProduct } from "@/lib/catalog";
import { ProductType } from "@/lib/generated/prisma/enums";

// No next/* imports here: Server Actions, pages, and Vitest all load this module.

export const CART_COOKIE = "cart";
export const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

// A cookie holds about 4 KB, which bounds the number of lines.
export const MAX_CART_LINES = 50;
export const MAX_QUANTITY = 99;

// The cart page heading, which takes focus after an item is removed.
export const CART_HEADING_ID = "cart-heading";

const PRODUCT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export interface CartEntry {
  productId: string;
  quantity: number;
}

export interface CartProduct {
  id: string;
  type: ProductType;
}

export type AddCartOutcome =
  | "added"
  | "already_in_cart"
  | "max_quantity"
  | "cart_full";

export interface CartLine {
  product: PublicProduct;
  quantity: number;
  lineTotalCents: number;
}

export interface CartView {
  lines: CartLine[];
  subtotalCents: number;
  totalCents: number;
  removedCount: number;
}

export function isValidProductId(value: unknown): value is string {
  return typeof value === "string" && PRODUCT_ID_PATTERN.test(value);
}

export function isValidQuantity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_QUANTITY
  );
}

// Form input arrives as text; only plain digits in range count.
export function parseQuantity(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{1,2}$/.test(value)) return null;
  const quantity = Number(value);
  return isValidQuantity(quantity) ? quantity : null;
}

// The cookie is untrusted input: anything malformed is dropped, never thrown.
export function parseCart(raw: string | undefined): CartEntry[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  const entries: CartEntry[] = [];
  const seen = new Set<string>();
  for (const item of data) {
    if (!Array.isArray(item) || item.length !== 2) continue;
    const [productId, quantity] = item;
    if (!isValidProductId(productId) || !isValidQuantity(quantity)) continue;
    if (seen.has(productId)) continue;
    seen.add(productId);
    entries.push({ productId, quantity });
    if (entries.length === MAX_CART_LINES) break;
  }
  return entries;
}

export function serializeCart(entries: CartEntry[]): string {
  return JSON.stringify(entries.map((entry) => [entry.productId, entry.quantity]));
}

export function addCartItem(
  entries: CartEntry[],
  product: CartProduct,
): { entries: CartEntry[]; outcome: AddCartOutcome } {
  const existing = entries.find((entry) => entry.productId === product.id);
  if (!existing) {
    if (entries.length >= MAX_CART_LINES) return { entries, outcome: "cart_full" };
    return {
      entries: [...entries, { productId: product.id, quantity: 1 }],
      outcome: "added",
    };
  }
  if (product.type === ProductType.SERVICE) {
    return { entries, outcome: "already_in_cart" };
  }
  if (existing.quantity >= MAX_QUANTITY) {
    return { entries, outcome: "max_quantity" };
  }
  return {
    entries: entries.map((entry) =>
      entry === existing ? { ...entry, quantity: entry.quantity + 1 } : entry,
    ),
    outcome: "added",
  };
}

// Services are always one per cart; the caller validates the range.
export function setCartQuantity(
  entries: CartEntry[],
  product: CartProduct,
  quantity: number,
): CartEntry[] {
  const next = product.type === ProductType.SERVICE ? 1 : quantity;
  return entries.map((entry) =>
    entry.productId === product.id ? { ...entry, quantity: next } : entry,
  );
}

export function removeCartItem(
  entries: CartEntry[],
  productId: string,
): CartEntry[] {
  return entries.filter((entry) => entry.productId !== productId);
}

export function cartItemCount(entries: CartEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.quantity, 0);
}

// Prices always come from the current products, never from the cookie.
export function buildCartView(
  entries: CartEntry[],
  products: PublicProduct[],
): CartView {
  const byId = new Map(products.map((product) => [product.id, product]));
  const lines: CartLine[] = [];
  let removedCount = 0;
  for (const entry of entries) {
    const product = byId.get(entry.productId);
    if (!product) {
      removedCount += 1;
      continue;
    }
    const quantity =
      product.type === ProductType.SERVICE ? 1 : entry.quantity;
    lines.push({
      product,
      quantity,
      lineTotalCents: product.priceCents * quantity,
    });
  }
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  return { lines, subtotalCents, totalCents: subtotalCents, removedCount };
}
