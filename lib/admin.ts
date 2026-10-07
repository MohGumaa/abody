import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { type CategoryOption, categoryOptions } from "@/lib/admin-product-rules";
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

// Feature 13: digital products only; services are managed in feature 14.
export const ADMIN_PRODUCT_TYPE: ProductType = "DIGITAL_PRODUCT";

// Ids are cuids; anything longer is not worth a query.
const PRODUCT_ID_MAX_LENGTH = 64;

export function isProductId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= PRODUCT_ID_MAX_LENGTH
  );
}

export interface AdminProductRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  priceCents: number;
  status: ProductStatus;
  hasFile: boolean;
  updatedAt: Date;
}

export async function listAdminProducts(): Promise<AdminProductRow[]> {
  const rows = await db.product.findMany({
    where: { type: ADMIN_PRODUCT_TYPE },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      priceCents: true,
      status: true,
      updatedAt: true,
      digitalFile: true,
    },
  });
  return rows.map(({ digitalFile, ...row }) => ({
    ...row,
    hasFile: digitalFile !== null,
  }));
}

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  priceCents: number;
  category: string;
  image: string | null;
  included: string[];
  nameAr: string | null;
  categoryAr: string | null;
  shortDescriptionAr: string | null;
  descriptionAr: string | null;
  includedAr: string[];
  status: ProductStatus;
  // Only the download name; the storage key never leaves the server.
  fileName: string | null;
  orderCount: number;
  updatedAt: Date;
}

export async function getAdminProduct(id: string): Promise<AdminProduct | null> {
  if (!isProductId(id)) return null;
  const row = await db.product.findFirst({
    where: { id, type: ADMIN_PRODUCT_TYPE },
    select: {
      id: true,
      name: true,
      slug: true,
      shortDescription: true,
      description: true,
      priceCents: true,
      category: true,
      image: true,
      included: true,
      nameAr: true,
      categoryAr: true,
      shortDescriptionAr: true,
      descriptionAr: true,
      includedAr: true,
      status: true,
      digitalFile: true,
      updatedAt: true,
      _count: { select: { orderItems: true } },
    },
  });
  if (!row) return null;
  const { digitalFile, _count, ...product } = row;
  return {
    ...product,
    fileName: digitalFile ? digitalFile.slice(digitalFile.lastIndexOf("/") + 1) : null,
    orderCount: _count.orderItems,
  };
}

// Categories digital products already use, for the admin category picker.
export async function listAdminCategories(): Promise<CategoryOption[]> {
  const rows = await db.product.findMany({
    where: { type: ADMIN_PRODUCT_TYPE },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: { category: true, categoryAr: true },
  });
  return categoryOptions(rows);
}
