import { db } from "@/lib/db";
import { PAID_ORDER_STATUSES } from "@/lib/delivery";
import { DOWNLOADABLE_PRODUCT } from "@/lib/downloads";
import type {
  OrderStatus,
  ServiceStatus,
} from "@/lib/generated/prisma/enums";

// Server code only. What the customer account pages show. Every query is
// scoped to the signed-in user's own orders, and none selects digitalFile.

const SERVICE_PRODUCT = { type: "SERVICE" } as const;

function paidOrdersOf(userId: string) {
  return { userId, status: { in: [...PAID_ORDER_STATUSES] } };
}

// Newest first; the order number breaks ties within the same instant.
const NEWEST_ORDER_FIRST = [
  { createdAt: "desc" },
  { number: "desc" },
] as const;
const NEWEST_ITEM_FIRST = [
  { order: { createdAt: "desc" } },
  { order: { number: "desc" } },
  { id: "asc" },
] as const;

export interface AccountCounts {
  orders: number;
  downloads: number;
  services: number;
}

export async function getAccountCounts(userId: string): Promise<AccountCounts> {
  const [orders, downloads, services] = await Promise.all([
    db.order.count({ where: { userId } }),
    db.orderItem.count({
      where: { order: paidOrdersOf(userId), product: DOWNLOADABLE_PRODUCT },
    }),
    db.orderItem.count({
      where: { order: paidOrdersOf(userId), product: SERVICE_PRODUCT },
    }),
  ]);
  return { orders, downloads, services };
}

export interface AccountOrder {
  id: string;
  number: number;
  status: OrderStatus;
  totalCents: number;
  createdAt: Date;
  items: {
    id: string;
    name: string;
    nameAr: string | null;
    priceCents: number;
    quantity: number;
  }[];
}

export async function listAccountOrders(
  userId: string,
  take?: number,
): Promise<AccountOrder[]> {
  const orders = await db.order.findMany({
    where: { userId },
    orderBy: [...NEWEST_ORDER_FIRST],
    take,
    select: {
      id: true,
      number: true,
      status: true,
      totalCents: true,
      createdAt: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          priceCents: true,
          quantity: true,
          product: { select: { name: true, nameAr: true } },
        },
      },
    },
  });
  return orders.map(({ items, ...order }) => ({
    ...order,
    items: items.map(({ product, ...item }) => ({ ...item, ...product })),
  }));
}

export interface AccountDownload {
  itemId: string;
  name: string;
  nameAr: string | null;
  orderNumber: number;
  purchasedAt: Date;
  // The download route's credential. Shown only to the order's owner.
  checkoutSessionId: string;
}

export async function listAccountDownloads(
  userId: string,
  take?: number,
): Promise<AccountDownload[]> {
  const items = await db.orderItem.findMany({
    where: { order: paidOrdersOf(userId), product: DOWNLOADABLE_PRODUCT },
    orderBy: [...NEWEST_ITEM_FIRST],
    take,
    select: {
      id: true,
      product: { select: { name: true, nameAr: true } },
      order: {
        select: { number: true, createdAt: true, stripeCheckoutSessionId: true },
      },
    },
  });
  return items.map(({ id, product, order }) => ({
    itemId: id,
    name: product.name,
    nameAr: product.nameAr,
    orderNumber: order.number,
    purchasedAt: order.createdAt,
    checkoutSessionId: order.stripeCheckoutSessionId,
  }));
}

export interface AccountService {
  itemId: string;
  name: string;
  nameAr: string | null;
  orderNumber: number;
  orderStatus: OrderStatus;
  purchasedAt: Date;
  // Null until the customer sends their onboarding details.
  serviceStatus: ServiceStatus | null;
}

export async function listAccountServices(
  userId: string,
): Promise<AccountService[]> {
  const items = await db.orderItem.findMany({
    where: { order: paidOrdersOf(userId), product: SERVICE_PRODUCT },
    orderBy: [...NEWEST_ITEM_FIRST],
    select: {
      id: true,
      product: { select: { name: true, nameAr: true } },
      order: { select: { number: true, status: true, createdAt: true } },
      service: { select: { status: true } },
    },
  });
  return items.map(({ id, product, order, service }) => ({
    itemId: id,
    name: product.name,
    nameAr: product.nameAr,
    orderNumber: order.number,
    orderStatus: order.status,
    purchasedAt: order.createdAt,
    serviceStatus: service?.status ?? null,
  }));
}

const ITEM_ID_MAX_LENGTH = 64;

export interface AccountServiceDetail {
  itemId: string;
  name: string;
  nameAr: string | null;
  orderNumber: number;
  purchasedAt: Date;
  // Null until the customer sends their onboarding details.
  service: {
    status: ServiceStatus;
    // Validate with readRequirements before showing.
    requirements: unknown;
    createdAt: Date;
    startDate: Date | null;
    completedDate: Date | null;
    updatedAt: Date;
  } | null;
}

// One service item in the user's paid orders, or null. Every miss looks the
// same, so nothing tells whether the item exists. Never selects adminNotes.
export async function findAccountService(
  userId: string,
  itemId: unknown,
): Promise<AccountServiceDetail | null> {
  if (typeof itemId !== "string" || itemId.length === 0) return null;
  if (itemId.length > ITEM_ID_MAX_LENGTH) return null;
  const item = await db.orderItem.findFirst({
    where: { id: itemId, order: paidOrdersOf(userId), product: SERVICE_PRODUCT },
    select: {
      id: true,
      product: { select: { name: true, nameAr: true } },
      order: { select: { number: true, createdAt: true } },
      service: {
        select: {
          status: true,
          requirements: true,
          createdAt: true,
          startDate: true,
          completedDate: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!item) return null;
  return {
    itemId: item.id,
    name: item.product.name,
    nameAr: item.product.nameAr,
    orderNumber: item.order.number,
    purchasedAt: item.order.createdAt,
    service: item.service,
  };
}

// Up to two letters for the profile avatar.
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("");
  return letters.toLocaleUpperCase();
}
