import { customerLabel, isProductId } from "@/lib/admin";
import { db } from "@/lib/db";
import type { OrderStatus, ProductType } from "@/lib/generated/prisma/enums";

// Admin order list, detail, and fulfilment rules (feature 15a). Server code
// only; callers check requireAdmin() first.

// The statuses an admin may set, and only on an order already in one of them.
// Pending, Cancelled, and Refunded follow Stripe.
export const FULFILMENT_STATUSES = ["PAID", "PROCESSING", "COMPLETED"] as const;

export type FulfilmentStatus = (typeof FULFILMENT_STATUSES)[number];

export function isFulfilmentStatus(value: unknown): value is FulfilmentStatus {
  return (FULFILMENT_STATUSES as readonly unknown[]).includes(value);
}

// The schema keeps one status; the payment side of it, for the admin.
const PAYMENT_LABELS: Record<OrderStatus, string> = {
  PENDING: "Awaiting payment",
  PAID: "Paid",
  PROCESSING: "Paid",
  COMPLETED: "Paid",
  CANCELLED: "Not paid",
  REFUNDED: "Refunded",
};

export function paymentStatusLabel(status: OrderStatus): string {
  return PAYMENT_LABELS[status];
}

export const ORDERS_PAGE_SIZE = 50;

const PAGE_PATTERN = /^\d{1,6}$/;

// The 1-based page to show: anything missing, malformed, or out of range
// becomes the nearest valid page.
export function parsePage(value: unknown, totalCount: number): number {
  const pageCount = Math.max(1, Math.ceil(totalCount / ORDERS_PAGE_SIZE));
  const page = typeof value === "string" && PAGE_PATTERN.test(value) ? Number(value) : 1;
  return Math.min(Math.max(page, 1), pageCount);
}

export interface AdminOrderRow {
  id: string;
  number: number;
  status: OrderStatus;
  totalCents: number;
  createdAt: Date;
  customer: string;
  itemCount: number;
}

export interface AdminOrderPage {
  orders: AdminOrderRow[];
  page: number;
  pageCount: number;
  total: number;
}

export async function listAdminOrders(pageParam: unknown): Promise<AdminOrderPage> {
  const total = await db.order.count();
  const page = parsePage(pageParam, total);
  const orders = await db.order.findMany({
    orderBy: [{ createdAt: "desc" }, { number: "desc" }],
    skip: (page - 1) * ORDERS_PAGE_SIZE,
    take: ORDERS_PAGE_SIZE,
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
  });
  return {
    page,
    total,
    pageCount: Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE)),
    orders: orders.map((order) => ({
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

export interface AdminOrder {
  id: string;
  number: number;
  status: OrderStatus;
  totalCents: number;
  currency: string;
  createdAt: Date;
  customerEmail: string | null;
  user: { name: string; email: string } | null;
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId: string;
  items: {
    id: string;
    priceCents: number;
    quantity: number;
    product: { id: string; name: string; type: ProductType };
  }[];
}

export async function getAdminOrder(id: string): Promise<AdminOrder | null> {
  if (!isProductId(id)) return null;
  return db.order.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      status: true,
      totalCents: true,
      currency: true,
      createdAt: true,
      customerEmail: true,
      user: { select: { name: true, email: true } },
      stripePaymentIntentId: true,
      stripeCheckoutSessionId: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          priceCents: true,
          quantity: true,
          product: { select: { id: true, name: true, type: true } },
        },
      },
    },
  });
}
