import type { ServiceStatus } from "@/lib/generated/prisma/enums";
import type { Locale } from "@/lib/i18n/config";
import {
  button,
  DICTIONARIES,
  escapeHtml,
  ltr,
  page,
  type BuiltEmail,
} from "@/lib/order-emails";
import { formatOrderNumber } from "@/lib/orders";

// The service emails (feature 19b) as subject, HTML, and plain text. Pure like
// lib/order-emails.ts: callers pass names already localized and links already
// absolute. Neither email carries admin notes or the customer's requirements.
// Names are admin-entered, so they go in through replacer functions: a "$&" in
// a name stays literal.

export interface EmailService {
  name: string;
  orderNumber: number;
}

export function customerServiceStatusEmail(
  service: EmailService & { status: ServiceStatus },
  locale: Locale,
  orderPageUrl: string,
): BuiltEmail {
  const dictionary = DICTIONARIES[locale];
  const t = dictionary.serviceEmail;
  const number = formatOrderNumber(service.orderNumber);
  const label = dictionary.account.serviceStatus[service.status];
  const message = dictionary.account.service.messages[service.status];
  const subject = t.subject.replace("{name}", () => service.name);

  const html = page(
    locale,
    subject,
    `<h1 style="font-size:22px;margin:0 0 8px">${escapeHtml(t.heading)}</h1>
<p style="margin:0 0 16px">${escapeHtml(t.intro)
      .replace("{name}", () => `<bdi>${escapeHtml(service.name)}</bdi>`)
      .replace("{number}", () => ltr(number))}</p>
<p style="margin:0 0 8px">${escapeHtml(t.status)}: <strong>${escapeHtml(label)}</strong></p>
<p style="margin:0 0 16px">${escapeHtml(message)}</p>
<p style="margin:24px 0">${button(orderPageUrl, t.viewOrder)}</p>
<p style="margin:0;color:#78716c;font-size:13px">${escapeHtml(t.footer)}</p>`,
  );

  const text = [
    t.heading,
    "",
    t.intro.replace("{name}", () => service.name).replace("{number}", () => number),
    `${t.status}: ${label}`,
    message,
    "",
    `${t.viewOrder}: ${orderPageUrl}`,
    "",
    t.footer,
  ].join("\n");

  return { subject, html, text };
}

export type RequirementsKind = "created" | "updated";

// English only, like the admin area. `customer` is the admin's customer label.
export function adminServiceRequirementsEmail(
  service: EmailService & { customer: string },
  kind: RequirementsKind,
  adminUrl: string,
): BuiltEmail {
  const number = formatOrderNumber(service.orderNumber);
  const heading = kind === "created" ? "New service details" : "Service details updated";
  const subject = `${heading}: ${service.name} (order ${number})`;
  const intro =
    kind === "created"
      ? "The customer sent their details for this service."
      : "The customer updated their details for this service.";

  const html = page(
    "en",
    subject,
    `<h1 style="font-size:22px;margin:0 0 8px">${escapeHtml(heading)}</h1>
<p style="margin:0 0 16px">${escapeHtml(intro)}</p>
<p style="margin:0 0 4px">Service: <strong>${escapeHtml(service.name)}</strong></p>
<p style="margin:0 0 4px">Order: ${escapeHtml(number)}</p>
<p style="margin:0 0 16px">Customer: ${escapeHtml(service.customer)}</p>
<p style="margin:24px 0">${button(adminUrl, "Open the service order")}</p>`,
  );

  const text = [
    heading,
    "",
    intro,
    `Service: ${service.name}`,
    `Order: ${number}`,
    `Customer: ${service.customer}`,
    "",
    `Open the service order: ${adminUrl}`,
  ].join("\n");

  return { subject, html, text };
}
