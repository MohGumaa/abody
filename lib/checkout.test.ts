import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import type { CartView } from "@/lib/cart";
import type { PublicProduct } from "@/lib/catalog";
import {
  checkoutCustomer,
  checkoutLineItems,
  checkoutReturnUrls,
  checkoutState,
  isCheckoutSessionId,
  stripeCheckoutLocale,
} from "@/lib/checkout";
import { ProductType } from "@/lib/generated/prisma/enums";

function product(overrides: Partial<PublicProduct>): PublicProduct {
  return {
    id: "p1",
    name: "Digital Marketing Template",
    slug: "digital-marketing-template",
    shortDescription: "",
    description: "",
    priceCents: 4900,
    currency: "USD",
    type: ProductType.DIGITAL_PRODUCT,
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

beforeEach(() => {
  vi.stubEnv("SITE_URL", "https://abody.example");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("checkoutLineItems", () => {
  it("prices each line from the product and tags it with the product id", () => {
    const view: CartView = {
      lines: [
        {
          product: product({ name: "قالب التسويق الرقمي" }),
          quantity: 3,
          lineTotalCents: 14700,
        },
        {
          product: product({
            id: "s1",
            name: "Ads Management",
            priceCents: 29900,
            type: ProductType.SERVICE,
          }),
          quantity: 1,
          lineTotalCents: 29900,
        },
      ],
      subtotalCents: 44600,
      totalCents: 44600,
      itemCount: 4,
      removedCount: 0,
    };
    expect(checkoutLineItems(view)).toEqual([
      {
        quantity: 3,
        price_data: {
          currency: "usd",
          unit_amount: 4900,
          product_data: {
            name: "قالب التسويق الرقمي",
            metadata: { productId: "p1" },
          },
        },
      },
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: 29900,
          product_data: {
            name: "Ads Management",
            metadata: { productId: "s1" },
          },
        },
      },
    ]);
  });
});

describe("checkoutCustomer", () => {
  it("sends a signed-in customer's id and email", () => {
    expect(checkoutCustomer({ id: "u1", email: "a@b.co" })).toEqual({
      client_reference_id: "u1",
      customer_email: "a@b.co",
    });
  });

  it("sends nothing for a guest", () => {
    expect(checkoutCustomer(null)).toEqual({});
  });
});

describe("checkoutReturnUrls", () => {
  it("keeps the language prefix and the unencoded placeholder", () => {
    expect(checkoutReturnUrls("en")).toEqual({
      success_url:
        "https://abody.example/en/checkout/return?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://abody.example/en/cart?checkout=cancelled",
    });
    expect(checkoutReturnUrls("ar")).toEqual({
      success_url:
        "https://abody.example/ar/checkout/return?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://abody.example/ar/cart?checkout=cancelled",
    });
  });

  it("keeps a base path in SITE_URL", () => {
    vi.stubEnv("SITE_URL", "https://abody.example/shop");
    expect(checkoutReturnUrls("ar").cancel_url).toBe(
      "https://abody.example/shop/ar/cart?checkout=cancelled",
    );
  });
});

describe("isCheckoutSessionId", () => {
  it("accepts test and live session ids", () => {
    expect(isCheckoutSessionId("cs_test_a1B2c3_D4")).toBe(true);
    expect(isCheckoutSessionId("cs_live_a1B2c3")).toBe(true);
  });

  it("rejects anything else", () => {
    for (const value of [
      "",
      "cs_test_",
      "cs_other_abc",
      "pi_test_abc",
      "cs_test_abc/../x",
      "cs_test_abc?x=1",
      "cs_test_" + "a".repeat(248),
      null,
      undefined,
      42,
      ["cs_test_abc"],
    ]) {
      expect(isCheckoutSessionId(value)).toBe(false);
    }
    expect(isCheckoutSessionId("cs_test_" + "a".repeat(247))).toBe(true);
  });
});

describe("checkoutState", () => {
  it("is paid only for a complete, paid session", () => {
    expect(checkoutState({ status: "complete", payment_status: "paid" })).toBe(
      "paid",
    );
    expect(
      checkoutState({
        status: "complete",
        payment_status: "no_payment_required",
      }),
    ).toBe("paid");
  });

  it("is processing for a complete, unpaid or unknown payment status", () => {
    expect(
      checkoutState({ status: "complete", payment_status: "unpaid" }),
    ).toBe("processing");
    expect(
      checkoutState({ status: "complete", payment_status: "something_new" }),
    ).toBe("processing");
  });

  it("is not completed for open, expired, or missing status", () => {
    for (const status of ["open", "expired", null]) {
      expect(checkoutState({ status, payment_status: "paid" })).toBe(
        "not_completed",
      );
    }
  });
});

describe("stripeCheckoutLocale", () => {
  it("uses English for English and lets Stripe pick for Arabic", () => {
    expect(stripeCheckoutLocale("en")).toBe("en");
    expect(stripeCheckoutLocale("ar")).toBe("auto");
  });
});
