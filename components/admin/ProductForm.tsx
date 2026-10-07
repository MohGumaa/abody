"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createProduct,
  updateProduct,
  type ProductActionResult,
} from "@/actions/admin-products";
import { INPUT_BASE } from "@/components/auth/AuthForm";
import {
  CATEGORY_MAX,
  DESCRIPTION_MAX,
  IMAGE_MAX,
  INCLUDED_LINE_MAX,
  INCLUDED_MAX_LINES,
  NAME_MAX,
  SHORT_DESCRIPTION_MAX,
  SLUG_MAX,
  type ProductField,
  type ProductFieldError,
  type ProductFormValues,
} from "@/lib/admin-product-rules";

const INPUT = `${INPUT_BASE} px-4`;
const TEXTAREA = `${INPUT_BASE} h-auto px-4 py-3 leading-relaxed`;
const SUBMIT =
  "h-11 rounded-control bg-primary-strong px-5 text-sm font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-wait disabled:opacity-70";
const CARD = "grid gap-5 rounded-card border border-border bg-panel p-5 shadow-soft min-[600px]:p-6";

const FIELD_ERRORS: Record<ProductFieldError, string> = {
  required: "This field is required.",
  too_long: "This is too long.",
  invalid_slug: "Use lowercase letters, numbers, and single hyphens, such as facebook-ads-guide.",
  slug_taken: "Another product or service already uses this slug.",
  invalid_price: "Enter a price from 0.50 to 99999.99, with at most two decimals.",
  invalid_image: "Use an https:// URL or a site path starting with /.",
  too_many_lines: `Use at most ${INCLUDED_MAX_LINES} lines.`,
};

const FORM_ERRORS: Record<Exclude<ProductActionResult, null | { success: true }>["error"], string> = {
  invalid_fields: "Some fields need attention. Fix them and save again.",
  not_found: "This product no longer exists.",
  file_required: "Upload a file before publishing.",
  has_orders: "This product has orders.",
  unexpected: "Something went wrong. Try again.",
};

interface FieldSpec {
  field: ProductField;
  label: string;
  hint?: string;
  max: number;
  multiline?: number;
  arabic?: boolean;
  required?: boolean;
  inputMode?: "decimal";
  dir?: "ltr";
}

const LINES_HINT = `One item per line, up to ${INCLUDED_MAX_LINES} lines of ${INCLUDED_LINE_MAX} characters.`;

const ENGLISH: FieldSpec[] = [
  { field: "name", label: "Name", max: NAME_MAX, required: true },
  {
    field: "slug",
    label: "Slug",
    hint: "Used in the address: /en/products/your-slug.",
    max: SLUG_MAX,
    required: true,
    dir: "ltr",
  },
  { field: "shortDescription", label: "Short description", max: SHORT_DESCRIPTION_MAX, multiline: 2, required: true },
  { field: "description", label: "Description", max: DESCRIPTION_MAX, multiline: 6, required: true },
  { field: "category", label: "Category", hint: "Groups products in the store filter.", max: CATEGORY_MAX, required: true },
  // The line limits are checked on the server; maxLength would cap the total.
  { field: "included", label: "What's included", hint: LINES_HINT, max: 0, multiline: 4 },
];

const PRICING: FieldSpec[] = [
  { field: "price", label: "Price (USD)", hint: "For example 49 or 49.99.", max: 9, required: true, inputMode: "decimal", dir: "ltr" },
  {
    field: "image",
    label: "Image URL",
    hint: "Optional. An https:// URL or a site path such as /seed/cover.svg.",
    max: IMAGE_MAX,
    dir: "ltr",
  },
];

const ARABIC: FieldSpec[] = [
  { field: "nameAr", label: "Name (Arabic)", max: NAME_MAX, arabic: true },
  { field: "shortDescriptionAr", label: "Short description (Arabic)", max: SHORT_DESCRIPTION_MAX, multiline: 2, arabic: true },
  { field: "descriptionAr", label: "Description (Arabic)", max: DESCRIPTION_MAX, multiline: 6, arabic: true },
  { field: "categoryAr", label: "Category (Arabic)", max: CATEGORY_MAX, arabic: true },
  { field: "includedAr", label: "What's included (Arabic)", hint: LINES_HINT, max: 0, multiline: 4, arabic: true },
];

function Field({
  spec,
  value,
  error,
}: {
  spec: FieldSpec;
  value: string;
  error: ProductFieldError | undefined;
}) {
  const id = `product-${spec.field}`;
  const describedBy =
    [spec.hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    name: spec.field,
    // React text: admin-entered values never render as HTML.
    defaultValue: value,
    maxLength: spec.max > 0 ? spec.max : undefined,
    required: spec.required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    dir: spec.arabic ? "rtl" : spec.dir,
    lang: spec.arabic ? "ar" : undefined,
  } as const;

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {spec.label}
        {!spec.required && !spec.arabic && <span className="font-normal text-faint"> (optional)</span>}
      </label>
      {spec.multiline ? (
        <textarea {...common} rows={spec.multiline} className={TEXTAREA} />
      ) : (
        <input {...common} type="text" inputMode={spec.inputMode} className={INPUT} />
      )}
      {spec.hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {spec.hint}
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

// Creates a product (no id) or edits one. Status and the file have their own
// controls on the edit page.
export function ProductForm({
  id,
  initial,
}: {
  id?: string;
  initial: ProductFormValues;
}) {
  const [state, action, pending] = useActionState<ProductActionResult, FormData>(
    id ? updateProduct : createProduct,
    null,
  );
  const alertRef = useRef<HTMLDivElement>(null);
  const failed = !pending && state?.success === false ? state : null;
  const saved = !pending && state?.success === true;
  // React resets the form after each submit, so a failed one refills it.
  const values = failed?.values ?? initial;

  useEffect(() => {
    if (state?.success === false) alertRef.current?.focus();
  }, [state]);

  function fields(specs: FieldSpec[]) {
    return specs.map((spec) => (
      <Field
        key={spec.field}
        spec={spec}
        value={values[spec.field] ?? ""}
        error={failed?.fieldErrors?.[spec.field]}
      />
    ));
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

      <section aria-labelledby="product-english" className={CARD}>
        <h2 id="product-english" className="text-lg font-semibold">
          Details
        </h2>
        {fields(ENGLISH)}
      </section>

      <section aria-labelledby="product-pricing" className={CARD}>
        <h2 id="product-pricing" className="text-lg font-semibold">
          Price and image
        </h2>
        {fields(PRICING)}
      </section>

      <section aria-labelledby="product-arabic" className={CARD}>
        <div className="grid gap-1">
          <h2 id="product-arabic" className="text-lg font-semibold">
            Arabic content
          </h2>
          <p className="text-sm text-muted">
            Optional. Empty fields show the English text on Arabic pages.
          </p>
        </div>
        {fields(ARABIC)}
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={SUBMIT}>
          {pending ? "Saving…" : id ? "Save changes" : "Create product"}
        </button>
        <p role="status" className={saved ? "text-sm font-medium text-success" : "sr-only"}>
          {saved ? "Changes saved." : ""}
        </p>
      </div>
    </form>
  );
}
