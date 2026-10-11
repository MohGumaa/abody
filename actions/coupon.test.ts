import { beforeEach, describe, expect, it, vi } from "vitest";

const { store, listPublishedProductsByIds, findUnique, reserveRateLimit } = vi.hoisted(() => ({
  store: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  listPublishedProductsByIds: vi.fn(),
  findUnique: vi.fn(),
  reserveRateLimit: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => store,
  headers: async () => new Headers(),
}));
vi.mock("@/lib/rate-limit", () => ({ clientKey: () => "ip", reserveRateLimit }));
vi.mock("@/lib/catalog", () => ({ listPublishedProductsByIds }));
vi.mock("@/lib/db", () => ({ db: { coupon: { findUnique } } }));

import { applyCoupon, removeCoupon } from "./coupon";

const digital = { id: "p1", type: "DIGITAL_PRODUCT", priceCents: 4900 };
const service = { id: "s1", type: "SERVICE", priceCents: 29900 };

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

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  store.get.mockReset().mockImplementation((name: string) =>
    name === "cart" ? { name, value: JSON.stringify([["p1", 2]]) } : undefined,
  );
  store.set.mockReset();
  store.delete.mockReset();
  listPublishedProductsByIds.mockReset().mockResolvedValue([digital, service]);
  findUnique.mockReset().mockResolvedValue(coupon);
  reserveRateLimit.mockReset().mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("applyCoupon", () => {
  it("saves the normalized code in the cookie", async () => {
    expect(await applyCoupon(null, form({ code: "  save10 " }))).toEqual({ success: true });

    expect(findUnique.mock.calls[0][0].where).toEqual({ code: "SAVE10" });
    expect(store.set).toHaveBeenCalledWith("coupon", "SAVE10", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  });

  it("rejects a missing field", async () => {
    expect(await applyCoupon(null, form({}))).toEqual({
      success: false,
      error: "invalid_input",
    });
    expect(store.set).not.toHaveBeenCalled();
  });

  it("treats a malformed or overlong code as invalid without a query", async () => {
    for (const code of ["", "a b", "x".repeat(65)]) {
      expect(await applyCoupon(null, form({ code }))).toEqual({
        success: false,
        error: "invalid",
      });
    }
    expect(findUnique).not.toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
  });

  it("rejects an empty cart before looking up the code", async () => {
    store.get.mockReturnValue(undefined);

    expect(await applyCoupon(null, form({ code: "SAVE10" }))).toEqual({
      success: false,
      error: "empty_cart",
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid", null],
    ["invalid", { ...coupon, active: false }],
    ["expired", { ...coupon, expiresOn: new Date("2020-01-01T00:00:00Z") }],
    ["used_up", { ...coupon, maxRedemptions: 1, redemptionCount: 1 }],
    ["not_eligible", { ...coupon, appliesTo: "SERVICES" }],
  ])("returns %s and leaves the cookie alone", async (reason, found) => {
    findUnique.mockResolvedValue(found);

    expect(await applyCoupon(null, form({ code: "SAVE10" }))).toEqual({
      success: false,
      error: reason,
    });
    expect(store.set).not.toHaveBeenCalled();
  });

  it("returns below_minimum for a total under $0.50", async () => {
    listPublishedProductsByIds.mockResolvedValue([{ ...digital, priceCents: 50 }]);
    store.get.mockImplementation((name: string) =>
      name === "cart" ? { name, value: JSON.stringify([["p1", 1]]) } : undefined,
    );
    findUnique.mockResolvedValue({ ...coupon, percentOff: 50 });

    expect(await applyCoupon(null, form({ code: "SAVE10" }))).toEqual({
      success: false,
      error: "below_minimum",
    });
  });

  it("returns unexpected when the lookup fails", async () => {
    findUnique.mockRejectedValue(new Error("db down"));

    expect(await applyCoupon(null, form({ code: "SAVE10" }))).toEqual({
      success: false,
      error: "unexpected",
    });
    expect(console.error).toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
  });

  it("counts every attempt against the visitor's limit", async () => {
    store.get.mockReturnValue(undefined);

    await applyCoupon(null, form({ code: "SAVE10" }));

    expect(reserveRateLimit).toHaveBeenCalledWith("coupon", "ip");
  });

  it("stops at the limit without looking up the code", async () => {
    reserveRateLimit.mockResolvedValue(false);

    expect(await applyCoupon(null, form({ code: "SAVE10" }))).toEqual({
      success: false,
      error: "rate_limited",
    });
    expect(findUnique).not.toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
  });

  it("does not count a request without a code field", async () => {
    await applyCoupon(null, form({}));

    expect(reserveRateLimit).not.toHaveBeenCalled();
  });
});

describe("removeCoupon", () => {
  it("deletes the cookie", async () => {
    expect(await removeCoupon()).toEqual({ success: true });
    expect(store.delete).toHaveBeenCalledWith("coupon");
  });
});
