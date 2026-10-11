"use server";

import { cookies, headers } from "next/headers";
import { buildCartView, CART_COOKIE, CART_COOKIE_MAX_AGE, parseCart } from "@/lib/cart";
import { checkCartCoupon } from "@/lib/cart-coupon";
import { listPublishedProductsByIds } from "@/lib/catalog";
import { COUPON_COOKIE, type CouponFailure } from "@/lib/coupons";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { clientKey, reserveRateLimit } from "@/lib/rate-limit";

// The cart page's discount code (feature 20). The cookie holds only the code;
// the cart page and checkout check it again every time, so it grants nothing.

export type CouponApplyError =
  | "invalid_input"
  | "empty_cart"
  | CouponFailure
  | "rate_limited"
  | "unexpected";

export type CouponActionResult =
  | { success: true }
  | { success: false; error: CouponApplyError }
  | null;

export async function applyCoupon(
  _previous: CouponActionResult,
  formData: FormData,
): Promise<CouponActionResult> {
  const raw = formData.get("code");
  if (typeof raw !== "string") return { success: false, error: "invalid_input" };

  try {
    // Every attempt counts, so codes cannot be guessed quickly.
    if (!(await reserveRateLimit("coupon", clientKey(await headers())))) {
      return { success: false, error: "rate_limited" };
    }
    const store = await cookies();
    const entries = parseCart(store.get(CART_COOKIE)?.value);
    // Only ids, types, and prices are used here, so the language does not matter.
    const products = await listPublishedProductsByIds(
      entries.map((entry) => entry.productId),
      DEFAULT_LOCALE,
    );
    const view = buildCartView(entries, products);
    if (view.lines.length === 0) return { success: false, error: "empty_cart" };

    const { code, evaluation } = await checkCartCoupon(raw, view);
    if (!evaluation.ok) return { success: false, error: evaluation.reason };

    store.set(COUPON_COOKIE, code, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: CART_COOKIE_MAX_AGE,
    });
    return { success: true };
  } catch (error) {
    console.error("applyCoupon failed", error);
    return { success: false, error: "unexpected" };
  }
}

export async function removeCoupon(): Promise<CouponActionResult> {
  (await cookies()).delete(COUPON_COOKIE);
  return { success: true };
}
