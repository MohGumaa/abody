"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { resetPassword, type ResetPasswordError } from "@/actions/auth";
import { PasswordInput } from "@/components/auth/AuthForm";
import type { AuthField, AuthFieldError } from "@/lib/auth";
import type { Locale } from "@/lib/i18n/config";

export interface ResetPasswordFormText {
  password: string;
  passwordHint: string;
  confirm: string;
  showPassword: string;
  hidePassword: string;
  submit: string;
  pending: string;
  errors: Record<Exclude<ResetPasswordError, "invalid_input">, string>;
  fieldErrors: Record<AuthFieldError, string>;
}

const FIELD_ORDER: AuthField[] = ["password", "confirm"];

// Success redirects to sign in, so this form only ever shows failures.
export function ResetPasswordForm({
  locale,
  token,
  text,
}: {
  locale: Locale;
  token: string;
  text: ResetPasswordFormText;
}) {
  const [state, action, pending] = useActionState(resetPassword, null);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const failed = !pending && state?.success === false ? state : null;
  const fieldErrors = failed?.fieldErrors ?? {};
  // The other inputs are hidden, so a rejected one is unexpected.
  const formError = failed
    ? text.errors[failed.error === "invalid_input" ? "unexpected" : failed.error]
    : null;

  useEffect(() => {
    if (!state || state.success !== false) return;
    const first = FIELD_ORDER.find((field) => state.fieldErrors?.[field]);
    const target = first
      ? formRef.current?.querySelector<HTMLInputElement>(`#${first}`)
      : alertRef.current;
    target?.focus();
  }, [state]);

  function describedBy(field: AuthField, hint?: string) {
    const ids = [hint, fieldErrors[field] ? `${field}-error` : undefined];
    return ids.filter(Boolean).join(" ") || undefined;
  }

  function fieldError(field: AuthField) {
    const code = fieldErrors[field];
    return code ? (
      <p id={`${field}-error`} className="text-sm text-danger">
        {text.fieldErrors[code]}
      </p>
    ) : null;
  }

  return (
    <form ref={formRef} action={action} noValidate className="grid gap-5">
      <input type="hidden" name="lang" value={locale} />
      <input type="hidden" name="token" value={token} />

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
        <label htmlFor="password" className="text-sm font-medium">
          {text.password}
        </label>
        <PasswordInput
          id="password"
          name="password"
          showLabel={text.showPassword}
          hideLabel={text.hidePassword}
          visible={passwordVisible}
          onVisibleChange={setPasswordVisible}
          controls="confirm"
          autoComplete="new-password"
          required
          maxLength={128}
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={describedBy("password", "password-hint")}
        />
        <p id="password-hint" className="text-xs text-muted">
          {text.passwordHint}
        </p>
        {fieldError("password")}
      </div>

      <div className="grid gap-2">
        <label htmlFor="confirm" className="text-sm font-medium">
          {text.confirm}
        </label>
        <PasswordInput
          id="confirm"
          name="confirm"
          visible={passwordVisible}
          autoComplete="new-password"
          required
          maxLength={128}
          aria-invalid={fieldErrors.confirm ? true : undefined}
          aria-describedby={describedBy("confirm")}
        />
        {fieldError("confirm")}
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
