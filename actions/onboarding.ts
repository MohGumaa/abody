"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { errorLabel } from "@/lib/error-label";
import {
  canEditOnboarding,
  parseOnboardingForm,
  type OnboardingField,
  type OnboardingFieldErrors,
} from "@/lib/onboarding";
import { sendServiceRequirementsEmail } from "@/lib/service-notifications";
import { findOnboardingItem, saveOnboarding } from "@/lib/services";
import { getCurrentUser } from "@/lib/session";

export type OnboardingActionError =
  | "invalid_input"
  | "invalid_fields"
  | "not_found"
  | "locked"
  | "signed_out"
  | "unexpected";

export type OnboardingActionResult =
  | { success: true }
  | {
      success: false;
      error: OnboardingActionError;
      fieldErrors?: OnboardingFieldErrors;
      values?: Partial<Record<OnboardingField, string>>;
    }
  | null;

function formText(form: FormData, key: string): string | null {
  const value = form.get(key);
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function submitOnboarding(
  _previous: OnboardingActionResult,
  formData: FormData,
): Promise<OnboardingActionResult> {
  try {
    const sessionId = formText(formData, "sessionId");
    const user = await getCurrentUser();
    if (!user && !sessionId) return { success: false, error: "signed_out" };

    // Access is checked again on every submit; the form's hidden fields only
    // name the item.
    const item = await findOnboardingItem(formData.get("itemId"), {
      userId: user?.id ?? null,
      sessionId,
    });
    if (!item) return { success: false, error: "not_found" };
    if (item.service && !canEditOnboarding(item.service.status)) {
      return { success: false, error: "locked" };
    }

    const parsed = parseOnboardingForm(formData);
    if (!parsed.ok) {
      return parsed.invalidInput
        ? { success: false, error: "invalid_input" }
        : {
            success: false,
            error: "invalid_fields",
            fieldErrors: parsed.fieldErrors,
            values: parsed.values,
          };
    }

    const saved = await saveOnboarding(item.itemId, parsed.data);
    if (saved === "locked") return { success: false, error: "locked" };
    // Tell the Abody team after the response; never delays or fails the submit.
    after(() => sendServiceRequirementsEmail(item.itemId, saved));
    revalidatePath("/[lang]/onboarding/[itemId]", "page");
    revalidatePath("/[lang]/account", "layout");
    return { success: true };
  } catch (error) {
    // Name and code only: a Prisma message can repeat the query's data, and the
    // answers can hold account details.
    console.error("submitOnboarding failed", errorLabel(error));
    return { success: false, error: "unexpected" };
  }
}
