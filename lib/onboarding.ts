import type { ServiceStatus } from "@/lib/generated/prisma/enums";

// Service onboarding form rules (feature 10). No db or next/* imports: the
// Server Action, pages, and Vitest all load this module.

export const ONBOARDING_FIELDS = [
  "businessName",
  "website",
  "adAccount",
  "campaignGoals",
  "budget",
  "notes",
] as const;

export type OnboardingField = (typeof ONBOARDING_FIELDS)[number];
export type OnboardingFieldError = "business_name_required" | "too_long";
export type OnboardingFieldErrors = Partial<
  Record<OnboardingField, OnboardingFieldError>
>;

// Counted in JavaScript string length after trimming.
export const ONBOARDING_MAX_LENGTH: Record<OnboardingField, number> = {
  businessName: 200,
  website: 500,
  adAccount: 500,
  campaignGoals: 2000,
  budget: 100,
  notes: 2000,
};

// What Service.requirements stores. Every key is always present.
export interface OnboardingRequirements {
  businessName: string;
  website: string | null;
  adAccount: string | null;
  campaignGoals: string | null;
  budget: string | null;
  notes: string | null;
}

export type OnboardingParseResult =
  | { ok: true; data: OnboardingRequirements }
  | { ok: false; invalidInput: true }
  | {
      ok: false;
      invalidInput: false;
      fieldErrors: OnboardingFieldErrors;
      values: Record<OnboardingField, string>;
    };

export function parseOnboardingForm(form: FormData): OnboardingParseResult {
  const values = {} as Record<OnboardingField, string>;
  for (const field of ONBOARDING_FIELDS) {
    const value = form.get(field);
    if (typeof value !== "string") return { ok: false, invalidInput: true };
    values[field] = value.trim();
  }

  const fieldErrors: OnboardingFieldErrors = {};
  for (const field of ONBOARDING_FIELDS) {
    if (values[field].length > ONBOARDING_MAX_LENGTH[field]) {
      fieldErrors[field] = "too_long";
    }
  }
  if (values.businessName.length === 0) {
    fieldErrors.businessName = "business_name_required";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, invalidInput: false, fieldErrors, values };
  }

  const optional = (field: OnboardingField) => values[field] || null;
  return {
    ok: true,
    data: {
      businessName: values.businessName,
      website: optional("website"),
      adAccount: optional("adAccount"),
      campaignGoals: optional("campaignGoals"),
      budget: optional("budget"),
      notes: optional("notes"),
    },
  };
}

// Stored JSON is checked on the way out too; anything else is null.
export function readRequirements(json: unknown): OnboardingRequirements | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const record = json as Record<string, unknown>;
  if (
    Object.keys(record).length !== ONBOARDING_FIELDS.length ||
    typeof record.businessName !== "string" ||
    record.businessName.length === 0
  ) {
    return null;
  }
  for (const field of ONBOARDING_FIELDS) {
    const value = record[field];
    if (field !== "businessName" && value !== null && typeof value !== "string") {
      return null;
    }
  }
  return record as unknown as OnboardingRequirements;
}

const EDITABLE: ReadonlySet<ServiceStatus> = new Set<ServiceStatus>([
  "NEW",
  "WAITING_FOR_INFORMATION",
]);
export const EDITABLE_SERVICE_STATUSES: readonly ServiceStatus[] = [...EDITABLE];

export function canEditOnboarding(status: ServiceStatus | null): boolean {
  return status === null || EDITABLE.has(status);
}

export type OnboardingState = "needed" | "received" | "locked";

// No record yet, or the team asked for more, means the customer has to act.
export function onboardingState(status: ServiceStatus | null): OnboardingState {
  if (status === null || status === "WAITING_FOR_INFORMATION") return "needed";
  if (status === "NEW") return "received";
  return "locked";
}
