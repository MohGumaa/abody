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
import { formatDurationDays } from "@/lib/catalog";
import { formatDate } from "@/lib/dates";
import { formatPriceCents } from "@/lib/money";

export function generateMetadata(): Promise<Metadata> {
  return adminMetadata("Services");
}

const FOCUS =
  "outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary-strong";

export default async function AdminServicesPage() {
  await requireAdmin();
  const services = await listAdminProducts("SERVICE");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
          <p className="text-sm text-muted">
            Services customers buy, then send their requirements for.
          </p>
        </div>
        <Link
          href="/admin/services/new"
          className={`flex h-11 items-center gap-2 rounded-control bg-primary-strong px-5 text-sm font-semibold text-white hover:shadow-raised ${FOCUS}`}
        >
          <PlusIcon className="h-4 w-4" />
          New service
        </Link>
      </div>

      <section
        aria-labelledby="services-title"
        className="min-w-0 overflow-hidden rounded-card border border-border bg-panel shadow-soft"
      >
        <h2 id="services-title" className="sr-only">
          All services
        </h2>
        {services.length === 0 ? (
          <div className="p-5 min-[600px]:p-6">
            {/* Not the shared EmptyState: admin links have no hover underline. */}
            <div className="grid justify-items-start gap-3 rounded-card bg-surface p-5 text-sm">
              <p className="text-muted">No services yet.</p>
              <Link
                href="/admin/services/new"
                className={`rounded-control font-semibold text-primary-strong hover:text-foreground ${FOCUS}`}
              >
                Create the first service
              </Link>
            </div>
          </div>
        ) : (
          <Table className="min-w-190">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Service</TableHead>
                <TableHead scope="col">Category</TableHead>
                <TableHead scope="col" className="text-end">Price</TableHead>
                <TableHead scope="col">Duration</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell>
                    {/* React text: admin-entered names never render as HTML. */}
                    <Link
                      href={`/admin/services/${service.id}`}
                      className={`rounded-control font-semibold text-foreground hover:text-primary-strong ${FOCUS}`}
                      dir="auto"
                    >
                      {service.name}
                    </Link>
                    <span className="block text-xs text-faint">{service.slug}</span>
                  </TableCell>
                  <TableCell className="text-muted" dir="auto">
                    {service.category}
                  </TableCell>
                  <TableCell className="text-end font-semibold tabular-nums">
                    {formatPriceCents(service.priceCents)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted">
                    {service.durationDays ? (
                      formatDurationDays(service.durationDays, "en")
                    ) : (
                      <>
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">None</span>
                      </>
                    )}
                  </TableCell>
                  <TableCell>
                    <ProductStatusChip status={service.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-faint">
                    {formatDate(service.updatedAt, "en")}
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
