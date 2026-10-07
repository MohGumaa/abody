"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { refundOrder, type RefundActionResult } from "@/actions/admin-orders";

const SECONDARY =
  "h-11 justify-self-start rounded-control border border-border bg-surface px-5 text-sm font-semibold text-foreground outline-offset-2 hover:border-primary hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-wait disabled:opacity-70";
const DANGER =
  "h-11 justify-self-start rounded-control bg-danger px-5 text-sm font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-danger disabled:cursor-wait disabled:opacity-70";
const DANGER_OUTLINE =
  "h-11 justify-self-start rounded-control border border-danger/40 bg-panel px-5 text-sm font-semibold text-danger outline-offset-2 hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-danger";

const MESSAGES: Record<Exclude<RefundActionResult, null | { success: true }>["error"], string> = {
  stripe_error: "Stripe could not refund this payment. Check the order in the Stripe dashboard.",
  not_refundable: "This order can no longer be refunded. Reload to see its status.",
  not_found: "This order no longer exists.",
  no_payment: "No Stripe payment is recorded for this order. Refund it in the Stripe dashboard.",
  unexpected: "Something went wrong. Try again.",
};

// A full refund through Stripe. On success the page revalidates and this card
// is replaced by the Refunded status.
export function OrderRefund({ orderId, amount }: { orderId: string; amount: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<RefundActionResult, FormData>(
    async (previous, formData) => {
      const result = await refundOrder(previous, formData);
      // A refused refund closes the panel, so the message replaces it.
      if (result?.success === false) setConfirming(false);
      return result;
    },
    null,
  );
  const confirmRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  // Focus follows the step: into the confirm panel, and back when it closes.
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
    else if (wasConfirming.current) startRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  const error = !pending && state?.success === false ? MESSAGES[state.error] : null;
  const refunded = !pending && state?.success === true;

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted">
        Refunds the full payment through Stripe and ends the customer&apos;s download access.
      </p>
      {confirming ? (
        <form
          action={action}
          className="grid gap-3 rounded-control border border-danger/40 bg-danger-soft p-4"
        >
          <input type="hidden" name="id" value={orderId} />
          <p className="text-sm font-medium text-danger">
            Refund {amount} to the customer through Stripe? The order becomes Refunded and
            download access ends. This cannot be undone.
          </p>
          <div className="flex flex-wrap gap-3">
            <button ref={confirmRef} type="submit" disabled={pending} className={DANGER}>
              {pending ? "Refunding…" : "Confirm refund"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className={SECONDARY}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          ref={startRef}
          type="button"
          onClick={() => setConfirming(true)}
          className={DANGER_OUTLINE}
        >
          Refund order
        </button>
      )}
      <p
        role="status"
        className={
          error
            ? "rounded-control bg-danger-soft px-4 py-3 text-sm text-danger"
            : refunded
              ? "text-sm font-medium text-success"
              : "sr-only"
        }
      >
        {error ?? (refunded ? "Order refunded." : "")}
      </p>
    </div>
  );
}
