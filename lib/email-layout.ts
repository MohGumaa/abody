import { localeDirection, localizedPath, type Locale } from "@/lib/i18n/config";
import { ar } from "@/lib/i18n/dictionaries/ar";
import { en, type Dictionary } from "@/lib/i18n/dictionaries/en";

// The branded wrapper shared by every transactional email (mockup:
// prototypes/emails.html). No db, next/*, or fetch imports: callers pass the
// brand values in, and Vitest loads this module directly. Email HTML is
// inline-styled and table-based because email clients ignore most CSS.

export const DICTIONARIES: Record<Locale, Dictionary> = { en, ar };

// The app/globals.css tokens as hex: email clients do not support oklch.
export const EMAIL_COLORS = {
  brand: "#0061a2",
  brandLight: "#3282c6",
  soft: "#dff1ff",
  canvas: "#ecf3fa",
  panel: "#ffffff",
  footer: "#f5f8fb",
  border: "#dbe2e9",
  ink: "#0e1e2f",
  fg: "#121921",
  muted: "#3f4952",
  faint: "#606a74",
  success: "#106c3e",
  successSoft: "#daf7e3",
  warning: "#7a5200",
  warningSoft: "#fdf0d5",
  danger: "#a8261d",
  dangerSoft: "#fde8e6",
  service: "#4a3aa8",
  serviceSoft: "#ece9fd",
} as const;

const C = EMAIL_COLORS;
const FONT = "Tajawal, Arial, Helvetica, sans-serif";
const TRUST_ICONS = ["&#9889;", "&#128274;", "&#128202;"];

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

// Passed in by the notification modules (emailBrand() in lib/email.ts).
export interface EmailBrand {
  siteUrl: string;
  contactEmail: string | null;
}

// Names and addresses are admin-entered, so every interpolated value is escaped.
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Numbers and prices keep left-to-right order inside Arabic text.
export function ltr(value: string): string {
  return `<span dir="ltr">${escapeHtml(value)}</span>`;
}

// The side where a line starts and ends in the email's language.
export function startSide(locale: Locale): "left" | "right" {
  return locale === "ar" ? "right" : "left";
}

export function endSide(locale: Locale): "left" | "right" {
  return locale === "ar" ? "left" : "right";
}

function siteLink(brand: EmailBrand, path: string): string {
  return brand.siteUrl.replace(/\/$/, "") + path;
}

// Bulletproof button: the table cell carries the color so Outlook keeps it.
export function button(href: string, label: string, color: string = C.brand): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" class="btn" style="border-collapse:separate;margin:0 auto">
<tr><td style="border-radius:10px;background:${color}"><a href="${escapeHtml(href)}" style="display:block;padding:14px 28px;border-radius:10px;color:#ffffff;font-weight:bold;font-size:16px;text-decoration:none;text-align:center">${escapeHtml(label)}</a></td></tr></table>`;
}

// `content` is HTML, so callers escape any text they put in it.
export function pill(content: string, fg: string, bg: string): string {
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${bg};color:${fg};font-weight:bold;font-size:12px;line-height:18px">${content}</span>`;
}

// Inbox preview text, hidden in the opened email. The trailing joiners keep
// clients from filling the preview with the body text.
export function preheader(text: string): string {
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(text)}${"&#847;&zwnj;&nbsp;".repeat(3)}</div>`;
}

export function heading2(text: string): string {
  return `<h2 style="margin:28px 0 4px;font-size:18px">${escapeHtml(text)}</h2>`;
}

// The plain text footer: the contact email when one is saved, then the site.
export function textFooter(brand: EmailBrand): string[] {
  return ["", ...(brand.contactEmail ? [brand.contactEmail] : []), siteLink(brand, "")];
}

export interface PageOptions {
  locale: Locale;
  brand: EmailBrand;
  // Plain text, escaped here.
  title: string;
  preheader: string;
  heading: string;
  eyebrow?: string;
  footerNote: string;
  // HTML: callers escape what they interpolate.
  icon: string;
  meta?: string;
  sub?: string;
  body: string;
  // Ink hero and a one-line footer, for the English-only admin emails.
  admin?: boolean;
}

function customerFooter(locale: Locale, brand: EmailBrand, note: string): string {
  const dictionary = DICTIONARIES[locale];
  const t = dictionary.emailLayout;
  const header = dictionary.header;
  const trust = [header.trust.download, header.trust.payment, header.trust.tracking];
  const links: [string, string][] = [
    [header.products, "/products"],
    [header.services, "/services"],
    [header.contact, "/contact"],
  ];
  const contact = brand.contactEmail
    ? `<p style="margin:0 0 10px">${escapeHtml(t.questions)} <a href="mailto:${escapeHtml(brand.contactEmail)}" style="color:${C.brand}" dir="ltr">${escapeHtml(brand.contactEmail)}</a></p>`
    : "";
  return `<tr><td style="padding:0;background:${C.soft}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
${trust
  .map(
    (line, i) =>
      `<td class="stack" width="33%" valign="top" style="padding:16px 12px;${i ? `border-${startSide(locale)}:1px solid #c7e3f8;` : ""}color:${C.brand};font-size:13px;line-height:1.4;text-align:center"><span style="font-size:16px">${TRUST_ICONS[i]}</span><br>${escapeHtml(line)}</td>`,
  )
  .join("\n")}
</tr></table></td></tr>
<tr><td class="pad" style="padding:24px 32px;background:${C.footer};border-top:1px solid ${C.border};color:${C.faint};font-size:13px;line-height:1.7;text-align:center">
<p style="margin:0 0 10px">${links
    .map(
      ([label, path]) =>
        `<a href="${escapeHtml(siteLink(brand, localizedPath(locale, path)))}" style="color:${C.brand};font-weight:bold;text-decoration:none">${escapeHtml(label)}</a>`,
    )
    .join(` <span style="color:${C.border}">&nbsp;|&nbsp;</span> `)}</p>
${contact}
<p style="margin:0 0 4px">${escapeHtml(note)}</p>
<p style="margin:0">${escapeHtml(dictionary.footer.rights(new Date().getUTCFullYear()))}</p>
</td></tr>`;
}

function adminFooter(note: string): string {
  return `<tr><td class="pad" style="padding:18px 32px;background:${C.footer};border-top:1px solid ${C.border};color:${C.faint};font-size:13px;line-height:1.6">${escapeHtml(note)}</td></tr>`;
}

// Preheader, accent bar, logo row, hero band, body, footer.
export function page(options: PageOptions): string {
  const { locale, brand, admin = false } = options;
  const dir = localeDirection(locale);
  const start = startSide(locale);
  const end = endSide(locale);
  const hero = admin ? C.ink : C.brand;
  const home = siteLink(brand, admin ? "/admin" : localizedPath(locale, "/"));
  const logo = siteLink(brand, "/Logo-0.jpg");
  const alt = DICTIONARIES[locale].header.logoAlt;

  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(options.title)}</title>
<style>
  @media (max-width:480px) {
    .wrap { padding:12px 8px !important; }
    .pad { padding-left:20px !important; padding-right:20px !important; }
    .stack { display:block !important; width:100% !important; box-sizing:border-box; border-left:0 !important; border-right:0 !important; }
    .stack + .stack { border-top:1px solid ${C.border} !important; }
    .meta { display:none !important; }
    .logo { text-align:center !important; }
    .btn { width:100% !important; }
    h1 { font-size:22px !important; }
  }
</style></head>
<body style="margin:0;padding:0;background:${C.canvas}">
${preheader(options.preheader)}
<div class="wrap" dir="${dir}" style="padding:32px 12px;background:${C.canvas};font-family:${FONT};color:${C.fg};font-size:16px;line-height:1.55">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;border-collapse:separate;background:${C.panel};border-radius:16px;overflow:hidden;box-shadow:0 10px 30px -12px rgba(14,30,47,.22)">
<tr><td style="height:5px;line-height:5px;font-size:0;background:${C.brandLight}">&nbsp;</td></tr>
<tr><td class="pad" style="padding:20px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
<td class="logo" style="text-align:${start}"><a href="${escapeHtml(home)}"><img src="${escapeHtml(logo)}" width="164" height="32" alt="${escapeHtml(alt)}" style="display:inline-block;height:32px;width:auto;border:0"></a></td>
${options.meta ? `<td class="meta" style="text-align:${end};color:${C.faint};font-size:13px;white-space:nowrap">${options.meta}</td>` : ""}
</tr></table>
</td></tr>
<tr><td class="pad" style="padding:32px;background:${hero};color:#ffffff">
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
<td valign="middle" style="width:52px;padding-${end}:16px"><div style="width:52px;height:52px;border-radius:26px;background:rgba(255,255,255,.16);color:#ffffff;font-size:26px;line-height:52px;text-align:center">${options.icon}</div></td>
<td valign="middle">
${options.eyebrow ? `<p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#a9c6e0">${escapeHtml(options.eyebrow)}</p>` : ""}
<h1 style="margin:0;font-size:26px;line-height:1.25;color:#ffffff">${escapeHtml(options.heading)}</h1>
${options.sub ? `<p style="margin:6px 0 0;font-size:15px;color:${C.soft}">${options.sub}</p>` : ""}
</td>
</tr></table>
</td></tr>
<tr><td class="pad" style="padding:32px">${options.body}</td></tr>
${admin ? adminFooter(options.footerNote) : customerFooter(locale, brand, options.footerNote)}
</table>
</div>
</body>
</html>`;
}

// A bordered card of rows; each row is [start cell HTML, end cell HTML].
export function linesCard(locale: Locale, rows: [string, string][]): string {
  const cell = `padding:14px 16px;border-bottom:1px solid ${C.border}`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid ${C.border};border-radius:12px">
${rows
  .map(
    ([main, side]) =>
      `<tr><td style="${cell}">${main}</td><td valign="top" style="${cell};text-align:${endSide(locale)};white-space:nowrap;font-weight:bold">${side}</td></tr>`,
  )
  .join("\n")}
</table>`;
}

// The highlighted total under a lines card.
export function totalRow(locale: Locale, label: string, value: string): string {
  const [first, last] = locale === "ar" ? ["0 10px 10px 0", "10px 0 0 10px"] : ["10px 0 0 10px", "0 10px 10px 0"];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:12px"><tr>
<td style="padding:12px 16px;background:${C.canvas};border-radius:${first};font-weight:bold">${escapeHtml(label)}</td>
<td style="padding:12px 16px;background:${C.canvas};border-radius:${last};text-align:${endSide(locale)};font-weight:bold;font-size:20px;color:${C.brand}">${ltr(value)}</td></tr></table>`;
}

// A numbered step card, as in "What happens next".
export function stepCard(
  locale: Locale,
  n: number,
  title: string,
  text: string,
  accent: string,
  background: string,
): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin-top:12px;background:${background};border-radius:12px"><tr>
<td valign="top" style="width:32px;padding:16px 0;padding-${startSide(locale)}:16px"><div style="width:28px;height:28px;border-radius:14px;background:${accent};color:#ffffff;font-weight:bold;font-size:14px;line-height:28px;text-align:center">${n}</div></td>
<td style="padding:16px"><strong style="display:block;margin-bottom:2px">${escapeHtml(title)}</strong><span style="color:${C.muted}">${escapeHtml(text)}</span></td></tr></table>`;
}

// A row of up to three labelled figures for the admin emails. Values are HTML.
export function statsRow(stats: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid ${C.border};border-radius:12px"><tr>
${stats
  .map(
    ([label, value], i) =>
      `<td class="stack" width="${Math.floor(100 / stats.length)}%" valign="top" style="padding:14px 16px;${i ? `border-left:1px solid ${C.border};` : ""}"><span style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${C.faint}">${escapeHtml(label)}</span><br><strong style="font-size:18px">${value}</strong></td>`,
  )
  .join("\n")}
</tr></table>`;
}

// Centers a block such as a button, with space above it.
export function centered(html: string, marginTop = 28): string {
  return `<div style="margin-top:${marginTop}px;text-align:center">${html}</div>`;
}
