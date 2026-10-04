import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import {
  getPublishedProductBySlug,
  productPath,
  type PublicProduct,
} from "@/lib/catalog";
import type { ProductType } from "@/lib/generated/prisma/enums";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { pageMetadata, socialImageSrc } from "@/lib/seo";

// One query per request, shared by generateMetadata and the page.
const loadProduct = cache(getPublishedProductBySlug);

// Each item has one canonical URL, so the other type's route is a 404 too.
export async function requirePublishedProduct(
  slug: string,
  type: ProductType,
): Promise<PublicProduct> {
  const product = await loadProduct(slug, await getLocale());
  if (!product || product.type !== type) {
    notFound();
  }
  return product;
}

export async function productMetadata(
  slug: string,
  type: ProductType,
): Promise<Metadata> {
  const product = await requirePublishedProduct(slug, type);
  const { meta } = await getDictionary();
  return pageMetadata({
    locale: await getLocale(),
    path: productPath(product),
    title: product.name,
    description: product.shortDescription,
    siteName: meta.title,
    image: socialImageSrc(product.image),
  });
}
