"use client";

import { useActionState } from "react";
import { startCheckout, type CheckoutActionError } from "@/actions/checkout";
import { ArrowIcon } from "@/components/icons";
import type { Locale } from "@/lib/i18n/config";

export interface CheckoutButtonText {
  checkout: string;
  redirecting: string;
  errors: Record<Exclude<CheckoutActionError, "invalid_input">, string>;
}

interface CheckoutButtonProps {
  locale: Locale;
  text: CheckoutButtonText;
}

const ERROR_ID = "checkout-error";

export function CheckoutButton({ locale, text }: CheckoutButtonProps) {
  const [state, action, pending] = useActionState(startCheckout, null);
  // The only input is the hidden language, so a rejected one is unexpected.
  const error =
    !pending && state?.success === false
      ? text.errors[state.error === "invalid_input" ? "unexpected" : state.error]
      : null;

  return (
    <form action={action}>
      <input type="hidden" name="lang" value={locale} />
      <button
        type="submit"
        disabled={pending}
        aria-describedby={error ? ERROR_ID : undefined}
        className="flex h-13 w-full items-center justify-center gap-2 rounded-card bg-primary-strong px-6 font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? text.redirecting : text.checkout}
        {!pending && <ArrowIcon className="h-5 w-5 rtl:-scale-x-100" />}
      </button>
      <p
        id={ERROR_ID}
        role="alert"
        className="mt-2 text-center text-sm text-danger empty:hidden"
      >
        {error}
      </p>
    </form>
  );
}
