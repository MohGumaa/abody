import type { Locale } from "@/lib/i18n/config";
import {
  button,
  DICTIONARIES,
  escapeHtml,
  page,
  type BuiltEmail,
} from "@/lib/order-emails";

// The forgot-password email (feature 28) as subject, HTML, and plain text.
// Pure like lib/order-emails.ts: the caller passes the absolute reset link.

export function passwordResetEmail(locale: Locale, resetUrl: string): BuiltEmail {
  const t = DICTIONARIES[locale].passwordResetEmail;

  const html = page(
    locale,
    t.subject,
    `<h1 style="font-size:22px;margin:0 0 8px">${escapeHtml(t.heading)}</h1>
<p style="margin:0 0 16px">${escapeHtml(t.intro)}</p>
<p style="margin:24px 0">${button(resetUrl, t.button)}</p>
<p style="margin:0 0 16px">${escapeHtml(t.expires)}</p>
<p style="margin:0;color:#78716c;font-size:13px">${escapeHtml(t.ignore)}</p>`,
  );

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
  ].join("\n");

  return { subject: t.subject, html, text };
}
