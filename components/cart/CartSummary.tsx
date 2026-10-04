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
  // Already pluralized, for example "3 items".
  itemCountLabel: string;
  locale: Locale;
  text: {
    summary: string;
    subtotal: string;
    total: string;
    secureNote: string;
  } & CheckoutButtonText;
}

export function CartSummary({
  subtotalCents,
  totalCents,
  itemCountLabel,
  locale,
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
        <div className="flex justify-between gap-4 border-t border-border pt-4 text-lg font-semibold">
          <dt>{text.total}</dt>
          <dd>{formatPriceCents(totalCents)}</dd>
        </div>
      </dl>
      <CheckoutButton locale={locale} text={text} />
      <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted">
        <LockIcon className="h-4 w-4" />
        {text.secureNote}
      </p>
    </section>
  );
}
