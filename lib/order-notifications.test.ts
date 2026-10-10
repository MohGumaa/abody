import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { order, emailConfig, adminNotificationEmail, sendEmail } = vi.hoisted(() => ({
  order: { findUnique: vi.fn() },
  emailConfig: vi.fn(),
  adminNotificationEmail: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { order } }));
vi.mock("@/lib/email", () => ({ emailConfig, adminNotificationEmail, sendEmail }));

import { sendOrderPaidEmails, sessionLocale } from "@/lib/order-notifications";

const CONFIG = { apiKey: "re_secret_123", from: "Abody <orders@abody.test>" };
const SESSION = { id: "cs_test_1", metadata: { locale: "ar" } };

const ORDER = {
  number: 1001,
  totalCents: 33700,
  customerEmail: "buyer@example.com",
  items: [
    {
      id: "item_1",
      quantity: 2,
      priceCents: 1900,
      product: { name: "Facebook Ads Guide", nameAr: "دليل إعلانات فيسبوك", type: "DIGITAL_PRODUCT" },
    },
    {
      id: "item_2",
      quantity: 1,
      priceCents: 29900,
      product: { name: "Ads Management", nameAr: null, type: "SERVICE" },
    },
  ],
};

function logged(): string {
  return [
    ...vi.mocked(console.error).mock.calls,
    ...vi.mocked(console.info).mock.calls,
  ]
    .flat()
    .join(" ");
}

function sent(kind: "customer" | "admin") {
  return sendEmail.mock.calls.find(
    ([, message]) => message.idempotencyKey === `order-paid-${kind}/o1`,
  )?.[1];
}

beforeEach(() => {
  vi.stubEnv("SITE_URL", "https://abody.test");
  order.findUnique.mockReset().mockResolvedValue(ORDER);
  emailConfig.mockReset().mockReturnValue(CONFIG);
  adminNotificationEmail.mockReset().mockReturnValue("team@abody.test");
  sendEmail.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sessionLocale", () => {
  it.each([
    [{ locale: "ar" }, "ar"],
    [{ locale: "en" }, "en"],
    [{ locale: "fr" }, "en"],
    [{}, "en"],
    [null, "en"],
  ])("maps metadata %j to %s", (metadata, locale) => {
    expect(sessionLocale({ metadata })).toBe(locale);
  });
});

describe("sendOrderPaidEmails", () => {
  it("sends the customer email in the checkout language and the admin email", async () => {
    await sendOrderPaidEmails("o1", SESSION);

    expect(sendEmail).toHaveBeenCalledTimes(2);
    const customer = sent("customer");
    expect(sendEmail.mock.calls[0][0]).toBe(CONFIG);
    expect(customer.to).toBe("buyer@example.com");
    expect(customer.subject).toBe("تم تأكيد طلبك #1001 من عبودي");
    expect(customer.html).toContain("دليل إعلانات فيسبوك");
    // A blank Arabic name falls back to English.
    expect(customer.html).toContain("Ads Management");
    expect(customer.text).toContain(
      "https://abody.test/ar/success?session_id=cs_test_1",
    );

    const admin = sent("admin");
    expect(admin.to).toBe("team@abody.test");
    expect(admin.subject).toBe("New order #1001 - $337.00 (includes a service)");
    expect(admin.html).toContain("Facebook Ads Guide");
    expect(admin.text).toContain("https://abody.test/admin/orders/o1");
    expect(admin.text).toContain("https://abody.test/admin/service-orders/item_2");
  });

  it("writes English when the session has no valid language", async () => {
    await sendOrderPaidEmails("o1", { id: "cs_test_1", metadata: {} });

    const customer = sent("customer");
    expect(customer.subject).toBe("Your Abody order #1001 is confirmed");
    expect(customer.text).toContain("https://abody.test/en/success?session_id=cs_test_1");
  });

  it("skips the customer email when the order has no address", async () => {
    order.findUnique.mockResolvedValue({ ...ORDER, customerEmail: null });

    await sendOrderPaidEmails("o1", SESSION);

    expect(sent("customer")).toBeUndefined();
    expect(sent("admin")).toBeDefined();
  });

  it("skips the admin email when no admin inbox is set", async () => {
    adminNotificationEmail.mockReturnValue(null);

    await sendOrderPaidEmails("o1", SESSION);

    expect(sent("customer")).toBeDefined();
    expect(sent("admin")).toBeUndefined();
  });

  it("sends nothing when email is off", async () => {
    emailConfig.mockReturnValue(null);

    await sendOrderPaidEmails("o1", SESSION);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(logged()).toContain("#1001");
  });

  it("logs a partial configuration without sending", async () => {
    emailConfig.mockImplementation(() => {
      throw new Error("Email is partly configured; missing EMAIL_FROM");
    });

    await expect(sendOrderPaidEmails("o1", SESSION)).resolves.toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(logged()).toContain("missing EMAIL_FROM");
  });

  it("still sends the admin email when the customer one fails, logging no address", async () => {
    sendEmail.mockImplementation(async (_config, message) => {
      if (message.idempotencyKey.startsWith("order-paid-customer")) {
        throw new Error("Resend answered 422");
      }
    });

    await sendOrderPaidEmails("o1", SESSION);

    expect(sendEmail).toHaveBeenCalledTimes(2);
    const text = logged();
    expect(text).toContain("#1001 customer email failed: Resend answered 422");
    expect(text).not.toContain("buyer@example.com");
    expect(text).not.toContain("team@abody.test");
    expect(text).not.toContain("cs_test_1");
  });

  it("logs and returns when the order is missing or the lookup fails", async () => {
    order.findUnique.mockResolvedValue(null);
    await expect(sendOrderPaidEmails("o1", SESSION)).resolves.toBeUndefined();

    order.findUnique.mockRejectedValue(new Error("db down"));
    await expect(sendOrderPaidEmails("o1", SESSION)).resolves.toBeUndefined();

    expect(sendEmail).not.toHaveBeenCalled();
    expect(logged()).toContain("o1");
  });
});
