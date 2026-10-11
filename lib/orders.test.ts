import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import {
  canTransition,
  formatOrderNumber,
  orderDiscountFromMetadata,
  orderItemsFromLineItems,
  targetStatus,
} from "@/lib/orders";

const paid = { mode: "payment", payment_status: "paid" } as const;

describe("targetStatus", () => {
  it("marks a completed, paid session PAID", () => {
    expect(targetStatus("checkout.session.completed", paid)).toBe("PAID");
  });

  it("treats no_payment_required as PAID", () => {
    expect(
      targetStatus("checkout.session.completed", {
        mode: "payment",
        payment_status: "no_payment_required",
      }),
    ).toBe("PAID");
  });

  it("keeps a completed, unpaid session PENDING", () => {
    expect(
      targetStatus("checkout.session.completed", {
        mode: "payment",
        payment_status: "unpaid",
      }),
    ).toBe("PENDING");
  });

  it("maps async success to PAID and async failure to CANCELLED", () => {
    expect(
      targetStatus("checkout.session.async_payment_succeeded", paid),
    ).toBe("PAID");
    expect(
      targetStatus("checkout.session.async_payment_failed", {
        mode: "payment",
        payment_status: "unpaid",
      }),
    ).toBe("CANCELLED");
  });

  it("ignores other events and non-payment sessions", () => {
    expect(targetStatus("checkout.session.expired", paid)).toBeNull();
    expect(targetStatus("charge.refunded", paid)).toBeNull();
    expect(
      targetStatus("checkout.session.completed", {
        mode: "subscription",
        payment_status: "paid",
      }),
    ).toBeNull();
  });
});

describe("canTransition", () => {
  it("allows PENDING to PAID or CANCELLED", () => {
    expect(canTransition("PENDING", "PAID")).toBe(true);
    expect(canTransition("PENDING", "CANCELLED")).toBe(true);
  });

  it("rejects every other move", () => {
    expect(canTransition("PAID", "PENDING")).toBe(false);
    expect(canTransition("PAID", "CANCELLED")).toBe(false);
    expect(canTransition("CANCELLED", "PAID")).toBe(false);
    expect(canTransition("PENDING", "PENDING")).toBe(false);
    expect(canTransition("PAID", "PAID")).toBe(false);
    expect(canTransition("PROCESSING", "PAID")).toBe(false);
    expect(canTransition("REFUNDED", "PAID")).toBe(false);
  });
});

function line(overrides: {
  id?: string;
  productId?: string | null;
  unitAmount?: number | null;
  quantity?: number | null;
  product?: unknown;
}): Stripe.LineItem {
  const product =
    "product" in overrides
      ? overrides.product
      : {
          id: "prod_1",
          object: "product",
          metadata:
            overrides.productId === null
              ? {}
              : { productId: overrides.productId ?? "p1" },
        };
  return {
    id: overrides.id ?? "li_1",
    quantity: "quantity" in overrides ? overrides.quantity : 1,
    price: {
      unit_amount: "unitAmount" in overrides ? overrides.unitAmount : 4900,
      product,
    },
  } as unknown as Stripe.LineItem;
}

describe("orderItemsFromLineItems", () => {
  it("maps a product and a service line", () => {
    expect(
      orderItemsFromLineItems([
        line({ productId: "p1", unitAmount: 4900, quantity: 3 }),
        line({ id: "li_2", productId: "s1", unitAmount: 29900, quantity: 1 }),
      ]),
    ).toEqual([
      { productId: "p1", priceCents: 4900, quantity: 3 },
      { productId: "s1", priceCents: 29900, quantity: 1 },
    ]);
  });

  it("rejects an empty list", () => {
    expect(() => orderItemsFromLineItems([])).toThrow();
  });

  it("rejects a line without productId metadata", () => {
    expect(() => orderItemsFromLineItems([line({ productId: null })])).toThrow(
      /productId/,
    );
  });

  it("rejects an unexpanded or deleted product", () => {
    expect(() =>
      orderItemsFromLineItems([line({ product: "prod_1" })]),
    ).toThrow(/productId/);
    expect(() =>
      orderItemsFromLineItems([
        line({ product: { id: "prod_1", deleted: true } }),
      ]),
    ).toThrow(/productId/);
  });

  it("rejects a missing unit amount or quantity", () => {
    expect(() =>
      orderItemsFromLineItems([line({ unitAmount: null })]),
    ).toThrow(/unit amount/);
    expect(() => orderItemsFromLineItems([line({ quantity: null })])).toThrow(
      /quantity/,
    );
    expect(() => orderItemsFromLineItems([line({ quantity: 0 })])).toThrow(
      /quantity/,
    );
  });
});

describe("formatOrderNumber", () => {
  it("prefixes the number with #", () => {
    expect(formatOrderNumber(1001)).toBe("#1001");
  });
});

describe("orderDiscountFromMetadata", () => {
  it("is null without coupon keys", () => {
    expect(orderDiscountFromMetadata(null)).toBeNull();
    expect(orderDiscountFromMetadata({ locale: "en" })).toBeNull();
  });

  it("reads the coupon id and discount", () => {
    expect(
      orderDiscountFromMetadata({ locale: "ar", couponId: "c1", discountCents: "1470" }),
    ).toEqual({ couponId: "c1", discountCents: 1470 });
  });

  it("throws on a partial or malformed discount", () => {
    const cases: Stripe.Metadata[] = [
      { couponId: "c1" },
      { discountCents: "100" },
      { couponId: "", discountCents: "100" },
      { couponId: "c1", discountCents: "0" },
      { couponId: "c1", discountCents: "-5" },
      { couponId: "c1", discountCents: "12.5" },
      { couponId: "x".repeat(65), discountCents: "100" },
    ];
    for (const metadata of cases) {
      expect(() => orderDiscountFromMetadata(metadata)).toThrow(/discount metadata/);
    }
  });
});
