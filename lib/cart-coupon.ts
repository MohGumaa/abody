import type { CartView } from "@/lib/cart";
import {
  CODE_INPUT_MAX,
  type CouponEvaluation,
  evaluateCoupon,
  isCouponCode,
  normalizeCouponCode,
} from "@/lib/coupons";
import { db } from "@/lib/db";

// Server code only. The cart page, the coupon actions, and checkout all check
// a code against the cart they are about to show or charge, the same way.

export interface CartCoupon {
  code: string;
  evaluation: CouponEvaluation;
}

// raw is the typed code or the coupon cookie, both untrusted. A malformed code
// is invalid without a query.
export async function checkCartCoupon(raw: string, view: CartView): Promise<CartCoupon> {
  const code = raw.length <= CODE_INPUT_MAX ? normalizeCouponCode(raw) : "";
  if (!isCouponCode(code)) {
    return { code, evaluation: { ok: false, reason: "invalid" } };
  }
  const coupon = await db.coupon.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      percentOff: true,
      appliesTo: true,
      active: true,
      expiresOn: true,
      maxRedemptions: true,
      redemptionCount: true,
    },
  });
  return { code, evaluation: evaluateCoupon(coupon, view, new Date()) };
}
