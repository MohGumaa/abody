import { describe, expect, it } from "vitest";
import type { EmailBrand } from "@/lib/email-layout";
import { ar } from "@/lib/i18n/dictionaries/ar";
import { en } from "@/lib/i18n/dictionaries/en";
import { SERVICE_STATUSES } from "@/lib/service-work-rules";
import {
  adminServiceRequirementsEmail,
  customerServiceStatusEmail,
} from "@/lib/service-emails";

const URL = "https://abody.test/en/success?session_id=cs_test_1";
const ADMIN_URL = "https://abody.test/admin/service-orders/item_2";
const BRAND: EmailBrand = { siteUrl: "https://abody.test", contactEmail: "hello@abody.test" };
const escape = (text: string) => text.replaceAll("'", "&#39;");
// The current tracker step's label is bold brand blue.
const current = (label: string) => `color:#0061a2;font-weight:bold">${label}</div>`;

describe("customerServiceStatusEmail", () => {
  it.each(SERVICE_STATUSES)("tells an English customer the new status %s", (status) => {
    const email = customerServiceStatusEmail(
      { name: "Ads Management", orderNumber: 1001, status },
      "en",
      URL,
      BRAND,
    );

    expect(email.subject).toBe("Update on your Abody service: Ads Management");
    expect(email.html).toContain('<html lang="en" dir="ltr">');
    for (const part of [
      "<bdi>Ads Management</bdi>",
      '<span dir="ltr">#1001</span>',
      en.account.serviceStatus[status],
      `href="${URL}"`,
    ]) {
      expect(email.html).toContain(part);
    }
    expect(email.text).toContain("Here is the latest on Ads Management from order #1001.");
    expect(email.text).toContain(`New status: ${en.account.serviceStatus[status]}`);
    expect(email.text).toContain(en.account.service.messages[status]);
    expect(email.text).toContain(`View your order: ${URL}`);
    expect(email.text).toContain("hello@abody.test");
    // The status message is the inbox preview.
    expect(email.html).toContain(
      `opacity:0;color:transparent">${escape(en.account.service.messages[status])}`,
    );
  });

  it.each([
    ["NEW", "Details received"],
    ["IN_PROGRESS", "In progress"],
    ["COMPLETED", "Completed"],
  ] as const)("highlights the %s tracker step", (status, label) => {
    const email = customerServiceStatusEmail(
      { name: "Ads Management", orderNumber: 1001, status },
      "en",
      URL,
      BRAND,
    );

    expect(email.html).toContain(current(label));
    for (const other of ["Details received", "In progress", "Completed"]) {
      if (other !== label) expect(email.html).not.toContain(current(other));
    }
    expect(email.html).toContain(en.serviceEmail.heading);
    expect(email.html).toContain("View your order");
    expect(email.html).not.toContain("border-left:4px solid");
  });

  it("asks for details with an amber callout when waiting for information", () => {
    const email = customerServiceStatusEmail(
      { name: "Ads Management", orderNumber: 1001, status: "WAITING_FOR_INFORMATION" },
      "en",
      URL,
      BRAND,
    );

    expect(email.html).toContain(en.serviceEmail.waitingHeading);
    expect(email.html).toContain("border-left:4px solid #7a5200");
    expect(email.html).toContain('<td style="border-radius:10px;background:#7a5200">');
    expect(email.html).toContain(`>${en.onboarding.edit}</a>`);
    expect(email.html).not.toContain(current("Details received"));
  });

  it("shows a red callout when cancelled", () => {
    const email = customerServiceStatusEmail(
      { name: "Ads Management", orderNumber: 1001, status: "CANCELLED" },
      "en",
      URL,
      BRAND,
    );

    expect(email.html).toContain(en.serviceEmail.cancelledHeading);
    expect(email.html).toContain("border-left:4px solid #a8261d");
    expect(email.html).toContain("View your order");
    expect(email.html).not.toContain(current("In progress"));
  });

  it("writes an Arabic update right to left", () => {
    const arabicUrl = "https://abody.test/ar/success?session_id=cs_test_1";
    const email = customerServiceStatusEmail(
      { name: "إدارة الإعلانات", orderNumber: 1001, status: "WAITING_FOR_INFORMATION" },
      "ar",
      arabicUrl,
      BRAND,
    );

    expect(email.subject).toBe("تحديث على خدمتك من عبودي: إدارة الإعلانات");
    expect(email.html).toContain('<html lang="ar" dir="rtl">');
    expect(email.html).toContain("<bdi>إدارة الإعلانات</bdi>");
    expect(email.html).toContain(ar.account.serviceStatus.WAITING_FOR_INFORMATION);
    expect(email.html).toContain(ar.account.service.messages.WAITING_FOR_INFORMATION);
    expect(email.html).toContain(`href="${arabicUrl}"`);
    expect(email.text).toContain(`${ar.serviceEmail.status}: بانتظار معلومات إضافية`);
    expect(email.html).toContain(ar.serviceEmail.waitingHeading);
    // The callout's accent sits at the start side, the right in Arabic.
    expect(email.html).toContain("border-right:4px solid #7a5200");
  });

  it("escapes the service name in HTML", () => {
    const email = customerServiceStatusEmail(
      { name: "<script>alert(1)</script> & Co", orderNumber: 1001, status: "IN_PROGRESS" },
      "en",
      URL,
      BRAND,
    );

    expect(email.html).not.toContain("<script>alert(1)</script>");
    expect(email.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; Co");
  });

  it("keeps replacement patterns in a name literal", () => {
    const email = customerServiceStatusEmail(
      { name: "Ads $& More", orderNumber: 1001, status: "NEW" },
      "en",
      URL,
      BRAND,
    );

    expect(email.subject).toBe("Update on your Abody service: Ads $& More");
    expect(email.html).toContain("<bdi>Ads $&amp; More</bdi>");
    expect(email.text).toContain("Here is the latest on Ads $& More from order #1001.");
  });
});

describe("adminServiceRequirementsEmail", () => {
  const SERVICE = { name: "Ads Management", orderNumber: 1001, customer: "Sara" };

  it("announces new details with the service order link", () => {
    const email = adminServiceRequirementsEmail(SERVICE, "created", ADMIN_URL, BRAND);

    expect(email.subject).toBe("New service details: Ads Management (order #1001)");
    expect(email.html).toContain('<html lang="en" dir="ltr">');
    expect(email.html).toContain("The customer sent their details");
    expect(email.html).toContain("Sara");
    expect(email.html).toContain("Admin notice");
    expect(email.html).toContain("background:#0e1e2f");
    expect(email.html).toContain(`href="${ADMIN_URL}"`);
    expect(email.text).toContain(`Open the service order: ${ADMIN_URL}`);
  });

  it("announces updated details", () => {
    const email = adminServiceRequirementsEmail(SERVICE, "updated", ADMIN_URL, BRAND);

    expect(email.subject).toBe("Service details updated: Ads Management (order #1001)");
    expect(email.text).toContain("The customer updated their details");
  });

  it("escapes the service name and customer in HTML", () => {
    const email = adminServiceRequirementsEmail(
      { name: "<script>x</script>", orderNumber: 1001, customer: "A & B" },
      "created",
      ADMIN_URL,
      BRAND,
    );

    expect(email.html).not.toContain("<script>x</script>");
    expect(email.html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(email.html).toContain("A &amp; B");
    expect(email.html).not.toContain("A & B");
  });
});
