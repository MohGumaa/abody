import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteProduct, ProductStatusControl } from "@/components/admin/ProductActions";
import { ProductFileUpload } from "@/components/admin/ProductFileUpload";
import { ProductForm } from "@/components/admin/ProductForm";
import { ProductStatusChip } from "@/components/admin/ProductStatusChip";
import { ExternalIcon } from "@/components/icons";
import {
  adminMetadata,
  getAdminProduct,
  listAdminCategories,
  requireAdmin,
} from "@/lib/admin";
import { centsToPriceInput } from "@/lib/admin-products";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata({
  params,
}: PageProps<"/admin/products/[id]">): Promise<Metadata> {
  // Only an admin's request reads the product; anyone else gets the 404 title.
  const user = await getCurrentUser();
  const product = user?.role === "ADMIN" ? await getAdminProduct((await params).id) : null;
  return adminMetadata(product ? `Edit ${product.name}` : "Edit product");
}

const CARD =
  "grid content-start gap-4 rounded-card border border-border bg-panel p-5 shadow-soft min-[600px]:p-6";
const BACK_LINK =
  "justify-self-start rounded-control text-sm font-medium text-primary-strong outline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary-strong";

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  await requireAdmin();
  const [product, categories] = await Promise.all([
    getAdminProduct((await params).id),
    listAdminCategories(),
  ]);
  if (!product) notFound();

  const initial = {
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription,
    description: product.description,
    price: centsToPriceInput(product.priceCents),
    category: product.category,
    image: product.image ?? "",
    included: product.included.join("\n"),
    nameAr: product.nameAr ?? "",
    categoryAr: product.categoryAr ?? "",
    shortDescriptionAr: product.shortDescriptionAr ?? "",
    descriptionAr: product.descriptionAr ?? "",
    includedAr: product.includedAr.join("\n"),
  };

  return (
    <>
      <div className="grid gap-1">
        <Link href="/admin/products" className={BACK_LINK}>
          ← All products
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          {/* React text: admin-entered names never render as HTML. */}
          <h1 className="text-2xl font-semibold tracking-tight break-words" dir="auto">
            {product.name}
          </h1>
          <ProductStatusChip status={product.status} />
        </div>
        {product.status === "PUBLISHED" && (
          <Link
            href={`/en/products/${product.slug}`}
            className={`flex items-center gap-1.5 ${BACK_LINK}`}
          >
            View in store
            <ExternalIcon className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="grid items-start gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_22rem]">
        <ProductForm id={product.id} initial={initial} categories={categories} />

        <div className="grid gap-6">
          <section aria-labelledby="product-file-title" className={CARD}>
            <h2 id="product-file-title" className="text-lg font-semibold">
              Downloadable file
            </h2>
            <ProductFileUpload productId={product.id} fileName={product.fileName} />
          </section>
          <section aria-labelledby="product-status-title" className={CARD}>
            <h2 id="product-status-title" className="text-lg font-semibold">
              Visibility
            </h2>
            <ProductStatusControl
              productId={product.id}
              status={product.status}
              hasFile={product.fileName !== null}
            />
          </section>
          <section aria-labelledby="product-delete-title" className={CARD}>
            <h2 id="product-delete-title" className="text-lg font-semibold">
              Delete
            </h2>
            <DeleteProduct productId={product.id} />
          </section>
        </div>
      </div>
    </>
  );
}
