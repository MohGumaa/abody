"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import {
  createCoupon,
  setCouponActive,
  updateCoupon,
  type CouponActionResult,
} from "@/actions/admin-coupons";
import { INPUT_BASE } from "@/components/auth/AuthForm";
import type {
  CouponField,
  CouponFieldError,
  CouponFormValues,
} from "@/lib/admin-coupons";
import {
  CODE_MAX,
  CODE_MIN,
  COUPON_SCOPES,
  MAX_REDEMPTIONS_MAX,
  PERCENT_MAX,
  PERCENT_MIN,
  SCOPE_LABELS,
} from "@/lib/coupons";

const INPUT = `${INPUT_BASE} px-4`;
const SUBMIT =
  "h-11 rounded-control bg-primary-strong px-5 text-sm font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-wait disabled:opacity-70";
const SECONDARY =
  "h-11 justify-self-start rounded-control border border-border bg-surface px-5 text-sm font-semibold text-foreground outline-offset-2 hover:border-primary hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-wait disabled:opacity-70";
const PRIMARY = `justify-self-start ${SUBMIT}`;
const CARD = "grid gap-5 rounded-card border border-border bg-panel p-5 shadow-soft min-[600px]:p-6";

const FIELD_ERRORS: Record<CouponFieldError, string> = {
  required: "This field is required.",
  invalid_code: `Use ${CODE_MIN} to ${CODE_MAX} letters and numbers, with single hyphens between them, such as SPRING-10.`,
  code_taken: "Another discount code already uses this code.",
  invalid_percent: `Enter a whole number from ${PERCENT_MIN} to ${PERCENT_MAX}.`,
  invalid_scope: "Choose what the code applies to.",
  invalid_date: "Enter a real date, or leave it empty.",
  invalid_max: `Enter a whole number from 1 to ${MAX_REDEMPTIONS_MAX.toLocaleString("en-US")}, or leave it empty.`,
};

type FormError = Exclude<CouponActionResult, null | { success: true }>["error"];

const FORM_ERRORS: Record<FormError, string> = {
  invalid_fields: "Some fields need attention. Fix them and save again.",
  not_found: "This discount code no longer exists.",
  unexpected: "Something went wrong. Try again.",
};

function describedBy(id: string, hint: boolean, error: boolean): string | undefined {
  return [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
}

function FieldShell({
  field,
  label,
  optional,
  hint,
  error,
  children,
}: {
  field: CouponField;
  label: string;
  optional?: boolean;
  hint?: string;
  error: CouponFieldError | undefined;
  children: ReactNode;
}) {
  const id = `coupon-${field}`;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional && <span className="font-normal text-faint"> (optional)</span>}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {FIELD_ERRORS[error]}
        </p>
      )}
    </div>
  );
}

// Creates a code (no id) or edits one. The code itself is set only on create,
// and the active state has its own control on the edit page.
export function CouponForm({ id, initial }: { id?: string; initial: CouponFormValues }) {
  const [state, action, pending] = useActionState<CouponActionResult, FormData>(
    id ? updateCoupon : createCoupon,
    null,
  );
  const alertRef = useRef<HTMLDivElement>(null);
  const failed = !pending && state?.success === false ? state : null;
  const saved = !pending && state?.success === true;
  // React resets the form after each submit, so a failed one refills it.
  const values = failed?.values ?? initial;
  const errors = failed?.fieldErrors ?? {};

  useEffect(() => {
    if (state?.success === false) alertRef.current?.focus();
  }, [state]);

  function common(field: CouponField, hint: boolean) {
    const fieldId = `coupon-${field}`;
    return {
      id: fieldId,
      name: field,
      "aria-invalid": errors[field] ? true : undefined,
      "aria-describedby": describedBy(fieldId, hint, Boolean(errors[field])),
    } as const;
  }

  return (
    <form action={action} noValidate className="grid gap-6">
      {id && <input type="hidden" name="id" value={id} />}
      <div
        ref={alertRef}
        role="alert"
        tabIndex={-1}
        className={
          failed
            ? "rounded-control bg-danger-soft px-4 py-3 text-sm text-danger outline-offset-2 focus-visible:outline-2 focus-visible:outline-danger"
            : "sr-only"
        }
      >
        {failed && FORM_ERRORS[failed.error]}
      </div>

      <section aria-labelledby="coupon-details" className={CARD}>
        <h2 id="coupon-details" className="text-lg font-semibold">
          Discount
        </h2>
        {!id && (
          <FieldShell
            field="code"
            label="Code"
            hint="Customers type this in the cart. Letters are saved in capitals. It cannot be changed later."
            error={errors.code}
          >
            <input
              {...common("code", true)}
              defaultValue={values.code ?? ""}
              type="text"
              required
              maxLength={CODE_MAX}
              autoCapitalize="characters"
              spellCheck={false}
              dir="ltr"
              className={`${INPUT} uppercase`}
            />
          </FieldShell>
        )}
        <FieldShell
          field="percentOff"
          label="Percent off"
          hint={`A whole number from ${PERCENT_MIN} to ${PERCENT_MAX}.`}
          error={errors.percentOff}
        >
          <input
            {...common("percentOff", true)}
            defaultValue={values.percentOff ?? ""}
            type="text"
            inputMode="numeric"
            required
            maxLength={2}
            dir="ltr"
            className={INPUT}
          />
        </FieldShell>
        <FieldShell field="appliesTo" label="Applies to" error={errors.appliesTo}>
          <select
            {...common("appliesTo", false)}
            defaultValue={values.appliesTo || "ALL"}
            required
            className={INPUT}
          >
            {COUPON_SCOPES.map((scope) => (
              <option key={scope} value={scope}>
                {SCOPE_LABELS[scope]}
              </option>
            ))}
          </select>
        </FieldShell>
      </section>

      <section aria-labelledby="coupon-limits" className={CARD}>
        <div className="grid gap-1">
          <h2 id="coupon-limits" className="text-lg font-semibold">
            Limits
          </h2>
          <p className="text-sm text-muted">Leave both empty for a code with no end.</p>
        </div>
        <FieldShell
          field="expiresOn"
          label="Last valid day"
          optional
          hint="The code works through the end of this day, UTC."
          error={errors.expiresOn}
        >
          <input
            {...common("expiresOn", true)}
            defaultValue={values.expiresOn ?? ""}
            type="date"
            className={INPUT}
          />
        </FieldShell>
        <FieldShell
          field="maxRedemptions"
          label="Maximum uses"
          optional
          hint="Counted when an order is paid."
          error={errors.maxRedemptions}
        >
          <input
            {...common("maxRedemptions", true)}
            defaultValue={values.maxRedemptions ?? ""}
            type="text"
            inputMode="numeric"
            maxLength={7}
            dir="ltr"
            className={INPUT}
          />
        </FieldShell>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={SUBMIT}>
          {pending ? "Saving…" : id ? "Save changes" : "Create code"}
        </button>
        <p role="status" className={saved ? "text-sm font-medium text-success" : "sr-only"}>
          {saved ? "Changes saved." : ""}
        </p>
      </div>
    </form>
  );
}

export function CouponActiveControl({ id, active }: { id: string; active: boolean }) {
  const [state, action, pending] = useActionState<CouponActionResult, FormData>(
    setCouponActive,
    null,
  );
  const error = !pending && state?.success === false ? FORM_ERRORS[state.error] : null;
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <p className="text-sm text-muted">
        {active
          ? "Customers can use this code at checkout."
          : "Customers cannot use this code until you activate it."}
      </p>
      <button type="submit" disabled={pending} className={active ? SECONDARY : PRIMARY}>
        {pending ? "Saving…" : active ? "Deactivate" : "Activate"}
      </button>
      <p
        role="alert"
        className={error ? "rounded-control bg-danger-soft px-4 py-3 text-sm text-danger" : "sr-only"}
      >
        {error}
      </p>
    </form>
  );
}
