import { PRICE_MIN_CENTS } from "@/lib/admin-product-rules";
import type { CartView } from "@/lib/cart";
import type { CouponScope, ProductType } from "@/lib/generated/prisma/enums";

// Discount code rules (feature 20). No next/* or db imports: Server Actions,
// pages, the admin, and Vitest all load this module.

export const COUPON_COOKIE = "coupon";

export const CODE_MIN = 3;
export const CODE_MAX = 32;
// Customer input longer than this is rejected before any query.
export const CODE_INPUT_MAX = 64;
export const PERCENT_MIN = 1;
export const PERCENT_MAX = 99;
export const MAX_REDEMPTIONS_MAX = 1_000_000;

export const COUPON_SCOPES: readonly CouponScope[] = ["ALL", "DIGITAL_PRODUCTS", "SERVICES"];

// The admin area is English-only.
export const SCOPE_LABELS: Record<CouponScope, string> = {
  ALL: "All products and services",
  DIGITAL_PRODUCTS: "Digital products only",
  SERVICES: "Services only",
};

const CODE_PATTERN = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CouponFailure =
  | "invalid"
  | "expired"
  | "used_up"
  | "not_eligible"
  | "below_minimum";

export interface CouponRecord {
  id: string;
  code: string;
  percentOff: number;
  appliesTo: CouponScope;
  active: boolean;
  expiresOn: Date | null;
  maxRedemptions: number | null;
  redemptionCount: number;
}

export interface DiscountedLine {
  productId: string;
  discountedUnitCents: number;
}

export interface AppliedCoupon {
  ok: true;
  couponId: string;
  code: string;
  percentOff: number;
  discountCents: number;
  totalCents: number;
  // Every cart line, in cart order; ineligible lines keep their price.
  lines: DiscountedLine[];
}

export type CouponEvaluation = AppliedCoupon | { ok: false; reason: CouponFailure };

export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isCouponCode(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= CODE_MIN &&
    value.length <= CODE_MAX &&
    CODE_PATTERN.test(value)
  );
}

export function couponAppliesTo(scope: CouponScope, type: ProductType): boolean {
  if (scope === "ALL") return true;
  return scope === "DIGITAL_PRODUCTS" ? type === "DIGITAL_PRODUCT" : type === "SERVICE";
}

// expiresOn is the last valid day at 00:00 UTC, so the code ends a day later.
export function couponExpired(expiresOn: Date | null, now: Date): boolean {
  return expiresOn !== null && now.getTime() >= expiresOn.getTime() + DAY_MS;
}

// Rounded down, so every Stripe line stays a whole cent and the lines add up
// to the total Stripe charges.
export function discountedUnitCents(priceCents: number, percentOff: number): number {
  return priceCents - Math.floor((priceCents * percentOff) / 100);
}

// An unknown and an inactive code read the same, so a customer cannot tell
// which codes exist.
export function evaluateCoupon(
  coupon: CouponRecord | null,
  view: CartView,
  now: Date,
): CouponEvaluation {
  if (!coupon || !coupon.active) return { ok: false, reason: "invalid" };
  if (couponExpired(coupon.expiresOn, now)) return { ok: false, reason: "expired" };
  if (
    coupon.maxRedemptions !== null &&
    coupon.redemptionCount >= coupon.maxRedemptions
  ) {
    return { ok: false, reason: "used_up" };
  }

  let eligible = false;
  let discountCents = 0;
  const lines = view.lines.map((line) => {
    const { id, type, priceCents } = line.product;
    if (!couponAppliesTo(coupon.appliesTo, type)) {
      return { productId: id, discountedUnitCents: priceCents };
    }
    eligible = true;
    const unit = discountedUnitCents(priceCents, coupon.percentOff);
    discountCents += (priceCents - unit) * line.quantity;
    return { productId: id, discountedUnitCents: unit };
  });
  if (!eligible) return { ok: false, reason: "not_eligible" };

  const totalCents = view.totalCents - discountCents;
  // Stripe's minimum USD charge.
  if (totalCents < PRICE_MIN_CENTS) return { ok: false, reason: "below_minimum" };

  return {
    ok: true,
    couponId: coupon.id,
    code: coupon.code,
    percentOff: coupon.percentOff,
    discountCents,
    totalCents,
    lines,
  };
}
