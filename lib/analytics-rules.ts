import type { ProductType } from "@/lib/generated/prisma/enums";
import { isLocale, type Locale } from "@/lib/i18n/config";

// Pure rules for store analytics (feature 23): which beacon paths count, the
// report periods, and the report math. No database or request access here.

const PATH_MAX_LENGTH = 200;
// "/en" or "/ar", then up to six segments of letters, digits, "-", and "_".
// No query, hash, trailing slash, dot, or encoded character, so file and
// _next paths never match.
const TRACKED_PATH = /^\/(en|ar)((?:\/[A-Za-z0-9_-]{1,100}){0,6})$/;

const DETAIL_SECTIONS: Record<string, ProductType> = {
  products: "DIGITAL_PRODUCT",
  services: "SERVICE",
};

export interface TrackedPath {
  path: string;
  locale: Locale;
  // A product or service detail page; the slug still has to match a
  // published product of that type before the view names it.
  detail: { type: ProductType; slug: string } | null;
}

export function parseTrackedPath(value: unknown): TrackedPath | null {
  if (typeof value !== "string" || value.length > PATH_MAX_LENGTH) return null;
  const match = TRACKED_PATH.exec(value);
  if (!match || !isLocale(match[1])) return null;

  const segments = match[2].split("/").slice(1);
  const type = segments.length === 2 ? DETAIL_SECTIONS[segments[0]] : undefined;
  return {
    path: value,
    locale: match[1],
    detail: type ? { type, slug: segments[1] } : null,
  };
}

export const RANGE_DAYS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_DAYS)[number];
export const DEFAULT_RANGE_DAYS: RangeDays = 30;

// The ?range= value; anything but 7, 30, or 90 shows the default period.
export function parseRangeDays(value: unknown): RangeDays {
  return RANGE_DAYS.find((days) => value === String(days)) ?? DEFAULT_RANGE_DAYS;
}

// 00:00 UTC on the first day of the period: 7 days is today and the 6 before.
export function rangeStart(days: RangeDays, now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)),
  );
}

// Whole percent of `whole` that reached `part`; null when nothing could.
export function conversionRate(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 100);
}

export interface PopularProduct {
  id: string;
  name: string;
  type: ProductType;
  views: number;
  addsToCart: number;
  unitsSold: number;
  salesCents: number;
}

export const POPULAR_PRODUCTS_LIMIT = 10;

export function rankPopularProducts(
  products: readonly PopularProduct[],
): PopularProduct[] {
  return [...products]
    .sort(
      (a, b) =>
        b.unitsSold - a.unitsSold ||
        b.salesCents - a.salesCents ||
        b.views - a.views ||
        a.name.localeCompare(b.name),
    )
    .slice(0, POPULAR_PRODUCTS_LIMIT);
}
