import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { service, orderItem, emailConfig, emailBrand, adminNotificationEmail, sendEmail, retrieve } =
  vi.hoisted(() => ({
    service: { findUnique: vi.fn() },
    orderItem: { findUnique: vi.fn() },
    emailConfig: vi.fn(),
    emailBrand: vi.fn(),
    adminNotificationEmail: vi.fn(),
    sendEmail: vi.fn(),
    retrieve: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({ db: { service, orderItem } }));
vi.mock("@/lib/email", () => ({ emailConfig, emailBrand, adminNotificationEmail, sendEmail }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { retrieve } } }),
}));
vi.mock("@/lib/session", () => ({ getCurrentUser: vi.fn() }));

import {
  sendServiceRequirementsEmail,
  sendServiceStatusEmail,
} from "@/lib/service-notifications";

const CONFIG = { apiKey: "re_secret_123", from: "Abody <orders@abody.test>" };
const BRAND = { siteUrl: "https://abody.test/", contactEmail: "hello@abody.test" };
const CHANGED_AT = new Date("2026-10-10T12:00:00.000Z");

const SERVICE = {
  status: "IN_PROGRESS",
  orderItem: {
    product: { name: "Ads Management", nameAr: "إدارة الإعلانات" },
    order: {
      number: 1001,
      customerEmail: "buyer@example.com",
      stripeCheckoutSessionId: "cs_test_1",
    },
  },
};

const ITEM = {
  product: { name: "Ads Management" },
  order: { number: 1001, customerEmail: "buyer@example.com", user: { name: "Sara" } },
};

function logged(): string {
  return [
    ...vi.mocked(console.error).mock.calls,
    ...vi.mocked(console.info).mock.calls,
  ]
    .flat()
    .join(" ");
}

function message() {
  return sendEmail.mock.calls[0]?.[1];
}

beforeEach(() => {
  vi.stubEnv("SITE_URL", "https://abody.test");
  service.findUnique.mockReset().mockResolvedValue(SERVICE);
  orderItem.findUnique.mockReset().mockResolvedValue(ITEM);
  emailConfig.mockReset().mockReturnValue(CONFIG);
  emailBrand.mockReset().mockResolvedValue(BRAND);
  adminNotificationEmail.mockReset().mockReturnValue("team@abody.test");
  sendEmail.mockReset().mockResolvedValue(undefined);
  retrieve.mockReset().mockResolvedValue({ id: "cs_test_1", metadata: { locale: "ar" } });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sendServiceStatusEmail", () => {
  it("emails the customer in the checkout language", async () => {
    await sendServiceStatusEmail("svc_1", CHANGED_AT);

    expect(retrieve).toHaveBeenCalledWith("cs_test_1");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toBe(CONFIG);
    const sent = message();
    expect(sent.to).toBe("buyer@example.com");
    expect(sent.idempotencyKey).toBe("service-status/svc_1/2026-10-10T12:00:00.000Z");
    expect(sent.subject).toContain("إدارة الإعلانات");
    expect(sent.html).toContain('<html lang="ar" dir="rtl">');
    expect(sent.html).toContain("قيد التنفيذ");
    expect(sent.text).toContain("https://abody.test/ar/success?session_id=cs_test_1");
  });

  it.each([
    ["missing", { id: "cs_test_1", metadata: {} }],
    ["invalid", { id: "cs_test_1", metadata: { locale: "fr" } }],
  ])("falls back to English when the language is %s", async (_case, session) => {
    retrieve.mockResolvedValue(session);
    await sendServiceStatusEmail("svc_1", CHANGED_AT);

    expect(message().subject).toBe("Update on your Abody service: Ads Management");
    expect(message().text).toContain("https://abody.test/en/success?session_id=cs_test_1");
  });

  it("falls back to English when the Stripe lookup fails", async () => {
    retrieve.mockRejectedValue(new Error("No such checkout.session: cs_test_1"));
    await sendServiceStatusEmail("svc_1", CHANGED_AT);

    expect(message().html).toContain('<html lang="en" dir="ltr">');
    expect(logged()).toContain("svc_1");
    expect(logged()).not.toContain("cs_test_1");
  });

  it("skips an order with no customer email", async () => {
    service.findUnique.mockResolvedValue({
      ...SERVICE,
      orderItem: { ...SERVICE.orderItem, order: { ...SERVICE.orderItem.order, customerEmail: null } },
    });
    await sendServiceStatusEmail("svc_1", CHANGED_AT);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(retrieve).not.toHaveBeenCalled();
    expect(emailBrand).not.toHaveBeenCalled();
    expect(logged()).toContain("svc_1");
  });

  it("sends nothing when email is off", async () => {
    emailConfig.mockReturnValue(null);
    await sendServiceStatusEmail("svc_1", CHANGED_AT);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(retrieve).not.toHaveBeenCalled();
    expect(emailBrand).not.toHaveBeenCalled();
  });

  it("logs a missing service", async () => {
    service.findUnique.mockResolvedValue(null);
    await sendServiceStatusEmail("svc_1", CHANGED_AT);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(logged()).toContain("svc_1");
  });

  it("never throws, and logs a failure without addresses or content", async () => {
    sendEmail.mockRejectedValue(new Error("Resend answered 500"));
    await expect(sendServiceStatusEmail("svc_1", CHANGED_AT)).resolves.toBeUndefined();

    const log = logged();
    expect(log).toContain("svc_1");
    expect(log).toContain("Resend answered 500");
    for (const secret of ["buyer@example.com", "cs_test_1", "Ads Management", "re_secret_123"]) {
      expect(log).not.toContain(secret);
    }
  });

  it("never throws on a partial email configuration", async () => {
    emailConfig.mockImplementation(() => {
      throw new Error("Email is partly configured; missing EMAIL_FROM");
    });
    await expect(sendServiceStatusEmail("svc_1", CHANGED_AT)).resolves.toBeUndefined();
    expect(logged()).toContain("missing EMAIL_FROM");
  });
});

describe("sendServiceRequirementsEmail", () => {
  it.each([
    ["created", "New service details: Ads Management (order #1001)"],
    ["updated", "Service details updated: Ads Management (order #1001)"],
  ] as const)("emails the admin about %s details", async (kind, subject) => {
    await sendServiceRequirementsEmail("item_2", kind);

    const sent = message();
    expect(sent.to).toBe("team@abody.test");
    expect(sent.subject).toBe(subject);
    expect(sent.idempotencyKey).toMatch(/^service-requirements\/item_2\/\d{4}-\d\d-\d\dT/);
    expect(sent.html).toContain("Sara");
    expect(sent.html).toContain('src="https://abody.test/Logo-0.jpg"');
    expect(sent.text).toContain("https://abody.test/admin/service-orders/item_2");
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("labels a guest order by its email", async () => {
    orderItem.findUnique.mockResolvedValue({ ...ITEM, order: { ...ITEM.order, user: null } });
    await sendServiceRequirementsEmail("item_2", "created");

    expect(message().text).toContain("Customer: buyer@example.com");
  });

  it("skips the email when no admin address is set", async () => {
    adminNotificationEmail.mockReturnValue(null);
    await sendServiceRequirementsEmail("item_2", "created");

    expect(sendEmail).not.toHaveBeenCalled();
    expect(emailBrand).not.toHaveBeenCalled();
    expect(logged()).toContain("item_2");
  });

  it("sends nothing when email is off", async () => {
    emailConfig.mockReturnValue(null);
    await sendServiceRequirementsEmail("item_2", "created");

    expect(sendEmail).not.toHaveBeenCalled();
    expect(emailBrand).not.toHaveBeenCalled();
  });

  it("never throws, and logs a failure without addresses", async () => {
    sendEmail.mockRejectedValue(new Error("Resend answered 422"));
    await expect(sendServiceRequirementsEmail("item_2", "updated")).resolves.toBeUndefined();

    const log = logged();
    expect(log).toContain("item_2");
    expect(log).not.toContain("team@abody.test");
    expect(log).not.toContain("buyer@example.com");
  });
});
