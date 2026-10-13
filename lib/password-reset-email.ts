import {
  button,
  centered,
  DICTIONARIES,
  EMAIL_COLORS as C,
  escapeHtml,
  page,
  textFooter,
  type BuiltEmail,
  type EmailBrand,
} from "@/lib/email-layout";
import type { Locale } from "@/lib/i18n/config";

// The forgot-password email (feature 28) as subject, HTML, and plain text.
// Pure like lib/order-emails.ts: the caller passes the absolute reset link and
// the brand values.

export function passwordResetEmail(
  locale: Locale,
  resetUrl: string,
  brand: EmailBrand,
): BuiltEmail {
  const t = DICTIONARIES[locale].passwordResetEmail;

  const html = page({
    locale,
    brand,
    title: t.subject,
    preheader: t.preheader,
    icon: "&#128273;",
    heading: t.heading,
    footerNote: t.footer,
    body: `<p style="margin:0 0 24px">${escapeHtml(t.intro)}</p>
${centered(button(resetUrl, t.button), 0)}
<p style="margin:16px 0 0;text-align:center;color:${C.faint};font-size:14px">&#9201; ${escapeHtml(t.expires)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin-top:28px;background:${C.canvas};border-radius:12px"><tr><td style="padding:16px 18px;font-size:14px;color:${C.muted}">
<strong style="color:${C.fg}">${escapeHtml(t.didntAsk)}</strong><br>${escapeHtml(t.ignoreBody)}
</td></tr></table>
<p style="margin:24px 0 0;font-size:13px;color:${C.faint}">${escapeHtml(t.pasteLink)}<br>
<a href="${escapeHtml(resetUrl)}" style="color:${C.brand};word-break:break-all" dir="ltr">${escapeHtml(resetUrl)}</a></p>`,
  });

  const text = [
    t.heading,
    "",
    t.intro,
    "",
    `${t.button}: ${resetUrl}`,
    "",
    t.expires,
    "",
    t.ignore,
    ...textFooter(brand),
  ].join("\n");

  return { subject: t.subject, html, text };
}
