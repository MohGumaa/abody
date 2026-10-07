import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { OrderNumber, StatusChip } from "@/components/account/AccountParts";
import { OrderRefund } from "@/components/admin/OrderRefund";
import { OrderStatusControl } from "@/components/admin/OrderStatusControl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminMetadata, requireAdmin } from "@/lib/admin";
import {
  getAdminOrder,
  isFulfilmentStatus,
  paymentStatusLabel,
} from "@/lib/admin-orders";
import { formatDate } from "@/lib/dates";
import { en } from "@/lib/i18n/dictionaries/en";
import { formatPriceCents } from "@/lib/money";
import { formatOrderNumber } from "@/lib/orders";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata({
  params,
}: PageProps<"/admin/orders/[id]">): Promise<Metadata> {
  // Only an admin's request reads the order; anyone else gets the 404 title.
  const user = await getCurrentUser();
  const order = user?.role === "ADMIN" ? await getAdminOrder((await params).id) : null;
  return adminMetadata(order ? `Order ${formatOrderNumber(order.number)}` : "Order");
}

const CARD =
  "grid content-start gap-4 rounded-card border border-border bg-panel p-5 shadow-soft min-[600px]:p-6";
const FOCUS =
  "outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary-strong";
const BACK_LINK = `justify-self-start rounded-control text-sm font-medium text-primary-strong hover:text-foreground ${FOCUS}`;

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="text-sm break-all">{children}</dd>
    </div>
  );
}

export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  await requireAdmin();
  const order = await getAdminOrder((await params).id);
  if (!order) notFound();

  const email = order.user?.email ?? order.customerEmail;

  return (
    <>
      <div className="grid gap-1">
        <Link href="/admin/orders" className={BACK_LINK}>
          ← All orders
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Order <OrderNumber number={order.number} />
          </h1>
          <StatusChip status={order.status} text={en.account} />
        </div>
        <p className="text-sm text-faint">Placed {formatDate(order.createdAt, "en")}</p>
      </div>

      <div className="grid items-start gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 gap-6">
          <section
            aria-labelledby="order-items-title"
            className="min-w-0 overflow-hidden rounded-card border border-border bg-panel shadow-soft"
          >
            <h2 id="order-items-title" className="px-5 pt-5 text-lg font-semibold min-[600px]:px-6">
              Items
            </h2>
            <Table className="mt-3 min-w-150">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Item</TableHead>
                  <TableHead scope="col">Type</TableHead>
                  <TableHead scope="col" className="text-end">Price</TableHead>
                  <TableHead scope="col" className="text-end">Qty</TableHead>
                  <TableHead scope="col" className="text-end">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => {
                  const isService = item.product.type === "SERVICE";
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        {/* React text: product names never render as HTML. */}
                        <Link
                          href={`/admin/${isService ? "services" : "products"}/${item.product.id}`}
                          className={`rounded-control font-semibold text-foreground hover:text-primary-strong ${FOCUS}`}
                          dir="auto"
                        >
                          {item.product.name}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted">
                        {isService ? "Service" : "Digital product"}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {formatPriceCents(item.priceCents)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{item.quantity}</TableCell>
                      <TableCell className="text-end font-semibold tabular-nums">
                        {formatPriceCents(item.priceCents * item.quantity)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell colSpan={4} className="text-end font-semibold">
                    Order total
                  </TableCell>
                  <TableCell className="text-end font-semibold tabular-nums">
                    {formatPriceCents(order.totalCents)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </section>

          <section aria-labelledby="order-payment-title" className={CARD}>
            <h2 id="order-payment-title" className="text-lg font-semibold">
              Payment
            </h2>
            <dl className="grid gap-4 min-[600px]:grid-cols-2">
              <Detail label="Payment status">{paymentStatusLabel(order.status)}</Detail>
              <Detail label="Amount">
                {formatPriceCents(order.totalCents)} {order.currency.toUpperCase()}
              </Detail>
              <Detail label="Stripe payment intent">
                <span dir="ltr" className="font-mono text-xs">
                  {order.stripePaymentIntentId ?? "Not recorded"}
                </span>
              </Detail>
              <Detail label="Stripe Checkout session">
                <span dir="ltr" className="font-mono text-xs">
                  {order.stripeCheckoutSessionId}
                </span>
              </Detail>
            </dl>
          </section>
        </div>

        <div className="grid gap-6">
          <section aria-labelledby="order-customer-title" className={CARD}>
            <h2 id="order-customer-title" className="text-lg font-semibold">
              Customer
            </h2>
            <dl className="grid gap-4">
              {/* React text: names and emails never render as HTML. */}
              <Detail label="Name">
                <span dir="auto">{order.user ? order.user.name || "No name" : "Guest"}</span>
              </Detail>
              <Detail label="Email">
                <span dir="auto">{email ?? "Not recorded"}</span>
              </Detail>
              <Detail label="Account">{order.user ? "Signed in at checkout" : "Guest checkout"}</Detail>
            </dl>
          </section>

          <section aria-labelledby="order-status-title" className={CARD}>
            <h2 id="order-status-title" className="text-lg font-semibold">
              Fulfilment
            </h2>
            {isFulfilmentStatus(order.status) ? (
              <OrderStatusControl orderId={order.id} status={order.status} />
            ) : (
              <p className="text-sm text-muted">
                Status follows Stripe. Pending, Cancelled, and Refunded orders cannot be
                changed here.
              </p>
            )}
          </section>

          {/* Only paid orders can be refunded; others follow Stripe. */}
          {isFulfilmentStatus(order.status) && (
            <section aria-labelledby="order-refund-title" className={CARD}>
              <h2 id="order-refund-title" className="text-lg font-semibold">
                Refund
              </h2>
              {order.stripePaymentIntentId ? (
                <OrderRefund
                  orderId={order.id}
                  amount={`${formatPriceCents(order.totalCents)} ${order.currency.toUpperCase()}`}
                />
              ) : (
                <p className="text-sm text-muted">
                  No Stripe payment is recorded for this order, so it can&apos;t be refunded
                  here. Refund it in the Stripe dashboard.
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
