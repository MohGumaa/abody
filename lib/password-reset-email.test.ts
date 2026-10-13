import { describe, expect, it } from "vitest";
import type { EmailBrand } from "@/lib/email-layout";
import { ar } from "@/lib/i18n/dictionaries/ar";
import { en } from "@/lib/i18n/dictionaries/en";
import { passwordResetEmail } from "./password-reset-email";

const BRAND: EmailBrand = { siteUrl: "https://abody.test", contactEmail: null };
const URL_WITH_QUERY = "https://abody.test/en/reset-password?token=abc&x=<y>";

describe("passwordResetEmail", () => {
  it("builds the English email with the link in both versions", () => {
    const email = passwordResetEmail("en", URL_WITH_QUERY, BRAND);

    expect(email.subject).toBe(en.passwordResetEmail.subject);
    expect(email.html).toContain('<html lang="en" dir="ltr">');
    expect(email.html).toContain(
      'href="https://abody.test/en/reset-password?token=abc&amp;x=&lt;y&gt;"',
    );
    expect(email.html).not.toContain("<y>");
    expect(email.html).toContain(en.passwordResetEmail.expires);
    expect(email.text).toContain(`${en.passwordResetEmail.button}: ${URL_WITH_QUERY}`);
    expect(email.text).toContain(en.passwordResetEmail.ignore);
    expect(email.text.endsWith("https://abody.test")).toBe(true);
  });

  it("has the preheader, the reassurance box, and a paste-this-link fallback", () => {
    const email = passwordResetEmail("en", URL_WITH_QUERY, BRAND);
    const escaped = "https://abody.test/en/reset-password?token=abc&amp;x=&lt;y&gt;";

    expect(email.html).toContain(en.passwordResetEmail.preheader);
    expect(email.html).toContain(en.passwordResetEmail.didntAsk.replace("'", "&#39;"));
    expect(email.html).toContain(en.passwordResetEmail.pasteLink);
    expect(email.html).toContain(`dir="ltr">${escaped}</a>`);
    // The button and the fallback both carry the link.
    expect(email.html.split(`href="${escaped}"`)).toHaveLength(3);
    expect(email.html).not.toContain(en.emailLayout.questions);
  });

  it("builds the Arabic email right to left", () => {
    const email = passwordResetEmail("ar", "https://abody.test/ar/reset-password?token=abc", BRAND);

    expect(email.subject).toBe(ar.passwordResetEmail.subject);
    expect(email.html).toContain('<html lang="ar" dir="rtl">');
    expect(email.html).toContain(ar.passwordResetEmail.heading);
    expect(email.text).toContain(
      `${ar.passwordResetEmail.button}: https://abody.test/ar/reset-password?token=abc`,
    );
  });
});
