// Server code only: transactional email through Resend's HTTPS API (feature
// 19a). Without RESEND_API_KEY and EMAIL_FROM, email is off, as in local
// development. Never log the key, an address, or email content.

import { isValidEmail } from "@/lib/auth";
import type { EmailBrand } from "@/lib/email-layout";
import { siteUrl } from "@/lib/seo";
import { getSiteContent } from "@/lib/site-content";

const RESEND_URL = "https://api.resend.com/emails";

export interface EmailConfig {
  apiKey: string;
  from: string;
}

export class EmailConfigError extends Error {}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  // Resend drops a repeat with the same key, so a retried send never doubles.
  idempotencyKey: string;
}

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

// The address in a sender Resend accepts: "you@domain" or "Name <you@domain>".
function senderAddress(from: string): string | null {
  const named = from.match(/^[^<>]+<([^<>]+)>$/);
  if (named) return named[1].trim();
  return /[<>]/.test(from) ? null : from;
}

// null when email is off. Only one of the two set throws, naming the missing
// one; a sender without a valid address throws too, so a typo is named in the
// log instead of failing every send at Resend. Messages never repeat values.
export function emailConfig(): EmailConfig | null {
  const apiKey = env("RESEND_API_KEY");
  const from = env("EMAIL_FROM");
  if (!apiKey && !from) return null;
  if (!apiKey || !from) {
    throw new EmailConfigError(
      `Email is partly configured; missing ${apiKey ? "EMAIL_FROM" : "RESEND_API_KEY"}`,
    );
  }
  const address = senderAddress(from);
  if (!address || !isValidEmail(address)) {
    throw new EmailConfigError(
      'Email is misconfigured; EMAIL_FROM must be "you@domain" or "Name <you@domain>"',
    );
  }
  return { apiKey, from };
}

// The admin inbox for new-order notices, or null when none is set.
export function adminNotificationEmail(): string | null {
  return env("ADMIN_NOTIFICATION_EMAIL") ?? null;
}

// The site link and saved contact email for the branded layout. Callers ask
// only once an email will go out. getSiteContent() never throws, so a failed
// read leaves out the contact line instead of the email.
export async function emailBrand(): Promise<EmailBrand> {
  const content = await getSiteContent();
  return { siteUrl: siteUrl().href, contactEmail: content?.contactEmail ?? null };
}

export async function sendEmail(config: EmailConfig, message: EmailMessage): Promise<void> {
  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": message.idempotencyKey,
    },
    body: JSON.stringify({
      from: config.from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend answered ${response.status}`);
  }
}
