import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { order, user, listLineItems } = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  order: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  listLineItems: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { order, user } }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { listLineItems } } }),
}));

import { Prisma } from "@/lib/generated/prisma/client";
import { syncCheckoutSession } from "@/lib/order-sync";

function session(
  overrides: Partial<Stripe.Checkout.Session> = {},
): Stripe.Checkout.Session {
  return {
    id: "cs_test_1",
    mode: "payment",
    payment_status: "paid",
    amount_total: 14700,
    currency: "usd",
    customer_details: { email: "buyer@example.com" },
    payment_intent: "pi_1",
    ...overrides,
  } as Stripe.Checkout.Session;
}

function lineItems(has_more = false, productId: string | null = "p1") {
  return {
    has_more,
    data: [
      {
        id: "li_1",
        quantity: 3,
        price: {
          unit_amount: 4900,
          product: {
            id: "prod_1",
            metadata: productId ? { productId } : {},
          },
        },
      },
    ],
  };
}

beforeEach(() => {
  for (const fn of Object.values(order)) fn.mockReset();
  user.findUnique.mockReset().mockResolvedValue(null);
  listLineItems.mockReset();
});

describe("syncCheckoutSession", () => {
  it("ignores an event that asks for no status", async () => {
    await syncCheckoutSession("checkout.session.expired", session());

    expect(order.findUnique).not.toHaveBeenCalled();
    expect(listLineItems).not.toHaveBeenCalled();
  });

  it("creates a paid order with its items", async () => {
    order.findUnique.mockResolvedValue(null);
    listLineItems.mockResolvedValue(lineItems());
    order.create.mockResolvedValue({});

    await syncCheckoutSession("checkout.session.completed", session());

    expect(listLineItems).toHaveBeenCalledWith("cs_test_1", {
      limit: 100,
      expand: ["data.price.product"],
    });
    expect(order.create).toHaveBeenCalledWith({
      data: {
        status: "PAID",
        userId: null,
        totalCents: 14700,
        currency: "usd",
        customerEmail: "buyer@example.com",
        stripeCheckoutSessionId: "cs_test_1",
        stripePaymentIntentId: "pi_1",
        items: { create: [{ productId: "p1", priceCents: 4900, quantity: 3 }] },
      },
    });
    expect(order.updateMany).not.toHaveBeenCalled();
  });

  it("links the order to the signed-in customer who checked out", async () => {
    order.findUnique.mockResolvedValue(null);
    listLineItems.mockResolvedValue(lineItems());
    user.findUnique.mockResolvedValue({ id: "u1" });

    await syncCheckoutSession(
      "checkout.session.completed",
      session({ client_reference_id: "u1" }),
    );

    expect(user.findUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { id: true },
    });
    expect(order.create.mock.calls[0][0].data.userId).toBe("u1");
  });

  it("leaves the order unlinked when the referenced user is gone", async () => {
    order.findUnique.mockResolvedValue(null);
    listLineItems.mockResolvedValue(lineItems());

    await syncCheckoutSession(
      "checkout.session.completed",
      session({ client_reference_id: "deleted" }),
    );

    expect(order.create.mock.calls[0][0].data.userId).toBeNull();
  });

  it("does not look up a user for a guest checkout", async () => {
    order.findUnique.mockResolvedValue(null);
    listLineItems.mockResolvedValue(lineItems());

    await syncCheckoutSession(
      "checkout.session.completed",
      session({ client_reference_id: null }),
    );

    expect(user.findUnique).not.toHaveBeenCalled();
    expect(order.create.mock.calls[0][0].data.userId).toBeNull();
  });

  it("reads an expanded payment intent's id and allows a missing email", async () => {
    order.findUnique.mockResolvedValue(null);
    listLineItems.mockResolvedValue(lineItems());

    await syncCheckoutSession(
      "checkout.session.completed",
      session({
        payment_intent: { id: "pi_2" } as Stripe.PaymentIntent,
        customer_details: null,
      }),
    );

    expect(order.create.mock.calls[0][0].data).toMatchObject({
      stripePaymentIntentId: "pi_2",
      customerEmail: null,
    });
  });

  it("does nothing for a repeat delivery to a paid order", async () => {
    order.findUnique.mockResolvedValue({ id: "o1", status: "PAID" });

    await syncCheckoutSession("checkout.session.completed", session());

    expect(listLineItems).not.toHaveBeenCalled();
    expect(order.create).not.toHaveBeenCalled();
    expect(order.updateMany).not.toHaveBeenCalled();
  });

  it("never downgrades a paid order", async () => {
    order.findUnique.mockResolvedValue({ id: "o1", status: "PAID" });

    await syncCheckoutSession(
      "checkout.session.completed",
      session({ payment_status: "unpaid" }),
    );

    expect(order.updateMany).not.toHaveBeenCalled();
  });

  it("moves a pending order to paid behind a PENDING guard", async () => {
    order.findUnique.mockResolvedValue({ id: "o1", status: "PENDING" });

    await syncCheckoutSession(
      "checkout.session.async_payment_succeeded",
      session(),
    );

    expect(order.updateMany).toHaveBeenCalledWith({
      where: { id: "o1", status: "PENDING" },
      data: { status: "PAID", stripePaymentIntentId: "pi_1" },
    });
  });

  it("falls through to the transition when a concurrent create won", async () => {
    order.findUnique.mockResolvedValue(null);
    listLineItems.mockResolvedValue(lineItems());
    order.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.10.0",
      }),
    );
    order.findUniqueOrThrow.mockResolvedValue({ id: "o1", status: "PENDING" });

    await syncCheckoutSession(
      "checkout.session.async_payment_failed",
      session({ payment_status: "unpaid", payment_intent: null }),
    );

    expect(order.updateMany).toHaveBeenCalledWith({
      where: { id: "o1", status: "PENDING" },
      data: { status: "CANCELLED", stripePaymentIntentId: undefined },
    });
  });

  it("rethrows other database errors", async () => {
    order.findUnique.mockResolvedValue(null);
    listLineItems.mockResolvedValue(lineItems());
    order.create.mockRejectedValue(new Error("connection lost"));

    await expect(
      syncCheckoutSession("checkout.session.completed", session()),
    ).rejects.toThrow("connection lost");
  });

  it("rejects more line items than one page", async () => {
    order.findUnique.mockResolvedValue(null);
    listLineItems.mockResolvedValue(lineItems(true));

    await expect(
      syncCheckoutSession("checkout.session.completed", session()),
    ).rejects.toThrow(/too many/);
    expect(order.create).not.toHaveBeenCalled();
  });

  it("rejects a line without a productId", async () => {
    order.findUnique.mockResolvedValue(null);
    listLineItems.mockResolvedValue(lineItems(false, null));

    await expect(
      syncCheckoutSession("checkout.session.completed", session()),
    ).rejects.toThrow(/productId/);
    expect(order.create).not.toHaveBeenCalled();
  });

  it("rejects a session without a total", async () => {
    order.findUnique.mockResolvedValue(null);
    listLineItems.mockResolvedValue(lineItems());

    await expect(
      syncCheckoutSession(
        "checkout.session.completed",
        session({ amount_total: null }),
      ),
    ).rejects.toThrow(/total/);
  });
});
