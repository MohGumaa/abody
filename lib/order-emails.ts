import { formatDate } from "@/lib/dates";
import {
  button,
  centered,
  DICTIONARIES,
  EMAIL_COLORS as C,
  escapeHtml,
  heading2,
  linesCard,
  ltr,
  page,
  pill,
  statsRow,
  stepCard,
  textFooter,
  totalRow,
  type BuiltEmail,
  type EmailBrand,
} from "@/lib/email-layout";
import type { ProductType } from "@/lib/generated/prisma/enums";
import type { Locale } from "@/lib/i18n/config";
import { formatPriceCents } from "@/lib/money";
import { formatOrderNumber } from "@/lib/orders";

// The order emails (feature 19a) as subject, HTML, and plain text. No db,
// next/*, or fetch imports: callers pass names already localized, links
// already absolute, and the brand values, and Vitest loads this module directly.

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
  createdAt: Date;
  lines: EmailOrderLine[];
}

function lineTotal(line: EmailOrderLine): string {
  return formatPriceCents(line.priceCents * line.quantity);
}

function typePill(type: ProductType, label: string): string {
  return type === "SERVICE"
    ? pill(escapeHtml(label), C.service, C.serviceSoft)
    : pill(escapeHtml(label), C.brand, C.soft);
}

function lineDetails(type: string, quantityLabel: string, quantity: number): string {
  return `<span style="font-size:13px;color:${C.faint}">${type} &nbsp;${escapeHtml(quantityLabel)}: ${ltr(String(quantity))}</span>`;
}

export function customerOrderEmail(
  order: EmailOrder,
  locale: Locale,
  orderPageUrl: string,
  brand: EmailBrand,
): BuiltEmail {
  const dictionary = DICTIONARIES[locale];
  const t = dictionary.orderEmail;
  const types = dictionary.emailLayout;
  const number = formatOrderNumber(order.number);
  const total = formatPriceCents(order.totalCents);
  const hasDownloads = order.lines.some((line) => line.type === "DIGITAL_PRODUCT");
  const hasServices = order.lines.some((line) => line.type === "SERVICE");
  const subject = t.subject.replace("{number}", number);

  const rows = order.lines.map((line): [string, string] => [
    `<strong><bdi>${escapeHtml(line.name)}</bdi></strong><br>${lineDetails(
      typePill(line.type, line.type === "SERVICE" ? types.service : types.digitalProduct),
      t.quantity,
      line.quantity,
    )}`,
    ltr(lineTotal(line)),
  ]);
  const steps = [
    ...(hasDownloads ? [[t.downloadsTitle, t.downloadsBody, C.brand, C.soft]] : []),
    ...(hasServices ? [[t.servicesTitle, t.servicesBody, C.service, "#f2f0fe"]] : []),
  ].map(([title, text, accent, background], i) =>
    stepCard(locale, i + 1, title, text, accent, background),
  );

  const html = page({
    locale,
    brand,
    title: subject,
    preheader: t.preheader.replace("{number}", number),
    meta: `${escapeHtml(t.orderLabel)} ${ltr(number)}<br><bdi>${escapeHtml(formatDate(order.createdAt, locale))}</bdi>`,
    icon: "&#10003;",
    heading: t.heading,
    sub: `${escapeHtml(t.orderLabel)} ${ltr(number)} &middot; ${pill(`&#10003; ${escapeHtml(t.paymentReceived)}`, C.success, C.successSoft)}`,
    footerNote: t.footer,
    body: `<p style="margin:0 0 20px">${escapeHtml(t.intro).replace("{number}", () => ltr(number))}</p>
${linesCard(locale, rows)}
${totalRow(locale, t.total, total)}
${steps.length ? `${heading2(t.nextTitle)}\n${steps.join("\n")}` : ""}
${centered(button(orderPageUrl, t.viewOrder))}`,
  });

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
    ...textFooter(brand),
  ].join("\n");

  return { subject, html, text };
}

const TYPE_LABELS: Record<ProductType, string> = {
  DIGITAL_PRODUCT: "Digital product",
  SERVICE: "Service",
};

export const ADMIN_EYEBROW = "Admin notice";
export const ADMIN_FOOTER =
  "Sent to the admin notification inbox set in ADMIN_NOTIFICATION_EMAIL.";

// English only, like the admin area.
export function adminOrderEmail(
  order: EmailOrder,
  adminOrderUrl: string,
  serviceUrl: (lineId: string) => string,
  brand: EmailBrand,
): BuiltEmail {
  const number = formatOrderNumber(order.number);
  const total = formatPriceCents(order.totalCents);
  const hasServices = order.lines.some((line) => line.type === "SERVICE");
  const subject = `New order ${number} - ${total}${hasServices ? " (includes a service)" : ""}`;
  const customer = order.customerEmail ?? "No email on the order";
  const items = order.lines.reduce((sum, line) => sum + line.quantity, 0);

  const rows = order.lines.map((line): [string, string] => {
    const link =
      line.type === "SERVICE"
        ? `<br><a href="${escapeHtml(serviceUrl(line.id))}" style="font-size:13px;font-weight:normal;color:${C.brand}">Open service order &rarr;</a>`
        : "";
    return [
      `<strong>${escapeHtml(line.name)}</strong>${link}<br>${lineDetails(typePill(line.type, TYPE_LABELS[line.type]), "Qty", line.quantity)}`,
      escapeHtml(lineTotal(line)),
    ];
  });

  const html = page({
    locale: "en",
    brand,
    admin: true,
    title: subject,
    preheader: `New order ${number} for ${total} from ${customer}${hasServices ? ", includes a service" : ""}.`,
    meta: escapeHtml(formatDate(order.createdAt, "en")),
    icon: "&#128722;",
    eyebrow: ADMIN_EYEBROW,
    heading: `New order ${number}`,
    footerNote: ADMIN_FOOTER,
    body: `${statsRow([
      ["Total paid", `<span style="color:${C.brand}">${escapeHtml(total)}</span>`],
      ["Items", String(items)],
      ["Customer", `<span style="font-size:15px;word-break:break-all">${escapeHtml(customer)}</span>`],
    ])}
${hasServices ? `<div style="margin-top:16px">${pill("Includes a service", C.service, C.serviceSoft)}</div>` : ""}
<div style="margin-top:16px">${linesCard("en", rows)}</div>
${centered(button(adminOrderUrl, "Open the order", C.ink))}`,
  });

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
