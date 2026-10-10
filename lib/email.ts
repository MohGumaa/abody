// Server code only: transactional email through Resend's HTTPS API (feature
// 19a). Without RESEND_API_KEY and EMAIL_FROM, email is off, as in local
// development. Never log the key, an address, or email content.

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

// null when email is off. Only one of the two set throws, naming the missing one.
export function emailConfig(): EmailConfig | null {
  const apiKey = env("RESEND_API_KEY");
  const from = env("EMAIL_FROM");
  if (!apiKey && !from) return null;
  if (!apiKey || !from) {
    throw new EmailConfigError(
      `Email is partly configured; missing ${apiKey ? "EMAIL_FROM" : "RESEND_API_KEY"}`,
    );
  }
  return { apiKey, from };
}

// The admin inbox for new-order notices, or null when none is set.
export function adminNotificationEmail(): string | null {
  return env("ADMIN_NOTIFICATION_EMAIL") ?? null;
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
