import { cache } from "react";
import { db } from "@/lib/db";
import {
  FLAGS,
  TEXT_FIELDS,
  type SiteContentField,
  type Flag,
  type SiteContentRow,
} from "@/lib/site-content-rules";
import type { SiteSettingsData } from "@/lib/site-settings-rules";

// The single site content row (feature 21b), which also holds the site
// settings (21c). Its id is fixed.
export const SITE_CONTENT_ID = 1;

// Each admin form writes only its own columns; the store reads them all.
export type SiteRow = SiteContentRow & SiteSettingsData;

const SITE_CONTENT_SELECT = Object.fromEntries(
  [...TEXT_FIELDS, "announcementLink", ...FLAGS, "contactEmail"].map((field) => [field, true]),
) as Record<SiteContentField | Flag | keyof SiteSettingsData, true>;

// Throws on a database error. The admin editors use this one: showing an empty
// form after a failed read would let the next save wipe the saved content.
export async function readSiteContent(): Promise<SiteRow | null> {
  return db.siteContent.findUnique({
    where: { id: SITE_CONTENT_ID },
    select: SITE_CONTENT_SELECT,
  });
}

// For the store: one query per request, shared by the layout's announcement
// bar, the footer, and the home page. Never throws: the customer layout has no
// error boundary above it, so a failed read falls back to the built-in text, no
// bar, and no footer contact line.
export const getSiteContent = cache(async (): Promise<SiteRow | null> => {
  try {
    return await readSiteContent();
  } catch (error) {
    console.error("getSiteContent failed", error);
    return null;
  }
});
