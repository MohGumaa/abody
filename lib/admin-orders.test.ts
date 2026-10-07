import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({
  db: {
    order: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));

import {
  ORDERS_PAGE_SIZE,
  getAdminOrder,
  isFulfilmentStatus,
  listAdminOrders,
  parsePage,
  paymentStatusLabel,
} from "./admin-orders";

beforeEach(() => {
  db.order.count.mockReset().mockResolvedValue(0);
  db.order.findMany.mockReset().mockResolvedValue([]);
  db.order.findUnique.mockReset().mockResolvedValue(null);
});

describe("paymentStatusLabel", () => {
  it.each([
    ["PENDING", "Awaiting payment"],
    ["PAID", "Paid"],
    ["PROCESSING", "Paid"],
    ["COMPLETED", "Paid"],
    ["CANCELLED", "Not paid"],
    ["REFUNDED", "Refunded"],
  ] as const)("labels %s as %s", (status, label) => {
    expect(paymentStatusLabel(status)).toBe(label);
  });
});

describe("isFulfilmentStatus", () => {
  it.each(["PAID", "PROCESSING", "COMPLETED"])("allows %s", (status) => {
    expect(isFulfilmentStatus(status)).toBe(true);
  });

  it.each(["PENDING", "CANCELLED", "REFUNDED", "paid", "", null, 1])(
    "rejects %s",
    (status) => {
      expect(isFulfilmentStatus(status)).toBe(false);
    },
  );
});

describe("parsePage", () => {
  const threePages = ORDERS_PAGE_SIZE * 2 + 1;

  it.each([
    [undefined, 1],
    ["1", 1],
    ["2", 2],
    ["3", 3],
    ["0", 1],
    ["-1", 1],
    ["2.5", 1],
    ["abc", 1],
    ["1e2", 1],
    ["4", 3],
    ["9999999", 1],
  ])("reads %s as page %i of three", (value, page) => {
    expect(parsePage(value, threePages)).toBe(page);
  });

  it("treats a repeated query value as missing", () => {
    expect(parsePage(["2", "3"], threePages)).toBe(1);
  });

  it("shows page 1 when there are no orders", () => {
    expect(parsePage("5", 0)).toBe(1);
  });
});

describe("listAdminOrders", () => {
  const createdAt = new Date("2026-10-01T00:00:00Z");

  it("reads one page, newest first", async () => {
    db.order.count.mockResolvedValue(ORDERS_PAGE_SIZE + 1);
    const result = await listAdminOrders("2");
    const query = db.order.findMany.mock.calls[0][0];
    expect(query.orderBy).toEqual([{ createdAt: "desc" }, { number: "desc" }]);
    expect(query.skip).toBe(ORDERS_PAGE_SIZE);
    expect(query.take).toBe(ORDERS_PAGE_SIZE);
    expect(result).toMatchObject({ page: 2, pageCount: 2, total: ORDERS_PAGE_SIZE + 1 });
  });

  it("labels customers and counts items", async () => {
    db.order.count.mockResolvedValue(3);
    db.order.findMany.mockResolvedValue([
      { id: "o1", number: 1001, status: "PAID", totalCents: 900, createdAt, customerEmail: "a@example.com", user: { name: "Layla" }, items: [{ quantity: 2 }, { quantity: 1 }] },
      { id: "o2", number: 1002, status: "PENDING", totalCents: 900, createdAt, customerEmail: "guest@example.com", user: null, items: [] },
      { id: "o3", number: 1003, status: "CANCELLED", totalCents: 900, createdAt, customerEmail: null, user: null, items: [] },
    ]);
    const { orders } = await listAdminOrders(undefined);
    expect(orders.map((order) => order.customer)).toEqual(["Layla", "guest@example.com", "Guest"]);
    expect(orders[0].itemCount).toBe(3);
    expect(orders[0]).not.toHaveProperty("customerEmail");
  });
});

describe("getAdminOrder", () => {
  it("reads one order by id with its items", async () => {
    db.order.findUnique.mockResolvedValue({ id: "o1" });
    expect(await getAdminOrder("o1")).toEqual({ id: "o1" });
    const query = db.order.findUnique.mock.calls[0][0];
    expect(query.where).toEqual({ id: "o1" });
    expect(query.select.items.orderBy).toEqual({ id: "asc" });
    expect(query.select.stripePaymentIntentId).toBe(true);
  });

  it("returns null for an unknown id", async () => {
    expect(await getAdminOrder("missing")).toBeNull();
  });

  it("skips the query for an oversized or empty id", async () => {
    expect(await getAdminOrder("x".repeat(65))).toBeNull();
    expect(await getAdminOrder("")).toBeNull();
    expect(db.order.findUnique).not.toHaveBeenCalled();
  });
});
