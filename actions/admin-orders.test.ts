import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, requireAdmin, revalidatePath, createRefund } = vi.hoisted(() => ({
  db: { order: { updateMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() } },
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  createRefund: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ refunds: { create: createRefund } }),
}));
vi.mock("@/lib/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin")>()),
  requireAdmin,
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));

import Stripe from "stripe";
import { refundOrder, setOrderStatus } from "./admin-orders";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const FULFILMENT = { in: ["PAID", "PROCESSING", "COMPLETED"] };

beforeEach(() => {
  requireAdmin.mockReset().mockResolvedValue({ id: "admin", role: "ADMIN" });
  db.order.updateMany.mockReset().mockResolvedValue({ count: 1 });
  db.order.count.mockReset().mockResolvedValue(1);
  revalidatePath.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("setOrderStatus", () => {
  it("never reaches the database for a non-admin", async () => {
    requireAdmin.mockRejectedValue(new Error("notFound"));
    await expect(
      setOrderStatus(null, form({ id: "o1", status: "PROCESSING" })),
    ).rejects.toThrow("notFound");
    expect(db.order.updateMany).not.toHaveBeenCalled();
    expect(db.order.count).not.toHaveBeenCalled();
  });

  it.each(["PAID", "PROCESSING", "COMPLETED"])(
    "sets %s only on an order in a fulfilment status",
    async (status) => {
      expect(await setOrderStatus(null, form({ id: "o1", status }))).toEqual({
        success: true,
      });
      expect(db.order.updateMany).toHaveBeenCalledWith({
        where: { id: "o1", status: FULFILMENT },
        data: { status },
      });
      expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
      expect(revalidatePath).toHaveBeenCalledWith("/[lang]", "layout");
    },
  );

  it.each(["PENDING", "CANCELLED", "REFUNDED", "SHIPPED", ""])(
    "refuses the status %s without a query",
    async (status) => {
      expect(await setOrderStatus(null, form({ id: "o1", status }))).toEqual({
        success: false,
        error: "invalid_status",
      });
      expect(db.order.updateMany).not.toHaveBeenCalled();
    },
  );

  it("rejects a missing or oversized id without a query", async () => {
    expect(await setOrderStatus(null, form({ status: "PAID" }))).toEqual({
      success: false,
      error: "not_found",
    });
    expect(
      await setOrderStatus(null, form({ id: "x".repeat(65), status: "PAID" })),
    ).toEqual({ success: false, error: "not_found" });
    expect(db.order.updateMany).not.toHaveBeenCalled();
  });

  it("reports an order Stripe has moved out of fulfilment as locked", async () => {
    db.order.updateMany.mockResolvedValue({ count: 0 });
    expect(
      await setOrderStatus(null, form({ id: "o1", status: "COMPLETED" })),
    ).toEqual({ success: false, error: "locked" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports a missing order as not_found", async () => {
    db.order.updateMany.mockResolvedValue({ count: 0 });
    db.order.count.mockResolvedValue(0);
    expect(
      await setOrderStatus(null, form({ id: "o1", status: "COMPLETED" })),
    ).toEqual({ success: false, error: "not_found" });
  });

  it("hides unexpected errors", async () => {
    db.order.updateMany.mockRejectedValue(new Error("down"));
    expect(
      await setOrderStatus(null, form({ id: "o1", status: "PAID" })),
    ).toEqual({ success: false, error: "unexpected" });
  });
});

describe("refundOrder", () => {
  const PAID = { status: "PAID", stripePaymentIntentId: "pi_1" };
  const REFUND_WRITE = {
    where: { id: "o1", status: FULFILMENT },
    data: { status: "REFUNDED" },
  };

  function stripeError(code: string) {
    return new Stripe.errors.StripeInvalidRequestError({
      type: "invalid_request_error",
      code,
      message: `Stripe says ${code}`,
    });
  }

  beforeEach(() => {
    db.order.findUnique.mockReset().mockResolvedValue(PAID);
    createRefund.mockReset().mockResolvedValue({ id: "re_1", status: "succeeded" });
  });

  it("never reaches the database or Stripe for a non-admin", async () => {
    requireAdmin.mockRejectedValue(new Error("notFound"));

    await expect(refundOrder(null, form({ id: "o1" }))).rejects.toThrow("notFound");
    expect(db.order.findUnique).not.toHaveBeenCalled();
    expect(createRefund).not.toHaveBeenCalled();
  });

  it("returns not_found for a bad or unknown id without calling Stripe", async () => {
    await expect(refundOrder(null, form({ id: "x".repeat(65) }))).resolves.toEqual({
      success: false,
      error: "not_found",
    });
    expect(db.order.findUnique).not.toHaveBeenCalled();

    db.order.findUnique.mockResolvedValue(null);
    await expect(refundOrder(null, form({ id: "o1" }))).resolves.toEqual({
      success: false,
      error: "not_found",
    });
    expect(createRefund).not.toHaveBeenCalled();
  });

  it.each(["PENDING", "CANCELLED", "REFUNDED"])(
    "refuses a %s order without calling Stripe",
    async (status) => {
      db.order.findUnique.mockResolvedValue({ ...PAID, status });

      await expect(refundOrder(null, form({ id: "o1" }))).resolves.toEqual({
        success: false,
        error: "not_refundable",
      });
      expect(createRefund).not.toHaveBeenCalled();
      expect(db.order.updateMany).not.toHaveBeenCalled();
    },
  );

  it("returns no_payment when no payment intent is recorded", async () => {
    db.order.findUnique.mockResolvedValue({ ...PAID, stripePaymentIntentId: null });

    await expect(refundOrder(null, form({ id: "o1" }))).resolves.toEqual({
      success: false,
      error: "no_payment",
    });
    expect(createRefund).not.toHaveBeenCalled();
  });

  it.each(["PAID", "PROCESSING", "COMPLETED"])(
    "fully refunds a %s order, then marks it Refunded",
    async (status) => {
      db.order.findUnique.mockResolvedValue({ ...PAID, status });

      await expect(refundOrder(null, form({ id: "o1" }))).resolves.toEqual({
        success: true,
      });
      expect(createRefund).toHaveBeenCalledWith(
        { payment_intent: "pi_1" },
        { idempotencyKey: "refund-order-o1" },
      );
      expect(db.order.updateMany).toHaveBeenCalledWith(REFUND_WRITE);
      expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
      expect(revalidatePath).toHaveBeenCalledWith("/[lang]", "layout");
    },
  );

  it("treats a pending refund as accepted", async () => {
    createRefund.mockResolvedValue({ id: "re_1", status: "pending" });

    await expect(refundOrder(null, form({ id: "o1" }))).resolves.toEqual({ success: true });
    expect(db.order.updateMany).toHaveBeenCalledWith(REFUND_WRITE);
  });

  it("marks the order Refunded when Stripe already refunded the charge", async () => {
    createRefund.mockRejectedValue(stripeError("charge_already_refunded"));

    await expect(refundOrder(null, form({ id: "o1" }))).resolves.toEqual({ success: true });
    expect(db.order.updateMany).toHaveBeenCalledWith(REFUND_WRITE);
  });

  it("returns stripe_error without a write when Stripe refuses", async () => {
    createRefund.mockRejectedValue(stripeError("amount_too_large"));

    await expect(refundOrder(null, form({ id: "o1" }))).resolves.toEqual({
      success: false,
      error: "stripe_error",
    });
    expect(db.order.updateMany).not.toHaveBeenCalled();
  });

  it.each(["failed", "canceled"])(
    "returns stripe_error without a write for a %s refund",
    async (status) => {
      createRefund.mockResolvedValue({ id: "re_1", status });

      await expect(refundOrder(null, form({ id: "o1" }))).resolves.toEqual({
        success: false,
        error: "stripe_error",
      });
      expect(db.order.updateMany).not.toHaveBeenCalled();
    },
  );

  it("succeeds when the webhook already marked the order", async () => {
    db.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(refundOrder(null, form({ id: "o1" }))).resolves.toEqual({ success: true });
  });

  it("returns unexpected on a database error", async () => {
    db.order.findUnique.mockRejectedValue(new Error("db down"));

    await expect(refundOrder(null, form({ id: "o1" }))).resolves.toEqual({
      success: false,
      error: "unexpected",
    });
    expect(createRefund).not.toHaveBeenCalled();
  });
});
