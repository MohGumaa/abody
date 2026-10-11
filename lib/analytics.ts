import {
  type PopularProduct,
  type RangeDays,
  rangeStart,
  rankPopularProducts,
} from "@/lib/analytics-rules";
import { db } from "@/lib/db";
import { PAID_ORDER_STATUSES } from "@/lib/delivery";
import type { AnalyticsEventType } from "@/lib/generated/prisma/enums";

// Server code only. Store analytics (feature 23): counts in our own database,
// never a visitor, user, session, IP, or cookie value.

// Recording never throws: a lost count must not change what the customer
// sees. Callers await it so serverless runtimes do not drop the write.
export async function recordEvent(
  type: Exclude<AnalyticsEventType, "PAGE_VIEW">,
  productId?: string,
): Promise<void> {
  try {
    await db.analyticsEvent.create({ data: { type, productId: productId ?? null } });
  } catch (error) {
    console.error(`recordEvent ${type} failed`, error);
  }
}

// The path is already validated by parseTrackedPath. A detail page names its
// product only when the slug is a published product of that page's type.
export async function recordPageView(
  path: string,
  detail: { type: PopularProduct["type"]; slug: string } | null,
): Promise<void> {
  try {
    const product = detail
      ? await db.product.findFirst({
          where: { slug: detail.slug, type: detail.type, status: "PUBLISHED" },
          select: { id: true },
        })
      : null;
    await db.analyticsEvent.create({
      data: { type: "PAGE_VIEW", path, productId: product?.id ?? null },
    });
  } catch (error) {
    console.error("recordPageView failed", error);
  }
}

const TOP_PAGES_LIMIT = 10;

export interface AnalyticsReport {
  days: RangeDays;
  start: Date;
  pageViews: number;
  productViews: number;
  addsToCart: number;
  checkoutsStarted: number;
  // Orders in the paid statuses created in the period, as on the dashboard.
  purchases: number;
  revenueCents: number;
  popularProducts: PopularProduct[];
  topPages: { path: string; views: number }[];
}

export async function getAnalyticsReport(
  days: RangeDays,
  now: Date = new Date(),
): Promise<AnalyticsReport> {
  const start = rangeStart(days, now);
  const inRange = { createdAt: { gte: start } };
  const paidInRange = { status: { in: [...PAID_ORDER_STATUSES] }, ...inRange };

  const [byType, productViews, byProduct, orders, soldItems, pages] =
    await Promise.all([
      db.analyticsEvent.groupBy({
        by: ["type"],
        where: inRange,
        _count: { _all: true },
      }),
      db.analyticsEvent.count({
        where: { type: "PAGE_VIEW", productId: { not: null }, ...inRange },
      }),
      db.analyticsEvent.groupBy({
        by: ["productId", "type"],
        where: { productId: { not: null }, ...inRange },
        _count: { _all: true },
      }),
      db.order.aggregate({
        where: paidInRange,
        _sum: { totalCents: true },
        _count: { _all: true },
      }),
      db.orderItem.findMany({
        where: { order: paidInRange },
        select: { productId: true, quantity: true, priceCents: true },
      }),
      db.analyticsEvent.groupBy({
        by: ["path"],
        where: { type: "PAGE_VIEW", path: { not: null }, ...inRange },
        _count: { path: true },
        orderBy: [{ _count: { path: "desc" } }, { path: "asc" }],
        take: TOP_PAGES_LIMIT,
      }),
    ]);

  const typeCount = (type: AnalyticsEventType) =>
    byType.find((group) => group.type === type)?._count._all ?? 0;

  const totals = new Map<
    string,
    { views: number; addsToCart: number; unitsSold: number; salesCents: number }
  >();
  const totalsFor = (id: string) => {
    let row = totals.get(id);
    if (!row) {
      row = { views: 0, addsToCart: 0, unitsSold: 0, salesCents: 0 };
      totals.set(id, row);
    }
    return row;
  };
  for (const group of byProduct) {
    if (!group.productId) continue;
    const row = totalsFor(group.productId);
    if (group.type === "PAGE_VIEW") row.views += group._count._all;
    if (group.type === "ADD_TO_CART") row.addsToCart += group._count._all;
  }
  for (const item of soldItems) {
    const row = totalsFor(item.productId);
    row.unitsSold += item.quantity;
    row.salesCents += item.priceCents * item.quantity;
  }

  const products = totals.size
    ? await db.product.findMany({
        where: { id: { in: [...totals.keys()] } },
        select: { id: true, name: true, type: true },
      })
    : [];

  return {
    days,
    start,
    pageViews: typeCount("PAGE_VIEW"),
    productViews,
    addsToCart: typeCount("ADD_TO_CART"),
    checkoutsStarted: typeCount("CHECKOUT_STARTED"),
    purchases: orders._count._all,
    revenueCents: orders._sum.totalCents ?? 0,
    popularProducts: rankPopularProducts(
      products.map((product) => ({ ...product, ...totalsFor(product.id) })),
    ),
    topPages: pages.map((page) => ({
      path: page.path ?? "",
      views: page._count?.path ?? 0,
    })),
  };
}
