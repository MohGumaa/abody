"use server";

import { cookies } from "next/headers";
import {
  addCartItem,
  CART_COOKIE,
  CART_COOKIE_MAX_AGE,
  cartItemCount,
  isValidProductId,
  parseCart,
  parseQuantity,
  removeCartItem,
  serializeCart,
  setCartQuantity,
  type CartEntry,
} from "@/lib/cart";
import { listPublishedProductsByIds, type PublicProduct } from "@/lib/catalog";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";

export type CartActionError =
  | "invalid_input"
  | "unavailable"
  | "cart_full"
  | "unexpected";

export type CartActionOutcome =
  | "added"
  | "already_in_cart"
  | "max_quantity"
  | "updated"
  | "removed";

export type CartActionResult =
  | { success: true; data: { outcome: CartActionOutcome; count: number } }
  | { success: false; error: CartActionError }
  | null;

type CookieStore = Awaited<ReturnType<typeof cookies>>;

interface LoadedCart {
  store: CookieStore;
  // Entries whose product is still published.
  entries: CartEntry[];
  products: Map<string, PublicProduct>;
}

// One query covers the cart and the target, so every write also drops items
// that are no longer published.
async function loadCart(targetId?: string): Promise<LoadedCart> {
  const store = await cookies();
  const stored = parseCart(store.get(CART_COOKIE)?.value);
  const ids = stored.map((entry) => entry.productId);
  if (targetId && !ids.includes(targetId)) ids.push(targetId);
  // Only ids and types are used here, so the language does not matter.
  const found = await listPublishedProductsByIds(ids, DEFAULT_LOCALE);
  const products = new Map(found.map((product) => [product.id, product]));
  return {
    store,
    entries: stored.filter((entry) => products.has(entry.productId)),
    products,
  };
}

function saveCart(store: CookieStore, entries: CartEntry[]): void {
  if (entries.length === 0) {
    store.delete(CART_COOKIE);
    return;
  }
  store.set(CART_COOKIE, serializeCart(entries), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE,
  });
}

function success(
  outcome: CartActionOutcome,
  entries: CartEntry[],
): CartActionResult {
  return { success: true, data: { outcome, count: cartItemCount(entries) } };
}

function failure(error: CartActionError): CartActionResult {
  return { success: false, error };
}

export async function addToCart(
  _previous: CartActionResult,
  formData: FormData,
): Promise<CartActionResult> {
  const productId = formData.get("productId");
  if (!isValidProductId(productId)) return failure("invalid_input");

  try {
    const { store, entries, products } = await loadCart(productId);
    const product = products.get(productId);
    if (!product) return failure("unavailable");

    const result = addCartItem(entries, product);
    if (result.outcome === "cart_full") return failure("cart_full");
    saveCart(store, result.entries);
    return success(result.outcome, result.entries);
  } catch (error) {
    console.error("addToCart failed", error);
    return failure("unexpected");
  }
}

export async function updateCartQuantity(
  _previous: CartActionResult,
  formData: FormData,
): Promise<CartActionResult> {
  const productId = formData.get("productId");
  const quantity = parseQuantity(formData.get("quantity"));
  if (!isValidProductId(productId) || quantity === null) {
    return failure("invalid_input");
  }

  try {
    const { store, entries, products } = await loadCart();
    const product = products.get(productId);
    if (!product) return failure("unavailable");

    const next = setCartQuantity(entries, product, quantity);
    saveCart(store, next);
    return success("updated", next);
  } catch (error) {
    console.error("updateCartQuantity failed", error);
    return failure("unexpected");
  }
}

// Removing an item that is not in the cart still succeeds.
export async function removeFromCart(
  _previous: CartActionResult,
  formData: FormData,
): Promise<CartActionResult> {
  const productId = formData.get("productId");
  if (!isValidProductId(productId)) return failure("invalid_input");

  try {
    const { store, entries } = await loadCart();
    const next = removeCartItem(entries, productId);
    saveCart(store, next);
    return success("removed", next);
  } catch (error) {
    console.error("removeFromCart failed", error);
    return failure("unexpected");
  }
}
