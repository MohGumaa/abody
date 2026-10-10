import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  adminNotificationEmail,
  EmailConfigError,
  emailConfig,
  sendEmail,
} from "@/lib/email";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function setEnv(values: { key?: string; from?: string; admin?: string }) {
  vi.stubEnv("RESEND_API_KEY", values.key ?? "");
  vi.stubEnv("EMAIL_FROM", values.from ?? "");
  vi.stubEnv("ADMIN_NOTIFICATION_EMAIL", values.admin ?? "");
}

describe("emailConfig", () => {
  it("is off when neither variable is set", () => {
    setEnv({});
    expect(emailConfig()).toBeNull();
  });

  it("reads both variables", () => {
    setEnv({ key: "re_secret_123", from: "Abody <orders@abody.test>" });
    expect(emailConfig()).toEqual({
      apiKey: "re_secret_123",
      from: "Abody <orders@abody.test>",
    });
  });

  it.each([
    ["EMAIL_FROM", { key: "re_secret_123" }],
    ["RESEND_API_KEY", { from: "Abody <orders@abody.test>" }],
  ])("throws naming %s when only one is set", (missing, values) => {
    setEnv(values);
    let error: unknown;
    try {
      emailConfig();
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(EmailConfigError);
    const message = (error as Error).message;
    expect(message).toContain(missing);
    expect(message).not.toContain("re_secret_123");
    expect(message).not.toContain("orders@abody.test");
  });
});

describe("adminNotificationEmail", () => {
  it("is the configured address, or null", () => {
    setEnv({ admin: " team@abody.test " });
    expect(adminNotificationEmail()).toBe("team@abody.test");
    setEnv({});
    expect(adminNotificationEmail()).toBeNull();
  });
});

describe("sendEmail", () => {
  const config = { apiKey: "re_secret_123", from: "Abody <orders@abody.test>" };
  const message = {
    to: "buyer@example.com",
    subject: "Order #1001",
    html: "<p>Hi</p>",
    text: "Hi",
    idempotencyKey: "order-paid-customer/o1",
  };

  it("posts the message to Resend", async () => {
    await sendEmail(config, message);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      Authorization: "Bearer re_secret_123",
      "Content-Type": "application/json",
      "Idempotency-Key": "order-paid-customer/o1",
    });
    expect(JSON.parse(init.body)).toEqual({
      from: "Abody <orders@abody.test>",
      to: ["buyer@example.com"],
      subject: "Order #1001",
      html: "<p>Hi</p>",
      text: "Hi",
    });
  });

  it("throws with only the status when Resend refuses", async () => {
    fetchMock.mockResolvedValue(
      new Response('{"message":"invalid from buyer@example.com"}', { status: 422 }),
    );

    let error: unknown;
    try {
      await sendEmail(config, message);
    } catch (caught) {
      error = caught;
    }
    const text = (error as Error).message;
    expect(text).toBe("Resend answered 422");
    expect(text).not.toContain("re_secret_123");
    expect(text).not.toContain("buyer@example.com");
  });
});
