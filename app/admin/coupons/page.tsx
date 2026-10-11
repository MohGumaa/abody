import type { Metadata } from "next";
import Link from "next/link";
import { CouponStatusChip } from "@/components/admin/CouponStatusChip";
import { PlusIcon } from "@/components/icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminMetadata, requireAdmin } from "@/lib/admin";
import { listAdminCoupons } from "@/lib/admin-coupons";
import { SCOPE_LABELS } from "@/lib/coupons";
import { formatDate } from "@/lib/dates";

export function generateMetadata(): Promise<Metadata> {
  return adminMetadata("Coupons");
}

const FOCUS =
  "outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary-strong";

export default async function AdminCouponsPage() {
  await requireAdmin();
  const coupons = await listAdminCoupons();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Coupons</h1>
          <p className="text-sm text-muted">
            Percentage discount codes customers enter in the cart.
          </p>
        </div>
        <Link
          href="/admin/coupons/new"
          className={`flex h-11 items-center gap-2 rounded-control bg-primary-strong px-5 text-sm font-semibold text-white hover:shadow-raised ${FOCUS}`}
        >
          <PlusIcon className="h-4 w-4" />
          New code
        </Link>
      </div>

      <section
        aria-labelledby="coupons-title"
        className="min-w-0 overflow-hidden rounded-card border border-border bg-panel shadow-soft"
      >
        <h2 id="coupons-title" className="sr-only">
          All discount codes
        </h2>
        {coupons.length === 0 ? (
          <div className="p-5 min-[600px]:p-6">
            <div className="grid justify-items-start gap-3 rounded-card bg-surface p-5 text-sm">
              <p className="text-muted">No discount codes yet.</p>
              <Link
                href="/admin/coupons/new"
                className={`rounded-control font-semibold text-primary-strong hover:text-foreground ${FOCUS}`}
              >
                Create the first code
              </Link>
            </div>
          </div>
        ) : (
          <Table className="min-w-190">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Code</TableHead>
                <TableHead scope="col" className="text-end">Discount</TableHead>
                <TableHead scope="col">Applies to</TableHead>
                <TableHead scope="col" className="text-end">Uses</TableHead>
                <TableHead scope="col">Last valid day</TableHead>
                <TableHead scope="col">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((coupon) => (
                <TableRow key={coupon.id}>
                  <TableCell>
                    <Link
                      href={`/admin/coupons/${coupon.id}`}
                      className={`rounded-control font-mono font-semibold text-foreground hover:text-primary-strong ${FOCUS}`}
                      dir="ltr"
                    >
                      {coupon.code}
                    </Link>
                  </TableCell>
                  <TableCell className="text-end font-semibold tabular-nums">
                    {coupon.percentOff}%
                  </TableCell>
                  <TableCell className="text-muted">{SCOPE_LABELS[coupon.appliesTo]}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {coupon.redemptionCount}
                    {coupon.maxRedemptions !== null && (
                      <span className="text-faint"> / {coupon.maxRedemptions}</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted">
                    {coupon.expiresOn ? formatDate(coupon.expiresOn, "en") : "No end"}
                  </TableCell>
                  <TableCell>
                    <CouponStatusChip active={coupon.active} />
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
