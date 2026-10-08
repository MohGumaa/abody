"use server";

import { revalidatePath } from "next/cache";
import { isProductId, requireAdmin } from "@/lib/admin";
import { PAID_SERVICE_ITEM } from "@/lib/admin-service-work";
import { db } from "@/lib/db";
import {
  isServiceStatus,
  parseAdminNotes,
  statusChangeData,
} from "@/lib/service-work-rules";

// Admin service work (feature 16): the status and internal notes of a service
// the customer has onboarded. Dates come from the server clock, never the form.
// requireAdmin() throws, so it stays outside the try.

export type ServiceWorkResult =
  | { success: true }
  | {
      success: false;
      error: "not_found" | "invalid_status" | "notes_too_long" | "changed" | "unexpected";
    }
  | null;

export async function saveServiceWork(
  _previous: ServiceWorkResult,
  formData: FormData,
): Promise<ServiceWorkResult> {
  await requireAdmin();
  try {
    const id = formData.get("id");
    if (!isProductId(id)) return { success: false, error: "not_found" };
    const status = formData.get("status");
    if (!isServiceStatus(status)) return { success: false, error: "invalid_status" };
    const notes = parseAdminNotes(formData.get("notes"));
    if (!notes.ok) {
      // A missing field means a malformed form, not the admin's text.
      return {
        success: false,
        error: notes.error === "too_long" ? "notes_too_long" : "invalid_status",
      };
    }

    // Only a work record whose order is still paid can change.
    const where = { id, orderItem: PAID_SERVICE_ITEM };
    const current = await db.service.findFirst({
      where,
      select: { status: true, startDate: true, completedDate: true },
    });
    if (!current) return { success: false, error: "not_found" };

    // One write conditioned on the status that was read, so the dates always
    // match the change and a concurrent save is never overwritten.
    const { count } = await db.service.updateMany({
      where: { ...where, status: current.status },
      data: {
        ...statusChangeData(current.status, status, current, new Date()),
        adminNotes: notes.notes,
      },
    });
    if (count === 0) {
      const exists = await db.service.count({ where });
      return { success: false, error: exists > 0 ? "changed" : "not_found" };
    }
    // The admin pages and the customer's account service pages.
    revalidatePath("/admin", "layout");
    revalidatePath("/[lang]", "layout");
    return { success: true };
  } catch (error) {
    // The message only: never the customer's answers or the notes.
    console.error(
      "saveServiceWork failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return { success: false, error: "unexpected" };
  }
}
