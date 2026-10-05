import { describe, expect, it } from "vitest";
import {
  addCartItem,
  buildCartView,
  cartItemCount,
  MAX_CART_LINES,
  parseCart,
  parseQuantity,
  removeCartItem,
  serializeCart,
  setCartQuantity,
  type CartEntry,
} from "@/lib/cart";
import type { PublicProduct } from "@/lib/catalog";

const digital = { id: "p1", type: "DIGITAL_PRODUCT" as const };
const service = { id: "s1", type: "SERVICE" as const };

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

function lines(count: number): CartEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    productId: `id${i}`,
    quantity: 1,
  }));
}

describe("parseCart", () => {
  it("returns an empty cart for missing or malformed values", () => {
    expect(parseCart(undefined)).toEqual([]);
    expect(parseCart("")).toEqual([]);
    expect(parseCart("not json")).toEqual([]);
    expect(parseCart('{"p1":1}')).toEqual([]);
    expect(parseCart("null")).toEqual([]);
  });

  it("keeps valid entries in order", () => {
    expect(parseCart('[["p1",2],["s1",1]]')).toEqual([
      { productId: "p1", quantity: 2 },
      { productId: "s1", quantity: 1 },
    ]);
  });

  it("drops entries with a bad shape", () => {
    expect(
      parseCart('[["p1"],["p2",1,3],"p3",{"id":"p4"},null,["p5",1]]'),
    ).toEqual([{ productId: "p5", quantity: 1 }]);
  });

  it("drops bad ids", () => {
    const tooLong = "a".repeat(65);
    expect(
      parseCart(JSON.stringify([["", 1], ["a b", 1], [tooLong, 1], [5, 1], ["ok_-1", 1]])),
    ).toEqual([{ productId: "ok_-1", quantity: 1 }]);
  });

  it("drops quantities that are not whole numbers from 1 to 99", () => {
    expect(
      parseCart('[["a",0],["b",100],["c",1.5],["d","2"],["e",-1],["f",99]]'),
    ).toEqual([{ productId: "f", quantity: 99 }]);
  });

  it("keeps only the first of duplicate ids", () => {
    expect(parseCart('[["p1",2],["p1",5]]')).toEqual([
      { productId: "p1", quantity: 2 },
    ]);
  });

  it("stops at the line limit", () => {
    const raw = serializeCart(lines(MAX_CART_LINES + 5));
    expect(parseCart(raw)).toHaveLength(MAX_CART_LINES);
  });

  it("round-trips through serializeCart", () => {
    const entries = [
      { productId: "p1", quantity: 3 },
      { productId: "s1", quantity: 1 },
    ];
    expect(parseCart(serializeCart(entries))).toEqual(entries);
  });
});

describe("parseQuantity", () => {
  it("accepts whole numbers from 1 to 99", () => {
    expect(parseQuantity("1")).toBe(1);
    expect(parseQuantity("99")).toBe(99);
  });

  it("rejects anything else", () => {
    for (const value of ["0", "100", "abc", "1.5", "-1", "", " 2", null, 3]) {
      expect(parseQuantity(value)).toBeNull();
    }
  });
});

describe("addCartItem", () => {
  it("appends a new item with quantity 1", () => {
    const result = addCartItem([], digital);
    expect(result).toEqual({
      entries: [{ productId: "p1", quantity: 1 }],
      outcome: "added",
    });
  });

  it("increments a digital product already in the cart", () => {
    const result = addCartItem([{ productId: "p1", quantity: 2 }], digital);
    expect(result.outcome).toBe("added");
    expect(result.entries).toEqual([{ productId: "p1", quantity: 3 }]);
  });

  it("keeps a service at one", () => {
    const entries = [{ productId: "s1", quantity: 1 }];
    expect(addCartItem(entries, service)).toEqual({
      entries,
      outcome: "already_in_cart",
    });
  });

  it("stops a digital product at the maximum quantity", () => {
    const entries = [{ productId: "p1", quantity: 99 }];
    expect(addCartItem(entries, digital)).toEqual({
      entries,
      outcome: "max_quantity",
    });
  });

  it("refuses a new line when the cart is full", () => {
    const entries = lines(MAX_CART_LINES);
    expect(addCartItem(entries, digital)).toEqual({
      entries,
      outcome: "cart_full",
    });
  });

  it("still increments an existing line when the cart is full", () => {
    const entries = lines(MAX_CART_LINES);
    const result = addCartItem(entries, { id: "id0", type: "DIGITAL_PRODUCT" });
    expect(result.outcome).toBe("added");
    expect(result.entries[0].quantity).toBe(2);
  });
});

describe("setCartQuantity", () => {
  it("sets a digital product's quantity", () => {
    expect(
      setCartQuantity([{ productId: "p1", quantity: 1 }], digital, 5),
    ).toEqual([{ productId: "p1", quantity: 5 }]);
  });

  it("keeps a service at one", () => {
    expect(
      setCartQuantity([{ productId: "s1", quantity: 1 }], service, 4),
    ).toEqual([{ productId: "s1", quantity: 1 }]);
  });

  it("leaves the cart unchanged for a missing id", () => {
    const entries = [{ productId: "p2", quantity: 1 }];
    expect(setCartQuantity(entries, digital, 5)).toEqual(entries);
  });
});

describe("removeCartItem and cartItemCount", () => {
  it("removes only the matching line", () => {
    expect(
      removeCartItem(
        [
          { productId: "p1", quantity: 2 },
          { productId: "s1", quantity: 1 },
        ],
        "p1",
      ),
    ).toEqual([{ productId: "s1", quantity: 1 }]);
  });

  it("sums quantities", () => {
    expect(cartItemCount([])).toBe(0);
    expect(
      cartItemCount([
        { productId: "p1", quantity: 2 },
        { productId: "s1", quantity: 1 },
      ]),
    ).toBe(3);
  });
});

describe("buildCartView", () => {
  it("prices lines from the products in cookie order", () => {
    const view = buildCartView(
      [
        { productId: "s1", quantity: 1 },
        { productId: "p1", quantity: 2 },
      ],
      [
        product({ id: "p1", priceCents: 4900 }),
        product({ id: "s1", type: "SERVICE", priceCents: 30000 }),
      ],
    );

    expect(view.lines.map((line) => [line.product.id, line.quantity, line.lineTotalCents])).toEqual([
      ["s1", 1, 30000],
      ["p1", 2, 9800],
    ]);
    expect(view.subtotalCents).toBe(39800);
    expect(view.totalCents).toBe(39800);
    expect(view.itemCount).toBe(3);
    expect(view.removedCount).toBe(0);
  });

  it("shows a service at quantity one whatever the cookie says", () => {
    const view = buildCartView(
      [{ productId: "s1", quantity: 3 }],
      [product({ id: "s1", type: "SERVICE", priceCents: 1000 })],
    );
    expect(view.lines[0].quantity).toBe(1);
    expect(view.totalCents).toBe(1000);
    expect(view.itemCount).toBe(1);
  });

  it("counts entries with no published product", () => {
    const view = buildCartView(
      [
        { productId: "gone", quantity: 1 },
        { productId: "p1", quantity: 1 },
      ],
      [product({ id: "p1" })],
    );
    expect(view.lines).toHaveLength(1);
    expect(view.removedCount).toBe(1);
  });

  it("handles an empty cart", () => {
    expect(buildCartView([], [])).toEqual({
      lines: [],
      subtotalCents: 0,
      totalCents: 0,
      itemCount: 0,
      removedCount: 0,
    });
  });
});
