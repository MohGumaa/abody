import type Stripe from "stripe";
import { db } from "@/lib/db";
import { PAID_ORDER_STATUSES } from "@/lib/delivery";
import { Prisma } from "@/lib/generated/prisma/client";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import {
  canTransition,
  orderItemsFromLineItems,
  targetStatus,
} from "@/lib/orders";
import { getStripe } from "@/lib/stripe";

// Server code only. Called from the verified Stripe webhook, which writes orders
// and payment status. The admin refund action (feature 15b) also marks orders
// Refunded, with the same conditional write as syncChargeRefund.

// The cart caps at 50 lines, so one page always holds the whole session.
const LINE_ITEM_LIMIT = 100;

function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  const intent = session.payment_intent;
  if (!intent) return null;
  return typeof intent === "string" ? intent : intent.id;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

// Checkout sets the reference only for a signed-in customer. A user deleted
// since then leaves a guest order.
async function orderUserId(reference: string | null): Promise<string | null> {
  if (!reference) return null;
  const user = await db.user.findUnique({
    where: { id: reference },
    select: { id: true },
  });
  return user?.id ?? null;
}

// The new order's id, or null when a concurrent delivery created it first.
async function createOrder(
  session: Stripe.Checkout.Session,
  status: OrderStatus,
): Promise<string | null> {
  const lineItems = await getStripe().checkout.sessions.listLineItems(
    session.id,
    { limit: LINE_ITEM_LIMIT, expand: ["data.price.product"] },
  );
  if (lineItems.has_more) {
    throw new Error(`Checkout session ${session.id} has too many line items`);
  }
  if (session.amount_total === null || !session.currency) {
    throw new Error(`Checkout session ${session.id} has no total or currency`);
  }
  const items = orderItemsFromLineItems(lineItems.data);
  const userId = await orderUserId(session.client_reference_id);
  try {
    const order = await db.order.create({
      select: { id: true },
      data: {
        status,
        userId,
        totalCents: session.amount_total,
        currency: session.currency,
        customerEmail: session.customer_details?.email ?? null,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId(session),
        items: { create: items },
      },
    });
    return order.id;
  } catch (error) {
    // A concurrent delivery of the same session created it first.
    if (isUniqueViolation(error)) return null;
    throw error;
  }
}

// Returns the order id only when this call made the order PAID, by creating it
// paid or by winning the PENDING update, so the paid emails go out once.
export async function syncCheckoutSession(
  eventType: string,
  session: Stripe.Checkout.Session,
): Promise<string | null> {
  const status = targetStatus(eventType, session);
  if (!status) return null;

  const existing = await db.order.findUnique({
    where: { stripeCheckoutSessionId: session.id },
    select: { id: true, status: true },
  });
  if (!existing) {
    const createdId = await createOrder(session, status);
    if (createdId) return status === "PAID" ? createdId : null;
  }

  const order =
    existing ??
    (await db.order.findUniqueOrThrow({
      where: { stripeCheckoutSessionId: session.id },
      select: { id: true, status: true },
    }));
  if (!canTransition(order.status, status)) return null;
  // The PENDING guard lets only one of two racing deliveries move the order.
  const { count } = await db.order.updateMany({
    where: { id: order.id, status: "PENDING" },
    // Keep a stored payment intent when this event carries none.
    data: {
      status,
      stripePaymentIntentId: paymentIntentId(session) ?? undefined,
    },
  });
  return count === 1 && status === "PAID" ? order.id : null;
}

// A fully refunded charge marks its paid orders Refunded, which ends their
// downloads. Partial refunds change nothing. Returns the number of orders moved.
export async function syncChargeRefund(charge: Stripe.Charge): Promise<number> {
  if (charge.refunded !== true) return 0;
  const intent = charge.payment_intent;
  const intentId = typeof intent === "string" ? intent : intent?.id;
  if (!intentId) return 0;
  const { count } = await db.order.updateMany({
    where: {
      stripePaymentIntentId: intentId,
      status: { in: [...PAID_ORDER_STATUSES] },
    },
    data: { status: "REFUNDED" },
  });
  return count;
}
