// No next/* or db imports here: Vitest loads this module directly.
import { isLocale, localizedPath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

// Admin-edited home page text, section switches, and the announcement bar
// (feature 21b): form parsing and how a stored row turns into page content.

// Character limits, shared by the parser and the admin form's maxLength.
export const TEXT_LIMITS = {
  heroEyebrow: 60,
  heroTitle: 120,
  heroLead: 300,
  ctaTitle: 120,
  ctaBody: 300,
  ctaAction: 40,
  announcementText: 160,
} as const;

export const ANNOUNCEMENT_LINK_MAX = 200;

export type TextKey = keyof typeof TEXT_LIMITS;
export type TextField = TextKey | `${TextKey}Ar`;

export const TEXT_KEYS = Object.keys(TEXT_LIMITS) as TextKey[];
export const TEXT_FIELDS: TextField[] = TEXT_KEYS.flatMap((key) => [key, `${key}Ar` as const]);

// Home sections below the hero, in page order. The hero always shows: it holds
// the page's h1.
export const SECTION_FLAGS = [
  "showCategories",
  "showFeatured",
  "showServices",
  "showValues",
  "showHowItWorks",
  "showCta",
] as const;

export type SectionFlag = (typeof SECTION_FLAGS)[number];
export type Flag = SectionFlag | "announcementEnabled";

export const FLAGS: Flag[] = [...SECTION_FLAGS, "announcementEnabled"];

export type SiteContentField = TextField | "announcementLink";
export type SiteContentFieldError = "too_long" | "required" | "invalid_link";
export type SiteContentFieldErrors = Partial<Record<SiteContentField, SiteContentFieldError>>;

// What the form shows: the saved row, or what was typed after a failed save.
export type SiteContentFormValues = Record<SiteContentField, string> & Record<Flag, boolean>;

export type SiteContentData = Record<SiteContentField, string | null> & Record<Flag, boolean>;

export type ParsedSiteContentForm =
  | { ok: true; data: SiteContentData; values: SiteContentFormValues }
  | { ok: false; fieldErrors: SiteContentFieldErrors; values: SiteContentFormValues };

// A row as stored; null when nothing was ever saved.
export type SiteContentRow = SiteContentData;

export function textLimit(field: TextField): number {
  return TEXT_LIMITS[field.replace(/Ar$/, "") as TextKey];
}

// A store path is given without the language and gets the visitor's prefix;
// anything else must be an https:// URL. Returns null when neither.
export function parseAnnouncementLink(input: string): string | null {
  if (input.length > ANNOUNCEMENT_LINK_MAX || /\s/.test(input)) return null;
  if (input.startsWith("/")) {
    if (input.includes("\\") || input.includes("//")) return null;
    const first = input.slice(1).split(/[/?#]/)[0];
    return isLocale(first) ? null : input;
  }
  try {
    return new URL(input).protocol === "https:" ? input : null;
  } catch {
    return null;
  }
}

export function siteContentFormValues(row: SiteContentRow | null): SiteContentFormValues {
  const values = {} as SiteContentFormValues;
  for (const field of TEXT_FIELDS) values[field] = row?.[field] ?? "";
  values.announcementLink = row?.announcementLink ?? "";
  for (const flag of SECTION_FLAGS) values[flag] = row?.[flag] ?? true;
  values.announcementEnabled = row?.announcementEnabled ?? false;
  return values;
}

export function parseSiteContentForm(formData: FormData): ParsedSiteContentForm {
  const values = {} as SiteContentFormValues;
  const data = {} as SiteContentData;
  const fieldErrors: SiteContentFieldErrors = {};

  for (const field of TEXT_FIELDS) {
    const raw = formData.get(field);
    // Line breaks are folded to spaces: every field renders as one paragraph.
    const value = typeof raw === "string" ? raw.replace(/\s*[\r\n]+\s*/g, " ").trim() : "";
    values[field] = value;
    data[field] = value || null;
    if (value.length > textLimit(field)) fieldErrors[field] = "too_long";
  }

  const rawLink = formData.get("announcementLink");
  const link = typeof rawLink === "string" ? rawLink.trim() : "";
  values.announcementLink = link;
  data.announcementLink = link || null;
  if (link && parseAnnouncementLink(link) === null) fieldErrors.announcementLink = "invalid_link";

  // An unchecked checkbox is not sent at all.
  for (const flag of FLAGS) {
    values[flag] = formData.has(flag);
    data[flag] = values[flag];
  }

  // The bar shows customer text, which must exist in both languages.
  if (data.announcementEnabled) {
    for (const field of ["announcementText", "announcementTextAr"] as const) {
      if (!data[field]) fieldErrors[field] = "required";
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors, values };
  return { ok: true, data, values };
}

export interface HomeContent {
  hero: { eyebrow: string; title: string; lead: string };
  cta: { title: string; body: string; action: string };
  show: Record<SectionFlag, boolean>;
}

// A blank field shows the built-in text for the page's language, never the
// other language's saved text.
export function resolveHomeContent(
  row: SiteContentRow | null,
  locale: Locale,
  home: Dictionary["home"],
): HomeContent {
  const pick = (key: TextKey, fallback: string) =>
    (locale === "ar" ? row?.[`${key}Ar`] : row?.[key]) || fallback;
  const show = {} as Record<SectionFlag, boolean>;
  for (const flag of SECTION_FLAGS) show[flag] = row?.[flag] ?? true;
  return {
    hero: {
      eyebrow: pick("heroEyebrow", home.hero.eyebrow),
      title: pick("heroTitle", home.hero.title),
      lead: pick("heroLead", home.hero.lead),
    },
    cta: {
      title: pick("ctaTitle", home.cta.title),
      body: pick("ctaBody", home.cta.body),
      action: pick("ctaAction", home.cta.action),
    },
    show,
  };
}

export interface Announcement {
  text: string;
  href: string | null;
}

export function resolveAnnouncement(
  row: SiteContentRow | null,
  locale: Locale,
): Announcement | null {
  if (!row?.announcementEnabled) return null;
  const text = locale === "ar" ? row.announcementTextAr : row.announcementText;
  if (!text) return null;
  const link = row.announcementLink ? parseAnnouncementLink(row.announcementLink) : null;
  return {
    text,
    href: link === null ? null : link.startsWith("/") ? localizedPath(locale, link) : link,
  };
}
