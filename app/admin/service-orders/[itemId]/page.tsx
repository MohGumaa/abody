import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { OrderNumber } from "@/components/account/AccountParts";
import { ServiceStatus } from "@/components/admin/ServiceStatus";
import { ServiceWorkForm } from "@/components/admin/ServiceWorkForm";
import { OnboardingAnswers } from "@/components/onboarding/OnboardingAnswers";
import { adminMetadata, requireAdmin } from "@/lib/admin";
import { getServiceOrder } from "@/lib/admin-service-work";
import { formatDate } from "@/lib/dates";
import { en } from "@/lib/i18n/dictionaries/en";
import { readRequirements } from "@/lib/onboarding";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata({
  params,
}: PageProps<"/admin/service-orders/[itemId]">): Promise<Metadata> {
  // Only an admin's request reads the item; anyone else gets the 404 title.
  const user = await getCurrentUser();
  const item =
    user?.role === "ADMIN" ? await getServiceOrder((await params).itemId) : null;
  return adminMetadata(item ? `Service order ${item.product.name}` : "Service order");
}

const CARD =
  "grid content-start gap-4 rounded-card border border-border bg-panel p-5 shadow-soft min-[600px]:p-6";
const FOCUS =
  "outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary-strong";
const BACK_LINK = `justify-self-start rounded-control text-sm font-medium text-primary-strong hover:text-foreground ${FOCUS}`;
const TEXT_LINK = `rounded-control font-semibold text-foreground hover:text-primary-strong ${FOCUS}`;

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="text-sm break-all">{children}</dd>
    </div>
  );
}

function dateOrDash(date: Date | null): string {
  return date ? formatDate(date, "en") : "Not yet";
}

export default async function AdminServiceOrderPage({
  params,
}: PageProps<"/admin/service-orders/[itemId]">) {
  await requireAdmin();
  const item = await getServiceOrder((await params).itemId);
  if (!item) notFound();

  const { order, product, service } = item;
  const answers = service ? readRequirements(service.requirements) : null;
  const email = order.user?.email ?? order.customerEmail;

  return (
    <>
      <div className="grid gap-1">
        <Link href="/admin/service-orders" className={BACK_LINK}>
          ← All service orders
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          {/* React text: product names never render as HTML. */}
          <h1 dir="auto" className="text-2xl font-semibold tracking-tight wrap-break-word">
            {product.name}
          </h1>
          <ServiceStatus status={service?.status ?? null} />
        </div>
        <p className="text-sm text-faint">
          Purchased {formatDate(order.createdAt, "en")} ·{" "}
          <Link href={`/admin/orders/${order.id}`} className={TEXT_LINK}>
            Order <OrderNumber number={order.number} />
          </Link>
        </p>
      </div>

      <div className="grid items-start gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 gap-6">
          <section aria-labelledby="service-details-title" className={CARD}>
            <h2 id="service-details-title" className="text-lg font-semibold">
              Customer details
            </h2>
            {!service ? (
              <p className="text-sm text-muted">
                Awaiting customer details. The customer hasn&apos;t sent their onboarding
                details yet, so the work can&apos;t be updated.
              </p>
            ) : answers ? (
              <OnboardingAnswers answers={answers} text={en.onboarding} />
            ) : (
              <p className="rounded-control bg-danger-soft px-4 py-3 text-sm text-danger">
                The saved details can&apos;t be read. Check the record in the database.
              </p>
            )}
          </section>

          {service && (
            <section aria-labelledby="service-work-title" className={CARD}>
              <h2 id="service-work-title" className="text-lg font-semibold">
                Work
              </h2>
              <ServiceWorkForm
                serviceId={service.id}
                status={service.status}
                notes={service.adminNotes ?? ""}
              />
            </section>
          )}
        </div>

        <div className="grid gap-6">
          <section aria-labelledby="service-customer-title" className={CARD}>
            <h2 id="service-customer-title" className="text-lg font-semibold">
              Customer
            </h2>
            <dl className="grid gap-4">
              {/* React text: names and emails never render as HTML. */}
              <Detail label="Name">
                {order.user?.role === "CUSTOMER" ? (
                  <Link
                    href={`/admin/customers/${order.user.id}`}
                    className={`rounded-control font-semibold text-primary-strong hover:text-foreground ${FOCUS}`}
                    dir="auto"
                  >
                    {order.user.name || "No name"}
                  </Link>
                ) : (
                  <span dir="auto">{order.user ? order.user.name || "No name" : "Guest"}</span>
                )}
              </Detail>
              <Detail label="Email">
                <span dir="auto">{email ?? "Not recorded"}</span>
              </Detail>
              <Detail label="Account">
                {order.user ? "Signed in at checkout" : "Guest checkout"}
              </Detail>
            </dl>
          </section>

          <section aria-labelledby="service-summary-title" className={CARD}>
            <h2 id="service-summary-title" className="text-lg font-semibold">
              Service
            </h2>
            <dl className="grid gap-4">
              <Detail label="Service">
                <Link href={`/admin/services/${product.id}`} className={TEXT_LINK} dir="auto">
                  {product.name}
                </Link>
              </Detail>
              <Detail label="Duration">
                {product.durationDays ? `${product.durationDays} days` : "Not set"}
              </Detail>
              <Detail label="Started">{dateOrDash(service?.startDate ?? null)}</Detail>
              <Detail label="Completed">{dateOrDash(service?.completedDate ?? null)}</Detail>
              {service && (
                <Detail label="Last updated">{formatDate(service.updatedAt, "en")}</Detail>
              )}
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}
