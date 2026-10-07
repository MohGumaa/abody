import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser, redirect, notFound, db } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  db: {
    order: { aggregate: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    user: { count: vi.fn() },
    product: { groupBy: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    orderItem: { count: vi.fn() },
  },
  // Both throw in Next.js, ending the page.
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));

vi.mock("@/lib/session", () => ({ getCurrentUser }));
vi.mock("next/navigation", () => ({ redirect, notFound }));
vi.mock("@/lib/db", () => ({ db }));

import {
  adminMetadata,
  catalogCounts,
  customerLabel,
  getAdminOverview,
  getAdminProduct,
  listAdminProducts,
  requireAdmin,
} from "@/lib/admin";

const PAID = { status: { in: ["PAID", "PROCESSING", "COMPLETED"] } };

const admin = { id: "a1", name: "Abody", email: "admin@example.com", role: "ADMIN" };
const customer = { id: "u1", name: "Layla", email: "layla@example.com", role: "CUSTOMER" };

beforeEach(() => {
  getCurrentUser.mockReset();
  redirect.mockClear();
  notFound.mockClear();
});

describe("requireAdmin", () => {
  it("gives a signed-out visitor a 404, not a sign-in redirect", async () => {
    getCurrentUser.mockResolvedValue(null);

    await expect(requireAdmin()).rejects.toThrow("notFound");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("gives a signed-in customer a 404", async () => {
    getCurrentUser.mockResolvedValue(customer);

    await expect(requireAdmin()).rejects.toThrow("notFound");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("returns the admin", async () => {
    getCurrentUser.mockResolvedValue(admin);

    await expect(requireAdmin()).resolves.toEqual(admin);
    expect(redirect).not.toHaveBeenCalled();
    expect(notFound).not.toHaveBeenCalled();
  });
});

describe("adminMetadata", () => {
  const robots = { index: false, follow: false };

  it("names the page for an admin", async () => {
    getCurrentUser.mockResolvedValue(admin);

    expect(await adminMetadata("Dashboard")).toEqual({
      title: { absolute: "Dashboard | Abody Admin" },
      robots,
    });
    expect(await adminMetadata()).toEqual({
      title: { absolute: "Abody Admin" },
      robots,
    });
  });

  it.each([
    ["signed out", null],
    ["a customer", customer],
  ])("never names the admin area when %s", async (_label, user) => {
    getCurrentUser.mockResolvedValue(user);

    for (const metadata of [await adminMetadata("Dashboard"), await adminMetadata()]) {
      expect(metadata).toEqual({ title: { absolute: "Page not found" }, robots });
    }
  });
});

describe("customerLabel", () => {
  it("prefers the account name, then the checkout email, then Guest", () => {
    expect(
      customerLabel({ user: { name: "Layla" }, customerEmail: "l@example.com" }),
    ).toBe("Layla");
    expect(customerLabel({ user: null, customerEmail: "g@example.com" })).toBe(
      "g@example.com",
    );
    expect(customerLabel({ user: null, customerEmail: null })).toBe("Guest");
  });
});

describe("catalogCounts", () => {
  const groups = [
    { type: "DIGITAL_PRODUCT", status: "PUBLISHED", _count: { _all: 3 } },
    { type: "DIGITAL_PRODUCT", status: "UNPUBLISHED", _count: { _all: 2 } },
    { type: "SERVICE", status: "PUBLISHED", _count: { _all: 4 } },
  ] as const;

  it("counts published and total entries of one type", () => {
    expect(catalogCounts(groups, "DIGITAL_PRODUCT")).toEqual({
      published: 3,
      total: 5,
    });
    expect(catalogCounts(groups, "SERVICE")).toEqual({ published: 4, total: 4 });
  });

  it("is zero for an empty catalog", () => {
    expect(catalogCounts([], "SERVICE")).toEqual({ published: 0, total: 0 });
  });
});

describe("getAdminOverview", () => {
  beforeEach(() => {
    for (const model of Object.values(db)) {
      for (const fn of Object.values(model)) fn.mockReset();
    }
    db.order.aggregate.mockResolvedValue({
      _sum: { totalCents: 14800 },
      _count: { _all: 2 },
    });
    db.order.count.mockResolvedValue(1);
    db.user.count.mockResolvedValue(7);
    db.product.groupBy.mockResolvedValue([
      { type: "DIGITAL_PRODUCT", status: "PUBLISHED", _count: { _all: 3 } },
      { type: "SERVICE", status: "UNPUBLISHED", _count: { _all: 1 } },
    ]);
    db.orderItem.count.mockResolvedValue(2);
    db.order.findMany.mockResolvedValue([]);
  });

  it("sums revenue over paid, processing, and completed orders only", async () => {
    const overview = await getAdminOverview();

    expect(db.order.aggregate).toHaveBeenCalledWith({
      where: PAID,
      _sum: { totalCents: true },
      _count: { _all: true },
    });
    expect(overview.revenueCents).toBe(14800);
    expect(overview.paidOrders).toBe(2);
  });

  it("reports zero revenue when nothing is paid", async () => {
    db.order.aggregate.mockResolvedValue({
      _sum: { totalCents: null },
      _count: { _all: 0 },
    });

    const overview = await getAdminOverview();
    expect(overview.revenueCents).toBe(0);
    expect(overview.paidOrders).toBe(0);
  });

  it("counts pending orders, customer accounts, and the catalog", async () => {
    const overview = await getAdminOverview();

    expect(db.order.count).toHaveBeenCalledWith({ where: { status: "PENDING" } });
    expect(db.user.count).toHaveBeenCalledWith({ where: { role: "CUSTOMER" } });
    expect(overview).toMatchObject({
      pendingOrders: 1,
      customers: 7,
      products: { published: 3, total: 3 },
      services: { published: 0, total: 1 },
    });
  });

  it("counts paid service items awaiting onboarding or still in progress", async () => {
    const overview = await getAdminOverview();

    expect(db.orderItem.count).toHaveBeenCalledWith({
      where: {
        product: { type: "SERVICE" },
        order: PAID,
        OR: [
          { service: { is: null } },
          {
            service: {
              status: { in: ["NEW", "WAITING_FOR_INFORMATION", "IN_PROGRESS"] },
            },
          },
        ],
      },
    });
    expect(overview.activeServices).toBe(2);
  });

  it("lists the 10 newest orders of any status with only the shown fields", async () => {
    const createdAt = new Date("2026-10-01T00:00:00Z");
    db.order.findMany.mockResolvedValue([
      {
        id: "o1",
        number: 1002,
        status: "PENDING",
        totalCents: 9800,
        createdAt,
        customerEmail: "g@example.com",
        user: null,
        items: [{ quantity: 2 }, { quantity: 1 }],
      },
    ]);

    const overview = await getAdminOverview();
    const args = db.order.findMany.mock.calls[0][0];
    expect(args.where).toBeUndefined();
    expect(args.take).toBe(10);
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, { number: "desc" }]);
    expect(args.select).toEqual({
      id: true,
      number: true,
      status: true,
      totalCents: true,
      createdAt: true,
      customerEmail: true,
      user: { select: { name: true } },
      items: { select: { quantity: true } },
    });
    expect(overview.recentOrders).toEqual([
      {
        id: "o1",
        number: 1002,
        status: "PENDING",
        totalCents: 9800,
        createdAt,
        customer: "g@example.com",
        itemCount: 3,
      },
    ]);
  });
});

describe("admin products", () => {
  const updatedAt = new Date("2026-10-01T00:00:00Z");

  it("lists digital products with a file flag, never the key", async () => {
    db.product.findMany.mockResolvedValue([
      { id: "p1", name: "A", slug: "a", category: "Guides", priceCents: 900, status: "PUBLISHED", updatedAt, digitalFile: "seed/a.pdf" },
      { id: "p2", name: "B", slug: "b", category: "Guides", priceCents: 900, status: "UNPUBLISHED", updatedAt, digitalFile: null },
    ]);
    const rows = await listAdminProducts();
    expect(db.product.findMany.mock.calls[0][0].where).toEqual({ type: "DIGITAL_PRODUCT" });
    expect(rows.map((row) => row.hasFile)).toEqual([true, false]);
    expect(rows[0]).not.toHaveProperty("digitalFile");
  });

  it("returns one digital product with only the file name", async () => {
    db.product.findFirst.mockResolvedValue({
      id: "p1",
      name: "A",
      digitalFile: "products/p1/0a1b/Guide.pdf",
      _count: { orderItems: 3 },
      updatedAt,
    });
    const product = await getAdminProduct("p1");
    expect(db.product.findFirst.mock.calls[0][0].where).toEqual({ id: "p1", type: "DIGITAL_PRODUCT" });
    expect(product).toMatchObject({ id: "p1", fileName: "Guide.pdf", orderCount: 3 });
    expect(product).not.toHaveProperty("digitalFile");
  });

  it("returns null for an unknown, service, or oversized id", async () => {
    db.product.findFirst.mockResolvedValue(null);
    expect(await getAdminProduct("s1")).toBeNull();
    db.product.findFirst.mockClear();
    expect(await getAdminProduct("x".repeat(65))).toBeNull();
    expect(db.product.findFirst).not.toHaveBeenCalled();
  });
});
