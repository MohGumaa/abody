"use client";

import { useActionState, useEffect, useRef, useState, type RefObject } from "react";
import {
  createProduct,
  createService,
  updateProduct,
  updateService,
  type ProductActionResult,
} from "@/actions/admin-products";
import { INPUT_BASE } from "@/components/auth/AuthForm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORY_MAX,
  DESCRIPTION_MAX,
  DURATION_MAX_DAYS,
  DURATION_MIN_DAYS,
  IMAGE_MAX,
  INCLUDED_LINE_MAX,
  INCLUDED_MAX_LINES,
  NAME_MAX,
  SHORT_DESCRIPTION_MAX,
  SLUG_MAX,
  initialCategoryPick,
  type CategoryOption,
  type CategoryPick,
  type ProductField,
  type ProductFieldError,
  type ProductFormValues,
} from "@/lib/admin-product-rules";
import type { ProductType } from "@/lib/generated/prisma/enums";

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
  invalid_duration: `Enter a whole number of days from ${DURATION_MIN_DAYS} to ${DURATION_MAX_DAYS}, or leave it empty.`,
};

type FormError = Exclude<ProductActionResult, null | { success: true }>["error"];

function formErrors(noun: string): Record<FormError, string> {
  return {
    invalid_fields: "Some fields need attention. Fix them and save again.",
    not_found: `This ${noun} no longer exists.`,
    file_required: "Upload a file before publishing.",
    has_orders: `This ${noun} has orders.`,
    unexpected: "Something went wrong. Try again.",
  };
}

interface FieldSpec {
  field: ProductField;
  label: string;
  hint?: string;
  max: number;
  multiline?: number;
  arabic?: boolean;
  required?: boolean;
  inputMode?: "decimal" | "numeric";
  dir?: "ltr";
}

// Select item values are never submitted, so they cannot clash with a name.
const NEW_CATEGORY = "new";
const optionValue = (index: number) => `option:${index}`;

const LINES_HINT = `One item per line, up to ${INCLUDED_MAX_LINES} lines of ${INCLUDED_LINE_MAX} characters.`;
const REQUIREMENTS_HINT = `What the customer needs to provide. ${LINES_HINT}`;

// Products and services share every field; services add a duration and
// requirements. The line limits are checked on the server; maxLength would
// cap the total.
function fieldSpecs(type: ProductType) {
  const isService = type === "SERVICE";
  const english: FieldSpec[] = [
    { field: "name", label: "Name", max: NAME_MAX, required: true },
    {
      field: "slug",
      label: "Slug",
      hint: `Used in the address: /en/${isService ? "services" : "products"}/your-slug.`,
      max: SLUG_MAX,
      required: true,
      dir: "ltr",
    },
    { field: "shortDescription", label: "Short description", max: SHORT_DESCRIPTION_MAX, multiline: 2, required: true },
    { field: "description", label: "Description", max: DESCRIPTION_MAX, multiline: 6, required: true },
  ];
  const lists: FieldSpec[] = [
    { field: "included", label: "What's included", hint: LINES_HINT, max: 0, multiline: 4 },
    ...(isService
      ? [{ field: "requirements", label: "Requirements", hint: REQUIREMENTS_HINT, max: 0, multiline: 4 } as const]
      : []),
  ];
  const pricing: FieldSpec[] = [
    { field: "price", label: "Price (USD)", hint: "For example 49 or 49.99.", max: 9, required: true, inputMode: "decimal", dir: "ltr" },
    ...(isService
      ? [
          {
            field: "durationDays",
            label: "Duration (days)",
            hint: `A whole number from ${DURATION_MIN_DAYS} to ${DURATION_MAX_DAYS}. Leave it empty to show no duration.`,
            max: 3,
            inputMode: "numeric",
            dir: "ltr",
          } as const,
        ]
      : []),
    {
      field: "image",
      label: "Image URL",
      hint: "Optional. An https:// URL or a site path such as /seed/cover.svg.",
      max: IMAGE_MAX,
      dir: "ltr",
    },
  ];
  const arabic: FieldSpec[] = [
    { field: "nameAr", label: "Name (Arabic)", max: NAME_MAX, arabic: true },
    { field: "shortDescriptionAr", label: "Short description (Arabic)", max: SHORT_DESCRIPTION_MAX, multiline: 2, arabic: true },
    { field: "descriptionAr", label: "Description (Arabic)", max: DESCRIPTION_MAX, multiline: 6, arabic: true },
    { field: "categoryAr", label: "Category (Arabic)", max: CATEGORY_MAX, arabic: true },
    { field: "includedAr", label: "What's included (Arabic)", hint: LINES_HINT, max: 0, multiline: 4, arabic: true },
    ...(isService
      ? [{ field: "requirementsAr", label: "Requirements (Arabic)", hint: LINES_HINT, max: 0, multiline: 4, arabic: true } as const]
      : []),
  ];
  return { english, lists, pricing, arabic };
}

function Field({
  spec,
  value,
  error,
  onValueChange,
}: {
  spec: FieldSpec;
  value: string;
  error: ProductFieldError | undefined;
  // Makes the field controlled, for values other fields can fill in.
  onValueChange?: (value: string) => void;
}) {
  const id = `product-${spec.field}`;
  const describedBy =
    [spec.hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    name: spec.field,
    // React text: admin-entered values never render as HTML.
    ...(onValueChange
      ? { value, onChange: (event: { target: { value: string } }) => onValueChange(event.target.value) }
      : { defaultValue: value }),
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

// The category: a pick from the categories in use, or a new name typed in.
// Exactly one input named "category" is rendered, so the Select's own values
// never reach the server; the server validates the name as before.
function CategoryField({
  options,
  pick,
  onPick,
  hint,
  error,
  newInputRef,
  formResetting,
}: {
  options: CategoryOption[];
  hint: string;
  pick: CategoryPick;
  onPick: (pick: CategoryPick) => void;
  error: ProductFieldError | undefined;
  newInputRef: RefObject<HTMLInputElement | null>;
  formResetting: RefObject<boolean>;
}) {
  const focusNew = useRef(false);
  const id = "product-category";
  const newId = `${id}-new`;
  const describedBy = [`${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ");
  const isNew = pick.mode === "new";
  const hasOptions = options.length > 0;

  const newInput = isNew && (
    <input
      ref={newInputRef}
      id={hasOptions ? newId : id}
      name="category"
      type="text"
      value={pick.text}
      onChange={(event) => onPick({ mode: "new", text: event.target.value })}
      maxLength={CATEGORY_MAX}
      required
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      className={INPUT}
    />
  );

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        Category
      </label>
      {hasOptions && (
        <Select
          value={
            pick.mode === "existing" ? optionValue(pick.index) : isNew ? NEW_CATEGORY : ""
          }
          onValueChange={(value) => {
            // Radix puts its mount-time value back on every form reset, and
            // React resets the form after each submit; the form's own state
            // already follows the submitted values, so ignore that change.
            if (formResetting.current) return;
            if (value === NEW_CATEGORY) {
              focusNew.current = true;
              onPick({ mode: "new", text: "" });
              return;
            }
            const match = /^option:(\d+)$/.exec(value);
            const index = match ? Number(match[1]) : -1;
            if (index >= 0 && index < options.length) onPick({ mode: "existing", index });
          }}
        >
          <SelectTrigger
            id={id}
            aria-invalid={error && !isNew ? true : undefined}
            aria-describedby={describedBy}
          >
            <SelectValue placeholder="Choose a category" />
          </SelectTrigger>
          <SelectContent
            onCloseAutoFocus={(event) => {
              // Picking "New category…" moves focus to the field it reveals.
              if (!focusNew.current) return;
              focusNew.current = false;
              event.preventDefault();
              setTimeout(() => newInputRef.current?.focus());
            }}
          >
            {options.map((option, index) => (
              <SelectItem key={option.category} value={optionValue(index)}>
                {option.category}
              </SelectItem>
            ))}
            <SelectSeparator />
            <SelectItem value={NEW_CATEGORY}>New category…</SelectItem>
          </SelectContent>
        </Select>
      )}
      {pick.mode === "existing" && (
        <input type="hidden" name="category" value={options[pick.index].category} />
      )}
      {isNew && hasOptions ? (
        <div className="mt-2 grid gap-1.5">
          <label htmlFor={newId} className="text-sm font-medium">
            New category
          </label>
          {newInput}
        </div>
      ) : (
        newInput
      )}
      <p id={`${id}-hint`} className="text-xs text-muted">
        {hint}
      </p>
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {FIELD_ERRORS[error]}
        </p>
      )}
    </div>
  );
}

// Creates a product or service (no id) or edits one. Status and the file have
// their own controls on the edit page. The type picks the server action, which
// binds the type itself; the form never sends it.
export function ProductForm({
  type,
  id,
  initial,
  categories,
}: {
  type: ProductType;
  id?: string;
  initial: ProductFormValues;
  categories: CategoryOption[];
}) {
  const isService = type === "SERVICE";
  const noun = isService ? "service" : "product";
  const specs = fieldSpecs(type);
  const [state, action, pending] = useActionState<ProductActionResult, FormData>(
    isService ? (id ? updateService : createService) : id ? updateProduct : createProduct,
    null,
  );
  const alertRef = useRef<HTMLDivElement>(null);
  const failed = !pending && state?.success === false ? state : null;
  const saved = !pending && state?.success === true;
  // React resets the form after each submit, so a failed one refills it.
  const values = failed?.values ?? initial;

  // The category picker and the Arabic category are controlled, so picking a
  // category can fill in its Arabic name. They follow the last submitted
  // values, else the saved ones, and reset only when those change (not while
  // a submit is pending, nor on a refresh that changed nothing).
  const source = (state?.success === false ? state.values : undefined) ?? initial;
  const sourceKey = JSON.stringify([source.category ?? "", source.categoryAr ?? ""]);
  const [syncedKey, setSyncedKey] = useState(sourceKey);
  const [pick, setPick] = useState(() => initialCategoryPick(categories, source.category ?? ""));
  const [categoryAr, setCategoryAr] = useState(source.categoryAr ?? "");
  const newCategoryRef = useRef<HTMLInputElement>(null);
  const formResetting = useRef(false);
  if (syncedKey !== sourceKey) {
    setSyncedKey(sourceKey);
    setPick(initialCategoryPick(categories, source.category ?? ""));
    setCategoryAr(source.categoryAr ?? "");
  }

  // The Arabic name the picker last filled in. Switching category replaces or
  // clears it, but never a value the admin typed.
  const filledAr = useRef<string | null>(null);
  function choose(next: CategoryPick) {
    setPick(next);
    const arabic = next.mode === "existing" ? categories[next.index].categoryAr : null;
    if (arabic) {
      setCategoryAr(arabic);
      filledAr.current = arabic;
    } else if (filledAr.current !== null && categoryAr === filledAr.current) {
      setCategoryAr("");
      filledAr.current = null;
    }
  }

  useEffect(() => {
    if (state?.success === false) alertRef.current?.focus();
  }, [state]);

  function fields(specs: FieldSpec[]) {
    return specs.map((spec) => (
      <Field
        key={spec.field}
        spec={spec}
        value={spec.field === "categoryAr" ? categoryAr : (values[spec.field] ?? "")}
        error={failed?.fieldErrors?.[spec.field]}
        onValueChange={spec.field === "categoryAr" ? setCategoryAr : undefined}
      />
    ));
  }

  return (
    <form
      action={action}
      noValidate
      // Capture runs before the Select's own reset listener on the form.
      onResetCapture={() => {
        formResetting.current = true;
        setTimeout(() => {
          formResetting.current = false;
        });
      }}
      className="grid gap-6"
    >
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
        {failed && formErrors(noun)[failed.error]}
      </div>

      <section aria-labelledby="product-english" className={CARD}>
        <h2 id="product-english" className="text-lg font-semibold">
          Details
        </h2>
        {fields(specs.english)}
        <CategoryField
          options={categories}
          pick={pick}
          onPick={choose}
          hint={`Groups ${noun}s in the store filter.`}
          error={failed?.fieldErrors?.category}
          newInputRef={newCategoryRef}
          formResetting={formResetting}
        />
        {fields(specs.lists)}
      </section>

      <section aria-labelledby="product-pricing" className={CARD}>
        <h2 id="product-pricing" className="text-lg font-semibold">
          {isService ? "Price, duration, and image" : "Price and image"}
        </h2>
        {fields(specs.pricing)}
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
        {fields(specs.arabic)}
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={SUBMIT}>
          {pending ? "Saving…" : id ? "Save changes" : `Create ${noun}`}
        </button>
        <p role="status" className={saved ? "text-sm font-medium text-success" : "sr-only"}>
          {saved ? "Changes saved." : ""}
        </p>
      </div>
    </form>
  );
}
