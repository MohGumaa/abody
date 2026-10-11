// No next/* or db imports here: Vitest loads this module directly.
import { isValidEmail, normalizeEmail } from "@/lib/auth";

// Admin site settings (feature 21c): the public contact email in the footer.

export const CONTACT_EMAIL_MAX = 254;

export type SiteSettingsFieldErrors = { contactEmail?: "invalid_email" };

export interface SiteSettingsFormValues {
  contactEmail: string;
}

export interface SiteSettingsData {
  contactEmail: string | null;
}

export type ParsedSiteSettingsForm =
  | { ok: true; data: SiteSettingsData }
  | { ok: false; fieldErrors: SiteSettingsFieldErrors; values: SiteSettingsFormValues };

// A blank field clears the email.
export function parseSiteSettingsForm(formData: FormData): ParsedSiteSettingsForm {
  const raw = formData.get("contactEmail");
  const contactEmail = normalizeEmail(typeof raw === "string" ? raw : "");
  if (!contactEmail) return { ok: true, data: { contactEmail: null } };
  if (!isValidEmail(contactEmail)) {
    return {
      ok: false,
      fieldErrors: { contactEmail: "invalid_email" },
      values: { contactEmail },
    };
  }
  return { ok: true, data: { contactEmail } };
}
