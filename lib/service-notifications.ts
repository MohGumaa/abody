import { customerLabel } from "@/lib/admin";
import { localizedName } from "@/lib/catalog";
import { db } from "@/lib/db";
import { adminNotificationEmail, emailConfig, sendEmail } from "@/lib/email";
import { localizedPath, type Locale } from "@/lib/i18n/config";
import { sessionLocale } from "@/lib/order-notifications";
import { absoluteUrl } from "@/lib/seo";
import {
  adminServiceRequirementsEmail,
  customerServiceStatusEmail,
  type RequirementsKind,
} from "@/lib/service-emails";
import { getStripe } from "@/lib/stripe";

// Server code only. The service emails (feature 19b), scheduled with after()
// by the admin status save and the customer's onboarding submit. Best effort:
// these never throw, and each failure is logged with the service or item id
// only, never an address, the session id, notes, requirements, or content.

function reason(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

// The checkout language is not stored locally; the Checkout session keeps it.
// Any Stripe failure means English. Stripe's messages can repeat the session
// id, so only the error's name is logged.
async function checkoutLocale(label: string, sessionId: string): Promise<Locale> {
  try {
    return sessionLocale(await getStripe().checkout.sessions.retrieve(sessionId));
  } catch (error) {
    const name = error instanceof Error ? error.name : "unknown error";
    console.error(`${label} email language lookup failed (${name}); using English`);
    return "en";
  }
}

export async function sendServiceStatusEmail(serviceId: string, changedAt: Date): Promise<void> {
  const label = `Service ${serviceId} status`;
  try {
    const service = await db.service.findUnique({
      where: { id: serviceId },
      select: {
        status: true,
        orderItem: {
          select: {
            product: { select: { name: true, nameAr: true } },
            order: {
              select: { number: true, customerEmail: true, stripeCheckoutSessionId: true },
            },
          },
        },
      },
    });
    if (!service) {
      console.error(`${label} email: service not found`);
      return;
    }
    const { product, order } = service.orderItem;
    const config = emailConfig();
    if (!config) {
      console.info(`Email is off; ${label} email skipped`);
      return;
    }
    if (!order.customerEmail) {
      console.info(`${label} email skipped: no address`);
      return;
    }
    // Looked up only when an email will go out.
    const locale = await checkoutLocale(label, order.stripeCheckoutSessionId);
    const orderPageUrl = `${absoluteUrl(localizedPath(locale, "/success"))}?session_id=${encodeURIComponent(order.stripeCheckoutSessionId)}`;
    await sendEmail(config, {
      to: order.customerEmail,
      ...customerServiceStatusEmail(
        {
          name: localizedName(product, locale),
          orderNumber: order.number,
          status: service.status,
        },
        locale,
        orderPageUrl,
      ),
      idempotencyKey: `service-status/${serviceId}/${changedAt.toISOString()}`,
    });
  } catch (error) {
    console.error(`${label} email failed: ${reason(error)}`);
  }
}

export async function sendServiceRequirementsEmail(
  itemId: string,
  kind: RequirementsKind,
): Promise<void> {
  const label = `Order item ${itemId} requirements`;
  try {
    const item = await db.orderItem.findUnique({
      where: { id: itemId },
      select: {
        product: { select: { name: true } },
        order: {
          select: { number: true, customerEmail: true, user: { select: { name: true } } },
        },
      },
    });
    if (!item) {
      console.error(`${label} email: order item not found`);
      return;
    }
    const config = emailConfig();
    if (!config) {
      console.info(`Email is off; ${label} email skipped`);
      return;
    }
    const to = adminNotificationEmail();
    if (!to) {
      console.info(`${label} email skipped: no address`);
      return;
    }
    await sendEmail(config, {
      to,
      ...adminServiceRequirementsEmail(
        {
          name: item.product.name,
          orderNumber: item.order.number,
          customer: customerLabel(item.order),
        },
        kind,
        absoluteUrl(`/admin/service-orders/${encodeURIComponent(itemId)}`),
      ),
      idempotencyKey: `service-requirements/${itemId}/${new Date().toISOString()}`,
    });
  } catch (error) {
    console.error(`${label} email failed: ${reason(error)}`);
  }
}
