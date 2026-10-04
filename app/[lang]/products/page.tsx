import type { Metadata } from "next";
import {
  listingMetadata,
  StoreListing,
} from "@/components/catalog/StoreListing";
import { ProductType } from "@/lib/generated/prisma/enums";
import { parseCategoryParam } from "@/lib/listing";

export function generateMetadata(): Promise<Metadata> {
  return listingMetadata(ProductType.DIGITAL_PRODUCT);
}

export default async function ProductsPage({
  searchParams,
}: PageProps<"/[lang]/products">) {
  const { category } = await searchParams;
  return (
    <StoreListing
      type={ProductType.DIGITAL_PRODUCT}
      category={parseCategoryParam(category)}
    />
  );
}
