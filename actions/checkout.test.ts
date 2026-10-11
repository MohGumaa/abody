import { beforeEach, describe, expect, it, vi } from "vitest";

const { store, listPublishedProductsByIds, findUnique, createSession, redirect } = vi.hoisted(
  () => ({
    store: { get: vi.fn() },
    listPublishedProductsByIds: vi.fn(),
    findUnique: vi.fn(),
    createSession: vi.fn(),
    redirect: vi.fn((url: string) => {
      throw new Error(`redirect:${url}`);
    }),
  }),
);

vi.mock("next/headers", () => ({ cookies: async () => store }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/catalog", () => ({ listPublishedProductsByIds }));
vi.mock("@/lib/db", () => ({ db: { coupon: { findUnique } } }));
vi.mock("@/lib/session", () => ({ getCurrentUser: async () => null }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { create: createSession } } }),
}));

import { startCheckout } from "./checkout";

const digital = { id: "p1", name: "Guide", type: "DIGITAL_PRODUCT", priceCents: 4900 };

const coupon = {
  id: "c1",
  code: "SAVE10",
  percentOff: 10,
  appliesTo: "ALL",
  active: true,
  expiresOn: null,
  maxRedemptions: null,
  redemptionCount: 0,
};

function cookiesWith(code?: string) {
  store.get.mockImplementation((name: string) => {
    if (name === "cart") return { name, value: JSON.stringify([["p1", 2]]) };
    if (name === "coupon" && code) return { name, value: code };
    return undefined;
  });
}

function form(): FormData {
  const data = new FormData();
  data.set("lang", "en");
  return data;
}

beforeEach(() => {
  vi.stubEnv("SITE_URL", "https://abody.example");
  cookiesWith();
  listPublishedProductsByIds.mockReset().mockResolvedValue([digital]);
  findUnique.mockReset().mockResolvedValue(coupon);
  createSession.mockReset().mockResolvedValue({ url: "https://checkout.stripe.test/s" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("startCheckout with a discount code", () => {
  it("charges full price and sends no coupon without a saved code", async () => {
    await expect(startCheckout(null, form())).rejects.toThrow("redirect:");

    const params = createSession.mock.calls[0][0];
    expect(params.line_items[0].price_data.unit_amount).toBe(4900);
    expect(params.metadata).toEqual({ locale: "en" });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("charges the discounted price and sends the coupon in metadata", async () => {
    cookiesWith("SAVE10");

    await expect(startCheckout(null, form())).rejects.toThrow("redirect:");

    const params = createSession.mock.calls[0][0];
    expect(params.line_items[0].price_data.unit_amount).toBe(4410);
    expect(params.metadata).toEqual({ locale: "en", couponId: "c1", discountCents: "980" });
  });

  it("refuses a saved code that no longer applies, before creating a session", async () => {
    cookiesWith("SAVE10");
    findUnique.mockResolvedValue({ ...coupon, active: false });

    expect(await startCheckout(null, form())).toEqual({
      success: false,
      error: "coupon_invalid",
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("refuses a malformed saved code", async () => {
    cookiesWith("not a code");

    expect(await startCheckout(null, form())).toEqual({
      success: false,
      error: "coupon_invalid",
    });
    expect(createSession).not.toHaveBeenCalled();
  });
});
