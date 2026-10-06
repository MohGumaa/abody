"use client";

import {
  useActionState,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import {
  changePassword,
  signOutOtherSessions,
  updateProfile,
  type AccountActionResult,
} from "@/actions/account";
import {
  EMAIL_INPUT,
  IconInput,
  INPUT,
  PasswordInput,
} from "@/components/auth/AuthForm";
import { MailIcon, UserIcon } from "@/components/icons";
import type { AccountField } from "@/lib/auth";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { formatItemCount } from "@/lib/i18n/plural";

type SettingsText = Dictionary["settings"];
type FieldIds = Partial<Record<AccountField, string>>;

interface FormProps {
  text: SettingsText;
  // Where the "sign in again" link goes when the session ended mid-form.
  loginHref: string;
}

const LABEL = "text-sm font-medium";
const HINT = "text-xs text-muted";
const SUBMIT =
  "h-11 rounded-control bg-primary-strong px-5 text-sm font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-wait disabled:opacity-70 justify-self-start";
const SECONDARY =
  "h-11 rounded-control border border-border bg-surface px-5 text-sm font-semibold text-foreground outline-offset-2 hover:border-primary hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-wait disabled:opacity-70 justify-self-start";

// Messages and focus for one settings form. Results belong to the last
// submit, so a new submit clears them.
function useResult(
  state: AccountActionResult,
  pending: boolean,
  fieldIds: FieldIds,
) {
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const current = pending ? null : state;
  const failed = current?.success === false ? current : null;
  const succeeded = current?.success === true ? current : null;

  // After a failed submit, move focus to the first field to fix, or to the
  // message when no single field is at fault.
  useEffect(() => {
    if (!state || state.success !== false) return;
    const first = (Object.keys(fieldIds) as AccountField[]).find(
      (field) => state.fieldErrors?.[field],
    );
    const target = first
      ? formRef.current?.querySelector<HTMLElement>(`#${fieldIds[first]}`)
      : alertRef.current;
    target?.focus();
  }, [state, fieldIds]);

  return { formRef, alertRef, failed, succeeded };
}

function FormMessages({
  alertRef,
  failed,
  success,
  text,
  loginHref,
}: FormProps & {
  alertRef: RefObject<HTMLDivElement | null>;
  failed: Extract<AccountActionResult, { success: false }> | null;
  success: string | null;
}) {
  let error: ReactNode = null;
  if (failed?.error === "signed_out") {
    error = (
      <>
        {text.signedOut}{" "}
        <a href={loginHref} className="font-semibold underline">
          {text.signInAgain}
        </a>
      </>
    );
  } else if (failed) {
    // The forms send only their own fields, so a rejected shape is unexpected.
    error = text.errors[failed.error === "invalid_input" ? "unexpected" : failed.error];
  }

  return (
    <>
      <div
        ref={alertRef}
        role="alert"
        tabIndex={-1}
        className={
          error
            ? "rounded-control bg-danger-soft px-4 py-3 text-sm text-danger outline-offset-2 focus-visible:outline-2 focus-visible:outline-danger"
            : "sr-only"
        }
      >
        {error}
      </div>
      <p
        role="status"
        className={
          success
            ? "rounded-control bg-surface px-4 py-3 text-sm font-medium text-primary-strong"
            : "sr-only"
        }
      >
        {success}
      </p>
    </>
  );
}

function FieldError({
  id,
  failed,
  field,
  text,
}: {
  id: string;
  failed: Extract<AccountActionResult, { success: false }> | null;
  field: AccountField;
  text: SettingsText;
}) {
  const code = failed?.fieldErrors?.[field];
  return code ? (
    <p id={`${id}-error`} className="text-sm text-danger">
      {text.fieldErrors[code]}
    </p>
  ) : null;
}

function fieldProps(
  failed: Extract<AccountActionResult, { success: false }> | null,
  field: AccountField,
  id: string,
  hint?: string,
) {
  const invalid = Boolean(failed?.fieldErrors?.[field]);
  const describedBy = [hint, invalid ? `${id}-error` : undefined]
    .filter(Boolean)
    .join(" ");
  return {
    id,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy || undefined,
  };
}

const PROFILE_IDS: FieldIds = {
  name: "profile-name",
  email: "profile-email",
  currentPassword: "profile-current-password",
};

export function ProfileForm({
  name,
  email,
  ...props
}: FormProps & { name: string; email: string }) {
  const { text } = props;
  const [state, action, pending] = useActionState(updateProfile, null);
  const { formRef, alertRef, failed, succeeded } = useResult(
    state,
    pending,
    PROFILE_IDS,
  );
  const ids = PROFILE_IDS as Required<FieldIds>;
  // The form resets after each submit; keep what was typed when it failed.
  const values = failed?.values;

  return (
    <form ref={formRef} action={action} noValidate className="grid gap-5">
      <FormMessages
        {...props}
        alertRef={alertRef}
        failed={failed}
        success={succeeded ? text.profile.saved : null}
      />
      <div className="grid gap-2">
        <label htmlFor={ids.name} className={LABEL}>
          {text.profile.name}
        </label>
        <IconInput
          icon={UserIcon}
          {...fieldProps(failed, "name", ids.name)}
          name="name"
          type="text"
          autoComplete="name"
          required
          maxLength={100}
          defaultValue={values?.name ?? name}
          className={INPUT}
        />
        <FieldError id={ids.name} failed={failed} field="name" text={text} />
      </div>
      <div className="grid gap-2">
        <label htmlFor={ids.email} className={LABEL}>
          {text.profile.email}
        </label>
        <IconInput
          icon={MailIcon}
          {...fieldProps(failed, "email", ids.email)}
          name="email"
          type="email"
          autoComplete="email"
          dir="ltr"
          required
          maxLength={254}
          defaultValue={values?.email ?? email}
          className={EMAIL_INPUT}
        />
        <FieldError id={ids.email} failed={failed} field="email" text={text} />
      </div>
      <div className="grid gap-2">
        <label htmlFor={ids.currentPassword} className={LABEL}>
          {text.currentPassword}
        </label>
        <PasswordInput
          {...fieldProps(
            failed,
            "currentPassword",
            ids.currentPassword,
            `${ids.currentPassword}-hint`,
          )}
          id={ids.currentPassword}
          name="currentPassword"
          showLabel={text.showPassword}
          hideLabel={text.hidePassword}
          autoComplete="current-password"
          maxLength={128}
        />
        <p id={`${ids.currentPassword}-hint`} className={HINT}>
          {text.profile.currentPasswordHint}
        </p>
        <FieldError
          id={ids.currentPassword}
          failed={failed}
          field="currentPassword"
          text={text}
        />
      </div>
      <button type="submit" disabled={pending} className={SUBMIT}>
        {pending ? text.profile.pending : text.profile.submit}
      </button>
    </form>
  );
}

const PASSWORD_IDS: FieldIds = {
  currentPassword: "current-password",
  newPassword: "new-password",
  confirm: "confirm-password",
};

export function PasswordForm(props: FormProps) {
  const { text } = props;
  const [state, action, pending] = useActionState(changePassword, null);
  const { formRef, alertRef, failed, succeeded } = useResult(
    state,
    pending,
    PASSWORD_IDS,
  );
  const ids = PASSWORD_IDS as Required<FieldIds>;
  const passwordProps = {
    showLabel: text.showPassword,
    hideLabel: text.hidePassword,
    required: true,
    maxLength: 128,
  };

  return (
    <form ref={formRef} action={action} noValidate className="grid gap-5">
      <FormMessages
        {...props}
        alertRef={alertRef}
        failed={failed}
        success={succeeded ? text.password.saved : null}
      />
      <div className="grid gap-2">
        <label htmlFor={ids.currentPassword} className={LABEL}>
          {text.currentPassword}
        </label>
        <PasswordInput
          {...fieldProps(failed, "currentPassword", ids.currentPassword)}
          id={ids.currentPassword}
          name="currentPassword"
          autoComplete="current-password"
          {...passwordProps}
        />
        <FieldError
          id={ids.currentPassword}
          failed={failed}
          field="currentPassword"
          text={text}
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor={ids.newPassword} className={LABEL}>
          {text.password.newPassword}
        </label>
        <PasswordInput
          {...fieldProps(
            failed,
            "newPassword",
            ids.newPassword,
            `${ids.newPassword}-hint`,
          )}
          id={ids.newPassword}
          name="newPassword"
          autoComplete="new-password"
          {...passwordProps}
        />
        <p id={`${ids.newPassword}-hint`} className={HINT}>
          {text.password.newPasswordHint}
        </p>
        <FieldError
          id={ids.newPassword}
          failed={failed}
          field="newPassword"
          text={text}
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor={ids.confirm} className={LABEL}>
          {text.password.confirm}
        </label>
        <PasswordInput
          {...fieldProps(failed, "confirm", ids.confirm)}
          id={ids.confirm}
          name="confirm"
          autoComplete="new-password"
          {...passwordProps}
        />
        <FieldError id={ids.confirm} failed={failed} field="confirm" text={text} />
      </div>
      <button type="submit" disabled={pending} className={SUBMIT}>
        {pending ? text.password.pending : text.password.submit}
      </button>
    </form>
  );
}

const NO_FIELDS: FieldIds = {};

export function OtherSessionsForm({
  locale,
  ...props
}: FormProps & { locale: Locale }) {
  const { text } = props;
  const [state, action, pending] = useActionState(signOutOtherSessions, null);
  const { formRef, alertRef, failed, succeeded } = useResult(
    state,
    pending,
    NO_FIELDS,
  );
  const ended = succeeded?.ended ?? 0;
  const success = !succeeded
    ? null
    : ended === 0
      ? text.sessions.none
      : formatItemCount(locale, ended, text.sessions.ended);

  return (
    <form ref={formRef} action={action} className="grid gap-4">
      <FormMessages {...props} alertRef={alertRef} failed={failed} success={success} />
      <button type="submit" disabled={pending} className={SECONDARY}>
        {pending ? text.sessions.pending : text.sessions.submit}
      </button>
    </form>
  );
}
