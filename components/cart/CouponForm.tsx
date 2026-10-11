"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  applyCoupon,
  removeCoupon,
  type CouponActionResult,
  type CouponApplyError,
} from "@/actions/coupon";
import type { CouponFailure } from "@/lib/coupons";

export interface CouponFormText {
  label: string;
  apply: string;
  applying: string;
  remove: string;
  removing: string;
  notApplied: string;
  // Already filled in with the percent.
  appliedNote: string | null;
  errors: Record<Exclude<CouponApplyError, "invalid_input">, string>;
}

// What the server found for the saved code, if there is one.
export type SavedCoupon =
  | { code: string; ok: true }
  | { code: string; ok: false; reason: CouponFailure }
  | null;

const INPUT_ID = "coupon-code";
const ERROR_ID = "coupon-code-error";
const FIELD =
  "h-11 min-w-0 flex-1 rounded-control border border-border bg-surface px-3 font-mono text-sm uppercase outline-offset-2 placeholder:normal-case focus-visible:outline-2 focus-visible:outline-primary-strong aria-invalid:border-danger";
const BUTTON =
  "h-11 shrink-0 rounded-control border border-border bg-surface px-4 text-sm font-semibold text-foreground outline-offset-2 hover:border-primary hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-wait disabled:opacity-70";
const LINK_BUTTON =
  "shrink-0 rounded-control text-sm font-semibold text-primary-strong underline-offset-4 outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-wait disabled:opacity-70";

export function CouponForm({ saved, text }: { saved: SavedCoupon; text: CouponFormText }) {
  const [state, apply, applying] = useActionState(applyCoupon, null);
  const [removed, remove, removing] = useActionState<CouponActionResult>(removeCoupon, null);
  const inputRef = useRef<HTMLInputElement>(null);

  const error =
    !applying && state?.success === false
      ? text.errors[state.error === "invalid_input" ? "invalid" : state.error]
      : null;

  // A failed apply returns focus to the field to fix the code; after Remove the
  // field comes back and takes focus.
  useEffect(() => {
    if (state?.success === false) inputRef.current?.focus();
  }, [state]);
  useEffect(() => {
    if (removed?.success) inputRef.current?.focus();
  }, [removed]);

  return (
    <div className="mb-5 grid gap-2">
      {/* Present before any change, so the applied code is announced. */}
      <div role="status" className="empty:hidden">
        {saved && (
          <div
            className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-control px-4 py-3 text-sm ${
              saved.ok ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
            }`}
          >
            <p>
              <span dir="ltr" className="font-mono font-semibold">
                {saved.code}
              </span>
              {" · "}
              {saved.ok ? text.appliedNote : `${text.notApplied}: ${text.errors[saved.reason]}`}
            </p>
            <form action={remove}>
              <button type="submit" disabled={removing} className={LINK_BUTTON}>
                {removing ? text.removing : text.remove}
              </button>
            </form>
          </div>
        )}
      </div>
      {!saved && (
        <form action={apply} className="grid grid-cols-1 gap-1.5">
          <label htmlFor={INPUT_ID} className="text-sm font-medium">
            {text.label}
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              id={INPUT_ID}
              name="code"
              type="text"
              required
              maxLength={64}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              dir="ltr"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? ERROR_ID : undefined}
              className={FIELD}
            />
            <button type="submit" disabled={applying} className={BUTTON}>
              {applying ? text.applying : text.apply}
            </button>
          </div>
          <p id={ERROR_ID} role="alert" className="text-sm text-danger empty:hidden">
            {error}
          </p>
        </form>
      )}
    </div>
  );
}
