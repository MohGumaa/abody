import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { emailConfig, sendEmail } = vi.hoisted(() => ({
  emailConfig: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/email", () => ({ emailConfig, sendEmail }));

import { en } from "@/lib/i18n/dictionaries/en";
import {
  resetPasswordUrl,
  sendPasswordResetEmail,
} from "@/lib/password-reset-notifications";

const CONFIG = { apiKey: "re_secret_123", from: "Abody <hello@abody.test>" };
const TOKEN = "tok_ABC-123_secret";
const DELIVERY = {
  tokenId: "prt1",
  email: "layla@example.com",
  token: TOKEN,
  locale: "en" as const,
};

function logged(): string {
  return [
    ...vi.mocked(console.error).mock.calls,
    ...vi.mocked(console.info).mock.calls,
  ]
    .flat()
    .join(" ");
}

beforeEach(() => {
  vi.stubEnv("SITE_URL", "https://abody.test");
  emailConfig.mockReset().mockReturnValue(CONFIG);
  sendEmail.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("resetPasswordUrl", () => {
  it("points at the reset page in the request's language", () => {
    expect(resetPasswordUrl("ar", "a+b/c")).toBe(
      "https://abody.test/ar/reset-password?token=a%2Bb%2Fc",
    );
  });
});

describe("sendPasswordResetEmail", () => {
  it("sends the link to the account's address once per token", async () => {
    await sendPasswordResetEmail(DELIVERY);

    const [config, message] = sendEmail.mock.calls[0];
    expect(config).toBe(CONFIG);
    expect(message).toMatchObject({
      to: "layla@example.com",
      subject: en.passwordResetEmail.subject,
      idempotencyKey: "password-reset/prt1",
    });
    expect(message.text).toContain(`https://abody.test/en/reset-password?token=${TOKEN}`);
  });

  it("skips quietly when email is off", async () => {
    emailConfig.mockReturnValue(null);

    await expect(sendPasswordResetEmail(DELIVERY)).resolves.toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(logged()).toContain("password reset email skipped");
  });

  it("logs a failure without the address, token, or key", async () => {
    sendEmail.mockRejectedValue(new Error("Resend answered 500"));

    await expect(sendPasswordResetEmail(DELIVERY)).resolves.toBeUndefined();
    const log = logged();
    expect(log).toContain("Password reset prt1 email failed: Resend answered 500");
    expect(log).not.toContain("layla@example.com");
    expect(log).not.toContain(TOKEN);
    expect(log).not.toContain(CONFIG.apiKey);
  });

  it("does not throw on a partial email configuration", async () => {
    emailConfig.mockImplementation(() => {
      throw new Error("Email is partly configured; missing EMAIL_FROM");
    });

    await expect(sendPasswordResetEmail(DELIVERY)).resolves.toBeUndefined();
    expect(logged()).toContain("missing EMAIL_FROM");
  });
});
