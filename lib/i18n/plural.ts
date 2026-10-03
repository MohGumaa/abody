import type { Locale } from "@/lib/i18n/config";

// No next/* imports here: client components and Vitest load this module.

// One string per plural category; "{count}" is replaced with the number.
// Arabic uses all six categories, English only "one" and "other".
export type PluralForms = Record<Intl.LDMLPluralRule, string>;

// Latin digits in both languages, matching prices and order numbers.
export function formatItemCount(
  locale: Locale,
  count: number,
  forms: PluralForms,
): string {
  const category = new Intl.PluralRules(locale).select(count);
  return forms[category].replace("{count}", String(count));
}
