import { formatPriceCents } from "@/lib/money";

interface CartSummaryProps {
  subtotalCents: number;
  totalCents: number;
  text: {
    summary: string;
    subtotal: string;
    total: string;
    checkout: string;
    checkoutComingSoon: string;
  };
}

// Checkout ships with feature 5; until then the button stays disabled.
export function CartSummary({ subtotalCents, totalCents, text }: CartSummaryProps) {
  return (
    <section
      aria-labelledby="cart-summary-heading"
      className="rounded-card border border-border bg-surface p-5"
    >
      <h2 id="cart-summary-heading" className="text-lg font-semibold">
        {text.summary}
      </h2>
      <dl className="mt-4 space-y-2">
        <div className="flex justify-between gap-4 text-muted">
          <dt>{text.subtotal}</dt>
          <dd>{formatPriceCents(subtotalCents)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-border pt-2 text-lg font-semibold">
          <dt>{text.total}</dt>
          <dd>{formatPriceCents(totalCents)}</dd>
        </div>
      </dl>
      <button
        type="button"
        disabled
        aria-describedby="checkout-note"
        className="mt-5 w-full rounded-full bg-primary-strong px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {text.checkout}
      </button>
      <p id="checkout-note" className="mt-2 text-sm text-muted">
        {text.checkoutComingSoon}
      </p>
    </section>
  );
}
