import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, requireAdmin, revalidatePath, redirect } = vi.hoisted(() => ({
  db: { coupon: { create: vi.fn(), updateMany: vi.fn() } },
  // Both throw in Next.js, ending the action.
  requireAdmin: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/admin", () => ({ requireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect, notFound: vi.fn() }));

import { Prisma } from "@/lib/generated/prisma/client";
import { createCoupon, setCouponActive, updateCoupon } from "./admin-coupons";

const valid = {
  code: "save10",
  percentOff: "10",
  appliesTo: "ALL",
  expiresOn: "",
  maxRedemptions: "",
};

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  requireAdmin.mockReset().mockResolvedValue({ id: "admin", role: "ADMIN" });
  db.coupon.create.mockReset().mockResolvedValue({ id: "c1" });
  db.coupon.updateMany.mockReset().mockResolvedValue({ count: 1 });
  revalidatePath.mockClear();
  redirect.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("admin role", () => {
  it.each([
    ["createCoupon", () => createCoupon(null, form(valid))],
    ["updateCoupon", () => updateCoupon(null, form({ ...valid, id: "c1" }))],
    ["setCouponActive", () => setCouponActive(null, form({ id: "c1", active: "true" }))],
  ])("%s stops when requireAdmin throws", async (_name, run) => {
    requireAdmin.mockRejectedValue(new Error("NEXT_NOT_FOUND"));

    await expect(run()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(db.coupon.create).not.toHaveBeenCalled();
    expect(db.coupon.updateMany).not.toHaveBeenCalled();
  });
});

describe("createCoupon", () => {
  it("creates an inactive code and opens its page", async () => {
    await expect(createCoupon(null, form(valid))).rejects.toThrow("redirect:/admin/coupons/c1");

    expect(db.coupon.create).toHaveBeenCalledWith({
      data: {
        code: "SAVE10",
        percentOff: 10,
        appliesTo: "ALL",
        expiresOn: null,
        maxRedemptions: null,
        active: false,
      },
      select: { id: true },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
  });

  it("returns field errors without writing", async () => {
    const result = await createCoupon(null, form({ ...valid, percentOff: "0" }));

    expect(result).toMatchObject({
      success: false,
      error: "invalid_fields",
      fieldErrors: { percentOff: "invalid_percent" },
    });
    expect(db.coupon.create).not.toHaveBeenCalled();
  });

  it("reports a code that is already taken", async () => {
    db.coupon.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    expect(await createCoupon(null, form(valid))).toMatchObject({
      success: false,
      error: "invalid_fields",
      fieldErrors: { code: "code_taken" },
      values: { code: "SAVE10" },
    });
  });

  it("returns unexpected on other failures", async () => {
    db.coupon.create.mockRejectedValue(new Error("db down"));

    expect(await createCoupon(null, form(valid))).toEqual({ success: false, error: "unexpected" });
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("updateCoupon", () => {
  it("updates everything but the code and active state", async () => {
    const result = await updateCoupon(
      null,
      form({ ...valid, id: "c1", code: "OTHER", maxRedemptions: "5" }),
    );

    expect(result).toEqual({ success: true });
    expect(db.coupon.updateMany).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { percentOff: 10, appliesTo: "ALL", expiresOn: null, maxRedemptions: 5 },
    });
  });

  it("is not_found for a missing or unknown id", async () => {
    expect(await updateCoupon(null, form(valid))).toEqual({ success: false, error: "not_found" });
    db.coupon.updateMany.mockResolvedValue({ count: 0 });
    expect(await updateCoupon(null, form({ ...valid, id: "gone" }))).toEqual({
      success: false,
      error: "not_found",
    });
  });

  it("returns field errors without writing", async () => {
    const result = await updateCoupon(null, form({ ...valid, id: "c1", appliesTo: "X" }));

    expect(result).toMatchObject({ fieldErrors: { appliesTo: "invalid_scope" } });
    expect(db.coupon.updateMany).not.toHaveBeenCalled();
  });
});

describe("setCouponActive", () => {
  it("activates and deactivates", async () => {
    expect(await setCouponActive(null, form({ id: "c1", active: "true" }))).toEqual({
      success: true,
    });
    expect(db.coupon.updateMany).toHaveBeenLastCalledWith({
      where: { id: "c1" },
      data: { active: true },
    });
    await setCouponActive(null, form({ id: "c1", active: "false" }));
    expect(db.coupon.updateMany).toHaveBeenLastCalledWith({
      where: { id: "c1" },
      data: { active: false },
    });
  });

  it("rejects a bad flag or an unknown id", async () => {
    expect(await setCouponActive(null, form({ id: "c1", active: "yes" }))).toEqual({
      success: false,
      error: "not_found",
    });
    db.coupon.updateMany.mockResolvedValue({ count: 0 });
    expect(await setCouponActive(null, form({ id: "gone", active: "true" }))).toEqual({
      success: false,
      error: "not_found",
    });
  });
});
