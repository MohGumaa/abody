import type { Metadata } from "next";
import { ProductDetail } from "@/components/catalog/ProductDetail";
import { ProductJsonLd } from "@/components/catalog/ProductJsonLd";
import { ProductType } from "@/lib/generated/prisma/enums";
import { productMetadata, requirePublishedProduct } from "@/lib/product-page";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/services/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return productMetadata(slug, ProductType.SERVICE);
}

export default async function ServicePage({
  params,
}: PageProps<"/[lang]/services/[slug]">) {
  const { slug } = await params;
  const product = await requirePublishedProduct(slug, ProductType.SERVICE);
  return (
    <>
      <ProductJsonLd product={product} />
      <ProductDetail product={product} />
    </>
  );
}
