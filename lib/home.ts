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

// Items arrive newest first, so "featured" means newest until feature 21 adds
// curated picks. Product categories come before service categories.
export function selectHomeSections<
  T extends { type: ProductType; category: string; categoryLabel: string },
>(items: T[]): HomeSections<T> {
  const products = items.filter(
    (item) => item.type === ProductType.DIGITAL_PRODUCT,
  );
  const services = items.filter((item) => item.type === ProductType.SERVICE);

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
