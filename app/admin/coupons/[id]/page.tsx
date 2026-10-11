import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CouponActiveControl, CouponForm } from "@/components/admin/CouponForm";
import { CouponStatusChip } from "@/components/admin/CouponStatusChip";
import { adminMetadata, requireAdmin } from "@/lib/admin";
import { dateInputValue, getAdminCoupon } from "@/lib/admin-coupons";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata({
  params,
}: PageProps<"/admin/coupons/[id]">): Promise<Metadata> {
  // Only an admin's request reads the code; anyone else gets the 404 title.
  const user = await getCurrentUser();
  const coupon = user?.role === "ADMIN" ? await getAdminCoupon((await params).id) : null;
  return adminMetadata(coupon ? `Edit ${coupon.code}` : "Edit discount code");
}

const CARD =
  "grid content-start gap-4 rounded-card border border-border bg-panel p-5 shadow-soft min-[600px]:p-6";

export default async function EditCouponPage({ params }: PageProps<"/admin/coupons/[id]">) {
  await requireAdmin();
  const coupon = await getAdminCoupon((await params).id);
  if (!coupon) notFound();

  const initial = {
    percentOff: String(coupon.percentOff),
    appliesTo: coupon.appliesTo,
    expiresOn: dateInputValue(coupon.expiresOn),
    maxRedemptions: coupon.maxRedemptions === null ? "" : String(coupon.maxRedemptions),
  };

  return (
    <>
      <div className="grid gap-1">
        <Link
          href="/admin/coupons"
          className="justify-self-start rounded-control text-sm font-medium text-primary-strong outline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary-strong"
        >
          ← All coupons
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold tracking-tight break-all" dir="ltr">
            {coupon.code}
          </h1>
          <CouponStatusChip active={coupon.active} />
        </div>
      </div>

      <div className="grid items-start gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_22rem]">
        <CouponForm id={coupon.id} initial={initial} />

        <div className="grid gap-6">
          <section aria-labelledby="coupon-status-title" className={CARD}>
            <h2 id="coupon-status-title" className="text-lg font-semibold">
              Availability
            </h2>
            <CouponActiveControl id={coupon.id} active={coupon.active} />
          </section>
          <section aria-labelledby="coupon-usage-title" className={CARD}>
            <h2 id="coupon-usage-title" className="text-lg font-semibold">
              Usage
            </h2>
            <p className="text-sm text-muted">
              Used on{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {coupon.redemptionCount}
              </span>{" "}
              paid {coupon.redemptionCount === 1 ? "order" : "orders"}
              {coupon.maxRedemptions !== null && ` of ${coupon.maxRedemptions} allowed`}.
              Refunds do not give a use back.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
