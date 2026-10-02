import { beforeEach, describe, expect, it, vi } from "vitest";

const { store, listPublishedProductsByIds } = vi.hoisted(() => ({
  store: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  listPublishedProductsByIds: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => store }));
vi.mock("@/lib/catalog", () => ({ listPublishedProductsByIds }));

import { addToCart, removeFromCart, updateCartQuantity } from "./cart";

const digital = { id: "p1", type: "DIGITAL_PRODUCT", priceCents: 4900 };
const service = { id: "s1", type: "SERVICE", priceCents: 30000 };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function setCookie(value: unknown) {
  store.get.mockReturnValue({ name: "cart", value: JSON.stringify(value) });
}

function savedCart(): unknown {
  const [name, value] = store.set.mock.calls.at(-1) ?? [];
  expect(name).toBe("cart");
  return JSON.parse(value);
}

beforeEach(() => {
  store.get.mockReset().mockReturnValue(undefined);
  store.set.mockReset();
  store.delete.mockReset();
  listPublishedProductsByIds.mockReset().mockResolvedValue([digital, service]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("addToCart", () => {
  it("adds a new item and writes the cookie", async () => {
    const result = await addToCart(null, form({ productId: "p1" }));

    expect(result).toEqual({
      success: true,
      data: { outcome: "added", count: 1 },
    });
    expect(savedCart()).toEqual([["p1", 1]]);
    expect(store.set.mock.calls[0][2]).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  });

  it("looks up the cart and the target in one query", async () => {
    setCookie([["s1", 1]]);

    await addToCart(null, form({ productId: "p1" }));

    expect(listPublishedProductsByIds).toHaveBeenCalledTimes(1);
    expect(listPublishedProductsByIds.mock.calls[0][0]).toEqual(["s1", "p1"]);
  });

  it("keeps a service already in the cart at one", async () => {
    setCookie([["s1", 1]]);

    const result = await addToCart(null, form({ productId: "s1" }));

    expect(result).toEqual({
      success: true,
      data: { outcome: "already_in_cart", count: 1 },
    });
    expect(savedCart()).toEqual([["s1", 1]]);
  });

  it("rejects an unpublished or unknown product", async () => {
    listPublishedProductsByIds.mockResolvedValue([]);

    const result = await addToCart(null, form({ productId: "gone" }));

    expect(result).toEqual({ success: false, error: "unavailable" });
    expect(store.set).not.toHaveBeenCalled();
  });

  it("rejects a malformed id without querying", async () => {
    const cases: Record<string, string>[] = [{ productId: "bad id" }, {}];
    for (const fields of cases) {
      expect(await addToCart(null, form(fields))).toEqual({
        success: false,
        error: "invalid_input",
      });
    }
    expect(listPublishedProductsByIds).not.toHaveBeenCalled();
  });

  it("reports a full cart", async () => {
    const ids = Array.from({ length: 50 }, (_, i) => `id${i}`);
    setCookie(ids.map((id) => [id, 1]));
    listPublishedProductsByIds.mockResolvedValue([
      digital,
      ...ids.map((id) => ({ id, type: "DIGITAL_PRODUCT" })),
    ]);

    const result = await addToCart(null, form({ productId: "p1" }));

    expect(result).toEqual({ success: false, error: "cart_full" });
    expect(store.set).not.toHaveBeenCalled();
  });

  it("drops items that are no longer published when it writes", async () => {
    setCookie([
      ["gone", 2],
      ["s1", 1],
    ]);

    const result = await addToCart(null, form({ productId: "p1" }));

    expect(savedCart()).toEqual([
      ["s1", 1],
      ["p1", 1],
    ]);
    expect(result).toEqual({
      success: true,
      data: { outcome: "added", count: 2 },
    });
  });

  it("returns unexpected when the lookup fails", async () => {
    listPublishedProductsByIds.mockRejectedValue(new Error("db down"));

    const result = await addToCart(null, form({ productId: "p1" }));

    expect(result).toEqual({ success: false, error: "unexpected" });
    expect(console.error).toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
  });
});

describe("updateCartQuantity", () => {
  it("sets a digital product's quantity", async () => {
    setCookie([["p1", 1]]);

    const result = await updateCartQuantity(
      null,
      form({ productId: "p1", quantity: "4" }),
    );

    expect(result).toEqual({
      success: true,
      data: { outcome: "updated", count: 4 },
    });
    expect(savedCart()).toEqual([["p1", 4]]);
  });

  it("keeps a service at one", async () => {
    setCookie([["s1", 1]]);

    await updateCartQuantity(null, form({ productId: "s1", quantity: "3" }));

    expect(savedCart()).toEqual([["s1", 1]]);
  });

  it("rejects quantities outside 1 to 99", async () => {
    setCookie([["p1", 1]]);

    for (const quantity of ["0", "100", "abc", ""]) {
      expect(
        await updateCartQuantity(null, form({ productId: "p1", quantity })),
      ).toEqual({ success: false, error: "invalid_input" });
    }
    expect(store.set).not.toHaveBeenCalled();
  });

  it("rejects a product that is not in the cart", async () => {
    setCookie([["s1", 1]]);
    listPublishedProductsByIds.mockResolvedValue([service]);

    const result = await updateCartQuantity(
      null,
      form({ productId: "p1", quantity: "2" }),
    );

    expect(result).toEqual({ success: false, error: "unavailable" });
    expect(store.set).not.toHaveBeenCalled();
  });

  it("returns unexpected when the lookup fails", async () => {
    setCookie([["p1", 1]]);
    listPublishedProductsByIds.mockRejectedValue(new Error("db down"));

    expect(
      await updateCartQuantity(null, form({ productId: "p1", quantity: "2" })),
    ).toEqual({ success: false, error: "unexpected" });
  });
});

describe("removeFromCart", () => {
  it("removes the item and keeps the rest", async () => {
    setCookie([
      ["p1", 2],
      ["s1", 1],
    ]);

    const result = await removeFromCart(null, form({ productId: "p1" }));

    expect(result).toEqual({
      success: true,
      data: { outcome: "removed", count: 1 },
    });
    expect(savedCart()).toEqual([["s1", 1]]);
  });

  it("deletes the cookie when the cart becomes empty", async () => {
    setCookie([["p1", 2]]);

    await removeFromCart(null, form({ productId: "p1" }));

    expect(store.delete).toHaveBeenCalledWith("cart");
    expect(store.set).not.toHaveBeenCalled();
  });

  it("succeeds for an item that is not in the cart", async () => {
    setCookie([["s1", 1]]);

    expect(await removeFromCart(null, form({ productId: "p1" }))).toEqual({
      success: true,
      data: { outcome: "removed", count: 1 },
    });
  });

  it("rejects a malformed id", async () => {
    expect(await removeFromCart(null, form({ productId: "" }))).toEqual({
      success: false,
      error: "invalid_input",
    });
  });
});
