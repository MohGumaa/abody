import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/account/AccountParts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminMetadata, requireAdmin } from "@/lib/admin";
import { getAnalyticsReport } from "@/lib/analytics";
import { conversionRate, parseRangeDays, RANGE_DAYS } from "@/lib/analytics-rules";
import { formatPriceCents } from "@/lib/money";

export function generateMetadata(): Promise<Metadata> {
  return adminMetadata("Analytics");
}

const FOCUS =
  "outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary-strong";
const CARD = "rounded-card border border-border bg-panel shadow-soft";

function percent(rate: number | null): string {
  return rate === null ? "—" : `${rate}%`;
}

function count(value: number): string {
  return value.toLocaleString("en-US");
}

export default async function AdminAnalyticsPage({
  searchParams,
}: PageProps<"/admin/analytics">) {
  await requireAdmin();
  const days = parseRangeDays((await searchParams).range);
  const report = await getAnalyticsReport(days);

  const totals = [
    { label: "Page views", value: count(report.pageViews) },
    { label: "Product views", value: count(report.productViews) },
    { label: "Added to cart", value: count(report.addsToCart) },
    { label: "Checkouts started", value: count(report.checkoutsStarted) },
    { label: "Purchases", value: count(report.purchases) },
    { label: "Revenue", value: formatPriceCents(report.revenueCents) },
  ];
  const rates = [
    {
      label: "Product view to cart",
      value: percent(conversionRate(report.addsToCart, report.productViews)),
    },
    {
      label: "Cart to checkout",
      value: percent(conversionRate(report.checkoutsStarted, report.addsToCart)),
    },
    {
      label: "Checkout to purchase",
      value: percent(conversionRate(report.purchases, report.checkoutsStarted)),
    },
  ];
  const noActivity = report.pageViews + report.addsToCart + report.checkoutsStarted +
    report.purchases === 0;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted">
            Store activity and paid orders for the last {days} days (UTC).
          </p>
        </div>
        <nav aria-label="Report period">
          <ul className="flex gap-1 rounded-full border border-border bg-panel p-1">
            {RANGE_DAYS.map((option) => {
              const current = option === days;
              return (
                <li key={option}>
                  <Link
                    href={`/admin/analytics?range=${option}`}
                    aria-current={current ? "page" : undefined}
                    className={`block rounded-full px-3 py-1.5 text-sm font-medium ${FOCUS} ${
                      current
                        ? "bg-primary-strong text-white"
                        : "text-muted hover:bg-surface hover:text-foreground"
                    }`}
                  >
                    {option} days
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {noActivity && <EmptyState message="No store activity in this period yet." />}

      <section aria-labelledby="totals-title">
        <h2 id="totals-title" className="sr-only">
          Totals
        </h2>
        <dl className="grid gap-4 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-3">
          {totals.map(({ label, value }) => (
            <div key={label} className={`grid content-start gap-2 p-5 ${CARD}`}>
              <dt className="text-sm font-medium text-muted">{label}</dt>
              <dd className="text-[1.875rem] leading-tight font-semibold tracking-tight tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="rates-title" className={`grid gap-4 p-5 min-[600px]:p-6 ${CARD}`}>
        <div className="grid gap-0.5">
          <h2 id="rates-title" className="text-lg font-semibold">
            Conversion
          </h2>
          <p className="text-xs text-faint">Share of each step that reached the next</p>
        </div>
        <dl className="grid gap-4 min-[640px]:grid-cols-3">
          {rates.map(({ label, value }) => (
            <div key={label} className="grid gap-1 rounded-card bg-surface p-4">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="text-xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        aria-labelledby="popular-title"
        className={`min-w-0 overflow-hidden ${CARD}`}
      >
        <div className="grid gap-0.5 border-b border-border px-5 py-5 min-[600px]:px-6">
          <h2 id="popular-title" className="text-lg font-semibold">
            Popular products
          </h2>
          <p className="text-xs text-faint">Top 10 by units sold, then sales and views</p>
        </div>
        {report.popularProducts.length === 0 ? (
          <div className="p-5 min-[600px]:p-6">
            <EmptyState message="No product views or sales in this period." />
          </div>
        ) : (
          <Table className="min-w-170">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Name</TableHead>
                <TableHead scope="col">Type</TableHead>
                <TableHead scope="col" className="text-end">Views</TableHead>
                <TableHead scope="col" className="text-end">Added to cart</TableHead>
                <TableHead scope="col" className="text-end">Units sold</TableHead>
                <TableHead scope="col" className="text-end">Sales</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.popularProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {/* React text: names never render as HTML. */}
                    <Link
                      href={`/admin/${product.type === "SERVICE" ? "services" : "products"}/${product.id}`}
                      className={`rounded-control font-medium text-foreground hover:text-primary-strong ${FOCUS}`}
                      dir="auto"
                    >
                      {product.name}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted">
                    {product.type === "SERVICE" ? "Service" : "Product"}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{count(product.views)}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {count(product.addsToCart)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {count(product.unitsSold)}
                  </TableCell>
                  <TableCell className="text-end font-semibold tabular-nums">
                    {formatPriceCents(product.salesCents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section aria-labelledby="pages-title" className={`min-w-0 overflow-hidden ${CARD}`}>
        <div className="grid gap-0.5 border-b border-border px-5 py-5 min-[600px]:px-6">
          <h2 id="pages-title" className="text-lg font-semibold">
            Top pages
          </h2>
          <p className="text-xs text-faint">Top 10 store pages by views</p>
        </div>
        {report.topPages.length === 0 ? (
          <div className="p-5 min-[600px]:p-6">
            <EmptyState message="No page views in this period." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Page</TableHead>
                <TableHead scope="col" className="text-end">Views</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.topPages.map((page) => (
                <TableRow key={page.path}>
                  <TableCell>
                    <span className="block max-w-120 font-mono text-xs break-all">
                      {page.path}
                    </span>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{count(page.views)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </>
  );
}
