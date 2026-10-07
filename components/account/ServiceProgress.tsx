import { CheckIcon } from "@/components/icons";
import { formatDate } from "@/lib/dates";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import type { ProgressStep, ProgressStepState } from "@/lib/service-progress";

const MARKERS: Record<ProgressStepState, string> = {
  done: "bg-success text-white",
  current: "bg-primary-strong text-white ring-4 ring-primary-soft",
  upcoming: "border-2 border-border bg-panel",
};

// The service timeline. Each step says its state in words for screen readers,
// so the marker colors are never the only signal.
export function ServiceProgress({
  steps,
  locale,
  text,
}: {
  steps: ProgressStep[];
  locale: Locale;
  text: Dictionary["account"]["service"];
}) {
  return (
    <ol className="grid gap-4">
      {steps.map((step) => (
        <li
          key={step.key}
          aria-current={step.state === "current" ? "step" : undefined}
          className="flex items-start gap-3"
        >
          <span
            aria-hidden="true"
            className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${MARKERS[step.state]}`}
          >
            {step.state === "done" && <CheckIcon className="h-3.5 w-3.5" />}
          </span>
          <div className="grid gap-0.5">
            <span
              className={
                step.state === "upcoming" ? "text-muted" : "font-semibold"
              }
            >
              {text.steps[step.key]}
              <span className="sr-only">
                {" ("}
                {text.stepState[step.state]}
                {")"}
              </span>
            </span>
            {step.date && (
              <span className="text-sm text-muted">
                {formatDate(step.date, locale)}
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
