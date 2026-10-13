import { describe, expect, it } from "vitest";
import {
  button,
  escapeHtml,
  page,
  textFooter,
  type EmailBrand,
  type PageOptions,
} from "@/lib/email-layout";
import { ar } from "@/lib/i18n/dictionaries/ar";
import { en } from "@/lib/i18n/dictionaries/en";

const BRAND: EmailBrand = { siteUrl: "https://abody.test/", contactEmail: "hello@abody.test" };

function build(overrides: Partial<PageOptions> = {}): string {
  return page({
    locale: "en",
    brand: BRAND,
    title: "Subject",
    preheader: "Preview text",
    icon: "&#10003;",
    heading: "Heading",
    footerNote: "Why you got this.",
    body: "<p>Body</p>",
    ...overrides,
  });
}

describe("page", () => {
  it("loads the logo from the absolute site URL", () => {
    const html = build();
    expect(html).toContain('src="https://abody.test/Logo-0.jpg"');
    expect(html).toContain('alt="Abody"');
    expect(html).toContain('href="https://abody.test/en"');
  });

  it("keeps a base path in the site URL", () => {
    const html = build({ brand: { ...BRAND, siteUrl: "https://abody.test/shop" } });
    expect(html).toContain('src="https://abody.test/shop/Logo-0.jpg"');
    expect(html).toContain('href="https://abody.test/shop/en/products"');
  });

  it("hides the escaped preheader for the inbox preview", () => {
    const html = build({ preheader: "Order <#1001> & more" });
    expect(html).toContain(
      '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">Order &lt;#1001&gt; &amp; more',
    );
  });

  it("shows the escaped contact email in the customer footer", () => {
    const html = build({ brand: { ...BRAND, contactEmail: 'a&b"@abody.test' } });
    expect(html).toContain(en.emailLayout.questions);
    expect(html).toContain('href="mailto:a&amp;b&quot;@abody.test"');
    expect(html).not.toContain('a&b"@abody.test');
  });

  it("leaves out the questions line when no contact email is saved", () => {
    const html = build({ brand: { ...BRAND, contactEmail: null } });
    expect(html).not.toContain(en.emailLayout.questions);
    expect(html).not.toContain("mailto:");
  });

  it("has the trust lines, store links, note, and copyright in the customer footer", () => {
    const html = build();
    for (const part of [
      en.header.trust.download,
      en.header.trust.payment,
      en.header.trust.tracking,
      'href="https://abody.test/en/products"',
      'href="https://abody.test/en/services"',
      'href="https://abody.test/en/contact"',
      "Why you got this.",
      "All rights reserved.",
    ]) {
      expect(html).toContain(part);
    }
  });

  it("writes Arabic right to left with start and end sides flipped", () => {
    const html = build({ locale: "ar", meta: "meta" });
    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain('class="wrap" dir="rtl"');
    expect(html).toContain('alt="عبودي"');
    expect(html).toContain('class="logo" style="text-align:right"');
    expect(html).toContain('class="meta" style="text-align:left;');
    expect(html).toContain('href="https://abody.test/ar/products"');
    expect(html).toContain(ar.header.trust.download);
  });

  it("puts the meta at the end side in English", () => {
    const html = build({ meta: "meta" });
    expect(html).toContain('class="logo" style="text-align:left"');
    expect(html).toContain('class="meta" style="text-align:right;');
  });

  it("escapes the heading, eyebrow, title, and note", () => {
    const html = build({
      heading: "<h>",
      eyebrow: "<e>",
      title: "<t>",
      footerNote: "<n>",
    });
    for (const tag of ["<h>", "<e>", "<t>", "<n>"]) {
      expect(html).not.toContain(tag);
      expect(html).toContain(escapeHtml(tag));
    }
  });

  it("gives admin emails an ink hero and a one-line footer", () => {
    const html = build({ admin: true, eyebrow: "Admin notice" });
    expect(html).toContain("background:#0e1e2f;color:#ffffff");
    expect(html).toContain("Admin notice");
    expect(html).toContain('href="https://abody.test/admin"');
    expect(html).not.toContain(en.header.trust.download);
    expect(html).not.toContain(en.emailLayout.questions);
  });

  it("is a light-only layout that stacks on phones", () => {
    const html = build();
    expect(html).toContain('<meta name="color-scheme" content="light">');
    expect(html).toContain("@media (max-width:480px)");
  });
});

describe("button", () => {
  it("puts the color on the table cell and escapes the link", () => {
    const html = button("https://abody.test/?a=1&b=<2>", "Go", "#0e1e2f");
    expect(html).toContain('<td style="border-radius:10px;background:#0e1e2f">');
    expect(html).toContain('href="https://abody.test/?a=1&amp;b=&lt;2&gt;"');
  });
});

describe("textFooter", () => {
  it("ends with the contact email when set, then the site", () => {
    expect(textFooter(BRAND)).toEqual(["", "hello@abody.test", "https://abody.test"]);
    expect(textFooter({ ...BRAND, contactEmail: null })).toEqual(["", "https://abody.test"]);
  });
});

describe("escapeHtml", () => {
  it("escapes the five HTML characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
