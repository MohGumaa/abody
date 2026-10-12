"use client";

import { useActionState, useEffect, useRef } from "react";
import { requestPasswordReset, type ForgotPasswordError } from "@/actions/auth";
import { EMAIL_INPUT, IconInput } from "@/components/auth/AuthForm";
import { MailIcon } from "@/components/icons";
import type { AuthFieldError } from "@/lib/auth";
import type { Locale } from "@/lib/i18n/config";

export interface ForgotPasswordFormText {
  email: string;
  submit: string;
  pending: string;
  sent: string;
  errors: Record<Exclude<ForgotPasswordError, "invalid_input">, string>;
  fieldErrors: Record<AuthFieldError, string>;
}

// The same message follows every accepted request, whether or not the email
// has an account (feature 28).
export function ForgotPasswordForm({
  locale,
  text,
}: {
  locale: Locale;
  text: ForgotPasswordFormText;
}) {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  const emailRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  const failed = !pending && state?.success === false ? state : null;
  const emailError = failed?.fieldErrors?.email;
  // The only other input is the hidden language, so a rejected one is unexpected.
  const formError = failed
    ? text.errors[failed.error === "invalid_input" ? "unexpected" : failed.error]
    : null;

  // Focus the email to fix, the message, or the confirmation.
  useEffect(() => {
    if (!state) return;
    if (state.success) statusRef.current?.focus();
    else if (state.fieldErrors?.email) emailRef.current?.focus();
    else alertRef.current?.focus();
  }, [state]);

  if (state?.success) {
    return (
      <p
        ref={statusRef}
        role="status"
        tabIndex={-1}
        className="rounded-control bg-primary-soft px-4 py-3 text-sm text-foreground outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary-strong"
      >
        {text.sent}
      </p>
    );
  }

  return (
    <form action={action} noValidate className="grid gap-5">
      <input type="hidden" name="lang" value={locale} />

      <p
        ref={alertRef}
        role="alert"
        tabIndex={-1}
        className={
          formError
            ? "rounded-control bg-danger-soft px-4 py-3 text-sm text-danger outline-offset-2 focus-visible:outline-2 focus-visible:outline-danger"
            : "sr-only"
        }
      >
        {formError}
      </p>

      <div className="grid gap-2">
        <label htmlFor="email" className="text-sm font-medium">
          {text.email}
        </label>
        <IconInput
          ref={emailRef}
          icon={MailIcon}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          dir="ltr"
          required
          maxLength={254}
          placeholder="you@example.com"
          defaultValue={state?.values?.email ?? ""}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "email-error" : undefined}
          className={EMAIL_INPUT}
        />
        {emailError && (
          <p id="email-error" className="text-sm text-danger">
            {text.fieldErrors[emailError]}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-control bg-primary-strong px-5 font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? text.pending : text.submit}
      </button>
    </form>
  );
}
