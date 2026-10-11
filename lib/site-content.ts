import { cache } from "react";
import { db } from "@/lib/db";
import {
  FLAGS,
  TEXT_FIELDS,
  type SiteContentField,
  type Flag,
  type SiteContentRow,
} from "@/lib/site-content-rules";

// The single site content row (feature 21b). Its id is fixed.
export const SITE_CONTENT_ID = 1;

const SITE_CONTENT_SELECT = Object.fromEntries(
  [...TEXT_FIELDS, "announcementLink", ...FLAGS].map((field) => [field, true]),
) as Record<SiteContentField | Flag, true>;

// Throws on a database error. The admin editor uses this one: showing an empty
// form after a failed read would let the next save wipe the saved content.
export async function readSiteContent(): Promise<SiteContentRow | null> {
  return db.siteContent.findUnique({
    where: { id: SITE_CONTENT_ID },
    select: SITE_CONTENT_SELECT,
  });
}

// For the store: one query per request, shared by the layout's announcement
// bar and the home page. Never throws: the customer layout has no error
// boundary above it, so a failed read falls back to the built-in text and no bar.
export const getSiteContent = cache(async (): Promise<SiteContentRow | null> => {
  try {
    return await readSiteContent();
  } catch (error) {
    console.error("getSiteContent failed", error);
    return null;
  }
});
