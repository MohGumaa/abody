import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteProduct, ProductStatusControl } from "@/components/admin/ProductActions";
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
}: PageProps<"/admin/services/[id]">): Promise<Metadata> {
  // Only an admin's request reads the service; anyone else gets the 404 title.
  const user = await getCurrentUser();
  const service =
    user?.role === "ADMIN" ? await getAdminProduct((await params).id, "SERVICE") : null;
  return adminMetadata(service ? `Edit ${service.name}` : "Edit service");
}

const CARD =
  "grid content-start gap-4 rounded-card border border-border bg-panel p-5 shadow-soft min-[600px]:p-6";
const BACK_LINK =
  "justify-self-start rounded-control text-sm font-medium text-primary-strong outline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary-strong";

export default async function EditServicePage({ params }: PageProps<"/admin/services/[id]">) {
  await requireAdmin();
  const [service, categories] = await Promise.all([
    getAdminProduct((await params).id, "SERVICE"),
    listAdminCategories("SERVICE"),
  ]);
  if (!service) notFound();

  const initial = {
    name: service.name,
    slug: service.slug,
    shortDescription: service.shortDescription,
    description: service.description,
    price: centsToPriceInput(service.priceCents),
    durationDays: service.durationDays === null ? "" : String(service.durationDays),
    category: service.category,
    image: service.image ?? "",
    included: service.included.join("\n"),
    requirements: service.requirements ?? "",
    nameAr: service.nameAr ?? "",
    categoryAr: service.categoryAr ?? "",
    shortDescriptionAr: service.shortDescriptionAr ?? "",
    descriptionAr: service.descriptionAr ?? "",
    includedAr: service.includedAr.join("\n"),
    requirementsAr: service.requirementsAr ?? "",
  };

  return (
    <>
      <div className="grid gap-1">
        <Link href="/admin/services" className={BACK_LINK}>
          ← All services
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          {/* React text: admin-entered names never render as HTML. */}
          <h1 className="text-2xl font-semibold tracking-tight wrap-break-word" dir="auto">
            {service.name}
          </h1>
          <ProductStatusChip status={service.status} />
        </div>
        {service.status === "PUBLISHED" && (
          <Link
            href={`/en/services/${service.slug}`}
            className={`flex items-center gap-1.5 ${BACK_LINK}`}
          >
            View in store
            <ExternalIcon className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="grid items-start gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_22rem]">
        <ProductForm type="SERVICE" id={service.id} initial={initial} categories={categories} />

        <div className="grid gap-6">
          <section aria-labelledby="service-status-title" className={CARD}>
            <h2 id="service-status-title" className="text-lg font-semibold">
              Visibility
            </h2>
            <ProductStatusControl
              type="SERVICE"
              productId={service.id}
              status={service.status}
              hasFile={false}
            />
          </section>
          <section aria-labelledby="service-delete-title" className={CARD}>
            <h2 id="service-delete-title" className="text-lg font-semibold">
              Delete
            </h2>
            <DeleteProduct type="SERVICE" productId={service.id} />
          </section>
        </div>
      </div>
    </>
  );
}
