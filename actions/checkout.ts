"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { buildCartView, CART_COOKIE, parseCart } from "@/lib/cart";
import { listPublishedProductsByIds } from "@/lib/catalog";
import {
  checkoutLineItems,
  checkoutReturnUrls,
  stripeCheckoutLocale,
} from "@/lib/checkout";
import { isLocale } from "@/lib/i18n/config";
import { getStripe } from "@/lib/stripe";

export type CheckoutActionError = "invalid_input" | "empty_cart" | "unexpected";

// Success never returns: the action redirects to Stripe.
export type CheckoutActionResult =
  | { success: false; error: CheckoutActionError }
  | null;

export async function startCheckout(
  _previous: CheckoutActionResult,
  formData: FormData,
): Promise<CheckoutActionResult> {
  const locale = formData.get("lang");
  if (typeof locale !== "string" || !isLocale(locale)) {
    return { success: false, error: "invalid_input" };
  }

  let url: string | null;
  try {
    // The cookie is untrusted: lines, names, and prices come from the current
    // published products, exactly as the cart page shows them.
    const entries = parseCart((await cookies()).get(CART_COOKIE)?.value);
    const products = await listPublishedProductsByIds(
      entries.map((entry) => entry.productId),
      locale,
    );
    const view = buildCartView(entries, products);
    if (view.lines.length === 0) return { success: false, error: "empty_cart" };

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: checkoutLineItems(view),
      ...checkoutReturnUrls(locale),
      locale: stripeCheckoutLocale(locale),
      metadata: { locale },
    });
    url = session.url;
  } catch (error) {
    console.error("startCheckout failed", error);
    return { success: false, error: "unexpected" };
  }

  if (!url) {
    console.error("startCheckout failed: the session has no url");
    return { success: false, error: "unexpected" };
  }
  // Outside the try block, so the redirect is not caught as an error.
  redirect(url);
}
