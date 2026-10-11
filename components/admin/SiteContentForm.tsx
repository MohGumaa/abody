"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { saveSiteContent, type SiteContentActionResult } from "@/actions/admin-site-content";
import { INPUT_BASE } from "@/components/auth/AuthForm";
import {
  ANNOUNCEMENT_LINK_MAX,
  textLimit,
  type SectionFlag,
  type SiteContentField,
  type SiteContentFieldError,
  type SiteContentFormValues,
  type TextField,
  type TextKey,
} from "@/lib/site-content-rules";

const INPUT = `${INPUT_BASE} px-4`;
const TEXTAREA = `${INPUT_BASE} h-auto px-4 py-3 leading-relaxed`;
const SUBMIT =
  "h-11 rounded-control bg-primary-strong px-5 text-sm font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-wait disabled:opacity-70";
const CARD = "grid gap-5 rounded-card border border-border bg-panel p-5 shadow-soft min-[600px]:p-6";
const CHECKBOX = "size-4.5 shrink-0 accent-primary-strong";

const FORM_ERRORS: Record<Exclude<SiteContentActionResult, null | { success: true }>["error"], string> = {
  invalid_fields: "Some fields need attention. Fix them and save again.",
  unexpected: "Something went wrong. Try again.",
};

function fieldError(field: SiteContentField, error: SiteContentFieldError): string {
  switch (error) {
    case "too_long":
      return `Use ${field === "announcementLink" ? ANNOUNCEMENT_LINK_MAX : textLimit(field)} characters or fewer.`;
    case "required":
      return "Add the English and Arabic text to turn the bar on.";
    case "invalid_link":
      return "Use a store path such as /products, or a full https:// address.";
  }
}

const SECTION_LABELS: Record<SectionFlag, string> = {
  showCategories: "Shop by category",
  showFeatured: "Featured products",
  showServices: "Services",
  showValues: "Why Abody (the three value panels)",
  showHowItWorks: "How it works",
  showCta: "Call to action",
};

const TEXT_LABELS: Record<TextKey, { label: string; multiline?: boolean }> = {
  heroEyebrow: { label: "Eyebrow" },
  heroTitle: { label: "Title" },
  heroLead: { label: "Lead", multiline: true },
  ctaTitle: { label: "Title" },
  ctaBody: { label: "Body", multiline: true },
  ctaAction: { label: "Button label" },
  announcementText: { label: "Text" },
};

const fieldId = (field: SiteContentField) => `site-${field}`;

function FieldShell({
  field,
  label,
  hint,
  error,
  children,
}: {
  field: SiteContentField;
  label: string;
  hint?: string;
  error: SiteContentFieldError | undefined;
  children: ReactNode;
}) {
  const id = fieldId(field);
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        <span className="font-normal text-faint"> (optional)</span>
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {fieldError(field, error)}
        </p>
      )}
    </div>
  );
}

// Built-in text per field, shown as placeholders: a blank field uses it.
export type SiteContentDefaults = Partial<Record<TextField, string>>;

export function SiteContentForm({
  initial,
  defaults,
}: {
  initial: SiteContentFormValues;
  defaults: SiteContentDefaults;
}) {
  const [state, action, pending] = useActionState<SiteContentActionResult, FormData>(
    saveSiteContent,
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

  function common(field: SiteContentField, hint: boolean) {
    const id = fieldId(field);
    const described = [hint && `${id}-hint`, errors[field] && `${id}-error`].filter(Boolean);
    return {
      id,
      name: field,
      defaultValue: values[field],
      "aria-invalid": errors[field] ? true : undefined,
      "aria-describedby": described.join(" ") || undefined,
    } as const;
  }

  // One English and one Arabic field side by side.
  function textPair(key: TextKey) {
    const { label, multiline } = TEXT_LABELS[key];
    return (
      <div className="grid gap-4 min-[700px]:grid-cols-2">
        {([key, `${key}Ar`] as const).map((field) => {
          const arabic = field.endsWith("Ar");
          const props = {
            ...common(field, false),
            maxLength: textLimit(field),
            placeholder: defaults[field],
            lang: arabic ? "ar" : "en",
            dir: arabic ? "rtl" : "ltr",
          } as const;
          return (
            <FieldShell
              key={field}
              field={field}
              label={`${label} (${arabic ? "Arabic" : "English"})`}
              error={errors[field]}
            >
              {multiline ? (
                <textarea {...props} rows={3} className={TEXTAREA} />
              ) : (
                <input {...props} type="text" className={INPUT} />
              )}
            </FieldShell>
          );
        })}
      </div>
    );
  }

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

      <section aria-labelledby="site-hero" className={CARD}>
        <div className="grid gap-1">
          <h2 id="site-hero" className="text-lg font-semibold">
            Hero
          </h2>
          <p className="text-sm text-muted">
            The banner at the top of the home page. Leave a field empty to use the built-in text
            shown in it.
          </p>
        </div>
        {textPair("heroEyebrow")}
        {textPair("heroTitle")}
        {textPair("heroLead")}
      </section>

      <fieldset className={CARD}>
        <legend className="float-left text-lg font-semibold">Home sections</legend>
        <p className="clear-both text-sm text-muted">
          Unchecked sections are hidden from the home page in both languages. The hero always
          shows.
        </p>
        <div className="grid gap-3 min-[700px]:grid-cols-2">
          {(Object.keys(SECTION_LABELS) as SectionFlag[]).map((flag) => (
            <label key={flag} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name={flag}
                defaultChecked={values[flag]}
                className={CHECKBOX}
              />
              {SECTION_LABELS[flag]}
            </label>
          ))}
        </div>
      </fieldset>

      <section aria-labelledby="site-cta" className={CARD}>
        <div className="grid gap-1">
          <h2 id="site-cta" className="text-lg font-semibold">
            Call to action
          </h2>
          <p className="text-sm text-muted">The banner at the bottom of the home page.</p>
        </div>
        {textPair("ctaTitle")}
        {textPair("ctaBody")}
        {textPair("ctaAction")}
      </section>

      <section aria-labelledby="site-announcement" className={CARD}>
        <div className="grid gap-1">
          <h2 id="site-announcement" className="text-lg font-semibold">
            Announcement bar
          </h2>
          <p className="text-sm text-muted">
            One line above the header on every store page. Turning it on needs both texts.
          </p>
        </div>
        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            name="announcementEnabled"
            defaultChecked={values.announcementEnabled}
            className={CHECKBOX}
          />
          Show the announcement bar
        </label>
        {textPair("announcementText")}
        <FieldShell
          field="announcementLink"
          label="Link"
          hint="A store path without the language, such as /products or /services/ads-management, or a full https:// address. The whole text becomes the link."
          error={errors.announcementLink}
        >
          <input
            {...common("announcementLink", true)}
            type="text"
            maxLength={ANNOUNCEMENT_LINK_MAX}
            spellCheck={false}
            dir="ltr"
            className={INPUT}
          />
        </FieldShell>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={SUBMIT}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <p role="status" className={saved ? "text-sm font-medium text-success" : "sr-only"}>
          {saved ? "Changes saved." : ""}
        </p>
      </div>
    </form>
  );
}
