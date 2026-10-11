"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { SITE_CONTENT_ID } from "@/lib/site-content";
import {
  parseSiteSettingsForm,
  type SiteSettingsFieldErrors,
  type SiteSettingsFormValues,
} from "@/lib/site-settings-rules";

// Saves the site settings (feature 21c) on the site content row, writing only
// the settings columns so the home page content is never touched.
// requireAdmin() throws, so it stays outside the try block. Last save wins.

export type SiteSettingsActionError = "invalid_fields" | "unexpected";

export type SiteSettingsActionResult =
  | { success: true }
  | {
      success: false;
      error: SiteSettingsActionError;
      fieldErrors?: SiteSettingsFieldErrors;
      values?: SiteSettingsFormValues;
    }
  | null;

export async function saveSiteSettings(
  _previous: SiteSettingsActionResult,
  formData: FormData,
): Promise<SiteSettingsActionResult> {
  await requireAdmin();
  // Parsing is pure, so it stays outside the try: a failed write can then hand
  // the typed email back to the form.
  const parsed = parseSiteSettingsForm(formData);
  if (!parsed.ok) {
    return {
      success: false,
      error: "invalid_fields",
      fieldErrors: parsed.fieldErrors,
      values: parsed.values,
    };
  }
  try {
    await db.siteContent.upsert({
      where: { id: SITE_CONTENT_ID },
      create: { id: SITE_CONTENT_ID, ...parsed.data },
      update: parsed.data,
    });
    revalidatePath("/[lang]", "layout");
    revalidatePath("/admin/settings");
    return { success: true };
  } catch (error) {
    console.error("saveSiteSettings failed", error);
    return {
      success: false,
      error: "unexpected",
      values: { contactEmail: parsed.data.contactEmail ?? "" },
    };
  }
}
