"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { SITE_CONTENT_ID } from "@/lib/site-content";
import {
  parseSiteContentForm,
  type SiteContentFieldErrors,
  type SiteContentFormValues,
} from "@/lib/site-content-rules";

// Saves the home page text, section switches, and announcement bar (feature
// 21b) in one write. requireAdmin() throws, so it stays outside the try block.
// Two admins saving at once: the last save wins.

export type SiteContentActionError = "invalid_fields" | "unexpected";

export type SiteContentActionResult =
  | { success: true }
  | {
      success: false;
      error: SiteContentActionError;
      fieldErrors?: SiteContentFieldErrors;
      values?: SiteContentFormValues;
    }
  | null;

export async function saveSiteContent(
  _previous: SiteContentActionResult,
  formData: FormData,
): Promise<SiteContentActionResult> {
  await requireAdmin();
  try {
    const parsed = parseSiteContentForm(formData);
    if (!parsed.ok) {
      return {
        success: false,
        error: "invalid_fields",
        fieldErrors: parsed.fieldErrors,
        values: parsed.values,
      };
    }
    await db.siteContent.upsert({
      where: { id: SITE_CONTENT_ID },
      create: { id: SITE_CONTENT_ID, ...parsed.data },
      update: parsed.data,
    });
    revalidatePath("/[lang]", "layout");
    revalidatePath("/admin/content");
    return { success: true };
  } catch (error) {
    console.error("saveSiteContent failed", error);
    return { success: false, error: "unexpected" };
  }
}
