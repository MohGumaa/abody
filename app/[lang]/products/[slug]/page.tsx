import type { Metadata } from "next";
import { ProductDetail } from "@/components/catalog/ProductDetail";
import { ProductJsonLd } from "@/components/catalog/ProductJsonLd";
import { ProductType } from "@/lib/generated/prisma/enums";
import { productMetadata, requirePublishedProduct } from "@/lib/product-page";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return productMetadata(slug, ProductType.DIGITAL_PRODUCT);
}

export default async function ProductPage({
  params,
}: PageProps<"/[lang]/products/[slug]">) {
  const { slug } = await params;
  const product = await requirePublishedProduct(
    slug,
    ProductType.DIGITAL_PRODUCT,
  );
  return (
    <>
      <ProductJsonLd product={product} />
      <ProductDetail product={product} />
    </>
  );
}
