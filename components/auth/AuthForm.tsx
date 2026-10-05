"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ComponentType,
} from "react";
import { register, signIn, type AuthActionError } from "@/actions/auth";
import {
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
  UserIcon,
} from "@/components/icons";
import type { AuthField, AuthFieldError } from "@/lib/auth";
import type { Locale } from "@/lib/i18n/config";

export type AuthMode = "signIn" | "register";

export interface AuthFormText {
  name: string;
  email: string;
  password: string;
  passwordHint: string;
  confirm: string;
  showPassword: string;
  hidePassword: string;
  submit: string;
  pending: string;
  errors: Record<Exclude<AuthActionError, "invalid_input">, string>;
  fieldErrors: Record<AuthFieldError, string>;
}

interface AuthFormProps {
  mode: AuthMode;
  locale: Locale;
  next: string;
  text: AuthFormText;
}

const FIELD_ORDER: AuthField[] = ["name", "email", "password", "confirm"];
const INPUT_BASE =
  "h-11.5 w-full rounded-control border border-border bg-surface text-foreground outline-offset-1 placeholder:text-faint focus-visible:border-transparent focus-visible:outline-2 focus-visible:outline-primary-strong aria-invalid:border-danger";
// Room for the leading icon, plus the show/hide button on password fields.
const INPUT = `${INPUT_BASE} ps-11 pe-4`;
const PASSWORD_INPUT = `${INPUT_BASE} ps-11 pe-12`;
// The address stays left-to-right inside Arabic pages, so both sides leave
// room for the icon, which sits on the page's inline start.
const EMAIL_INPUT = `${INPUT_BASE} px-11 rtl:text-right`;

export function AuthForm({ mode, locale, next, text }: AuthFormProps) {
  const [state, action, pending] = useActionState(
    mode === "register" ? register : signIn,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);

  // Errors belong to the last submit; a new submit clears them.
  const failed = !pending && state?.success === false ? state : null;
  const fieldErrors = failed?.fieldErrors ?? {};
  // The only other input is the hidden language, so a rejected one is unexpected.
  const formError = failed
    ? text.errors[failed.error === "invalid_input" ? "unexpected" : failed.error]
    : null;

  // After a failed submit, move focus to the first field to fix, or to the
  // message when no single field is at fault.
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

  const labelClass = "text-sm font-medium";

  return (
    <form ref={formRef} action={action} noValidate className="grid gap-5">
      <input type="hidden" name="lang" value={locale} />
      <input type="hidden" name="next" value={next} />

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

      {mode === "register" && (
        <div className="grid gap-2">
          <label htmlFor="name" className={labelClass}>
            {text.name}
          </label>
          <IconInput
            icon={UserIcon}
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={100}
            defaultValue={state?.values?.name ?? ""}
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={describedBy("name")}
            className={INPUT}
          />
          {fieldError("name")}
        </div>
      )}

      <div className="grid gap-2">
        <label htmlFor="email" className={labelClass}>
          {text.email}
        </label>
        <IconInput
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
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={describedBy("email")}
          className={EMAIL_INPUT}
        />
        {fieldError("email")}
      </div>

      <div className="grid gap-2">
        <label htmlFor="password" className={labelClass}>
          {text.password}
        </label>
        <PasswordInput
          id="password"
          name="password"
          showLabel={text.showPassword}
          hideLabel={text.hidePassword}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          required
          maxLength={128}
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={describedBy(
            "password",
            mode === "register" ? "password-hint" : undefined,
          )}
        />
        {mode === "register" && (
          <p id="password-hint" className="text-xs text-muted">
            {text.passwordHint}
          </p>
        )}
        {fieldError("password")}
      </div>

      {mode === "register" && (
        <div className="grid gap-2">
          <label htmlFor="confirm" className={labelClass}>
            {text.confirm}
          </label>
          <PasswordInput
            id="confirm"
            name="confirm"
            showLabel={text.showPassword}
            hideLabel={text.hidePassword}
            autoComplete="new-password"
            required
            maxLength={128}
            aria-invalid={fieldErrors.confirm ? true : undefined}
            aria-describedby={describedBy("confirm")}
          />
          {fieldError("confirm")}
        </div>
      )}

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

// A leading icon inside the field, on the inline start in both languages.
function IconInput({
  icon: Icon,
  className = INPUT,
  ...props
}: ComponentProps<"input"> & { icon: ComponentType<{ className?: string }> }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute start-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-faint" />
      <input {...props} className={className} />
    </div>
  );
}

// Toggling only changes the input type, so the typed value is kept.
function PasswordInput({
  showLabel,
  hideLabel,
  ...props
}: ComponentProps<"input"> & { id: string; showLabel: string; hideLabel: string }) {
  const [visible, setVisible] = useState(false);
  const Toggle = visible ? EyeOffIcon : EyeIcon;
  return (
    <div className="relative">
      <LockIcon className="pointer-events-none absolute start-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-faint" />
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={PASSWORD_INPUT}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        aria-controls={props.id}
        className="absolute end-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-control text-muted outline-offset-1 hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-primary-strong"
      >
        <Toggle />
      </button>
    </div>
  );
}
