import { describe, expect, it } from "vitest";
import { ar } from "@/lib/i18n/dictionaries/ar";
import { en } from "@/lib/i18n/dictionaries/en";
import { SERVICE_STATUSES } from "@/lib/service-work-rules";
import {
  adminServiceRequirementsEmail,
  customerServiceStatusEmail,
} from "@/lib/service-emails";

const URL = "https://abody.test/en/success?session_id=cs_test_1";
const ADMIN_URL = "https://abody.test/admin/service-orders/item_2";

describe("customerServiceStatusEmail", () => {
  it.each(SERVICE_STATUSES)("tells an English customer the new status %s", (status) => {
    const email = customerServiceStatusEmail(
      { name: "Ads Management", orderNumber: 1001, status },
      "en",
      URL,
    );

    expect(email.subject).toBe("Update on your Abody service: Ads Management");
    expect(email.html).toContain('<html lang="en" dir="ltr">');
    for (const part of [
      "<bdi>Ads Management</bdi>",
      '<span dir="ltr">#1001</span>',
      en.account.serviceStatus[status],
      `href="${URL}"`,
      "View your order",
    ]) {
      expect(email.html).toContain(part);
    }
    expect(email.text).toContain("Here is the latest on Ads Management from order #1001.");
    expect(email.text).toContain(`New status: ${en.account.serviceStatus[status]}`);
    expect(email.text).toContain(en.account.service.messages[status]);
    expect(email.text).toContain(`View your order: ${URL}`);
  });

  it("writes an Arabic update right to left", () => {
    const arabicUrl = "https://abody.test/ar/success?session_id=cs_test_1";
    const email = customerServiceStatusEmail(
      { name: "إدارة الإعلانات", orderNumber: 1001, status: "WAITING_FOR_INFORMATION" },
      "ar",
      arabicUrl,
    );

    expect(email.subject).toBe("تحديث على خدمتك من عبودي: إدارة الإعلانات");
    expect(email.html).toContain('<html lang="ar" dir="rtl">');
    expect(email.html).toContain("<bdi>إدارة الإعلانات</bdi>");
    expect(email.html).toContain(ar.account.serviceStatus.WAITING_FOR_INFORMATION);
    expect(email.html).toContain(ar.account.service.messages.WAITING_FOR_INFORMATION);
    expect(email.html).toContain(`href="${arabicUrl}"`);
    expect(email.text).toContain(`${ar.serviceEmail.status}: بانتظار معلومات إضافية`);
  });

  it("escapes the service name in HTML", () => {
    const email = customerServiceStatusEmail(
      { name: "<script>alert(1)</script> & Co", orderNumber: 1001, status: "IN_PROGRESS" },
      "en",
      URL,
    );

    expect(email.html).not.toContain("<script>alert(1)</script>");
    expect(email.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; Co");
  });

  it("keeps replacement patterns in a name literal", () => {
    const email = customerServiceStatusEmail(
      { name: "Ads $& More", orderNumber: 1001, status: "NEW" },
      "en",
      URL,
    );

    expect(email.subject).toBe("Update on your Abody service: Ads $& More");
    expect(email.html).toContain("<bdi>Ads $&amp; More</bdi>");
    expect(email.text).toContain("Here is the latest on Ads $& More from order #1001.");
  });
});

describe("adminServiceRequirementsEmail", () => {
  const SERVICE = { name: "Ads Management", orderNumber: 1001, customer: "Sara" };

  it("announces new details with the service order link", () => {
    const email = adminServiceRequirementsEmail(SERVICE, "created", ADMIN_URL);

    expect(email.subject).toBe("New service details: Ads Management (order #1001)");
    expect(email.html).toContain('<html lang="en" dir="ltr">');
    expect(email.html).toContain("The customer sent their details");
    expect(email.html).toContain("Customer: Sara");
    expect(email.html).toContain(`href="${ADMIN_URL}"`);
    expect(email.text).toContain(`Open the service order: ${ADMIN_URL}`);
  });

  it("announces updated details", () => {
    const email = adminServiceRequirementsEmail(SERVICE, "updated", ADMIN_URL);

    expect(email.subject).toBe("Service details updated: Ads Management (order #1001)");
    expect(email.text).toContain("The customer updated their details");
  });

  it("escapes the service name and customer in HTML", () => {
    const email = adminServiceRequirementsEmail(
      { name: "<script>x</script>", orderNumber: 1001, customer: "A & B" },
      "created",
      ADMIN_URL,
    );

    expect(email.html).not.toContain("<script>x</script>");
    expect(email.html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(email.html).toContain("Customer: A &amp; B");
  });
});
