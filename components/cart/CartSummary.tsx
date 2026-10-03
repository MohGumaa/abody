import { ArrowIcon, LockIcon } from "@/components/icons";
import { formatPriceCents } from "@/lib/money";

interface CartSummaryProps {
  subtotalCents: number;
  totalCents: number;
  // Already pluralized, for example "3 items".
  itemCountLabel: string;
  text: {
    summary: string;
    subtotal: string;
    total: string;
    checkout: string;
    checkoutComingSoon: string;
    secureNote: string;
  };
}

// Checkout ships with feature 5; until then the button stays disabled.
export function CartSummary({
  subtotalCents,
  totalCents,
  itemCountLabel,
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
      <button
        type="button"
        disabled
        aria-describedby="checkout-note"
        className="flex h-13 w-full items-center justify-center gap-2 rounded-card bg-primary-strong px-6 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {text.checkout}
        <ArrowIcon className="h-5 w-5 rtl:-scale-x-100" />
      </button>
      <p id="checkout-note" className="mt-2 text-center text-sm text-muted">
        {text.checkoutComingSoon}
      </p>
      <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted">
        <LockIcon className="h-4 w-4" />
        {text.secureNote}
      </p>
    </section>
  );
}
