import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { OrderNumber, StatusChip } from "@/components/account/AccountParts";
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
import { getAdminCustomer } from "@/lib/admin-customers";
import { paymentStatusLabel } from "@/lib/admin-orders";
import { formatDate } from "@/lib/dates";
import { en } from "@/lib/i18n/dictionaries/en";
import { formatPriceCents } from "@/lib/money";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata({
  params,
}: PageProps<"/admin/customers/[id]">): Promise<Metadata> {
  // Only an admin's request reads the customer; anyone else gets the 404 title.
  const user = await getCurrentUser();
  const customer = user?.role === "ADMIN" ? await getAdminCustomer((await params).id) : null;
  return adminMetadata(
    customer ? `Customer ${customer.profile.name || customer.profile.email}` : "Customer",
  );
}

const CARD =
  "grid content-start gap-4 rounded-card border border-border bg-panel p-5 shadow-soft min-[600px]:p-6";
const TABLE_CARD =
  "min-w-0 overflow-hidden rounded-card border border-border bg-panel shadow-soft";
const TABLE_TITLE = "px-5 pt-5 text-lg font-semibold min-[600px]:px-6";
const FOCUS =
  "outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary-strong";
const BACK_LINK = `justify-self-start rounded-control text-sm font-medium text-primary-strong hover:text-foreground ${FOCUS}`;
const ROW_LINK = `rounded-control font-semibold text-foreground hover:text-primary-strong ${FOCUS}`;

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="text-sm break-all">{children}</dd>
    </div>
  );
}

// Not the shared EmptyState: admin links have no hover underline.
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="p-5 pt-3 min-[600px]:p-6 min-[600px]:pt-3">
      <div className="rounded-card bg-surface p-5 text-sm">
        <p className="text-muted">{children}</p>
      </div>
    </div>
  );
}

function OrderLink({ id, number }: { id: string; number: number }) {
  return (
    <Link href={`/admin/orders/${id}`} className={`text-xs ${ROW_LINK}`}>
      <OrderNumber number={number} />
    </Link>
  );
}

export default async function AdminCustomerPage({
  params,
}: PageProps<"/admin/customers/[id]">) {
  await requireAdmin();
  const customer = await getAdminCustomer((await params).id);
  if (!customer) notFound();

  const { profile, orders, downloads, services, counts } = customer;

  return (
    <>
      <div className="grid gap-1">
        <Link href="/admin/customers" className={BACK_LINK}>
          ← All customers
        </Link>
        {/* React text: names and emails never render as HTML. */}
        <h1 className="text-2xl font-semibold tracking-tight break-all" dir="auto">
          {profile.name || "No name"}
        </h1>
        <p className="text-sm text-faint">Joined {formatDate(profile.createdAt, "en")}</p>
      </div>

      <div className="grid items-start gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 gap-6">
          <section aria-labelledby="customer-orders-title" className={TABLE_CARD}>
            <h2 id="customer-orders-title" className={TABLE_TITLE}>
              Orders
            </h2>
            {orders.length === 0 ? (
              <Empty>No orders yet.</Empty>
            ) : (
              <Table className="mt-3 min-w-200">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Order</TableHead>
                    <TableHead scope="col">Items</TableHead>
                    <TableHead scope="col" className="text-end">Total</TableHead>
                    <TableHead scope="col">Payment</TableHead>
                    <TableHead scope="col">Status</TableHead>
                    <TableHead scope="col">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <OrderLink id={order.id} number={order.number} />
                      </TableCell>
                      <TableCell>
                        {/* React text: product names never render as HTML. */}
                        <ul className="grid max-w-64 gap-0.5">
                          {order.items.map((item) => (
                            <li key={item.id} className="break-words">
                              <span dir="auto">{item.name}</span>
                              {item.quantity > 1 && (
                                <span className="text-muted tabular-nums"> × {item.quantity}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </TableCell>
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
            )}
          </section>

          <section aria-labelledby="customer-downloads-title" className={TABLE_CARD}>
            <h2 id="customer-downloads-title" className={TABLE_TITLE}>
              Downloads
            </h2>
            {downloads.length === 0 ? (
              <Empty>No downloads. Downloads come from paid digital product orders.</Empty>
            ) : (
              <Table className="mt-3 min-w-150">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Product</TableHead>
                    <TableHead scope="col">Order</TableHead>
                    <TableHead scope="col">Purchased</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {downloads.map((download) => (
                    <TableRow key={download.itemId}>
                      <TableCell>
                        <Link
                          href={`/admin/products/${download.productId}`}
                          className={ROW_LINK}
                          dir="auto"
                        >
                          {download.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <OrderLink id={download.orderId} number={download.orderNumber} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-faint">
                        {formatDate(download.purchasedAt, "en")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          <section aria-labelledby="customer-services-title" className={TABLE_CARD}>
            <h2 id="customer-services-title" className={TABLE_TITLE}>
              Services
            </h2>
            {services.length === 0 ? (
              <Empty>No services. Services come from paid service orders.</Empty>
            ) : (
              <Table className="mt-3 min-w-150">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Service</TableHead>
                    <TableHead scope="col">Order</TableHead>
                    <TableHead scope="col">Status</TableHead>
                    <TableHead scope="col">Purchased</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((service) => (
                    <TableRow key={service.itemId}>
                      <TableCell>
                        <Link
                          href={`/admin/service-orders/${service.itemId}`}
                          className={ROW_LINK}
                          dir="auto"
                        >
                          {service.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <OrderLink id={service.orderId} number={service.orderNumber} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <ServiceStatus status={service.status} />
                          {service.active && (
                            <span className="text-xs font-semibold text-primary-strong">
                              Active
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-faint">
                        {formatDate(service.purchasedAt, "en")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </div>

        <section aria-labelledby="customer-profile-title" className={CARD}>
          <h2 id="customer-profile-title" className="text-lg font-semibold">
            Profile
          </h2>
          <dl className="grid gap-4">
            <Detail label="Name">
              <span dir="auto">{profile.name || "No name"}</span>
            </Detail>
            <Detail label="Email">
              <span dir="auto">{profile.email}</span>
            </Detail>
            <Detail label="Joined">{formatDate(profile.createdAt, "en")}</Detail>
            <Detail label="Orders">{counts.orders}</Detail>
            <Detail label="Downloads">{counts.downloads}</Detail>
            <Detail label="Active services">{counts.activeServices}</Detail>
          </dl>
        </section>
      </div>
    </>
  );
}
