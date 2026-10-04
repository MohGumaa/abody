import type Stripe from "stripe";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

// No Stripe client, db, or next/* imports here: Vitest loads this module.

// The status an event asks for, or null when the event creates no order.
export function targetStatus(
  eventType: string,
  session: Pick<Stripe.Checkout.Session, "mode" | "payment_status">,
): OrderStatus | null {
  if (session.mode !== "payment") return null;
  switch (eventType) {
    case "checkout.session.completed":
      return session.payment_status === "unpaid" ? "PENDING" : "PAID";
    case "checkout.session.async_payment_succeeded":
      return "PAID";
    case "checkout.session.async_payment_failed":
      return "CANCELLED";
    default:
      return null;
  }
}

// Webhooks only confirm or fail a pending payment. Repeated or late events, and
// statuses set by later features, are never changed here.
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return from === "PENDING" && (to === "PAID" || to === "CANCELLED");
}

export interface OrderItemInput {
  productId: string;
  priceCents: number;
  quantity: number;
}

// Lines map back to products through metadata.productId, set at checkout.
export function orderItemsFromLineItems(
  lineItems: readonly Stripe.LineItem[],
): OrderItemInput[] {
  if (lineItems.length === 0) throw new Error("Checkout session has no line items");
  return lineItems.map((line) => {
    const product = line.price?.product;
    const productId =
      product && typeof product === "object" && !product.deleted
        ? product.metadata.productId
        : undefined;
    const priceCents = line.price?.unit_amount;
    const quantity = line.quantity;
    if (!productId) throw new Error(`Line item ${line.id} has no productId`);
    if (typeof priceCents !== "number") {
      throw new Error(`Line item ${line.id} has no unit amount`);
    }
    if (!quantity || quantity < 1) {
      throw new Error(`Line item ${line.id} has no quantity`);
    }
    return { productId, priceCents, quantity };
  });
}

export function formatOrderNumber(number: number): string {
  return `#${number}`;
}
