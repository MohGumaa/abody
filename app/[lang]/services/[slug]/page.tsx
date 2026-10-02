import type { Metadata } from "next";
import { ProductDetail } from "@/components/catalog/ProductDetail";
import { ProductType } from "@/lib/generated/prisma/enums";
import { requirePublishedProduct } from "@/lib/product-page";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/services/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await requirePublishedProduct(slug, ProductType.SERVICE);
  return { title: product.name, description: product.shortDescription };
}

export default async function ServicePage({
  params,
}: PageProps<"/[lang]/services/[slug]">) {
  const { slug } = await params;
  const product = await requirePublishedProduct(slug, ProductType.SERVICE);
  return <ProductDetail product={product} />;
}
