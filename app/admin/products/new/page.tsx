import type { Metadata } from "next";
import Link from "next/link";
import { ProductForm } from "@/components/admin/ProductForm";
import { adminMetadata, requireAdmin } from "@/lib/admin";

export function generateMetadata(): Promise<Metadata> {
  return adminMetadata("New product");
}

export default async function NewProductPage() {
  await requireAdmin();
  return (
    <>
      <div className="grid gap-1">
        <Link
          href="/admin/products"
          className="justify-self-start rounded-control text-sm font-medium text-primary-strong outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary-strong"
        >
          ← All products
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New product</h1>
        <p className="text-sm text-muted">
          The product starts unpublished. Upload its file on the next page, then
          publish it.
        </p>
      </div>
      <div className="max-w-3xl">
        <ProductForm initial={{}} />
      </div>
    </>
  );
}
