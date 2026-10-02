import type { Metadata } from "next";
import { ProductDetail } from "@/components/catalog/ProductDetail";
import { ProductType } from "@/lib/generated/prisma/enums";
import { requirePublishedProduct } from "@/lib/product-page";

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await requirePublishedProduct(
    slug,
    ProductType.DIGITAL_PRODUCT,
  );
  return { title: product.name, description: product.shortDescription };
}

export default async function ProductPage({
  params,
}: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await requirePublishedProduct(
    slug,
    ProductType.DIGITAL_PRODUCT,
  );
  return <ProductDetail product={product} />;
}
