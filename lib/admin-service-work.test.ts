import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({
  db: {
    orderItem: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));

import { ORDERS_PAGE_SIZE } from "./admin-orders";
import { getServiceOrder, listServiceOrders } from "./admin-service-work";

const paidServiceItem = {
  product: { type: "SERVICE" },
  order: { status: { in: ["PAID", "PROCESSING", "COMPLETED"] } },
};

beforeEach(() => {
  db.orderItem.count.mockReset().mockResolvedValue(0);
  db.orderItem.findMany.mockReset().mockResolvedValue([]);
  db.orderItem.findFirst.mockReset().mockResolvedValue(null);
});

describe("listServiceOrders", () => {
  it("lists only service items in paid orders, newest first", async () => {
    await listServiceOrders(undefined);
    expect(db.orderItem.count).toHaveBeenCalledWith({ where: paidServiceItem });
    const query = db.orderItem.findMany.mock.calls[0][0];
    expect(query.where).toEqual(paidServiceItem);
    expect(query.orderBy[0]).toEqual({ order: { createdAt: "desc" } });
    expect(query.skip).toBe(0);
    expect(query.take).toBe(ORDERS_PAGE_SIZE);
  });

  it("selects no notes, answers, files, or Stripe ids", async () => {
    await listServiceOrders(undefined);
    const { select } = db.orderItem.findMany.mock.calls[0][0];
    expect(select.service).toEqual({ select: { status: true } });
    expect(select.product).toEqual({ select: { name: true } });
    expect(Object.keys(select.order.select)).not.toContain("stripeCheckoutSessionId");
  });

  it("skips to the requested page", async () => {
    db.orderItem.count.mockResolvedValue(ORDERS_PAGE_SIZE + 1);
    const result = await listServiceOrders("2");
    expect(db.orderItem.findMany.mock.calls[0][0].skip).toBe(ORDERS_PAGE_SIZE);
    expect(result).toMatchObject({ page: 2, pageCount: 2, total: ORDERS_PAGE_SIZE + 1 });
  });

  it("maps rows, with no status before onboarding", async () => {
    const createdAt = new Date("2026-10-01T00:00:00Z");
    db.orderItem.count.mockResolvedValue(2);
    db.orderItem.findMany.mockResolvedValue([
      {
        id: "item1",
        product: { name: "Ads Management" },
        order: { id: "o1", number: 1001, createdAt, customerEmail: "a@b.co", user: null },
        service: null,
      },
      {
        id: "item2",
        product: { name: "Account Management" },
        order: { id: "o2", number: 1002, createdAt, customerEmail: null, user: { name: "Sara" } },
        service: { status: "IN_PROGRESS" },
      },
    ]);
    const { items } = await listServiceOrders(undefined);
    expect(items).toEqual([
      {
        itemId: "item1",
        serviceName: "Ads Management",
        customer: "a@b.co",
        orderId: "o1",
        orderNumber: 1001,
        purchasedAt: createdAt,
        status: null,
      },
      {
        itemId: "item2",
        serviceName: "Account Management",
        customer: "Sara",
        orderId: "o2",
        orderNumber: 1002,
        purchasedAt: createdAt,
        status: "IN_PROGRESS",
      },
    ]);
  });
});

describe("getServiceOrder", () => {
  it("does not query for an id that cannot exist", async () => {
    expect(await getServiceOrder("")).toBeNull();
    expect(await getServiceOrder("x".repeat(65))).toBeNull();
    expect(db.orderItem.findFirst).not.toHaveBeenCalled();
  });

  it("finds the item only as a service in a paid order", async () => {
    await getServiceOrder("item1");
    const query = db.orderItem.findFirst.mock.calls[0][0];
    expect(query.where).toEqual({ id: "item1", ...paidServiceItem });
    expect(Object.keys(query.select.order.select)).not.toContain("stripeCheckoutSessionId");
    expect(Object.keys(query.select.product.select)).not.toContain("digitalFile");
    expect(Object.keys(query.select.order.select.user.select)).toEqual(["name", "email"]);
  });

  it("returns null when no paid service item matches", async () => {
    expect(await getServiceOrder("item1")).toBeNull();
  });

  it("returns the item keyed by its id", async () => {
    const row = {
      id: "item1",
      product: { id: "p1", name: "Ads Management", durationDays: 30 },
      order: { id: "o1", number: 1001, createdAt: new Date(), customerEmail: null, user: null },
      service: null,
    };
    db.orderItem.findFirst.mockResolvedValue(row);
    expect(await getServiceOrder("item1")).toEqual({
      itemId: "item1",
      product: row.product,
      order: row.order,
      service: null,
    });
  });
});
