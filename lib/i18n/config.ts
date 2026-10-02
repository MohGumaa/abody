// No next/* imports here: proxy.ts and Vitest both load this module.

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

// Each language's own name, shown by the switcher.
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
};

export const LOCALE_COOKIE = "lang";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "ar";
}

export function localeDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function otherLocale(locale: Locale): Locale {
  return locale === "ar" ? "en" : "ar";
}

// Highest q wins among English and Arabic entries; a tie keeps the first.
function localeFromAcceptLanguage(header: string): Locale | null {
  let best: Locale | null = null;
  let bestQ = 0;
  for (const entry of header.split(",")) {
    const [tag, ...params] = entry.split(";").map((part) => part.trim());
    const primary = tag.toLowerCase().split("-")[0];
    if (!isLocale(primary)) continue;
    const qParam = params.find((param) => param.startsWith("q="));
    const q = qParam ? Number(qParam.slice(2)) : 1;
    // Also skips q=0 and a q that is not a number.
    if (!(q > bestQ)) continue;
    best = primary;
    bestQ = q;
  }
  return best;
}

export function resolveLocale(
  cookieValue: string | null | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  return localeFromAcceptLanguage(acceptLanguage ?? "") ?? DEFAULT_LOCALE;
}

export function pathLocale(pathname: string): Locale | null {
  const segment = pathname.split("/")[1];
  return isLocale(segment) ? segment : null;
}

export function localizedPath(locale: Locale, path: string): string {
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

export function switchLocalePath(pathname: string, locale: Locale): string {
  const current = pathLocale(pathname);
  const rest = current ? pathname.slice(current.length + 1) || "/" : pathname;
  return localizedPath(locale, rest);
}
