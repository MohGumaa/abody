import { describe, expect, it } from "vitest";
import {
  canEditOnboarding,
  ONBOARDING_FIELDS,
  ONBOARDING_MAX_LENGTH,
  onboardingState,
  parseOnboardingForm,
  readRequirements,
} from "@/lib/onboarding";

const filled = {
  businessName: "  Layla Cafe  ",
  website: " https://layla.example ",
  adAccount: "act_123",
  campaignGoals: "More visits\nWeekend offers",
  budget: "$1,000 / month",
  notes: "Call after 5pm",
};

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("parseOnboardingForm", () => {
  it("trims every field and keeps line breaks inside", () => {
    expect(parseOnboardingForm(form(filled))).toEqual({
      ok: true,
      data: {
        businessName: "Layla Cafe",
        website: "https://layla.example",
        adAccount: "act_123",
        campaignGoals: "More visits\nWeekend offers",
        budget: "$1,000 / month",
        notes: "Call after 5pm",
      },
    });
  });

  it("stores an empty optional field as null", () => {
    const result = parseOnboardingForm(
      form({ ...filled, website: "  ", adAccount: "", budget: "", notes: "", campaignGoals: "" }),
    );
    expect(result).toEqual({
      ok: true,
      data: {
        businessName: "Layla Cafe",
        website: null,
        adAccount: null,
        campaignGoals: null,
        budget: null,
        notes: null,
      },
    });
  });

  it("requires a business name and returns what was typed", () => {
    const result = parseOnboardingForm(form({ ...filled, businessName: "   " }));
    expect(result).toEqual({
      ok: false,
      invalidInput: false,
      fieldErrors: { businessName: "business_name_required" },
      values: expect.objectContaining({ businessName: "", budget: "$1,000 / month" }),
    });
  });

  it.each(ONBOARDING_FIELDS)("rejects %s over its limit", (field) => {
    const limit = ONBOARDING_MAX_LENGTH[field];
    const atLimit = parseOnboardingForm(form({ ...filled, [field]: "a".repeat(limit) }));
    expect(atLimit.ok).toBe(true);
    const over = parseOnboardingForm(form({ ...filled, [field]: "a".repeat(limit + 1) }));
    expect(over).toMatchObject({
      ok: false,
      invalidInput: false,
      fieldErrors: { [field]: "too_long" },
    });
  });

  it("counts the limit after trimming", () => {
    const padded = ` ${"a".repeat(ONBOARDING_MAX_LENGTH.budget)} `;
    expect(parseOnboardingForm(form({ ...filled, budget: padded })).ok).toBe(true);
  });

  it("treats a missing or non-string entry as invalid input", () => {
    const missing = form(filled);
    missing.delete("notes");
    expect(parseOnboardingForm(missing)).toEqual({ ok: false, invalidInput: true });

    const file = form(filled);
    file.set("website", new Blob(["x"]), "x.txt");
    expect(parseOnboardingForm(file)).toEqual({ ok: false, invalidInput: true });
  });
});

describe("readRequirements", () => {
  const stored = {
    businessName: "Layla Cafe",
    website: null,
    adAccount: "act_123",
    campaignGoals: null,
    budget: null,
    notes: null,
  };

  it("returns well-formed stored answers", () => {
    expect(readRequirements(stored)).toEqual(stored);
  });

  it.each([
    ["null", null],
    ["an array", [stored]],
    ["a string", "Layla Cafe"],
    ["an empty business name", { ...stored, businessName: "" }],
    ["a missing key", { ...stored, notes: undefined }],
    ["an extra key", { ...stored, extra: "x" }],
    ["a number field", { ...stored, budget: 1000 }],
  ])("rejects %s", (_label, json) => {
    expect(readRequirements(json)).toBeNull();
  });
});

describe("service status rules", () => {
  it.each([
    [null, "needed", true],
    ["WAITING_FOR_INFORMATION", "needed", true],
    ["NEW", "received", true],
    ["IN_PROGRESS", "locked", false],
    ["COMPLETED", "locked", false],
    ["CANCELLED", "locked", false],
  ] as const)("%s is %s, editable %s", (status, state, editable) => {
    expect(onboardingState(status)).toBe(state);
    expect(canEditOnboarding(status)).toBe(editable);
  });
});
