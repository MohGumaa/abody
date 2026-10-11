import type { ReactNode } from "react";
import {
  CheckoutButton,
  type CheckoutButtonText,
} from "@/components/cart/CheckoutButton";
import { LockIcon } from "@/components/icons";
import type { Locale } from "@/lib/i18n/config";
import { formatPriceCents } from "@/lib/money";

interface CartSummaryProps {
  subtotalCents: number;
  totalCents: number;
  // Only when a discount code applies.
  discount: { code: string; cents: number } | null;
  // Already pluralized, for example "3 items".
  itemCountLabel: string;
  locale: Locale;
  // The discount code field, above the checkout button.
  coupon: ReactNode;
  text: {
    summary: string;
    subtotal: string;
    total: string;
    discount: string;
    secureNote: string;
  } & CheckoutButtonText;
}

export function CartSummary({
  subtotalCents,
  totalCents,
  discount,
  itemCountLabel,
  locale,
  coupon,
  text,
}: CartSummaryProps) {
  return (
    <section
      aria-labelledby="cart-summary-heading"
      className="rounded-panel border border-primary bg-panel p-5 shadow-soft min-[600px]:p-6 min-[960px]:sticky min-[960px]:top-6 min-[960px]:p-10"
    >
      <h2 id="cart-summary-heading" className="text-xl font-semibold">
        {text.summary}
      </h2>
      <dl className="my-5 grid gap-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">
            {text.subtotal} ({itemCountLabel})
          </dt>
          <dd className="font-semibold">{formatPriceCents(subtotalCents)}</dd>
        </div>
        {discount && (
          <div className="flex justify-between gap-4 text-success">
            <dt>
              {text.discount} (
              <span dir="ltr" className="font-mono">
                {discount.code}
              </span>
              )
            </dt>
            <dd className="font-semibold" dir="ltr">
              −{formatPriceCents(discount.cents)}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-4 border-t border-border pt-4 text-lg font-semibold">
          <dt>{text.total}</dt>
          <dd>{formatPriceCents(totalCents)}</dd>
        </div>
      </dl>
      {coupon}
      {/* Only plain strings cross to the client component. */}
      <CheckoutButton
        locale={locale}
        text={{ checkout: text.checkout, redirecting: text.redirecting, errors: text.errors }}
      />
      <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted">
        <LockIcon className="h-4 w-4" />
        {text.secureNote}
      </p>
    </section>
  );
}
