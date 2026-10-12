// No next/* or db imports here: Vitest loads this module directly.
import { ProductType } from "@/lib/generated/prisma/enums";
import { summarizeCategories } from "@/lib/listing";

// Row sizes: three featured products, two service cards.
const FEATURED_LIMIT = 3;
const SERVICES_LIMIT = 2;
// Admins type the category key, so the match ignores case and outer spaces.
const TEMPLATES_CATEGORY = "templates";

export interface HomeCategory {
  type: ProductType;
  category: string;
  label: string;
  count: number;
}

export interface FeaturedTabs<T> {
  bestSellers: T[];
  newest: T[];
  templates: T[];
}

export interface HomeSections<T> {
  heroProduct: T | null;
  featuredTabs: FeaturedTabs<T>;
  services: T[];
  categories: HomeCategory[];
}

// Picks first by featured position (feature 21a), then the rest. The sort is
// stable, so equal positions and unpicked items keep the input order.
function featuredFirst<T extends { featuredRank: number | null }>(items: T[]): T[] {
  const rank = (item: T) => item.featuredRank ?? Number.MAX_SAFE_INTEGER;
  return [...items].sort((a, b) => rank(a) - rank(b));
}

// Most units sold first. The sort is stable, so equal counts, including
// products that never sold, stay newest first.
function bestSellingFirst<T extends { id: string }>(
  items: T[],
  unitsSold: ReadonlyMap<string, number>,
): T[] {
  const units = (item: T) => unitsSold.get(item.id) ?? 0;
  return [...items].sort((a, b) => units(b) - units(a));
}

function isTemplate(item: { category: string }): boolean {
  return item.category.trim().toLowerCase() === TEMPLATES_CATEGORY;
}

// Items arrive newest first, so open slots fill with the newest unpicked
// items, and with no picks the hero and services show the newest. The
// featured tabs ignore picks (feature 29a). Product categories come before
// service categories.
export function selectHomeSections<
  T extends {
    id: string;
    type: ProductType;
    category: string;
    categoryLabel: string;
    featuredRank: number | null;
  },
>(items: T[], unitsSold: ReadonlyMap<string, number>): HomeSections<T> {
  const newest = items.filter((item) => item.type === ProductType.DIGITAL_PRODUCT);
  const products = featuredFirst(newest);
  const services = featuredFirst(
    items.filter((item) => item.type === ProductType.SERVICE),
  );

  return {
    heroProduct: products[0] ?? null,
    featuredTabs: {
      bestSellers: bestSellingFirst(newest, unitsSold).slice(0, FEATURED_LIMIT),
      newest: newest.slice(0, FEATURED_LIMIT),
      templates: newest.filter(isTemplate).slice(0, FEATURED_LIMIT),
    },
    services: services.slice(0, SERVICES_LIMIT),
    categories: [
      ...summarizeCategories(products).map((summary) => ({
        type: ProductType.DIGITAL_PRODUCT,
        ...summary,
      })),
      ...summarizeCategories(services).map((summary) => ({
        type: ProductType.SERVICE,
        ...summary,
      })),
    ],
  };
}
