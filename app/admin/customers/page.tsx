import type { Metadata } from "next";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminMetadata, requireAdmin } from "@/lib/admin";
import { listAdminCustomers } from "@/lib/admin-customers";
import { formatDate } from "@/lib/dates";

export function generateMetadata(): Promise<Metadata> {
  return adminMetadata("Customers");
}

const FOCUS =
  "outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary-strong";
const PAGE_LINK = `rounded-control text-sm font-semibold text-primary-strong hover:text-foreground ${FOCUS}`;

export default async function AdminCustomersPage({
  searchParams,
}: PageProps<"/admin/customers">) {
  await requireAdmin();
  const { customers, page, pageCount, total } = await listAdminCustomers(
    (await searchParams).page,
  );

  return (
    <>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="text-sm text-muted">
          Customer accounts, newest first. Guest orders are in Orders.
        </p>
      </div>

      <section
        aria-labelledby="customers-title"
        className="min-w-0 overflow-hidden rounded-card border border-border bg-panel shadow-soft"
      >
        <h2 id="customers-title" className="sr-only">
          All customers
        </h2>
        {total === 0 ? (
          <div className="p-5 min-[600px]:p-6">
            {/* Not the shared EmptyState: admin links have no hover underline. */}
            <div className="rounded-card bg-surface p-5 text-sm">
              <p className="text-muted">No customers yet.</p>
            </div>
          </div>
        ) : (
          <>
            <Table className="min-w-150">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Customer</TableHead>
                  <TableHead scope="col" className="text-end">Orders</TableHead>
                  <TableHead scope="col">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      {/* React text: names and emails never render as HTML. */}
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        className={`grid max-w-72 rounded-control hover:text-primary-strong ${FOCUS}`}
                      >
                        <span className="font-semibold break-all text-foreground" dir="auto">
                          {customer.name || "No name"}
                        </span>
                        <span className="text-xs break-all text-muted" dir="auto">
                          {customer.email}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{customer.orderCount}</TableCell>
                    <TableCell className="whitespace-nowrap text-faint">
                      {formatDate(customer.createdAt, "en")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {pageCount > 1 && (
              <nav
                aria-label="Customer pages"
                className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 min-[600px]:px-6"
              >
                {page > 1 ? (
                  <Link href={`/admin/customers?page=${page - 1}`} className={PAGE_LINK}>
                    ← Newer
                  </Link>
                ) : (
                  <span />
                )}
                <p className="text-sm text-muted">
                  Page {page} of {pageCount}
                </p>
                {page < pageCount ? (
                  <Link href={`/admin/customers?page=${page + 1}`} className={PAGE_LINK}>
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
