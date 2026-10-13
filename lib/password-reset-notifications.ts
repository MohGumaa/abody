import { emailBrand, emailConfig, sendEmail } from "@/lib/email";
import { localizedPath, type Locale } from "@/lib/i18n/config";
import { passwordResetEmail } from "@/lib/password-reset-email";
import { absoluteUrl } from "@/lib/seo";

// Server code only. The forgot-password email (feature 28), scheduled with
// after() by the request action. Best effort: this never throws, and a failure
// is logged with the token row id only, never the address, token, or link.

export interface PasswordResetDelivery {
  tokenId: string;
  email: string;
  token: string;
  locale: Locale;
}

export function resetPasswordUrl(locale: Locale, token: string): string {
  return `${absoluteUrl(localizedPath(locale, "/reset-password"))}?token=${encodeURIComponent(token)}`;
}

export async function sendPasswordResetEmail({
  tokenId,
  email,
  token,
  locale,
}: PasswordResetDelivery): Promise<void> {
  const label = `Password reset ${tokenId}`;
  try {
    const config = emailConfig();
    if (!config) {
      console.info("Email is off; password reset email skipped");
      return;
    }
    await sendEmail(config, {
      to: email,
      ...passwordResetEmail(locale, resetPasswordUrl(locale, token), await emailBrand()),
      idempotencyKey: `password-reset/${tokenId}`,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    console.error(`${label} email failed: ${reason}`);
  }
}
