import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { ProductStatus, ProductType } from "@/lib/generated/prisma/enums";

// The only fields public code may read. digitalFile and status stay out of the
// query itself so a private file reference can never reach a response.
const publicProductSelect = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  description: true,
  priceCents: true,
  type: true,
  category: true,
  image: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

type PublicProductRow = Prisma.ProductGetPayload<{
  select: typeof publicProductSelect;
}>;

export interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  priceCents: number;
  currency: "USD";
  type: ProductType;
  category: string;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

export function isProductType(value: string): value is ProductType {
  return value === ProductType.DIGITAL_PRODUCT || value === ProductType.SERVICE;
}

export function toPublicProduct(row: PublicProductRow): PublicProduct {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortDescription: row.shortDescription,
    description: row.description,
    priceCents: row.priceCents,
    currency: "USD",
    type: row.type,
    category: row.category,
    image: row.image,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPublishedProducts(
  options: { type?: ProductType } = {},
): Promise<PublicProduct[]> {
  const rows = await db.product.findMany({
    where: { status: ProductStatus.PUBLISHED, type: options.type },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: publicProductSelect,
  });
  return rows.map(toPublicProduct);
}

export async function getPublishedProductBySlug(
  slug: string,
): Promise<PublicProduct | null> {
  const row = await db.product.findFirst({
    where: { slug, status: ProductStatus.PUBLISHED },
    select: publicProductSelect,
  });
  return row ? toPublicProduct(row) : null;
}
