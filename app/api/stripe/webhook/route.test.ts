import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { syncCheckoutSession, syncChargeRefund, revalidatePath, sendOrderPaidEmails } =
  vi.hoisted(() => ({
    syncCheckoutSession: vi.fn(),
    syncChargeRefund: vi.fn(),
    revalidatePath: vi.fn(),
    sendOrderPaidEmails: vi.fn(),
  }));

vi.mock("@/lib/order-sync", () => ({ syncCheckoutSession, syncChargeRefund }));
vi.mock("@/lib/order-notifications", () => ({ sendOrderPaidEmails }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { POST } from "./route";

const SECRET = "whsec_test_secret";
// Signs test payloads locally; no network call is made.
const signer = new Stripe("sk_test_signer");

function eventBody(type: string, object: object = { id: "cs_test_1" }) {
  return JSON.stringify({
    id: "evt_1",
    object: "event",
    type,
    data: { object },
  });
}

function request(body: string, signature?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (signature !== undefined) headers.set("stripe-signature", signature);
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers,
    body,
  });
}

function signed(body: string, secret = SECRET) {
  return request(
    body,
    signer.webhooks.generateTestHeaderString({ payload: body, secret }),
  );
}

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_route");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
  syncCheckoutSession.mockReset().mockResolvedValue(null);
  sendOrderPaidEmails.mockReset().mockResolvedValue(undefined);
  syncChargeRefund.mockReset().mockResolvedValue(0);
  revalidatePath.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/stripe/webhook", () => {
  it("returns 500 when the webhook secret is not set", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");

    const response = await POST(signed(eventBody("checkout.session.completed")));

    expect(response.status).toBe(500);
    expect(syncCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects a request without a signature", async () => {
    const response = await POST(request(eventBody("checkout.session.completed")));

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_signature");
    expect(syncCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects a signature made with another secret", async () => {
    const response = await POST(
      signed(eventBody("checkout.session.completed"), "whsec_other"),
    );

    expect(response.status).toBe(400);
    expect(syncCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects a tampered body", async () => {
    const body = eventBody("checkout.session.completed");
    const signature = signer.webhooks.generateTestHeaderString({
      payload: body,
      secret: SECRET,
    });

    const response = await POST(
      request(body.replace("cs_test_1", "cs_test_2"), signature),
    );

    expect(response.status).toBe(400);
    expect(syncCheckoutSession).not.toHaveBeenCalled();
  });

  it("syncs a verified checkout event", async () => {
    const session = { id: "cs_test_1", mode: "payment" };

    const response = await POST(
      signed(eventBody("checkout.session.completed", session)),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(syncCheckoutSession).toHaveBeenCalledWith(
      "checkout.session.completed",
      session,
    );
  });

  it("sends the paid-order emails when this delivery paid the order", async () => {
    const session = { id: "cs_test_1", mode: "payment", metadata: { locale: "ar" } };
    syncCheckoutSession.mockResolvedValue("o1");

    const response = await POST(signed(eventBody("checkout.session.completed", session)));

    expect(response.status).toBe(200);
    expect(sendOrderPaidEmails).toHaveBeenCalledWith("o1", session);
  });

  it("sends no email when the sync paid no order", async () => {
    await POST(signed(eventBody("checkout.session.completed")));
    await POST(signed(eventBody("checkout.session.async_payment_failed")));

    expect(sendOrderPaidEmails).not.toHaveBeenCalled();
  });

  it("still answers 200 when the emails fail", async () => {
    syncCheckoutSession.mockResolvedValue("o1");
    sendOrderPaidEmails.mockRejectedValue(new Error("unexpected"));

    const response = await POST(signed(eventBody("checkout.session.completed")));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
  });

  it("sends no email when syncing fails", async () => {
    syncCheckoutSession.mockRejectedValue(new Error("db down"));

    await POST(signed(eventBody("checkout.session.completed")));

    expect(sendOrderPaidEmails).not.toHaveBeenCalled();
  });

  it("syncs the async payment events", async () => {
    await POST(signed(eventBody("checkout.session.async_payment_succeeded")));
    await POST(signed(eventBody("checkout.session.async_payment_failed")));

    expect(syncCheckoutSession.mock.calls.map(([type]) => type)).toEqual([
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
    ]);
  });

  it("acknowledges an unhandled event without syncing", async () => {
    const response = await POST(signed(eventBody("checkout.session.expired")));

    expect(response.status).toBe(200);
    expect(syncCheckoutSession).not.toHaveBeenCalled();
  });

  it("returns 500 so Stripe retries when syncing fails", async () => {
    syncCheckoutSession.mockRejectedValue(new Error("db down"));

    const response = await POST(
      signed(eventBody("checkout.session.completed")),
    );

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
  });

  it("syncs a verified charge.refunded event and refreshes the pages", async () => {
    const charge = { id: "ch_1", refunded: true, payment_intent: "pi_1" };
    syncChargeRefund.mockResolvedValue(1);

    const response = await POST(signed(eventBody("charge.refunded", charge)));

    expect(response.status).toBe(200);
    expect(syncChargeRefund).toHaveBeenCalledWith(charge);
    expect(syncCheckoutSession).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/[lang]", "layout");
  });

  it("skips revalidation when a refund moves no order", async () => {
    const response = await POST(signed(eventBody("charge.refunded", { id: "ch_1" })));

    expect(response.status).toBe(200);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("ignores an unsigned charge.refunded event", async () => {
    const response = await POST(request(eventBody("charge.refunded", { id: "ch_1" })));

    expect(response.status).toBe(400);
    expect(syncChargeRefund).not.toHaveBeenCalled();
  });

  it("returns 500 so Stripe retries when the refund sync fails", async () => {
    syncChargeRefund.mockRejectedValue(new Error("db down"));

    const response = await POST(signed(eventBody("charge.refunded", { id: "ch_1" })));

    expect(response.status).toBe(500);
  });
});
