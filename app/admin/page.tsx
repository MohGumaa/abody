import type { Metadata } from "next";
import type { ComponentType } from "react";
import {
  EmptyState,
  OrderNumber,
  StatusChip,
} from "@/components/account/AccountParts";
import {
  BoxIcon,
  CalendarIcon,
  ChartIcon,
  GridIcon,
  MegaphoneIcon,
  UsersIcon,
} from "@/components/icons";
import { initials } from "@/lib/account";
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

const AVATAR_TINTS = ["bg-tint-1", "bg-tint-2", "bg-tint-3", "bg-tint-4"];

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export default async function AdminDashboardPage() {
  await requireAdmin();
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted">
            An overview of the store. Revenue is all time.
          </p>
        </div>
        <p className="flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1.5 text-xs text-muted">
          <CalendarIcon className="h-4 w-4" />
          {formatDate(new Date(), "en")}
        </p>
      </div>

      <section aria-labelledby="stats-title">
        <h2 id="stats-title" className="sr-only">
          Store totals
        </h2>
        <dl className="grid gap-4 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-3">
          {stats.map(({ label, value, detail, Icon }, index) => {
            const featured = index === 0;
            return (
              // A dl group may hold only dt and dd, so the decorative icon sits
              // inside the term and is positioned at the card's top end.
              <div
                key={label}
                className={`relative grid content-start gap-3 rounded-card border p-5 shadow-soft ${
                  featured
                    ? "border-transparent bg-linear-140 from-ink to-ink-raised text-ink-text"
                    : "border-border bg-panel"
                }`}
              >
                <dt
                  className={`flex min-h-9 items-center pe-12 text-sm font-medium ${
                    featured ? "text-ink-muted" : "text-muted"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute end-5 top-5 grid h-9 w-9 place-items-center rounded-[10px] ${
                      featured
                        ? "bg-white/10 text-ink-text"
                        : "bg-primary-soft text-primary-strong"
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  {label}
                </dt>
                <dd className="text-[1.875rem] leading-tight font-semibold tracking-tight tabular-nums">
                  {value}
                </dd>
                <dd className={`text-xs ${featured ? "text-ink-muted" : "text-faint"}`}>
                  {detail}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section
        aria-labelledby="recent-orders"
        className="min-w-0 overflow-hidden rounded-card border border-border bg-panel shadow-soft"
      >
        <div className="grid gap-0.5 border-b border-border px-5 py-5 min-[600px]:px-6">
          <h2 id="recent-orders" className="text-lg font-semibold">
            Recent orders
          </h2>
          <p className="text-xs text-faint">The latest orders of any status</p>
        </div>
        {overview.recentOrders.length === 0 ? (
          <div className="p-5 min-[600px]:p-6">
            <EmptyState message="No orders yet." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-170 text-left text-sm">
              <thead className="bg-surface text-[0.6875rem] tracking-wider text-faint uppercase">
                <tr>
                  <th scope="col" className="px-6 py-3 font-semibold">Order</th>
                  <th scope="col" className="px-6 py-3 font-semibold">Customer</th>
                  <th scope="col" className="px-6 py-3 text-end font-semibold">Items</th>
                  <th scope="col" className="px-6 py-3 text-end font-semibold">Total</th>
                  <th scope="col" className="px-6 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-6 py-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentOrders.map((order, index) => (
                  <tr key={order.id} className="border-t border-border hover:bg-surface/60">
                    <td className="px-6 py-4 text-xs">
                      <OrderNumber number={order.number} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className={`grid h-7.5 w-7.5 shrink-0 place-items-center rounded-full text-[0.6875rem] font-semibold text-primary-strong ${
                            AVATAR_TINTS[index % AVATAR_TINTS.length]
                          }`}
                        >
                          {initials(order.customer)}
                        </span>
                        {/* React text: names and emails never render as HTML. */}
                        <span className="max-w-56 break-all" dir="auto">
                          {order.customer}
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-end tabular-nums">{order.itemCount}</td>
                    <td className="px-6 py-4 text-end font-semibold tabular-nums">
                      {formatPriceCents(order.totalCents)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusChip status={order.status} text={en.account} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-faint">
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
