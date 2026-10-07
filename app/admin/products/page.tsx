import type { Metadata } from "next";
import Link from "next/link";
import { ProductStatusChip } from "@/components/admin/ProductStatusChip";
import { PlusIcon } from "@/components/icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
            {/* Not the shared EmptyState: admin links have no hover underline. */}
            <div className="grid justify-items-start gap-3 rounded-card bg-surface p-5 text-sm">
              <p className="text-muted">No products yet.</p>
              <Link
                href="/admin/products/new"
                className={`rounded-control font-semibold text-primary-strong hover:text-foreground ${FOCUS}`}
              >
                Create the first product
              </Link>
            </div>
          </div>
        ) : (
          <Table className="min-w-190">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Product</TableHead>
                <TableHead scope="col">Category</TableHead>
                <TableHead scope="col" className="text-end">Price</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col">File</TableHead>
                <TableHead scope="col">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {/* React text: admin-entered names never render as HTML. */}
                    <Link
                      href={`/admin/products/${product.id}`}
                      className={`rounded-control font-semibold text-foreground hover:text-primary-strong ${FOCUS}`}
                      dir="auto"
                    >
                      {product.name}
                    </Link>
                    <span className="block text-xs text-faint">{product.slug}</span>
                  </TableCell>
                  <TableCell className="text-muted" dir="auto">
                    {product.category}
                  </TableCell>
                  <TableCell className="text-end font-semibold tabular-nums">
                    {formatPriceCents(product.priceCents)}
                  </TableCell>
                  <TableCell>
                    <ProductStatusChip status={product.status} />
                  </TableCell>
                  <TableCell>
                    {product.hasFile ? (
                      <span className="text-success">Attached</span>
                    ) : (
                      <span className="font-medium text-warning">Missing</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-faint">
                    {formatDate(product.updatedAt, "en")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </>
  );
}
