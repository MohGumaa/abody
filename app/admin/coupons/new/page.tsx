import type { Metadata } from "next";
import Link from "next/link";
import { CouponForm } from "@/components/admin/CouponForm";
import { adminMetadata, requireAdmin } from "@/lib/admin";

export function generateMetadata(): Promise<Metadata> {
  return adminMetadata("New discount code");
}

export default async function NewCouponPage() {
  await requireAdmin();
  return (
    <>
      <div className="grid gap-1">
        <Link
          href="/admin/coupons"
          className="justify-self-start rounded-control text-sm font-medium text-primary-strong outline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary-strong"
        >
          ← All coupons
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New discount code</h1>
        <p className="text-sm text-muted">
          The code starts inactive. Activate it on the next page when it is ready.
        </p>
      </div>
      <div className="max-w-3xl">
        <CouponForm initial={{ appliesTo: "ALL" }} />
      </div>
    </>
  );
}
