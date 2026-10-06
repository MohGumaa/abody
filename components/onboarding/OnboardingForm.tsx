"use client";

import {
  useActionState,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import {
  submitOnboarding,
  type OnboardingActionResult,
} from "@/actions/onboarding";
import { INPUT_BASE } from "@/components/auth/AuthForm";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import {
  ONBOARDING_FIELDS,
  ONBOARDING_MAX_LENGTH,
  type OnboardingField,
  type OnboardingRequirements,
} from "@/lib/onboarding";

type OnboardingText = Dictionary["onboarding"];
type Failed = Extract<OnboardingActionResult, { success: false }>;

interface OnboardingFormProps {
  text: OnboardingText;
  itemId: string;
  // Present for a guest who came from the success page.
  sessionId: string | null;
  // Saved answers, when the customer already sent them.
  saved: OnboardingRequirements | null;
  // Where the "sign in again" link goes when the session ended mid-form.
  loginHref: string;
}

const INPUT = `${INPUT_BASE} px-4`;
const TEXTAREA = `${INPUT_BASE} h-auto min-h-32 px-4 py-3`;
const LABEL = "text-sm font-medium";
const HINT = "text-xs text-muted";
const SUBMIT =
  "h-11 rounded-control bg-primary-strong px-5 text-sm font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-wait disabled:opacity-70 justify-self-start";

const MULTILINE: ReadonlySet<OnboardingField> = new Set(["campaignGoals", "notes"]);
const HINTED: ReadonlySet<OnboardingField> = new Set(["adAccount", "budget"]);

function fieldId(field: OnboardingField): string {
  return `onboarding-${field}`;
}

function Messages({
  failed,
  succeeded,
  alertRef,
  text,
  loginHref,
}: {
  failed: Failed | null;
  succeeded: boolean;
  alertRef: RefObject<HTMLDivElement | null>;
  text: OnboardingText;
  loginHref: string;
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
    // The form sends only its own fields, so a rejected shape is unexpected.
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
          succeeded
            ? "rounded-control bg-surface px-4 py-3 text-sm font-medium text-primary-strong"
            : "sr-only"
        }
      >
        {succeeded ? text.saved : null}
      </p>
    </>
  );
}

export function OnboardingForm({
  text,
  itemId,
  sessionId,
  saved,
  loginHref,
}: OnboardingFormProps) {
  const [state, action, pending] = useActionState(submitOnboarding, null);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  // Results belong to the last submit, so a new submit clears them.
  const current = pending ? null : state;
  const failed = current?.success === false ? current : null;
  const succeeded = current?.success === true;

  // After a failed submit, move focus to the first field to fix, or to the
  // message when no single field is at fault.
  useEffect(() => {
    if (!state || state.success !== false) return;
    const first = ONBOARDING_FIELDS.find((field) => state.fieldErrors?.[field]);
    const target = first
      ? formRef.current?.querySelector<HTMLElement>(`#${fieldId(first)}`)
      : alertRef.current;
    target?.focus();
  }, [state]);

  return (
    <form ref={formRef} action={action} noValidate className="grid gap-5">
      <Messages
        failed={failed}
        succeeded={succeeded}
        alertRef={alertRef}
        text={text}
        loginHref={loginHref}
      />
      <input type="hidden" name="itemId" value={itemId} />
      {sessionId && <input type="hidden" name="sessionId" value={sessionId} />}
      {ONBOARDING_FIELDS.map((field) => {
        const id = fieldId(field);
        const required = field === "businessName";
        const code = failed?.fieldErrors?.[field];
        const hintId = HINTED.has(field) ? `${id}-hint` : undefined;
        const errorId = code ? `${id}-error` : undefined;
        const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
        // The form resets after each submit; keep what was typed when it failed.
        const value = failed?.values?.[field] ?? saved?.[field] ?? "";
        const props = {
          id,
          name: field,
          required,
          maxLength: ONBOARDING_MAX_LENGTH[field],
          defaultValue: value,
          dir: "auto" as const,
          "aria-invalid": code ? true : undefined,
          "aria-describedby": describedBy,
        };
        return (
          <div key={field} className="grid gap-2">
            <label htmlFor={id} className={LABEL}>
              {text.fields[field]}
              {required && (
                <span className="text-danger">
                  {" "}
                  <span aria-hidden="true">*</span>
                  <span className="sr-only">({text.required})</span>
                </span>
              )}
            </label>
            {MULTILINE.has(field) ? (
              <textarea {...props} rows={4} className={TEXTAREA} />
            ) : (
              <input
                {...props}
                type="text"
                autoComplete={
                  field === "businessName"
                    ? "organization"
                    : field === "website"
                      ? "url"
                      : "off"
                }
                className={INPUT}
              />
            )}
            {hintId && (
              <p id={hintId} className={HINT}>
                {text.hints[field as "adAccount" | "budget"]}
              </p>
            )}
            {code && (
              <p id={errorId} className="text-sm text-danger">
                {text.fieldErrors[code].replace(
                  "{max}",
                  String(ONBOARDING_MAX_LENGTH[field]),
                )}
              </p>
            )}
          </div>
        );
      })}
      <button type="submit" disabled={pending} className={SUBMIT}>
        {pending ? text.pending : saved ? text.update : text.submit}
      </button>
    </form>
  );
}
