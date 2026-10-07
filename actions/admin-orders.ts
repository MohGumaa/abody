"use server";

import { revalidatePath } from "next/cache";
import { isProductId, requireAdmin } from "@/lib/admin";
import { FULFILMENT_STATUSES, isFulfilmentStatus } from "@/lib/admin-orders";
import { db } from "@/lib/db";

// Admin order fulfilment (feature 15a). Only Paid, Processing, and Completed
// can be set, and only on an order still in one of them, so a status Stripe set
// (Pending, Cancelled, Refunded) is never overwritten. requireAdmin() throws,
// so it stays outside the try.

export type OrderActionResult =
  | { success: true }
  | {
      success: false;
      error: "not_found" | "invalid_status" | "locked" | "unexpected";
    }
  | null;

export async function setOrderStatus(
  _previous: OrderActionResult,
  formData: FormData,
): Promise<OrderActionResult> {
  await requireAdmin();
  try {
    const id = formData.get("id");
    if (!isProductId(id)) return { success: false, error: "not_found" };
    const status = formData.get("status");
    if (!isFulfilmentStatus(status)) return { success: false, error: "invalid_status" };

    // One conditional write, so a concurrent Stripe change wins.
    const { count } = await db.order.updateMany({
      where: { id, status: { in: [...FULFILMENT_STATUSES] } },
      data: { status },
    });
    if (count === 0) {
      const exists = await db.order.count({ where: { id } });
      return { success: false, error: exists > 0 ? "locked" : "not_found" };
    }
    // The admin pages and the customer's account order pages.
    revalidatePath("/admin", "layout");
    revalidatePath("/[lang]", "layout");
    return { success: true };
  } catch (error) {
    console.error("setOrderStatus failed", error);
    return { success: false, error: "unexpected" };
  }
}
