import { describe, expect, it } from "vitest";
import type { EmailBrand } from "@/lib/email-layout";
import {
  adminOrderEmail,
  customerOrderEmail,
  type EmailOrder,
  type EmailOrderLine,
} from "@/lib/order-emails";

const GUIDE: EmailOrderLine = {
  id: "item_1",
  name: "Facebook Ads Guide",
  type: "DIGITAL_PRODUCT",
  quantity: 2,
  priceCents: 1900,
};
const ADS: EmailOrderLine = {
  id: "item_2",
  name: "Ads Management",
  type: "SERVICE",
  quantity: 1,
  priceCents: 29900,
};
const URL = "https://abody.test/en/success?session_id=cs_test_1";
const BRAND: EmailBrand = { siteUrl: "https://abody.test", contactEmail: "hello@abody.test" };

function order(lines: EmailOrderLine[]): EmailOrder {
  return {
    number: 1001,
    totalCents: lines.reduce((sum, line) => sum + line.priceCents * line.quantity, 0),
    customerEmail: "buyer@example.com",
    createdAt: new Date("2026-10-13T14:32:00.000Z"),
    lines,
  };
}

describe("customerOrderEmail", () => {
  it("summarises an English order with its link", () => {
    const email = customerOrderEmail(order([GUIDE, ADS]), "en", URL, BRAND);

    expect(email.subject).toBe("Your Abody order #1001 is confirmed");
    expect(email.html).toContain('<html lang="en" dir="ltr">');
    for (const part of [
      "Facebook Ads Guide",
      "Ads Management",
      "$38.00",
      "$299.00",
      "$337.00",
      "Payment received",
      `href="${URL}"`,
      "View your order",
    ]) {
      expect(email.html).toContain(part);
    }
    expect(email.text).toContain("Facebook Ads Guide (Qty: 2) - $38.00");
    expect(email.text).toContain("Total paid: $337.00");
    expect(email.text).toContain(`View your order: ${URL}`);
    expect(email.html).toContain('src="https://abody.test/Logo-0.jpg"');
    expect(email.html).toContain("Payment received for order #1001.");
    expect(email.html).toContain("Oct 13, 2026");
    expect(email.html).toContain("Digital product");
    expect(email.html).toContain("What happens next");
    expect(email.text.endsWith("hello@abody.test\nhttps://abody.test")).toBe(true);
  });

  it("writes an Arabic order right to left", () => {
    const arabicUrl = "https://abody.test/ar/success?session_id=cs_test_1";
    const email = customerOrderEmail(
      order([{ ...GUIDE, name: "دليل إعلانات فيسبوك" }]),
      "ar",
      arabicUrl,
      BRAND,
    );

    expect(email.subject).toBe("تم تأكيد طلبك #1001 من عبودي");
    expect(email.html).toContain('<html lang="ar" dir="rtl">');
    expect(email.html).toContain("دليل إعلانات فيسبوك");
    expect(email.html).toContain('<span dir="ltr">#1001</span>');
    expect(email.html).toContain('<span dir="ltr">$38.00</span>');
    expect(email.html).toContain("عرض طلبك");
    expect(email.text).toContain(`عرض طلبك: ${arabicUrl}`);
    expect(email.html).toContain("منتج رقمي");
    expect(email.html).toContain("ماذا بعد");
    // Prices sit at the end side, which is the left in Arabic.
    expect(email.html).toContain("text-align:left;white-space:nowrap");
  });

  it("shows the downloads section only for digital products", () => {
    const digital = customerOrderEmail(order([GUIDE]), "en", URL, BRAND);
    expect(digital.html).toContain("Your files are ready");
    expect(digital.html).not.toContain("tell us about your business");

    const service = customerOrderEmail(order([ADS]), "en", URL, BRAND);
    expect(service.html).not.toContain("Your files are ready");
    expect(service.html).toContain("Next step: tell us about your business");
    expect(service.text).toContain("Next step: tell us about your business");
    expect(service.html).toContain("Service");
  });

  it("escapes product names in the HTML", () => {
    const email = customerOrderEmail(
      order([{ ...GUIDE, name: 'Ads & <script>alert("x")</script>' }]),
      "en",
      URL,
      BRAND,
    );
    expect(email.html).toContain("Ads &amp; &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(email.html).not.toContain("<script>");
  });
});

describe("adminOrderEmail", () => {
  const adminUrl = "https://abody.test/admin/orders/o1";
  const serviceUrl = (id: string) => `https://abody.test/admin/service-orders/${id}`;

  it("flags a service purchase and links each service order", () => {
    const email = adminOrderEmail(order([GUIDE, ADS]), adminUrl, serviceUrl, BRAND);

    expect(email.subject).toBe("New order #1001 - $337.00 (includes a service)");
    expect(email.html).toContain("buyer@example.com");
    expect(email.html).toContain("Facebook Ads Guide");
    expect(email.html).toContain("Includes a service");
    expect(email.html).toContain("Admin notice");
    expect(email.html).toContain("background:#0e1e2f");
    expect(email.html).toContain(`href="${serviceUrl("item_2")}"`);
    expect(email.html).not.toContain(serviceUrl("item_1"));
    expect(email.html).toContain(`href="${adminUrl}"`);
    expect(email.text).toContain(`- Ads Management - Service x 1 - $299.00 - ${serviceUrl("item_2")}`);
  });

  it("has a plain subject without services and handles a missing email", () => {
    const email = adminOrderEmail(
      { ...order([GUIDE]), customerEmail: null },
      adminUrl,
      serviceUrl,
      BRAND,
    );
    expect(email.subject).toBe("New order #1001 - $38.00");
    expect(email.html).not.toContain("Includes a service");
    expect(email.html).toContain("No email on the order");
    expect(email.text).toContain("Customer: No email on the order");
  });

  it("escapes product names", () => {
    const email = adminOrderEmail(order([{ ...GUIDE, name: "<b>x</b>" }]), adminUrl, serviceUrl, BRAND);
    expect(email.html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
