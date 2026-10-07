import { beforeEach, describe, expect, it, vi } from "vitest";

const { order, orderItem } = vi.hoisted(() => ({
  order: { count: vi.fn(), findMany: vi.fn() },
  orderItem: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: { order, orderItem } }));

import {
  findAccountService,
  getAccountCounts,
  initials,
  listAccountDownloads,
  listAccountOrders,
  listAccountServices,
} from "@/lib/account";

const PAID = { in: ["PAID", "PROCESSING", "COMPLETED"] };

// Every key named in a select tree, at any depth.
function selectedKeys(select: Record<string, unknown>): string[] {
  return Object.entries(select).flatMap(([key, value]) => {
    if (value && typeof value === "object" && "select" in value) {
      return [key, ...selectedKeys(value.select as Record<string, unknown>)];
    }
    return [key];
  });
}

beforeEach(() => {
  order.count.mockReset();
  order.findMany.mockReset();
  orderItem.count.mockReset();
  orderItem.findMany.mockReset();
  orderItem.findFirst.mockReset();
});

describe("getAccountCounts", () => {
  it("counts the user's orders and paid downloads and services", async () => {
    order.count.mockResolvedValue(4);
    orderItem.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);

    await expect(getAccountCounts("u1")).resolves.toEqual({
      orders: 4,
      downloads: 3,
      services: 1,
    });
    expect(order.count).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(orderItem.count).toHaveBeenNthCalledWith(1, {
      where: {
        order: { userId: "u1", status: PAID },
        product: { type: "DIGITAL_PRODUCT", digitalFile: { not: null } },
      },
    });
    expect(orderItem.count).toHaveBeenNthCalledWith(2, {
      where: {
        order: { userId: "u1", status: PAID },
        product: { type: "SERVICE" },
      },
    });
  });
});

describe("listAccountOrders", () => {
  it("lists only the user's orders, newest first, with flat items", async () => {
    const createdAt = new Date("2026-09-20T00:00:00Z");
    order.findMany.mockResolvedValue([
      {
        id: "o1",
        number: 1004,
        status: "PAID",
        totalCents: 4900,
        createdAt,
        items: [
          {
            id: "i1",
            priceCents: 4900,
            quantity: 1,
            product: { name: "Guide", nameAr: "دليل" },
          },
        ],
      },
    ]);

    await expect(listAccountOrders("u1", 5)).resolves.toEqual([
      {
        id: "o1",
        number: 1004,
        status: "PAID",
        totalCents: 4900,
        createdAt,
        items: [
          { id: "i1", priceCents: 4900, quantity: 1, name: "Guide", nameAr: "دليل" },
        ],
      },
    ]);
    const args = order.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ userId: "u1" });
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, { number: "desc" }]);
    expect(args.take).toBe(5);
    expect(selectedKeys(args.select)).not.toContain("digitalFile");
    expect(selectedKeys(args.select)).not.toContain("stripeCheckoutSessionId");
  });

  it("passes no limit when none is given", async () => {
    order.findMany.mockResolvedValue([]);
    await expect(listAccountOrders("u1")).resolves.toEqual([]);
    expect(order.findMany.mock.calls[0][0].take).toBeUndefined();
  });
});

describe("listAccountDownloads", () => {
  it("lists downloadable items in the user's paid orders", async () => {
    const createdAt = new Date("2026-09-12T00:00:00Z");
    orderItem.findMany.mockResolvedValue([
      {
        id: "i1",
        product: { name: "Template", nameAr: null },
        order: { number: 1003, createdAt, stripeCheckoutSessionId: "cs_test_1" },
      },
    ]);

    await expect(listAccountDownloads("u1", 3)).resolves.toEqual([
      {
        itemId: "i1",
        name: "Template",
        nameAr: null,
        orderNumber: 1003,
        purchasedAt: createdAt,
        checkoutSessionId: "cs_test_1",
      },
    ]);
    const args = orderItem.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      order: { userId: "u1", status: PAID },
      product: { type: "DIGITAL_PRODUCT", digitalFile: { not: null } },
    });
    expect(args.orderBy[0]).toEqual({ order: { createdAt: "desc" } });
    expect(args.take).toBe(3);
    expect(selectedKeys(args.select)).not.toContain("digitalFile");
  });
});

describe("listAccountServices", () => {
  it("lists service items in the user's paid orders", async () => {
    const createdAt = new Date("2026-09-20T00:00:00Z");
    orderItem.findMany.mockResolvedValue([
      {
        id: "i2",
        product: { name: "Ads Management", nameAr: "إدارة الإعلانات" },
        order: { number: 1004, status: "PROCESSING", createdAt },
        service: { status: "NEW" },
      },
      {
        id: "i3",
        product: { name: "Account Management", nameAr: null },
        order: { number: 1003, status: "PAID", createdAt },
        service: null,
      },
    ]);

    await expect(listAccountServices("u1")).resolves.toEqual([
      {
        itemId: "i2",
        name: "Ads Management",
        nameAr: "إدارة الإعلانات",
        orderNumber: 1004,
        orderStatus: "PROCESSING",
        purchasedAt: createdAt,
        serviceStatus: "NEW",
      },
      {
        itemId: "i3",
        name: "Account Management",
        nameAr: null,
        orderNumber: 1003,
        orderStatus: "PAID",
        purchasedAt: createdAt,
        serviceStatus: null,
      },
    ]);
    const args = orderItem.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      order: { userId: "u1", status: PAID },
      product: { type: "SERVICE" },
    });
    expect(args.orderBy[0]).toEqual({ order: { createdAt: "desc" } });
    expect(selectedKeys(args.select)).not.toContain("digitalFile");
    expect(selectedKeys(args.select)).not.toContain("stripeCheckoutSessionId");
    expect(selectedKeys(args.select)).not.toContain("requirements");
  });
});

describe("findAccountService", () => {
  const createdAt = new Date("2026-09-20T00:00:00Z");

  it("returns the user's paid service item with its record", async () => {
    const record = {
      status: "IN_PROGRESS",
      requirements: { businessName: "Layla Cafe" },
      createdAt,
      startDate: createdAt,
      completedDate: null,
      updatedAt: createdAt,
    };
    orderItem.findFirst.mockResolvedValue({
      id: "i2",
      product: { name: "Ads Management", nameAr: "إدارة الإعلانات" },
      order: { number: 1004, createdAt },
      service: record,
    });

    await expect(findAccountService("u1", "i2")).resolves.toEqual({
      itemId: "i2",
      name: "Ads Management",
      nameAr: "إدارة الإعلانات",
      orderNumber: 1004,
      purchasedAt: createdAt,
      service: record,
    });
    const args = orderItem.findFirst.mock.calls[0][0];
    expect(args.where).toEqual({
      id: "i2",
      order: { userId: "u1", status: PAID },
      product: { type: "SERVICE" },
    });
    const keys = selectedKeys(args.select);
    expect(keys).not.toContain("adminNotes");
    expect(keys).not.toContain("digitalFile");
    expect(keys).not.toContain("stripeCheckoutSessionId");
  });

  it("returns an item with no record yet", async () => {
    orderItem.findFirst.mockResolvedValue({
      id: "i3",
      product: { name: "Account Management", nameAr: null },
      order: { number: 1003, createdAt },
      service: null,
    });
    const result = await findAccountService("u1", "i3");
    expect(result?.service).toBeNull();
  });

  it("returns null when nothing matches", async () => {
    orderItem.findFirst.mockResolvedValue(null);
    await expect(findAccountService("u1", "other")).resolves.toBeNull();
  });

  it.each([
    { label: "empty", itemId: "" },
    { label: "over-long", itemId: "x".repeat(65) },
    { label: "missing", itemId: undefined },
  ])(
    "returns null without a query for a $label id",
    async ({ itemId }) => {
      await expect(findAccountService("u1", itemId)).resolves.toBeNull();
      expect(orderItem.findFirst).not.toHaveBeenCalled();
    },
  );
});

describe("initials", () => {
  it("takes the first letters of the first two words", () => {
    expect(initials("layla mansour ahmed")).toBe("LM");
    expect(initials("  Layla  ")).toBe("L");
    expect(initials("ليلى منصور")).toBe("لم");
  });
});
