"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import {
  type CouponFieldErrors,
  type CouponFormValues,
  isCouponId,
  parseCouponForm,
} from "@/lib/admin-coupons";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";

// Admin discount code mutations (feature 20). Every action checks the admin
// role first. requireAdmin() and redirect() throw, so both stay outside the try
// blocks. Changes reach carts on their next render and checkout, which always
// re-check the code; past orders keep their stored discount.

export type CouponActionError = "invalid_fields" | "not_found" | "unexpected";

export type CouponActionResult =
  | { success: true }
  | {
      success: false;
      error: CouponActionError;
      fieldErrors?: CouponFieldErrors;
      values?: CouponFormValues;
    }
  | null;

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function formId(formData: FormData): string | null {
  const id = formData.get("id");
  return isCouponId(id) ? id : null;
}

export async function createCoupon(
  _previous: CouponActionResult,
  formData: FormData,
): Promise<CouponActionResult> {
  await requireAdmin();
  let id: string;
  try {
    const parsed = parseCouponForm(formData, true);
    if (!parsed.ok) {
      return {
        success: false,
        error: "invalid_fields",
        fieldErrors: parsed.fieldErrors,
        values: parsed.values,
      };
    }
    try {
      // New codes start inactive, like new products.
      const created = await db.coupon.create({
        data: { ...parsed.data, code: parsed.code, active: false },
        select: { id: true },
      });
      id = created.id;
    } catch (error) {
      // The unique index also catches two saves racing for the same code.
      if (hasCode(error, "P2002")) {
        return {
          success: false,
          error: "invalid_fields",
          fieldErrors: { code: "code_taken" },
          values: parsed.values,
        };
      }
      throw error;
    }
    revalidatePath("/admin", "layout");
  } catch (error) {
    console.error("createCoupon failed", error);
    return { success: false, error: "unexpected" };
  }
  redirect(`/admin/coupons/${id}`);
}

export async function updateCoupon(
  _previous: CouponActionResult,
  formData: FormData,
): Promise<CouponActionResult> {
  await requireAdmin();
  try {
    const id = formId(formData);
    if (!id) return { success: false, error: "not_found" };
    const parsed = parseCouponForm(formData, false);
    if (!parsed.ok) {
      return {
        success: false,
        error: "invalid_fields",
        fieldErrors: parsed.fieldErrors,
        values: parsed.values,
      };
    }
    // The code and active state are never set from this form.
    const { count } = await db.coupon.updateMany({ where: { id }, data: parsed.data });
    if (count === 0) return { success: false, error: "not_found" };
    revalidatePath("/admin", "layout");
    return { success: true };
  } catch (error) {
    console.error("updateCoupon failed", error);
    return { success: false, error: "unexpected" };
  }
}

export async function setCouponActive(
  _previous: CouponActionResult,
  formData: FormData,
): Promise<CouponActionResult> {
  await requireAdmin();
  try {
    const id = formId(formData);
    const active = formData.get("active");
    if (!id || (active !== "true" && active !== "false")) {
      return { success: false, error: "not_found" };
    }
    const { count } = await db.coupon.updateMany({
      where: { id },
      data: { active: active === "true" },
    });
    if (count === 0) return { success: false, error: "not_found" };
    revalidatePath("/admin", "layout");
    return { success: true };
  } catch (error) {
    console.error("setCouponActive failed", error);
    return { success: false, error: "unexpected" };
  }
}
