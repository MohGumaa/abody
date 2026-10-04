import type Stripe from "stripe";
import { apiError } from "@/lib/api-error";
import { syncCheckoutSession } from "@/lib/order-sync";
import { getStripe } from "@/lib/stripe";

// Stripe calls this endpoint; only a signature-verified event changes orders.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return apiError(500, "internal_error", "Webhook is not configured.");
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return apiError(400, "invalid_signature", "Missing Stripe signature.");
  }

  // The signature covers the exact raw body, so read it before any parsing.
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch (error) {
    // Log the reason only: never the body, which holds customer details.
    console.error(
      "Stripe webhook verification failed:",
      error instanceof Error ? error.message : error,
    );
    return apiError(400, "invalid_signature", "Invalid Stripe signature.");
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.async_payment_failed":
        await syncCheckoutSession(event.type, event.data.object);
        break;
      default:
        // Acknowledged so Stripe stops sending it; nothing to do.
        break;
    }
  } catch (error) {
    console.error(
      `Stripe webhook ${event.id} (${event.type}) failed:`,
      error instanceof Error ? error.message : error,
    );
    return apiError(500, "internal_error", "Webhook processing failed.");
  }

  return Response.json({ received: true });
}
