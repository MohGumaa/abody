import type { Metadata } from "next";
import Link from "next/link";
import { OrderNumber, StatusChip } from "@/components/account/AccountParts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminMetadata, requireAdmin } from "@/lib/admin";
import { listAdminOrders, paymentStatusLabel } from "@/lib/admin-orders";
import { formatDate } from "@/lib/dates";
import { en } from "@/lib/i18n/dictionaries/en";
import { formatPriceCents } from "@/lib/money";

export function generateMetadata(): Promise<Metadata> {
  return adminMetadata("Orders");
}

const FOCUS =
  "outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary-strong";
const PAGE_LINK = `rounded-control text-sm font-semibold text-primary-strong hover:text-foreground ${FOCUS}`;

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin();
  const { orders, page, pageCount, total } = await listAdminOrders(
    (await searchParams).page,
  );

  return (
    <>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="text-sm text-muted">
          Every order, newest first. Payment status follows Stripe.
        </p>
      </div>

      <section
        aria-labelledby="orders-title"
        className="min-w-0 overflow-hidden rounded-card border border-border bg-panel shadow-soft"
      >
        <h2 id="orders-title" className="sr-only">
          All orders
        </h2>
        {total === 0 ? (
          <div className="p-5 min-[600px]:p-6">
            {/* Not the shared EmptyState: admin links have no hover underline. */}
            <div className="rounded-card bg-surface p-5 text-sm">
              <p className="text-muted">No orders yet.</p>
            </div>
          </div>
        ) : (
          <>
            <Table className="min-w-200">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Order</TableHead>
                  <TableHead scope="col">Customer</TableHead>
                  <TableHead scope="col" className="text-end">Items</TableHead>
                  <TableHead scope="col" className="text-end">Total</TableHead>
                  <TableHead scope="col">Payment</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="text-xs">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className={`rounded-control text-foreground hover:text-primary-strong ${FOCUS}`}
                      >
                        <OrderNumber number={order.number} />
                      </Link>
                    </TableCell>
                    <TableCell>
                      {/* React text: names and emails never render as HTML. */}
                      <span className="block max-w-56 break-all" dir="auto">
                        {order.customer}
                      </span>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{order.itemCount}</TableCell>
                    <TableCell className="text-end font-semibold tabular-nums">
                      {formatPriceCents(order.totalCents)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted">
                      {paymentStatusLabel(order.status)}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={order.status} text={en.account} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-faint">
                      {formatDate(order.createdAt, "en")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {pageCount > 1 && (
              <nav
                aria-label="Order pages"
                className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 min-[600px]:px-6"
              >
                {page > 1 ? (
                  <Link href={`/admin/orders?page=${page - 1}`} className={PAGE_LINK}>
                    ← Newer
                  </Link>
                ) : (
                  <span />
                )}
                <p className="text-sm text-muted">
                  Page {page} of {pageCount}
                </p>
                {page < pageCount ? (
                  <Link href={`/admin/orders?page=${page + 1}`} className={PAGE_LINK}>
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
