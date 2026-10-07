import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { ONBOARDING_FIELDS, type OnboardingRequirements } from "@/lib/onboarding";

// The saved onboarding answers, read-only. Plain React text only: the website
// is never a link, and line breaks are kept.
export function OnboardingAnswers({
  answers,
  text,
}: {
  answers: OnboardingRequirements | null;
  text: Dictionary["onboarding"];
}) {
  return (
    <dl className="grid gap-4">
      {ONBOARDING_FIELDS.map((field) => (
        <div key={field} className="grid gap-1">
          <dt className="text-sm font-medium">{text.fields[field]}</dt>
          <dd dir="auto" className="whitespace-pre-line wrap-break-word text-muted">
            {answers?.[field] ?? text.notProvided}
          </dd>
        </div>
      ))}
    </dl>
  );
}
