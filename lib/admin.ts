import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PAID_ORDER_STATUSES } from "@/lib/delivery";
import type {
  OrderStatus,
  ProductStatus,
  ProductType,
  ServiceStatus,
} from "@/lib/generated/prisma/enums";
import { type CurrentUser, getCurrentUser } from "@/lib/session";

// Server code only. The admin area (feature 12 onward) is English-only at /admin.
// Callers check requireAdmin() before reading any of this data.

// Every admin page, action, and route calls this first; the admin layout only
// hides its chrome. The role comes from the session's user row, never from
// input. Anyone else, signed in or not, gets a 404 so the area's existence is
// not shown; admins sign in through the store login, then open /admin.
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") notFound();
  return user;
}

const ADMIN_TITLE = "Abody Admin";
const NO_INDEX = { index: false, follow: false };

// Head tags for the admin layout and every admin page. Metadata resolves even
// when the page then 404s, so anyone but an admin gets the same title as any
// missing page and the tab never names the admin area.
export async function adminMetadata(title?: string): Promise<Metadata> {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return { title: { absolute: "Page not found" }, robots: NO_INDEX };
  }
  return {
    title: { absolute: title ? `${title} | ${ADMIN_TITLE}` : ADMIN_TITLE },
    robots: NO_INDEX,
  };
}

const RECENT_ORDERS = 10;

// Service work still owed to a customer. A paid service item with no work
// record yet is waiting for the customer's onboarding details, so it counts.
export const ACTIVE_SERVICE_STATUSES: readonly ServiceStatus[] = [
  "NEW",
  "WAITING_FOR_INFORMATION",
  "IN_PROGRESS",
];

export interface CatalogCount {
  published: number;
  total: number;
}

export interface AdminRecentOrder {
  id: string;
  number: number;
  status: OrderStatus;
  totalCents: number;
  createdAt: Date;
  customer: string;
  itemCount: number;
}

export interface AdminOverview {
  // Paid, processing, and completed orders only; all orders are USD.
  revenueCents: number;
  paidOrders: number;
  pendingOrders: number;
  customers: number;
  products: CatalogCount;
  services: CatalogCount;
  activeServices: number;
  recentOrders: AdminRecentOrder[];
}

// The signed-in customer's name, else the email Stripe collected, else Guest.
export function customerLabel(order: {
  user: { name: string } | null;
  customerEmail: string | null;
}): string {
  return order.user?.name || order.customerEmail || "Guest";
}

export function catalogCounts(
  groups: readonly {
    type: ProductType;
    status: ProductStatus;
    _count: { _all: number };
  }[],
  type: ProductType,
): CatalogCount {
  const counts = { published: 0, total: 0 };
  for (const group of groups) {
    if (group.type !== type) continue;
    counts.total += group._count._all;
    if (group.status === "PUBLISHED") counts.published += group._count._all;
  }
  return counts;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const paid = { status: { in: [...PAID_ORDER_STATUSES] } };
  const [revenue, pendingOrders, customers, catalog, activeServices, orders] =
    await Promise.all([
      db.order.aggregate({
        where: paid,
        _sum: { totalCents: true },
        _count: { _all: true },
      }),
      db.order.count({ where: { status: "PENDING" } }),
      db.user.count({ where: { role: "CUSTOMER" } }),
      db.product.groupBy({
        by: ["type", "status"],
        _count: { _all: true },
      }),
      db.orderItem.count({
        where: {
          product: { type: "SERVICE" },
          order: paid,
          OR: [
            { service: { is: null } },
            { service: { status: { in: [...ACTIVE_SERVICE_STATUSES] } } },
          ],
        },
      }),
      db.order.findMany({
        orderBy: [{ createdAt: "desc" }, { number: "desc" }],
        take: RECENT_ORDERS,
        select: {
          id: true,
          number: true,
          status: true,
          totalCents: true,
          createdAt: true,
          customerEmail: true,
          user: { select: { name: true } },
          items: { select: { quantity: true } },
        },
      }),
    ]);

  return {
    revenueCents: revenue._sum.totalCents ?? 0,
    paidOrders: revenue._count._all,
    pendingOrders,
    customers,
    products: catalogCounts(catalog, "DIGITAL_PRODUCT"),
    services: catalogCounts(catalog, "SERVICE"),
    activeServices,
    recentOrders: orders.map((order) => ({
      id: order.id,
      number: order.number,
      status: order.status,
      totalCents: order.totalCents,
      createdAt: order.createdAt,
      customer: customerLabel(order),
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    })),
  };
}
