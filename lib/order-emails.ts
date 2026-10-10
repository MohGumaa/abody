import type { ProductType } from "@/lib/generated/prisma/enums";
import { localeDirection, type Locale } from "@/lib/i18n/config";
import { ar } from "@/lib/i18n/dictionaries/ar";
import { en, type Dictionary } from "@/lib/i18n/dictionaries/en";
import { formatPriceCents } from "@/lib/money";
import { formatOrderNumber } from "@/lib/orders";

// The order emails (feature 19a) as subject, HTML, and plain text. No db,
// next/*, or fetch imports: callers pass names already localized and links
// already absolute, and Vitest loads this module directly.

const DICTIONARIES: Record<Locale, Dictionary> = { en, ar };

const FONT = "Tajawal, Arial, Helvetica, sans-serif";

export interface EmailOrderLine {
  id: string;
  name: string;
  type: ProductType;
  quantity: number;
  priceCents: number;
}

export interface EmailOrder {
  number: number;
  totalCents: number;
  customerEmail: string | null;
  lines: EmailOrderLine[];
}

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

// Product names are admin-entered, so every interpolated value is escaped.
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function lineTotal(line: EmailOrderLine): string {
  return formatPriceCents(line.priceCents * line.quantity);
}

// Numbers and prices keep left-to-right order inside Arabic text.
function ltr(value: string): string {
  return `<span dir="ltr">${escapeHtml(value)}</span>`;
}

function button(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;border-radius:8px;background:#1d4ed8;color:#ffffff;font-weight:bold;text-decoration:none">${escapeHtml(label)}</a>`;
}

function page(locale: Locale, title: string, body: string): string {
  return `<!doctype html>
<html lang="${locale}" dir="${localeDirection(locale)}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:24px;background:#f5f5f4;font-family:${FONT};color:#1c1917">
<div style="max-width:560px;margin:0 auto;padding:24px;background:#ffffff;border-radius:12px">
${body}
</div>
</body>
</html>`;
}

export function customerOrderEmail(
  order: EmailOrder,
  locale: Locale,
  orderPageUrl: string,
): BuiltEmail {
  const t = DICTIONARIES[locale].orderEmail;
  const number = formatOrderNumber(order.number);
  const total = formatPriceCents(order.totalCents);
  const hasDownloads = order.lines.some((line) => line.type === "DIGITAL_PRODUCT");
  const hasServices = order.lines.some((line) => line.type === "SERVICE");
  const subject = t.subject.replace("{number}", number);
  const align = locale === "ar" ? "left" : "right";

  const rows = order.lines
    .map(
      (line) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #e7e5e4"><bdi>${escapeHtml(line.name)}</bdi><br><span style="color:#57534e;font-size:14px">${escapeHtml(t.quantity)}: ${ltr(String(line.quantity))}</span></td><td style="padding:8px 0;border-bottom:1px solid #e7e5e4;text-align:${align};white-space:nowrap">${ltr(lineTotal(line))}</td></tr>`,
    )
    .join("\n");
  const sections = [
    hasDownloads
      ? `<h2 style="font-size:18px;margin:24px 0 8px">${escapeHtml(t.downloadsTitle)}</h2><p style="margin:0">${escapeHtml(t.downloadsBody)}</p>`
      : "",
    hasServices
      ? `<h2 style="font-size:18px;margin:24px 0 8px">${escapeHtml(t.servicesTitle)}</h2><p style="margin:0">${escapeHtml(t.servicesBody)}</p>`
      : "",
  ].join("\n");

  const html = page(
    locale,
    subject,
    `<h1 style="font-size:22px;margin:0 0 8px">${escapeHtml(t.heading)}</h1>
<p style="margin:0 0 16px">${escapeHtml(t.intro).replace("{number}", ltr(number))}</p>
<p style="margin:0 0 16px;color:#15803d;font-weight:bold">${escapeHtml(t.paymentReceived)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
${rows}
<tr><td style="padding:12px 0;font-weight:bold">${escapeHtml(t.total)}</td><td style="padding:12px 0;font-weight:bold;text-align:${align}">${ltr(total)}</td></tr>
</table>
${sections}
<p style="margin:24px 0">${button(orderPageUrl, t.viewOrder)}</p>
<p style="margin:0;color:#78716c;font-size:13px">${escapeHtml(t.footer)}</p>`,
  );

  const text = [
    t.heading,
    "",
    t.intro.replace("{number}", number),
    t.paymentReceived,
    "",
    ...order.lines.map(
      (line) => `${line.name} (${t.quantity}: ${line.quantity}) - ${lineTotal(line)}`,
    ),
    `${t.total}: ${total}`,
    ...(hasDownloads ? ["", t.downloadsTitle, t.downloadsBody] : []),
    ...(hasServices ? ["", t.servicesTitle, t.servicesBody] : []),
    "",
    `${t.viewOrder}: ${orderPageUrl}`,
    "",
    t.footer,
  ].join("\n");

  return { subject, html, text };
}

const TYPE_LABELS: Record<ProductType, string> = {
  DIGITAL_PRODUCT: "Digital product",
  SERVICE: "Service",
};

// English only, like the admin area.
export function adminOrderEmail(
  order: EmailOrder,
  adminOrderUrl: string,
  serviceUrl: (lineId: string) => string,
): BuiltEmail {
  const number = formatOrderNumber(order.number);
  const total = formatPriceCents(order.totalCents);
  const hasServices = order.lines.some((line) => line.type === "SERVICE");
  const subject = `New order ${number} - ${total}${hasServices ? " (includes a service)" : ""}`;
  const customer = order.customerEmail ?? "No email on the order";

  const rows = order.lines
    .map((line) => {
      const link =
        line.type === "SERVICE"
          ? ` <a href="${escapeHtml(serviceUrl(line.id))}">Open service order</a>`
          : "";
      return `<li style="margin:0 0 8px">${escapeHtml(line.name)} - ${TYPE_LABELS[line.type]} x ${line.quantity} - ${escapeHtml(lineTotal(line))}${link}</li>`;
    })
    .join("\n");

  const html = page(
    "en",
    subject,
    `<h1 style="font-size:22px;margin:0 0 8px">New order ${escapeHtml(number)}</h1>
<p style="margin:0 0 4px">Total paid: <strong>${escapeHtml(total)}</strong></p>
<p style="margin:0 0 16px">Customer: ${escapeHtml(customer)}</p>
<ul style="margin:0 0 16px;padding-left:20px">
${rows}
</ul>
<p style="margin:24px 0">${button(adminOrderUrl, "Open the order")}</p>`,
  );

  const text = [
    `New order ${number}`,
    `Total paid: ${total}`,
    `Customer: ${customer}`,
    "",
    ...order.lines.map(
      (line) =>
        `- ${line.name} - ${TYPE_LABELS[line.type]} x ${line.quantity} - ${lineTotal(line)}` +
        (line.type === "SERVICE" ? ` - ${serviceUrl(line.id)}` : ""),
    ),
    "",
    `Open the order: ${adminOrderUrl}`,
  ].join("\n");

  return { subject, html, text };
}
