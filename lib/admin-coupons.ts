import {
  CODE_MAX,
  COUPON_SCOPES,
  isCouponCode,
  MAX_REDEMPTIONS_MAX,
  normalizeCouponCode,
  PERCENT_MAX,
  PERCENT_MIN,
} from "@/lib/coupons";
import { db } from "@/lib/db";
import type { CouponScope } from "@/lib/generated/prisma/enums";

// Admin discount codes (feature 20): form parsing and queries. Server code
// only; the admin form imports just its types. Callers check requireAdmin()
// before reading any of this data.

export type CouponField = "code" | "percentOff" | "appliesTo" | "expiresOn" | "maxRedemptions";

export type CouponFieldError =
  | "required"
  | "invalid_code"
  | "code_taken"
  | "invalid_percent"
  | "invalid_scope"
  | "invalid_date"
  | "invalid_max";

export type CouponFieldErrors = Partial<Record<CouponField, CouponFieldError>>;

// What the form sends back after a failed submit, as typed.
export type CouponFormValues = Partial<Record<CouponField, string>>;

export interface CouponFormData {
  percentOff: number;
  appliesTo: CouponScope;
  expiresOn: Date | null;
  maxRedemptions: number | null;
}

export type ParsedCouponForm =
  | { ok: true; code: string; data: CouponFormData; values: CouponFormValues }
  | { ok: false; fieldErrors: CouponFieldErrors; values: CouponFormValues };

// Ids are cuids; anything longer is not worth a query.
const COUPON_ID_MAX_LENGTH = 64;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WHOLE_NUMBER = /^\d{1,7}$/;

export function isCouponId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= COUPON_ID_MAX_LENGTH
  );
}

function isScope(value: string): value is CouponScope {
  return (COUPON_SCOPES as readonly string[]).includes(value);
}

// "2026-10-31" to midnight UTC, the shape of a @db.Date column; a date that
// does not exist, such as 2026-02-30, is null.
export function parseDateInput(input: string): Date | null {
  if (!DATE_PATTERN.test(input)) return null;
  const date = new Date(`${input}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(input) ? date : null;
}

export function dateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

function wholeNumber(input: string, min: number, max: number): number | null {
  if (!WHOLE_NUMBER.test(input)) return null;
  const value = Number(input);
  return value >= min && value <= max ? value : null;
}

// The code is read only on create; edits never change it.
export function parseCouponForm(formData: FormData, withCode: boolean): ParsedCouponForm {
  const fields: CouponField[] = ["percentOff", "appliesTo", "expiresOn", "maxRedemptions"];
  if (withCode) fields.unshift("code");
  const values: CouponFormValues = {};
  for (const field of fields) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value.trim() : "";
  }
  const fieldErrors: CouponFieldErrors = {};

  let code = "";
  if (withCode) {
    code = normalizeCouponCode(values.code ?? "");
    values.code = code;
    if (!code) fieldErrors.code = "required";
    else if (code.length > CODE_MAX || !isCouponCode(code)) fieldErrors.code = "invalid_code";
  }

  let percentOff = 0;
  if (!values.percentOff) fieldErrors.percentOff = "required";
  else {
    const parsed = wholeNumber(values.percentOff, PERCENT_MIN, PERCENT_MAX);
    if (parsed === null) fieldErrors.percentOff = "invalid_percent";
    else percentOff = parsed;
  }

  const scope = values.appliesTo ?? "";
  if (!scope) fieldErrors.appliesTo = "required";
  else if (!isScope(scope)) fieldErrors.appliesTo = "invalid_scope";

  let expiresOn: Date | null = null;
  if (values.expiresOn) {
    expiresOn = parseDateInput(values.expiresOn);
    if (!expiresOn) fieldErrors.expiresOn = "invalid_date";
  }

  let maxRedemptions: number | null = null;
  if (values.maxRedemptions) {
    maxRedemptions = wholeNumber(values.maxRedemptions, 1, MAX_REDEMPTIONS_MAX);
    if (maxRedemptions === null) fieldErrors.maxRedemptions = "invalid_max";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors, values };
  return {
    ok: true,
    code,
    values,
    data: { percentOff, appliesTo: scope as CouponScope, expiresOn, maxRedemptions },
  };
}

export interface AdminCoupon {
  id: string;
  code: string;
  percentOff: number;
  appliesTo: CouponScope;
  active: boolean;
  expiresOn: Date | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  updatedAt: Date;
}

const COUPON_SELECT = {
  id: true,
  code: true,
  percentOff: true,
  appliesTo: true,
  active: true,
  expiresOn: true,
  maxRedemptions: true,
  redemptionCount: true,
  updatedAt: true,
} as const;

export async function listAdminCoupons(): Promise<AdminCoupon[]> {
  return db.coupon.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: COUPON_SELECT,
  });
}

export async function getAdminCoupon(id: string): Promise<AdminCoupon | null> {
  if (!isCouponId(id)) return null;
  return db.coupon.findUnique({ where: { id }, select: COUPON_SELECT });
}
