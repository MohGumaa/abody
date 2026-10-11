// No next/* or db imports here: Vitest loads this module directly.
import { ProductType } from "@/lib/generated/prisma/enums";
import { summarizeCategories } from "@/lib/listing";

// Mockup row sizes: four featured products, two service cards.
const FEATURED_LIMIT = 4;
const SERVICES_LIMIT = 2;

export interface HomeCategory {
  type: ProductType;
  category: string;
  label: string;
  count: number;
}

export interface HomeSections<T> {
  heroProduct: T | null;
  featured: T[];
  services: T[];
  categories: HomeCategory[];
}

// Picks first by featured position (feature 21a), then the rest. The sort is
// stable, so equal positions and unpicked items keep the input order.
function featuredFirst<T extends { featuredRank: number | null }>(items: T[]): T[] {
  const rank = (item: T) => item.featuredRank ?? Number.MAX_SAFE_INTEGER;
  return [...items].sort((a, b) => rank(a) - rank(b));
}

// Items arrive newest first, so open slots fill with the newest unpicked
// items, and with no picks the rows show the newest. Product categories come
// before service categories.
export function selectHomeSections<
  T extends {
    type: ProductType;
    category: string;
    categoryLabel: string;
    featuredRank: number | null;
  },
>(items: T[]): HomeSections<T> {
  const products = featuredFirst(
    items.filter((item) => item.type === ProductType.DIGITAL_PRODUCT),
  );
  const services = featuredFirst(
    items.filter((item) => item.type === ProductType.SERVICE),
  );

  return {
    heroProduct: products[0] ?? null,
    featured: products.slice(0, FEATURED_LIMIT),
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
