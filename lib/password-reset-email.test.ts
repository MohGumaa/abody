import { describe, expect, it } from "vitest";
import { ar } from "@/lib/i18n/dictionaries/ar";
import { en } from "@/lib/i18n/dictionaries/en";
import { passwordResetEmail } from "./password-reset-email";

const URL_WITH_QUERY = "https://abody.test/en/reset-password?token=abc&x=<y>";

describe("passwordResetEmail", () => {
  it("builds the English email with the link in both versions", () => {
    const email = passwordResetEmail("en", URL_WITH_QUERY);

    expect(email.subject).toBe(en.passwordResetEmail.subject);
    expect(email.html).toContain('<html lang="en" dir="ltr">');
    expect(email.html).toContain(
      'href="https://abody.test/en/reset-password?token=abc&amp;x=&lt;y&gt;"',
    );
    expect(email.html).not.toContain("<y>");
    expect(email.html).toContain(en.passwordResetEmail.expires);
    expect(email.text).toContain(`${en.passwordResetEmail.button}: ${URL_WITH_QUERY}`);
    expect(email.text).toContain(en.passwordResetEmail.ignore);
  });

  it("builds the Arabic email right to left", () => {
    const email = passwordResetEmail("ar", "https://abody.test/ar/reset-password?token=abc");

    expect(email.subject).toBe(ar.passwordResetEmail.subject);
    expect(email.html).toContain('<html lang="ar" dir="rtl">');
    expect(email.html).toContain(ar.passwordResetEmail.heading);
    expect(email.text).toContain(
      `${ar.passwordResetEmail.button}: https://abody.test/ar/reset-password?token=abc`,
    );
  });
});
