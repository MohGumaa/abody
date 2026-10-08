import { ACTIVE_SERVICE_STATUSES, isProductId } from "@/lib/admin";
import { ORDERS_PAGE_SIZE, parsePage } from "@/lib/admin-orders";
import { PAID_SERVICE_ITEM } from "@/lib/admin-service-work";
import { db } from "@/lib/db";
import { PAID_ORDER_STATUSES } from "@/lib/delivery";
import { DOWNLOADABLE_PRODUCT } from "@/lib/downloads";
import type { OrderStatus, ServiceStatus } from "@/lib/generated/prisma/enums";

// Admin customer management (feature 17): read-only views of customer
// accounts. Server code only; callers check requireAdmin() first. A customer is
// a CUSTOMER-role account, the population the dashboard counts; admins and
// guest buyers are not customers here. No query selects passwordHash,
// sessions, digitalFile, or the Checkout session id.

const CUSTOMER = { role: "CUSTOMER" } as const;

const NEWEST_ITEM_FIRST = [
  { order: { createdAt: "desc" } },
  { order: { number: "desc" } },
  { id: "asc" },
] as const;

// Same rule as the dashboard: no work record yet, or work still owed.
export function isActiveService(status: ServiceStatus | null): boolean {
  return status === null || ACTIVE_SERVICE_STATUSES.includes(status);
}

export interface AdminCustomerRow {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  orderCount: number;
}

export interface AdminCustomerPage {
  customers: AdminCustomerRow[];
  page: number;
  pageCount: number;
  total: number;
}

export async function listAdminCustomers(pageParam: unknown): Promise<AdminCustomerPage> {
  const total = await db.user.count({ where: CUSTOMER });
  const page = parsePage(pageParam, total);
  const users = await db.user.findMany({
    where: CUSTOMER,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * ORDERS_PAGE_SIZE,
    take: ORDERS_PAGE_SIZE,
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
  });
  return {
    page,
    total,
    pageCount: Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE)),
    customers: users.map(({ _count, ...user }) => ({
      ...user,
      orderCount: _count.orders,
    })),
  };
}

export interface AdminCustomer {
  profile: { id: string; name: string; email: string; createdAt: Date };
  orders: {
    id: string;
    number: number;
    status: OrderStatus;
    totalCents: number;
    createdAt: Date;
    items: { id: string; name: string; quantity: number }[];
  }[];
  downloads: {
    itemId: string;
    productId: string;
    name: string;
    orderId: string;
    orderNumber: number;
    purchasedAt: Date;
  }[];
  services: {
    itemId: string;
    name: string;
    orderId: string;
    orderNumber: number;
    purchasedAt: Date;
    // Null until the customer sends their onboarding details.
    status: ServiceStatus | null;
    active: boolean;
  }[];
  counts: { orders: number; downloads: number; activeServices: number };
}

export async function getAdminCustomer(id: string): Promise<AdminCustomer | null> {
  if (!isProductId(id)) return null;
  const profile = await db.user.findFirst({
    where: { id, ...CUSTOMER },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  if (!profile) return null;

  const paidOrder = { userId: id, status: { in: [...PAID_ORDER_STATUSES] } };
  const [orders, downloads, services] = await Promise.all([
    db.order.findMany({
      where: { userId: id },
      orderBy: [{ createdAt: "desc" }, { number: "desc" }],
      select: {
        id: true,
        number: true,
        status: true,
        totalCents: true,
        createdAt: true,
        items: {
          orderBy: { id: "asc" },
          select: { id: true, quantity: true, product: { select: { name: true } } },
        },
      },
    }),
    db.orderItem.findMany({
      where: { order: paidOrder, product: DOWNLOADABLE_PRODUCT },
      orderBy: [...NEWEST_ITEM_FIRST],
      select: {
        id: true,
        product: { select: { id: true, name: true } },
        order: { select: { id: true, number: true, createdAt: true } },
      },
    }),
    db.orderItem.findMany({
      where: { ...PAID_SERVICE_ITEM, order: { ...PAID_SERVICE_ITEM.order, userId: id } },
      orderBy: [...NEWEST_ITEM_FIRST],
      select: {
        id: true,
        product: { select: { name: true } },
        order: { select: { id: true, number: true, createdAt: true } },
        service: { select: { status: true } },
      },
    }),
  ]);

  const serviceRows = services.map(({ id: itemId, product, order, service }) => {
    const status = service?.status ?? null;
    return {
      itemId,
      name: product.name,
      orderId: order.id,
      orderNumber: order.number,
      purchasedAt: order.createdAt,
      status,
      active: isActiveService(status),
    };
  });

  return {
    profile,
    orders: orders.map(({ items, ...order }) => ({
      ...order,
      items: items.map(({ id: itemId, quantity, product }) => ({
        id: itemId,
        name: product.name,
        quantity,
      })),
    })),
    downloads: downloads.map(({ id: itemId, product, order }) => ({
      itemId,
      productId: product.id,
      name: product.name,
      orderId: order.id,
      orderNumber: order.number,
      purchasedAt: order.createdAt,
    })),
    services: serviceRows,
    counts: {
      orders: orders.length,
      downloads: downloads.length,
      activeServices: serviceRows.filter((service) => service.active).length,
    },
  };
}
