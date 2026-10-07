"use server";

import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { isProductId, requireAdmin } from "@/lib/admin";
import { FULFILMENT_STATUSES, isFulfilmentStatus } from "@/lib/admin-orders";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

// Admin order fulfilment (feature 15a). Only Paid, Processing, and Completed
// can be set, and only on an order still in one of them, so a status Stripe set
// (Pending, Cancelled, Refunded) is never overwritten. requireAdmin() throws,
// so it stays outside the try.

export type OrderActionResult =
  | { success: true }
  | {
      success: false;
      error: "not_found" | "invalid_status" | "locked" | "unexpected";
    }
  | null;

export async function setOrderStatus(
  _previous: OrderActionResult,
  formData: FormData,
): Promise<OrderActionResult> {
  await requireAdmin();
  try {
    const id = formData.get("id");
    if (!isProductId(id)) return { success: false, error: "not_found" };
    const status = formData.get("status");
    if (!isFulfilmentStatus(status)) return { success: false, error: "invalid_status" };

    // One conditional write, so a concurrent Stripe change wins.
    const { count } = await db.order.updateMany({
      where: { id, status: { in: [...FULFILMENT_STATUSES] } },
      data: { status },
    });
    if (count === 0) {
      const exists = await db.order.count({ where: { id } });
      return { success: false, error: exists > 0 ? "locked" : "not_found" };
    }
    // The admin pages and the customer's account order pages.
    revalidatePath("/admin", "layout");
    revalidatePath("/[lang]", "layout");
    return { success: true };
  } catch (error) {
    console.error("setOrderStatus failed", error);
    return { success: false, error: "unexpected" };
  }
}

// Admin refunds (feature 15b): a full Stripe refund of a paid order, then the
// same conditional Refunded write the charge.refunded webhook makes, so
// whichever runs second changes nothing.

export type RefundActionResult =
  | { success: true }
  | {
      success: false;
      error: "not_found" | "not_refundable" | "no_payment" | "stripe_error" | "unexpected";
    }
  | null;

// Stripe's answer when the charge is already fully refunded.
function isAlreadyRefunded(error: unknown): boolean {
  return (
    error instanceof Stripe.errors.StripeInvalidRequestError &&
    error.code === "charge_already_refunded"
  );
}

export async function refundOrder(
  _previous: RefundActionResult,
  formData: FormData,
): Promise<RefundActionResult> {
  await requireAdmin();
  try {
    const id = formData.get("id");
    if (!isProductId(id)) return { success: false, error: "not_found" };

    // Status and payment intent come from the database, never the form.
    const order = await db.order.findUnique({
      where: { id },
      select: { status: true, stripePaymentIntentId: true },
    });
    if (!order) return { success: false, error: "not_found" };
    if (!isFulfilmentStatus(order.status)) {
      return { success: false, error: "not_refundable" };
    }
    if (!order.stripePaymentIntentId) return { success: false, error: "no_payment" };

    try {
      // No amount: a full refund. The key stops a double submit refunding twice.
      const refund = await getStripe().refunds.create(
        { payment_intent: order.stripePaymentIntentId },
        { idempotencyKey: `refund-order-${id}` },
      );
      if (refund.status === "failed" || refund.status === "canceled") {
        console.error(`refundOrder: Stripe refund ${refund.status} for order ${id}`);
        return { success: false, error: "stripe_error" };
      }
    } catch (error) {
      if (!isAlreadyRefunded(error)) {
        if (!(error instanceof Stripe.errors.StripeError)) throw error;
        console.error(`refundOrder: Stripe refused order ${id}:`, error.message);
        return { success: false, error: "stripe_error" };
      }
    }

    // Zero rows means the webhook already marked it; the refund still stands.
    await db.order.updateMany({
      where: { id, status: { in: [...FULFILMENT_STATUSES] } },
      data: { status: "REFUNDED" },
    });
    revalidatePath("/admin", "layout");
    revalidatePath("/[lang]", "layout");
    return { success: true };
  } catch (error) {
    console.error(
      "refundOrder failed",
      error instanceof Error ? error.message : error,
    );
    return { success: false, error: "unexpected" };
  }
}
