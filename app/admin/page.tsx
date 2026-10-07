import type { Metadata } from "next";
import type { ComponentType } from "react";
import {
  ACCOUNT_PANEL,
  EmptyState,
  OrderNumber,
  SectionHead,
  StatusChip,
} from "@/components/account/AccountParts";
import {
  BoxIcon,
  ChartIcon,
  GridIcon,
  MegaphoneIcon,
  UsersIcon,
} from "@/components/icons";
import { adminMetadata, getAdminOverview, requireAdmin } from "@/lib/admin";
import { formatDate } from "@/lib/dates";
import { en } from "@/lib/i18n/dictionaries/en";
import { formatPriceCents } from "@/lib/money";

export function generateMetadata(): Promise<Metadata> {
  return adminMetadata("Dashboard");
}

interface Stat {
  label: string;
  value: string;
  detail: string;
  Icon: ComponentType<{ className?: string }>;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export default async function AdminDashboardPage() {
  await requireAdmin("/admin");
  const overview = await getAdminOverview();

  const stats: Stat[] = [
    {
      label: "Revenue",
      value: formatPriceCents(overview.revenueCents),
      detail: `from ${plural(overview.paidOrders, "paid order", "paid orders")}`,
      Icon: ChartIcon,
    },
    {
      label: "Orders",
      value: String(overview.paidOrders),
      detail: `paid, ${overview.pendingOrders} pending`,
      Icon: BoxIcon,
    },
    {
      label: "Customers",
      value: String(overview.customers),
      detail: "registered accounts",
      Icon: UsersIcon,
    },
    {
      label: "Products",
      value: String(overview.products.published),
      detail: `published of ${overview.products.total}`,
      Icon: GridIcon,
    },
    {
      label: "Services",
      value: String(overview.services.published),
      detail: `published of ${overview.services.total}`,
      Icon: MegaphoneIcon,
    },
    {
      label: "Active services",
      value: String(overview.activeServices),
      detail: "awaiting details or in progress",
      Icon: MegaphoneIcon,
    },
  ];

  return (
    <>
      <section className={ACCOUNT_PANEL} aria-labelledby="dashboard-title">
        <div className="grid gap-2">
          <h1 id="dashboard-title" className="text-2xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="text-muted">An overview of the store. Revenue is all time.</p>
        </div>
        <dl className="grid gap-3 min-[600px]:grid-cols-2 min-[1100px]:grid-cols-3">
          {stats.map(({ label, value, detail, Icon }) => (
            // A dl group may hold only dt and dd, so the decorative icon sits
            // inside the term and is positioned at the card's start edge.
            <div
              key={label}
              className="relative grid content-center rounded-card bg-surface p-4 ps-18"
            >
              <dt className="text-sm text-muted">
                <span
                  aria-hidden="true"
                  className="absolute start-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-card bg-primary-soft text-primary-strong"
                >
                  <Icon className="h-5 w-5" />
                </span>
                {label}
              </dt>
              <dd className="text-xl font-semibold">{value}</dd>
              <dd className="text-xs text-faint">{detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={ACCOUNT_PANEL} aria-labelledby="recent-orders">
        <SectionHead id="recent-orders" title="Recent orders" />
        {overview.recentOrders.length === 0 ? (
          <EmptyState message="No orders yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th scope="col" className="py-2 pe-4 font-medium">Order</th>
                  <th scope="col" className="py-2 pe-4 font-medium">Customer</th>
                  <th scope="col" className="py-2 pe-4 font-medium">Items</th>
                  <th scope="col" className="py-2 pe-4 font-medium">Total</th>
                  <th scope="col" className="py-2 pe-4 font-medium">Status</th>
                  <th scope="col" className="py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border last:border-0">
                    <td className="py-3 pe-4">
                      <OrderNumber number={order.number} />
                    </td>
                    {/* React text: names and emails never render as HTML. */}
                    <td className="max-w-56 py-3 pe-4 break-all" dir="auto">
                      {order.customer}
                    </td>
                    <td className="py-3 pe-4">{order.itemCount}</td>
                    <td className="py-3 pe-4 font-semibold">
                      {formatPriceCents(order.totalCents)}
                    </td>
                    <td className="py-3 pe-4">
                      <StatusChip status={order.status} text={en.account} />
                    </td>
                    <td className="py-3 whitespace-nowrap text-muted">
                      {formatDate(order.createdAt, "en")}
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
