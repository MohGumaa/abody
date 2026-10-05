import type { CartView } from "@/lib/cart";
import { localizedPath, type Locale } from "@/lib/i18n/config";
import { absoluteUrl } from "@/lib/seo";

// No Stripe client or next/* imports here: Server Actions, route handlers,
// pages, and Vitest all load this module.

const SESSION_ID_PATTERN = /^cs_(test|live)_[A-Za-z0-9_]+$/;
const SESSION_ID_MAX_LENGTH = 255;

export interface CheckoutLineItem {
  quantity: number;
  price_data: {
    currency: "usd";
    unit_amount: number;
    product_data: { name: string; metadata: { productId: string } };
  };
}

// Feature 6 maps paid lines back to products through metadata.productId.
export function checkoutLineItems(view: CartView): CheckoutLineItem[] {
  return view.lines.map((line) => ({
    quantity: line.quantity,
    price_data: {
      currency: "usd",
      unit_amount: line.product.priceCents,
      product_data: {
        name: line.product.name,
        metadata: { productId: line.product.id },
      },
    },
  }));
}

export function checkoutReturnUrls(locale: Locale) {
  return {
    // Stripe fills in the placeholder, so it must stay unencoded.
    success_url: `${absoluteUrl(localizedPath(locale, "/checkout/return"))}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${absoluteUrl(localizedPath(locale, "/cart"))}?checkout=cancelled`,
  };
}

// A signed-in customer's id travels to the webhook in client_reference_id
// (set here, on the server), which links the order to their account. Guests
// send neither field.
export function checkoutCustomer(
  user: { id: string; email: string } | null,
): { client_reference_id?: string; customer_email?: string } {
  return user ? { client_reference_id: user.id, customer_email: user.email } : {};
}

export function isCheckoutSessionId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= SESSION_ID_MAX_LENGTH &&
    SESSION_ID_PATTERN.test(value)
  );
}

export type CheckoutState = "paid" | "processing" | "not_completed";

export interface CheckoutSessionStatus {
  status: string | null;
  payment_status: string;
}

// Only what the customer sees; the webhook (feature 6) confirms payment.
export function checkoutState(session: CheckoutSessionStatus): CheckoutState {
  if (session.status !== "complete") return "not_completed";
  const { payment_status } = session;
  if (payment_status === "paid" || payment_status === "no_payment_required") {
    return "paid";
  }
  // "unpaid", or a status this code does not know, is never shown as paid.
  return "processing";
}

// Stripe Checkout has no Arabic locale, so Arabic pages let Stripe follow the
// browser language.
export function stripeCheckoutLocale(locale: Locale): "en" | "auto" {
  return locale === "en" ? "en" : "auto";
}
