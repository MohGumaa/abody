import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({
  db: {
    user: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    order: { findMany: vi.fn() },
    orderItem: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));

import { getAdminCustomer, isActiveService, listAdminCustomers } from "./admin-customers";
import { ORDERS_PAGE_SIZE } from "./admin-orders";

const PAID = { in: ["PAID", "PROCESSING", "COMPLETED"] };

beforeEach(() => {
  db.user.count.mockReset().mockResolvedValue(0);
  db.user.findMany.mockReset().mockResolvedValue([]);
  db.user.findFirst.mockReset().mockResolvedValue(null);
  db.order.findMany.mockReset().mockResolvedValue([]);
  db.orderItem.findMany.mockReset().mockResolvedValue([]);
});

describe("isActiveService", () => {
  it.each([
    [null, true],
    ["NEW", true],
    ["WAITING_FOR_INFORMATION", true],
    ["IN_PROGRESS", true],
    ["COMPLETED", false],
    ["CANCELLED", false],
  ] as const)("treats %s as active: %s", (status, active) => {
    expect(isActiveService(status)).toBe(active);
  });
});

describe("listAdminCustomers", () => {
  it("reads one page of customer accounts, newest first", async () => {
    db.user.count.mockResolvedValue(ORDERS_PAGE_SIZE + 1);
    const result = await listAdminCustomers("2");
    expect(db.user.count.mock.calls[0][0]).toEqual({ where: { role: "CUSTOMER" } });
    const query = db.user.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ role: "CUSTOMER" });
    expect(query.orderBy).toEqual([{ createdAt: "desc" }, { id: "asc" }]);
    expect(query.skip).toBe(ORDERS_PAGE_SIZE);
    expect(query.take).toBe(ORDERS_PAGE_SIZE);
    expect(Object.keys(query.select)).toEqual(["id", "name", "email", "createdAt", "_count"]);
    expect(result).toMatchObject({ page: 2, pageCount: 2, total: ORDERS_PAGE_SIZE + 1 });
  });

  it("falls back to the nearest valid page", async () => {
    db.user.count.mockResolvedValue(3);
    expect((await listAdminCustomers("9")).page).toBe(1);
    expect(db.user.findMany.mock.calls[0][0].skip).toBe(0);
  });

  it("maps the order count", async () => {
    const createdAt = new Date("2026-10-01T00:00:00Z");
    db.user.count.mockResolvedValue(1);
    db.user.findMany.mockResolvedValue([
      { id: "u1", name: "Layla", email: "l@example.com", createdAt, _count: { orders: 4 } },
    ]);
    const { customers } = await listAdminCustomers(undefined);
    expect(customers).toEqual([
      { id: "u1", name: "Layla", email: "l@example.com", createdAt, orderCount: 4 },
    ]);
  });
});

describe("getAdminCustomer", () => {
  const createdAt = new Date("2026-10-01T00:00:00Z");

  it("skips every query for an oversized or empty id", async () => {
    expect(await getAdminCustomer("x".repeat(65))).toBeNull();
    expect(await getAdminCustomer("")).toBeNull();
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });

  it("scopes the lookup to customer accounts and returns null on a miss", async () => {
    expect(await getAdminCustomer("u1")).toBeNull();
    const query = db.user.findFirst.mock.calls[0][0];
    expect(query.where).toEqual({ id: "u1", role: "CUSTOMER" });
    expect(Object.keys(query.select)).toEqual(["id", "name", "email", "createdAt"]);
    expect(db.order.findMany).not.toHaveBeenCalled();
    expect(db.orderItem.findMany).not.toHaveBeenCalled();
  });

  it("reads the customer's orders, downloads, and services", async () => {
    db.user.findFirst.mockResolvedValue({ id: "u1", name: "Layla", email: "l@example.com", createdAt });
    db.order.findMany.mockResolvedValue([
      {
        id: "o1",
        number: 1001,
        status: "REFUNDED",
        totalCents: 900,
        createdAt,
        items: [{ id: "i1", quantity: 2, product: { name: "Guide" } }],
      },
    ]);
    db.orderItem.findMany
      .mockResolvedValueOnce([
        { id: "i2", product: { id: "p1", name: "Guide" }, order: { id: "o2", number: 1002, createdAt } },
      ])
      .mockResolvedValueOnce([
        { id: "i3", product: { name: "Ads" }, order: { id: "o2", number: 1002, createdAt }, service: null },
        { id: "i4", product: { name: "Ads" }, order: { id: "o2", number: 1002, createdAt }, service: { status: "COMPLETED" } },
        { id: "i5", product: { name: "Ads" }, order: { id: "o2", number: 1002, createdAt }, service: { status: "IN_PROGRESS" } },
      ]);

    const customer = await getAdminCustomer("u1");

    const orderQuery = db.order.findMany.mock.calls[0][0];
    expect(orderQuery.where).toEqual({ userId: "u1" });
    expect(orderQuery.orderBy).toEqual([{ createdAt: "desc" }, { number: "desc" }]);

    const [downloadQuery, serviceQuery] = db.orderItem.findMany.mock.calls.map((call) => call[0]);
    expect(downloadQuery.where).toEqual({
      order: { userId: "u1", status: PAID },
      product: { type: "DIGITAL_PRODUCT", digitalFile: { not: null } },
    });
    expect(serviceQuery.where).toEqual({
      product: { type: "SERVICE" },
      order: { userId: "u1", status: PAID },
    });
    expect(downloadQuery.select.product.select).not.toHaveProperty("digitalFile");
    expect(downloadQuery.select.order.select).not.toHaveProperty("stripeCheckoutSessionId");
    expect(serviceQuery.select.service.select).toEqual({ status: true });

    expect(customer).toEqual({
      profile: { id: "u1", name: "Layla", email: "l@example.com", createdAt },
      orders: [
        {
          id: "o1",
          number: 1001,
          status: "REFUNDED",
          totalCents: 900,
          createdAt,
          items: [{ id: "i1", name: "Guide", quantity: 2 }],
        },
      ],
      downloads: [
        { itemId: "i2", productId: "p1", name: "Guide", orderId: "o2", orderNumber: 1002, purchasedAt: createdAt },
      ],
      services: [
        { itemId: "i3", name: "Ads", orderId: "o2", orderNumber: 1002, purchasedAt: createdAt, status: null, active: true },
        { itemId: "i4", name: "Ads", orderId: "o2", orderNumber: 1002, purchasedAt: createdAt, status: "COMPLETED", active: false },
        { itemId: "i5", name: "Ads", orderId: "o2", orderNumber: 1002, purchasedAt: createdAt, status: "IN_PROGRESS", active: true },
      ],
      counts: { orders: 1, downloads: 1, activeServices: 2 },
    });
  });
});
