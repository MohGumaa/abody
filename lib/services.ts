import { db } from "@/lib/db";
import { PAID_ORDER_STATUSES } from "@/lib/delivery";
import { Prisma } from "@/lib/generated/prisma/client";
import type { ServiceStatus } from "@/lib/generated/prisma/enums";
import { isCheckoutSessionId } from "@/lib/checkout";
import {
  EDITABLE_SERVICE_STATUSES,
  type OnboardingRequirements,
} from "@/lib/onboarding";

// Server code only. Purchased service work records (feature 10). Access to an
// item comes from the signed-in owner or the order's checkout session id, the
// same bearer credential the success page and downloads use.

const SERVICE_PRODUCT = { type: "SERVICE" } as const;
const ITEM_ID_MAX_LENGTH = 64;

export interface OnboardingAccess {
  // From getCurrentUser(), never from the form.
  userId: string | null;
  sessionId: string | null;
}

export interface OnboardingItem {
  itemId: string;
  name: string;
  nameAr: string | null;
  orderNumber: number;
  service: { status: ServiceStatus; requirements: unknown } | null;
}

// Null unless the item is a service in a paid order the caller can reach.
// Every miss looks the same, so nothing tells whether the item exists.
export async function findOnboardingItem(
  itemId: unknown,
  access: OnboardingAccess,
): Promise<OnboardingItem | null> {
  if (typeof itemId !== "string" || itemId.length === 0) return null;
  if (itemId.length > ITEM_ID_MAX_LENGTH) return null;
  const owners: Prisma.OrderWhereInput[] = [];
  if (access.userId) owners.push({ userId: access.userId });
  if (isCheckoutSessionId(access.sessionId)) {
    owners.push({ stripeCheckoutSessionId: access.sessionId });
  }
  if (owners.length === 0) return null;

  const item = await db.orderItem.findFirst({
    where: {
      id: itemId,
      product: SERVICE_PRODUCT,
      order: { status: { in: [...PAID_ORDER_STATUSES] }, OR: owners },
    },
    select: {
      id: true,
      product: { select: { name: true, nameAr: true } },
      order: { select: { number: true } },
      service: { select: { status: true, requirements: true } },
    },
  });
  if (!item) return null;
  return {
    itemId: item.id,
    name: item.product.name,
    nameAr: item.product.nameAr,
    orderNumber: item.order.number,
    service: item.service,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

// The first save creates the record. Later saves change it only while it is
// still editable, so a record the team has started is never overwritten, even
// when a status change races the save. Call only after findOnboardingItem.
export async function saveOnboarding(
  itemId: string,
  requirements: OnboardingRequirements,
): Promise<"saved" | "locked"> {
  const data = requirements as unknown as Prisma.InputJsonObject;
  try {
    await db.service.create({
      data: { orderItemId: itemId, status: "NEW", requirements: data },
    });
    return "saved";
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  const { count } = await db.service.updateMany({
    where: { orderItemId: itemId, status: { in: [...EDITABLE_SERVICE_STATUSES] } },
    data: { requirements: data },
  });
  return count > 0 ? "saved" : "locked";
}

export interface OrderService {
  itemId: string;
  name: string;
  nameAr: string | null;
  status: ServiceStatus | null;
}

// The service items of a paid order, for the success page.
export async function listOrderServices(
  sessionId: string,
): Promise<OrderService[]> {
  const items = await db.orderItem.findMany({
    where: {
      product: SERVICE_PRODUCT,
      order: {
        stripeCheckoutSessionId: sessionId,
        status: { in: [...PAID_ORDER_STATUSES] },
      },
    },
    orderBy: [{ product: { name: "asc" } }, { id: "asc" }],
    select: {
      id: true,
      product: { select: { name: true, nameAr: true } },
      service: { select: { status: true } },
    },
  });
  return items.map(({ id, product, service }) => ({
    itemId: id,
    name: product.name,
    nameAr: product.nameAr,
    status: service?.status ?? null,
  }));
}
