import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCartView } from "@/lib/cart";
import type { PublicProduct } from "@/lib/catalog";
import {
  couponAppliesTo,
  couponExpired,
  discountedUnitCents,
  evaluateCoupon,
  isCouponCode,
  normalizeCouponCode,
  type CouponRecord,
} from "@/lib/coupons";

function product(overrides: Partial<PublicProduct>): PublicProduct {
  return {
    id: "p1",
    name: "Template",
    slug: "template",
    shortDescription: "Short",
    description: "Long",
    priceCents: 4900,
    currency: "USD",
    type: "DIGITAL_PRODUCT",
    category: "Templates",
    categoryLabel: "Templates",
    image: null,
    included: [],
    durationDays: null,
    requirements: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const digital = product({ id: "p1", priceCents: 4900 });
const service = product({ id: "s1", type: "SERVICE", priceCents: 29900 });

function coupon(overrides: Partial<CouponRecord> = {}): CouponRecord {
  return {
    id: "c1",
    code: "SAVE10",
    percentOff: 10,
    appliesTo: "ALL",
    active: true,
    expiresOn: null,
    maxRedemptions: null,
    redemptionCount: 0,
    ...overrides,
  };
}

const NOW = new Date("2026-10-10T12:00:00Z");

function cart(...lines: [PublicProduct, number][]) {
  return buildCartView(
    lines.map(([item, quantity]) => ({ productId: item.id, quantity })),
    lines.map(([item]) => item),
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("normalizeCouponCode and isCouponCode", () => {
  it("trims and uppercases", () => {
    expect(normalizeCouponCode("  save-10 ")).toBe("SAVE-10");
  });

  it("accepts letters, digits, and single inner hyphens of 3 to 32 characters", () => {
    for (const code of ["ABC", "SAVE10", "SPRING-2026", "A".repeat(32)]) {
      expect(isCouponCode(code)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    for (const code of ["AB", "A".repeat(33), "save10", "-SAVE", "SAVE-", "SA--VE", "SA VE", "", 10, null]) {
      expect(isCouponCode(code)).toBe(false);
    }
  });
});

describe("couponAppliesTo", () => {
  it("matches each scope to its product types", () => {
    expect(couponAppliesTo("ALL", "SERVICE")).toBe(true);
    expect(couponAppliesTo("ALL", "DIGITAL_PRODUCT")).toBe(true);
    expect(couponAppliesTo("DIGITAL_PRODUCTS", "DIGITAL_PRODUCT")).toBe(true);
    expect(couponAppliesTo("DIGITAL_PRODUCTS", "SERVICE")).toBe(false);
    expect(couponAppliesTo("SERVICES", "SERVICE")).toBe(true);
    expect(couponAppliesTo("SERVICES", "DIGITAL_PRODUCT")).toBe(false);
  });
});

describe("couponExpired", () => {
  const lastDay = new Date("2026-10-10T00:00:00Z");

  it("never expires without a date", () => {
    expect(couponExpired(null, NOW)).toBe(false);
  });

  it("stays valid through the last day in UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T23:59:59.999Z"));
    expect(couponExpired(lastDay, new Date())).toBe(false);
  });

  it("expires at the start of the next UTC day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-11T00:00:00Z"));
    expect(couponExpired(lastDay, new Date())).toBe(true);
  });
});

describe("discountedUnitCents", () => {
  it("rounds the discount down to the cent", () => {
    // 15% of 4999 is 749.85; 749 comes off.
    expect(discountedUnitCents(4999, 15)).toBe(4250);
    expect(discountedUnitCents(4900, 10)).toBe(4410);
    expect(discountedUnitCents(50, 99)).toBe(1);
  });
});

describe("evaluateCoupon", () => {
  it("discounts every line for ALL, times its quantity", () => {
    const result = evaluateCoupon(coupon(), cart([digital, 3], [service, 1]), NOW);

    expect(result).toEqual({
      ok: true,
      couponId: "c1",
      code: "SAVE10",
      percentOff: 10,
      // 3 x 490 + 2990
      discountCents: 4460,
      totalCents: 4900 * 3 + 29900 - 4460,
      lines: [
        { productId: "p1", discountedUnitCents: 4410 },
        { productId: "s1", discountedUnitCents: 26910 },
      ],
    });
  });

  it("keeps ineligible lines at full price", () => {
    const result = evaluateCoupon(
      coupon({ appliesTo: "SERVICES" }),
      cart([digital, 2], [service, 1]),
      NOW,
    );

    expect(result).toMatchObject({
      ok: true,
      discountCents: 2990,
      totalCents: 9800 + 26910,
      lines: [
        { productId: "p1", discountedUnitCents: 4900 },
        { productId: "s1", discountedUnitCents: 26910 },
      ],
    });
  });

  it("treats an unknown and an inactive code the same", () => {
    const view = cart([digital, 1]);
    expect(evaluateCoupon(null, view, NOW)).toEqual({ ok: false, reason: "invalid" });
    expect(evaluateCoupon(coupon({ active: false }), view, NOW)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("rejects an expired code", () => {
    const result = evaluateCoupon(
      coupon({ expiresOn: new Date("2026-10-09T00:00:00Z") }),
      cart([digital, 1]),
      NOW,
    );
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a code that reached its maximum uses", () => {
    const view = cart([digital, 1]);
    expect(
      evaluateCoupon(coupon({ maxRedemptions: 5, redemptionCount: 5 }), view, NOW),
    ).toEqual({ ok: false, reason: "used_up" });
    expect(
      evaluateCoupon(coupon({ maxRedemptions: 5, redemptionCount: 4 }), view, NOW).ok,
    ).toBe(true);
  });

  it("rejects a cart with no eligible line", () => {
    const result = evaluateCoupon(
      coupon({ appliesTo: "DIGITAL_PRODUCTS" }),
      cart([service, 1]),
      NOW,
    );
    expect(result).toEqual({ ok: false, reason: "not_eligible" });
  });

  it("rejects a total under Stripe's $0.50 minimum", () => {
    const cheap = product({ id: "p2", priceCents: 50 });
    expect(evaluateCoupon(coupon({ percentOff: 50 }), cart([cheap, 1]), NOW)).toEqual({
      ok: false,
      reason: "below_minimum",
    });
    expect(evaluateCoupon(coupon({ percentOff: 50 }), cart([cheap, 2]), NOW).ok).toBe(true);
  });

  it("rejects an empty cart as not eligible", () => {
    expect(evaluateCoupon(coupon(), cart(), NOW)).toEqual({
      ok: false,
      reason: "not_eligible",
    });
  });
});
