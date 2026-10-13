import {
  button,
  centered,
  DICTIONARIES,
  EMAIL_COLORS as C,
  escapeHtml,
  ltr,
  page,
  startSide,
  statsRow,
  textFooter,
  type BuiltEmail,
  type EmailBrand,
} from "@/lib/email-layout";
import type { ServiceStatus } from "@/lib/generated/prisma/enums";
import type { Locale } from "@/lib/i18n/config";
import { ADMIN_EYEBROW, ADMIN_FOOTER } from "@/lib/order-emails";
import { formatOrderNumber } from "@/lib/orders";

// The service emails (feature 19b) as subject, HTML, and plain text. Pure like
// lib/order-emails.ts: callers pass names already localized, links already
// absolute, and the brand values. Neither email carries admin notes or the
// customer's requirements. Names are admin-entered, so they go in through
// replacer functions: a "$&" in a name stays literal.

export interface EmailService {
  name: string;
  orderNumber: number;
}

// The steps a running service moves through. Waiting and cancelled get a
// callout instead.
const TRACKER_STEPS = ["NEW", "IN_PROGRESS", "COMPLETED"] as const;
type TrackerStatus = (typeof TRACKER_STEPS)[number];

function tracker(locale: Locale, status: TrackerStatus, message: string): string {
  const labels = DICTIONARIES[locale].account.serviceStatus;
  const current = TRACKER_STEPS.indexOf(status);
  const cells = TRACKER_STEPS.map((step, i) => {
    const done = i <= current;
    const checked = i < current || status === "COMPLETED";
    const labelStyle =
      i === current ? `color:${C.brand};font-weight:bold` : `color:${C.faint}`;
    return `<td width="33%" valign="top" style="text-align:center;padding:0 4px">
<div style="height:6px;border-radius:3px;background:${done ? C.brand : C.border};margin-bottom:10px"></div>
<div style="display:inline-block;width:26px;height:26px;border-radius:13px;background:${done ? C.brand : C.panel};border:2px solid ${done ? C.brand : C.border};color:${done ? "#ffffff" : C.faint};font-size:13px;font-weight:bold;line-height:26px">${checked ? "&#10003;" : i + 1}</div>
<div style="margin-top:6px;font-size:13px;${labelStyle}">${escapeHtml(labels[step])}</div></td>`;
  }).join("\n");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid ${C.border};border-radius:12px"><tr><td style="padding:20px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 4px"><tr>
${cells}
</tr></table>
<p style="margin:16px 0 0;text-align:center;color:${C.muted}">${escapeHtml(message)}</p></td></tr></table>`;
}

function callout(
  locale: Locale,
  caption: string,
  label: string,
  message: string,
  color: string,
  background: string,
): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background:${background};border-radius:12px;border-${startSide(locale)}:4px solid ${color}"><tr><td style="padding:16px 18px">
<span style="font-size:13px;color:${C.muted}">${escapeHtml(caption)}</span><br><strong style="font-size:18px;color:${color}">${escapeHtml(label)}</strong>
<p style="margin:6px 0 0">${escapeHtml(message)}</p></td></tr></table>`;
}

const STATUS_ICONS: Record<ServiceStatus, string> = {
  NEW: "&#8635;",
  IN_PROGRESS: "&#8635;",
  COMPLETED: "&#10003;",
  WAITING_FOR_INFORMATION: "!",
  CANCELLED: "&#10005;",
};

export function customerServiceStatusEmail(
  service: EmailService & { status: ServiceStatus },
  locale: Locale,
  orderPageUrl: string,
  brand: EmailBrand,
): BuiltEmail {
  const dictionary = DICTIONARIES[locale];
  const t = dictionary.serviceEmail;
  const { status } = service;
  const number = formatOrderNumber(service.orderNumber);
  const label = dictionary.account.serviceStatus[status];
  const message = dictionary.account.service.messages[status];
  const subject = t.subject.replace("{name}", () => service.name);
  const name = `<bdi>${escapeHtml(service.name)}</bdi>`;

  let heading = t.heading;
  let card: string;
  let action = button(orderPageUrl, t.viewOrder);
  if (status === "WAITING_FOR_INFORMATION") {
    heading = t.waitingHeading;
    card = callout(locale, t.status, label, message, C.warning, C.warningSoft);
    action = button(orderPageUrl, dictionary.onboarding.edit, C.warning);
  } else if (status === "CANCELLED") {
    heading = t.cancelledHeading;
    card = callout(locale, t.status, label, message, C.danger, C.dangerSoft);
  } else {
    card = tracker(locale, status, message);
  }

  const html = page({
    locale,
    brand,
    title: subject,
    preheader: message,
    meta: `${escapeHtml(dictionary.orderEmail.orderLabel)} ${ltr(number)}`,
    icon: STATUS_ICONS[status],
    heading,
    sub: name,
    footerNote: t.footer,
    body: `<p style="margin:0 0 20px">${escapeHtml(t.intro)
      .replace("{name}", () => `<strong>${name}</strong>`)
      .replace("{number}", () => ltr(number))}</p>
${card}
${centered(action)}`,
  });

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
    ...textFooter(brand),
  ].join("\n");

  return { subject, html, text };
}

export type RequirementsKind = "created" | "updated";

// English only, like the admin area. `customer` is the admin's customer label.
export function adminServiceRequirementsEmail(
  service: EmailService & { customer: string },
  kind: RequirementsKind,
  adminUrl: string,
  brand: EmailBrand,
): BuiltEmail {
  const number = formatOrderNumber(service.orderNumber);
  const heading = kind === "created" ? "New service details" : "Service details updated";
  const subject = `${heading}: ${service.name} (order ${number})`;
  const intro =
    kind === "created"
      ? "The customer sent their details for this service."
      : "The customer updated their details for this service.";

  const html = page({
    locale: "en",
    brand,
    admin: true,
    title: subject,
    preheader: `${intro} ${service.name}, order ${number}.`,
    meta: `Order ${ltr(number)}`,
    icon: "&#128203;",
    eyebrow: ADMIN_EYEBROW,
    heading,
    footerNote: ADMIN_FOOTER,
    body: `<p style="margin:0 0 20px">${escapeHtml(intro)}</p>
${statsRow([
  ["Service", escapeHtml(service.name)],
  ["Order", escapeHtml(number)],
  ["Customer", `<span style="font-size:15px;word-break:break-all">${escapeHtml(service.customer)}</span>`],
])}
${centered(button(adminUrl, "Open the service order", C.ink))}`,
  });

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
