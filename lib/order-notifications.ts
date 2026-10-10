import type Stripe from "stripe";
import { localizedName } from "@/lib/catalog";
import { db } from "@/lib/db";
import { adminNotificationEmail, emailConfig, sendEmail } from "@/lib/email";
import { isLocale, localizedPath, type Locale } from "@/lib/i18n/config";
import {
  adminOrderEmail,
  customerOrderEmail,
  type BuiltEmail,
  type EmailOrder,
} from "@/lib/order-emails";
import { formatOrderNumber } from "@/lib/orders";
import { absoluteUrl } from "@/lib/seo";

// Server code only. The paid-order emails (feature 19a), sent by the webhook
// after the order write that made the order PAID. Best effort: this never
// throws, and each failure is logged with the order number or id only, never
// an address, the session id, or content.

function reason(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

// Checkout stores the page language in the session's metadata.
export function sessionLocale(session: Pick<Stripe.Checkout.Session, "metadata">): Locale {
  const locale = session.metadata?.locale;
  return isLocale(locale) ? locale : "en";
}

async function loadOrder(orderId: string, locale: Locale) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      number: true,
      totalCents: true,
      customerEmail: true,
      items: {
        orderBy: { product: { name: "asc" } },
        select: {
          id: true,
          quantity: true,
          priceCents: true,
          product: { select: { name: true, nameAr: true, type: true } },
        },
      },
    },
  });
  if (!order) return null;
  // The customer email shows names in the order's language; the admin one in English.
  const lines = (nameLocale: Locale): EmailOrder["lines"] =>
    order.items.map((item) => ({
      id: item.id,
      name: localizedName(item.product, nameLocale),
      type: item.product.type,
      quantity: item.quantity,
      priceCents: item.priceCents,
    }));
  const base = {
    number: order.number,
    totalCents: order.totalCents,
    customerEmail: order.customerEmail,
  };
  return { customer: { ...base, lines: lines(locale) }, admin: { ...base, lines: lines("en") } };
}

export async function sendOrderPaidEmails(
  orderId: string,
  session: Pick<Stripe.Checkout.Session, "id" | "metadata">,
): Promise<void> {
  try {
    const config = emailConfig();
    const locale = sessionLocale(session);
    const order = await loadOrder(orderId, locale);
    if (!order) {
      console.error(`Order emails: order ${orderId} not found`);
      return;
    }
    const number = formatOrderNumber(order.customer.number);
    if (!config) {
      console.info(`Email is off; order ${number} emails skipped`);
      return;
    }

    const send = async (kind: string, to: string | null, build: () => BuiltEmail) => {
      if (!to) {
        console.info(`Order ${number} ${kind} email skipped: no address`);
        return;
      }
      try {
        await sendEmail(config, {
          to,
          ...build(),
          idempotencyKey: `order-paid-${kind}/${orderId}`,
        });
      } catch (error) {
        console.error(`Order ${number} ${kind} email failed: ${reason(error)}`);
      }
    };

    const orderPageUrl = `${absoluteUrl(localizedPath(locale, "/success"))}?session_id=${encodeURIComponent(session.id)}`;
    await send("customer", order.customer.customerEmail, () =>
      customerOrderEmail(order.customer, locale, orderPageUrl),
    );
    await send("admin", adminNotificationEmail(), () =>
      adminOrderEmail(
        order.admin,
        absoluteUrl(`/admin/orders/${encodeURIComponent(orderId)}`),
        (itemId) => absoluteUrl(`/admin/service-orders/${encodeURIComponent(itemId)}`),
      ),
    );
  } catch (error) {
    console.error(`Order emails for order ${orderId} not sent: ${reason(error)}`);
  }
}
