import type { Locale } from "@/lib/i18n/config";

// "Sep 20, 2026" and "20 سبتمبر 2026". Latin digits in Arabic too, so dates
// match prices and order numbers. UTC keeps the server's output the same
// wherever it runs.
const OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
};

const FORMATS: Record<Locale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en-US", OPTIONS),
  ar: new Intl.DateTimeFormat("ar-u-nu-latn", OPTIONS),
};

export function formatDate(date: Date, locale: Locale): string {
  return FORMATS[locale].format(date);
}
