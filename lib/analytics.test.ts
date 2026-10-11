import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({
  db: {
    analyticsEvent: {
      create: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    product: { findFirst: vi.fn(), findMany: vi.fn() },
    order: { aggregate: vi.fn() },
    orderItem: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db }));

import { getAnalyticsReport, recordEvent, recordPageView } from "@/lib/analytics";

const NOW = new Date("2026-10-11T12:00:00Z");
const START = new Date("2026-10-05T00:00:00Z");
const PAID_IN_RANGE = {
  status: { in: ["PAID", "PROCESSING", "COMPLETED"] },
  createdAt: { gte: START },
};

beforeEach(() => {
  for (const model of Object.values(db)) {
    for (const fn of Object.values(model)) fn.mockReset();
  }
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("recordEvent", () => {
  it("stores the event with its product", async () => {
    await recordEvent("ADD_TO_CART", "p1");
    expect(db.analyticsEvent.create).toHaveBeenCalledWith({
      data: { type: "ADD_TO_CART", productId: "p1" },
    });
  });

  it("stores an event without a product", async () => {
    await recordEvent("CHECKOUT_STARTED");
    expect(db.analyticsEvent.create).toHaveBeenCalledWith({
      data: { type: "CHECKOUT_STARTED", productId: null },
    });
  });

  it("logs and swallows a database error", async () => {
    db.analyticsEvent.create.mockRejectedValue(new Error("down"));
    await expect(recordEvent("CHECKOUT_STARTED")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});

describe("recordPageView", () => {
  it("stores a plain page view without a lookup", async () => {
    await recordPageView("/en/products", null);
    expect(db.product.findFirst).not.toHaveBeenCalled();
    expect(db.analyticsEvent.create).toHaveBeenCalledWith({
      data: { type: "PAGE_VIEW", path: "/en/products", productId: null },
    });
  });

  it("names a published product of the page's type", async () => {
    db.product.findFirst.mockResolvedValue({ id: "p1" });
    await recordPageView("/ar/services/ads", { type: "SERVICE", slug: "ads" });
    expect(db.product.findFirst).toHaveBeenCalledWith({
      where: { slug: "ads", type: "SERVICE", status: "PUBLISHED" },
      select: { id: true },
    });
    expect(db.analyticsEvent.create).toHaveBeenCalledWith({
      data: { type: "PAGE_VIEW", path: "/ar/services/ads", productId: "p1" },
    });
  });

  it("keeps the view without a product for an unknown slug", async () => {
    db.product.findFirst.mockResolvedValue(null);
    await recordPageView("/en/products/gone", { type: "DIGITAL_PRODUCT", slug: "gone" });
    expect(db.analyticsEvent.create).toHaveBeenCalledWith({
      data: { type: "PAGE_VIEW", path: "/en/products/gone", productId: null },
    });
  });

  it("logs and swallows a database error", async () => {
    db.product.findFirst.mockRejectedValue(new Error("down"));
    await expect(
      recordPageView("/en/products/x", { type: "DIGITAL_PRODUCT", slug: "x" }),
    ).resolves.toBeUndefined();
    expect(db.analyticsEvent.create).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
});

describe("getAnalyticsReport", () => {
  function mockReport() {
    db.analyticsEvent.groupBy.mockImplementation(async ({ by }: { by: string[] }) => {
      if (by.join() === "type") {
        return [
          { type: "PAGE_VIEW", _count: { _all: 40 } },
          { type: "ADD_TO_CART", _count: { _all: 6 } },
          { type: "CHECKOUT_STARTED", _count: { _all: 3 } },
        ];
      }
      if (by.join() === "productId,type") {
        return [
          { productId: "p1", type: "PAGE_VIEW", _count: { _all: 10 } },
          { productId: "p1", type: "ADD_TO_CART", _count: { _all: 4 } },
          { productId: "s1", type: "PAGE_VIEW", _count: { _all: 5 } },
        ];
      }
      return [
        { path: "/en", _count: { path: 20 } },
        { path: "/en/products/guide", _count: { path: 10 } },
      ];
    });
    db.analyticsEvent.count.mockResolvedValue(15);
    db.order.aggregate.mockResolvedValue({ _sum: { totalCents: 39800 }, _count: { _all: 2 } });
    db.orderItem.findMany.mockResolvedValue([
      { productId: "p1", quantity: 2, priceCents: 4410 },
      { productId: "s2", quantity: 1, priceCents: 30000 },
    ]);
    db.product.findMany.mockResolvedValue([
      { id: "p1", name: "Guide", type: "DIGITAL_PRODUCT" },
      { id: "s1", name: "Ads", type: "SERVICE" },
      { id: "s2", name: "Account", type: "SERVICE" },
    ]);
  }

  it("totals events and paid orders in the period", async () => {
    mockReport();
    const report = await getAnalyticsReport(7, NOW);

    expect(report).toMatchObject({
      days: 7,
      start: START,
      pageViews: 40,
      productViews: 15,
      addsToCart: 6,
      checkoutsStarted: 3,
      purchases: 2,
      revenueCents: 39800,
      topPages: [
        { path: "/en", views: 20 },
        { path: "/en/products/guide", views: 10 },
      ],
    });
  });

  it("ranks products from their views, adds, and paid sales", async () => {
    mockReport();
    const report = await getAnalyticsReport(7, NOW);

    expect(report.popularProducts).toEqual([
      {
        id: "p1",
        name: "Guide",
        type: "DIGITAL_PRODUCT",
        views: 10,
        addsToCart: 4,
        unitsSold: 2,
        salesCents: 8820,
      },
      {
        id: "s2",
        name: "Account",
        type: "SERVICE",
        views: 0,
        addsToCart: 0,
        unitsSold: 1,
        salesCents: 30000,
      },
      {
        id: "s1",
        name: "Ads",
        type: "SERVICE",
        views: 5,
        addsToCart: 0,
        unitsSold: 0,
        salesCents: 0,
      },
    ]);
    expect(db.product.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1", "s1", "s2"] } },
      select: { id: true, name: true, type: true },
    });
  });

  it("limits every query to the period and paid orders", async () => {
    mockReport();
    await getAnalyticsReport(7, NOW);

    for (const [args] of db.analyticsEvent.groupBy.mock.calls) {
      expect(args.where.createdAt).toEqual({ gte: START });
    }
    expect(db.analyticsEvent.count).toHaveBeenCalledWith({
      where: { type: "PAGE_VIEW", productId: { not: null }, createdAt: { gte: START } },
    });
    expect(db.order.aggregate.mock.calls[0][0].where).toEqual(PAID_IN_RANGE);
    expect(db.orderItem.findMany.mock.calls[0][0].where).toEqual({ order: PAID_IN_RANGE });
  });

  it("returns zeros and skips the product lookup with no activity", async () => {
    db.analyticsEvent.groupBy.mockResolvedValue([]);
    db.analyticsEvent.count.mockResolvedValue(0);
    db.order.aggregate.mockResolvedValue({ _sum: { totalCents: null }, _count: { _all: 0 } });
    db.orderItem.findMany.mockResolvedValue([]);

    const report = await getAnalyticsReport(30, NOW);

    expect(report).toMatchObject({
      pageViews: 0,
      productViews: 0,
      addsToCart: 0,
      checkoutsStarted: 0,
      purchases: 0,
      revenueCents: 0,
      popularProducts: [],
      topPages: [],
    });
    expect(db.product.findMany).not.toHaveBeenCalled();
  });
});
