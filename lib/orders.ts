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

export interface OrderDiscount {
  couponId: string;
  discountCents: number;
}

const COUPON_ID_MAX_LENGTH = 64;
const DISCOUNT_PATTERN = /^[1-9]\d{0,8}$/;

// Checkout writes both keys (feature 20) or neither, and the webhook signature
// was checked, so anything else is a bug: throwing makes Stripe retry.
export function orderDiscountFromMetadata(
  metadata: Stripe.Metadata | null,
): OrderDiscount | null {
  const couponId = metadata?.couponId;
  const discountCents = metadata?.discountCents;
  if (couponId === undefined && discountCents === undefined) return null;
  if (
    !couponId ||
    couponId.length > COUPON_ID_MAX_LENGTH ||
    !discountCents ||
    !DISCOUNT_PATTERN.test(discountCents)
  ) {
    throw new Error("Checkout session has malformed discount metadata");
  }
  return { couponId, discountCents: Number(discountCents) };
}

export function formatOrderNumber(number: number): string {
  return `#${number}`;
}
