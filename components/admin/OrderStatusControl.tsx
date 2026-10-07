"use client";

import { useActionState, useState } from "react";
import { setOrderStatus, type OrderActionResult } from "@/actions/admin-orders";
import type { FulfilmentStatus } from "@/lib/admin-orders";

const SUBMIT =
  "h-11 justify-self-start rounded-control bg-primary-strong px-5 text-sm font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-wait disabled:opacity-70";

// Labels only; the server whitelists the value.
const OPTIONS: { value: FulfilmentStatus; label: string; hint: string }[] = [
  { value: "PAID", label: "Paid", hint: "Payment received, work not started." },
  { value: "PROCESSING", label: "Processing", hint: "Being fulfilled." },
  { value: "COMPLETED", label: "Completed", hint: "Everything delivered." },
];

const MESSAGES: Record<Exclude<OrderActionResult, null | { success: true }>["error"], string> = {
  locked: "This order's status changed in Stripe. Reload to see it.",
  not_found: "This order no longer exists.",
  invalid_status: "Something went wrong. Try again.",
  unexpected: "Something went wrong. Try again.",
};

export function OrderStatusControl({
  orderId,
  status,
}: {
  orderId: string;
  status: FulfilmentStatus;
}) {
  const [state, action, pending] = useActionState<OrderActionResult, FormData>(
    setOrderStatus,
    null,
  );
  // Controlled, so a failed save keeps the admin's pick after the form resets.
  const [picked, setPicked] = useState<FulfilmentStatus>(status);
  const [savedStatus, setSavedStatus] = useState(status);
  if (savedStatus !== status) {
    // A refresh brought a new saved status.
    setSavedStatus(status);
    setPicked(status);
  }
  const error = !pending && state?.success === false ? MESSAGES[state.error] : null;
  const saved = !pending && state?.success === true;

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value={orderId} />
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Order status</legend>
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 rounded-control border border-border bg-surface px-4 py-3 text-sm has-checked:border-primary has-checked:bg-primary-soft"
          >
            <input
              type="radio"
              name="status"
              value={option.value}
              checked={picked === option.value}
              onChange={() => setPicked(option.value)}
              className="mt-0.5 accent-primary-strong"
            />
            <span className="grid gap-0.5">
              <span className="font-semibold">{option.label}</span>
              <span className="text-xs text-muted">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <button type="submit" disabled={pending} className={SUBMIT}>
        {pending ? "Saving…" : "Save status"}
      </button>
      <p
        role="status"
        className={
          error
            ? "rounded-control bg-danger-soft px-4 py-3 text-sm text-danger"
            : saved
              ? "text-sm font-medium text-success"
              : "sr-only"
        }
      >
        {error ?? (saved ? "Status saved." : "")}
      </p>
    </form>
  );
}
