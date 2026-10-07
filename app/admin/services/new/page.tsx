import type { Metadata } from "next";
import Link from "next/link";
import { ProductForm } from "@/components/admin/ProductForm";
import { adminMetadata, listAdminCategories, requireAdmin } from "@/lib/admin";

export function generateMetadata(): Promise<Metadata> {
  return adminMetadata("New service");
}

export default async function NewServicePage() {
  await requireAdmin();
  const categories = await listAdminCategories("SERVICE");
  return (
    <>
      <div className="grid gap-1">
        <Link
          href="/admin/services"
          className="justify-self-start rounded-control text-sm font-medium text-primary-strong outline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary-strong"
        >
          ← All services
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New service</h1>
        <p className="text-sm text-muted">
          The service starts unpublished. Publish it from the next page when it
          is ready.
        </p>
      </div>
      <div className="max-w-3xl">
        <ProductForm type="SERVICE" initial={{}} categories={categories} />
      </div>
    </>
  );
}
