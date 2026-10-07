import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, requireAdmin, revalidatePath } = vi.hoisted(() => ({
  db: { order: { updateMany: vi.fn(), count: vi.fn() } },
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin")>()),
  requireAdmin,
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));

import { setOrderStatus } from "./admin-orders";

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
