import type { Metadata } from "next";
import Link from "next/link";
import { OrderNumber } from "@/components/account/AccountParts";
import { ServiceStatus } from "@/components/admin/ServiceStatus";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminMetadata, requireAdmin } from "@/lib/admin";
import { listServiceOrders } from "@/lib/admin-service-work";
import { formatDate } from "@/lib/dates";

export function generateMetadata(): Promise<Metadata> {
  return adminMetadata("Service orders");
}

const FOCUS =
  "outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary-strong";
const PAGE_LINK = `rounded-control text-sm font-semibold text-primary-strong hover:text-foreground ${FOCUS}`;
const ROW_LINK = `rounded-control text-foreground hover:text-primary-strong ${FOCUS}`;

export default async function AdminServiceOrdersPage({
  searchParams,
}: PageProps<"/admin/service-orders">) {
  await requireAdmin();
  const { items, page, pageCount, total } = await listServiceOrders(
    (await searchParams).page,
  );

  return (
    <>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Service orders</h1>
        <p className="text-sm text-muted">
          Services bought in paid orders, newest first. Open one to update its work.
        </p>
      </div>

      <section
        aria-labelledby="service-orders-title"
        className="min-w-0 overflow-hidden rounded-card border border-border bg-panel shadow-soft"
      >
        <h2 id="service-orders-title" className="sr-only">
          All service orders
        </h2>
        {total === 0 ? (
          <div className="p-5 min-[600px]:p-6">
            {/* Not the shared EmptyState: admin links have no hover underline. */}
            <div className="rounded-card bg-surface p-5 text-sm">
              <p className="text-muted">No services have been bought yet.</p>
            </div>
          </div>
        ) : (
          <>
            <Table className="min-w-200">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Service</TableHead>
                  <TableHead scope="col">Customer</TableHead>
                  <TableHead scope="col">Order</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col">Purchased</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.itemId}>
                    <TableCell>
                      {/* React text: names never render as HTML. */}
                      <Link
                        href={`/admin/service-orders/${item.itemId}`}
                        className={`font-semibold ${ROW_LINK}`}
                        dir="auto"
                      >
                        {item.serviceName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-56 break-all" dir="auto">
                        {item.customer}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Link href={`/admin/orders/${item.orderId}`} className={ROW_LINK}>
                        <OrderNumber number={item.orderNumber} />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <ServiceStatus status={item.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-faint">
                      {formatDate(item.purchasedAt, "en")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {pageCount > 1 && (
              <nav
                aria-label="Service order pages"
                className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 min-[600px]:px-6"
              >
                {page > 1 ? (
                  <Link href={`/admin/service-orders?page=${page - 1}`} className={PAGE_LINK}>
                    ← Newer
                  </Link>
                ) : (
                  <span />
                )}
                <p className="text-sm text-muted">
                  Page {page} of {pageCount}
                </p>
                {page < pageCount ? (
                  <Link href={`/admin/service-orders?page=${page + 1}`} className={PAGE_LINK}>
                    Older →
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </>
        )}
      </section>
    </>
  );
}
