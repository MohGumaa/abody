import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { syncCheckoutSession } = vi.hoisted(() => ({
  syncCheckoutSession: vi.fn(),
}));

vi.mock("@/lib/order-sync", () => ({ syncCheckoutSession }));

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
  syncCheckoutSession.mockReset();
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
});
