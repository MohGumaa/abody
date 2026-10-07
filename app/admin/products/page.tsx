import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/account/AccountParts";
import { ProductStatusChip } from "@/components/admin/ProductStatusChip";
import { PlusIcon } from "@/components/icons";
import { adminMetadata, listAdminProducts, requireAdmin } from "@/lib/admin";
import { formatDate } from "@/lib/dates";
import { formatPriceCents } from "@/lib/money";

export function generateMetadata(): Promise<Metadata> {
  return adminMetadata("Products");
}

const FOCUS =
  "outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary-strong";

export default async function AdminProductsPage() {
  await requireAdmin();
  const products = await listAdminProducts();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted">
            Digital products customers download after paying.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className={`flex h-11 items-center gap-2 rounded-control bg-primary-strong px-5 text-sm font-semibold text-white hover:shadow-raised ${FOCUS}`}
        >
          <PlusIcon className="h-4 w-4" />
          New product
        </Link>
      </div>

      <section
        aria-labelledby="products-title"
        className="min-w-0 overflow-hidden rounded-card border border-border bg-panel shadow-soft"
      >
        <h2 id="products-title" className="sr-only">
          All products
        </h2>
        {products.length === 0 ? (
          <div className="p-5 min-[600px]:p-6">
            <EmptyState
              message="No products yet."
              action={{ href: "/admin/products/new", label: "Create the first product" }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-190 text-left text-sm">
              <thead className="bg-surface text-[0.6875rem] tracking-wider text-faint uppercase">
                <tr>
                  <th scope="col" className="px-6 py-3 font-semibold">Product</th>
                  <th scope="col" className="px-6 py-3 font-semibold">Category</th>
                  <th scope="col" className="px-6 py-3 text-end font-semibold">Price</th>
                  <th scope="col" className="px-6 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-6 py-3 font-semibold">File</th>
                  <th scope="col" className="px-6 py-3 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-t border-border hover:bg-surface/60">
                    <td className="px-6 py-4">
                      {/* React text: admin-entered names never render as HTML. */}
                      <Link
                        href={`/admin/products/${product.id}`}
                        className={`rounded-control font-semibold text-foreground hover:text-primary-strong hover:underline ${FOCUS}`}
                        dir="auto"
                      >
                        {product.name}
                      </Link>
                      <span className="block text-xs text-faint">{product.slug}</span>
                    </td>
                    <td className="px-6 py-4 text-muted" dir="auto">
                      {product.category}
                    </td>
                    <td className="px-6 py-4 text-end font-semibold tabular-nums">
                      {formatPriceCents(product.priceCents)}
                    </td>
                    <td className="px-6 py-4">
                      <ProductStatusChip status={product.status} />
                    </td>
                    <td className="px-6 py-4">
                      {product.hasFile ? (
                        <span className="text-success">Attached</span>
                      ) : (
                        <span className="font-medium text-warning">Missing</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-faint">
                      {formatDate(product.updatedAt, "en")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
