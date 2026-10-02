import { cache } from "react";
import { notFound } from "next/navigation";
import { getPublishedProductBySlug, type PublicProduct } from "@/lib/catalog";
import type { ProductType } from "@/lib/generated/prisma/enums";

// One query per request, shared by generateMetadata and the page.
const loadProduct = cache(getPublishedProductBySlug);

// Each item has one canonical URL, so the other type's route is a 404 too.
export async function requirePublishedProduct(
  slug: string,
  type: ProductType,
): Promise<PublicProduct> {
  const product = await loadProduct(slug);
  if (!product || product.type !== type) {
    notFound();
  }
  return product;
}
