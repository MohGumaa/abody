"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveSiteSettings, type SiteSettingsActionResult } from "@/actions/admin-site-settings";
import { INPUT_BASE } from "@/components/auth/AuthForm";
import { CONTACT_EMAIL_MAX, type SiteSettingsFormValues } from "@/lib/site-settings-rules";

const INPUT = `${INPUT_BASE} px-4`;
const SUBMIT =
  "h-11 rounded-control bg-primary-strong px-5 text-sm font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-wait disabled:opacity-70";
const CARD = "grid gap-5 rounded-card border border-border bg-panel p-5 shadow-soft min-[600px]:p-6";

const FORM_ERRORS: Record<Exclude<SiteSettingsActionResult, null | { success: true }>["error"], string> = {
  invalid_fields: "Some fields need attention. Fix them and save again.",
  unexpected: "Something went wrong. Try again.",
};

const ID = "settings-contactEmail";

export function SiteSettingsForm({ initial }: { initial: SiteSettingsFormValues }) {
  const [state, action, pending] = useActionState<SiteSettingsActionResult, FormData>(
    saveSiteSettings,
    null,
  );
  const alertRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const failed = !pending && state?.success === false ? state : null;
  const saved = !pending && state?.success === true;
  // React resets the form after each submit, so a failed one refills it.
  const values = failed?.values ?? initial;
  const error = failed?.fieldErrors?.contactEmail;

  useEffect(() => {
    if (state?.success !== false) return;
    // The one field takes focus when it is the problem; otherwise the alert.
    if (state.fieldErrors?.contactEmail) inputRef.current?.focus();
    else alertRef.current?.focus();
  }, [state]);

  const described = [`${ID}-hint`, error && `${ID}-error`].filter(Boolean).join(" ");

  return (
    <form action={action} noValidate className="grid gap-6">
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

      <section aria-labelledby="settings-contact" className={CARD}>
        <h2 id="settings-contact" className="text-lg font-semibold">
          Contact
        </h2>
        <div className="grid content-start gap-1.5">
          <label htmlFor={ID} className="text-sm font-medium">
            Contact email
            <span className="font-normal text-faint"> (optional)</span>
          </label>
          <input
            ref={inputRef}
            id={ID}
            name="contactEmail"
            type="email"
            autoComplete="off"
            spellCheck={false}
            dir="ltr"
            maxLength={CONTACT_EMAIL_MAX}
            defaultValue={values.contactEmail}
            aria-invalid={error ? true : undefined}
            aria-describedby={described}
            className={INPUT}
          />
          <p id={`${ID}-hint`} className="text-xs text-muted">
            Shown in the store footer. Leave blank to hide it.
          </p>
          {error && (
            <p id={`${ID}-error`} className="text-sm text-danger">
              Enter a valid email address, such as hello@example.com.
            </p>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={SUBMIT}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <p role="status" className={saved ? "text-sm font-medium text-success" : "sr-only"}>
          {saved ? "Settings saved." : ""}
        </p>
      </div>
    </form>
  );
}
