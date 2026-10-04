import type { Metadata } from "next";
import {
  listingMetadata,
  StoreListing,
} from "@/components/catalog/StoreListing";
import { ProductType } from "@/lib/generated/prisma/enums";
import { parseCategoryParam } from "@/lib/listing";

export function generateMetadata(): Promise<Metadata> {
  return listingMetadata(ProductType.SERVICE);
}

export default async function ServicesPage({
  searchParams,
}: PageProps<"/[lang]/services">) {
  const { category } = await searchParams;
  return (
    <StoreListing
      type={ProductType.SERVICE}
      category={parseCategoryParam(category)}
    />
  );
}
