import { customerLabel, isProductId } from "@/lib/admin";
import { ORDERS_PAGE_SIZE, parsePage } from "@/lib/admin-orders";
import { db } from "@/lib/db";
import { PAID_ORDER_STATUSES } from "@/lib/delivery";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Role, ServiceStatus } from "@/lib/generated/prisma/enums";

// Admin service orders (feature 16): the work queue for services bought in a
// paid order. Server code only; callers check requireAdmin() first. Keyed by
// order item, so an item the customer has not onboarded yet still shows.

// Service items in a paid order. Refunded, cancelled, and pending orders stay
// out of the queue.
export const PAID_SERVICE_ITEM = {
  product: { type: "SERVICE" },
  order: { status: { in: [...PAID_ORDER_STATUSES] } },
} as const satisfies Prisma.OrderItemWhereInput;

export interface ServiceOrderRow {
  itemId: string;
  serviceName: string;
  customer: string;
  orderId: string;
  orderNumber: number;
  purchasedAt: Date;
  // Null until the customer sends their onboarding details.
  status: ServiceStatus | null;
}

export interface ServiceOrderPage {
  items: ServiceOrderRow[];
  page: number;
  pageCount: number;
  total: number;
}

export async function listServiceOrders(pageParam: unknown): Promise<ServiceOrderPage> {
  const total = await db.orderItem.count({ where: PAID_SERVICE_ITEM });
  const page = parsePage(pageParam, total);
  const items = await db.orderItem.findMany({
    where: PAID_SERVICE_ITEM,
    orderBy: [{ order: { createdAt: "desc" } }, { order: { number: "desc" } }, { id: "asc" }],
    skip: (page - 1) * ORDERS_PAGE_SIZE,
    take: ORDERS_PAGE_SIZE,
    select: {
      id: true,
      product: { select: { name: true } },
      order: {
        select: {
          id: true,
          number: true,
          createdAt: true,
          customerEmail: true,
          user: { select: { name: true } },
        },
      },
      service: { select: { status: true } },
    },
  });
  return {
    page,
    total,
    pageCount: Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE)),
    items: items.map((item) => ({
      itemId: item.id,
      serviceName: item.product.name,
      customer: customerLabel(item.order),
      orderId: item.order.id,
      orderNumber: item.order.number,
      purchasedAt: item.order.createdAt,
      status: item.service?.status ?? null,
    })),
  };
}

export interface ServiceOrder {
  itemId: string;
  product: { id: string; name: string; durationDays: number | null };
  order: {
    id: string;
    number: number;
    createdAt: Date;
    customerEmail: string | null;
    user: { id: string; name: string; email: string; role: Role } | null;
  };
  service: {
    id: string;
    status: ServiceStatus;
    // Read with readRequirements before showing.
    requirements: unknown;
    adminNotes: string | null;
    startDate: Date | null;
    completedDate: Date | null;
    updatedAt: Date;
  } | null;
}

export async function getServiceOrder(itemId: string): Promise<ServiceOrder | null> {
  if (!isProductId(itemId)) return null;
  const item = await db.orderItem.findFirst({
    where: { id: itemId, ...PAID_SERVICE_ITEM },
    select: {
      id: true,
      product: { select: { id: true, name: true, durationDays: true } },
      order: {
        select: {
          id: true,
          number: true,
          createdAt: true,
          customerEmail: true,
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      },
      service: {
        select: {
          id: true,
          status: true,
          requirements: true,
          adminNotes: true,
          startDate: true,
          completedDate: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!item) return null;
  const { id, ...rest } = item;
  return { itemId: id, ...rest };
}
