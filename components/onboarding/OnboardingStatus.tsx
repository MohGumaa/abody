import Link from "next/link";
import type { ServiceStatus } from "@/lib/generated/prisma/enums";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { onboardingState, type OnboardingState } from "@/lib/onboarding";

const STATE_TONES: Record<OnboardingState, string> = {
  needed: "bg-warning-soft text-warning",
  received: "bg-success-soft text-success",
  locked: "bg-success-soft text-success",
};

const LINK =
  "inline-flex h-9 items-center justify-center rounded-control bg-primary-soft px-3 text-sm font-semibold text-primary-strong outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong";

// One service item's onboarding state, with the link to add or update the
// details while they can still change.
export function OnboardingStatus({
  status,
  href,
  name,
  text,
  showState = true,
}: {
  status: ServiceStatus | null;
  href: string;
  // The service name, so each link says which service it opens.
  name: string;
  text: Dictionary["onboarding"];
  // False where another chip already shows the service status.
  showState?: boolean;
}) {
  const state = onboardingState(status);
  if (!showState && state === "locked") return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {showState && (
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${STATE_TONES[state]}`}
        >
          {text.state[state]}
        </span>
      )}
      {state !== "locked" && (
        <Link href={href} className={LINK}>
          {state === "needed" ? text.add : text.edit}
          <span className="sr-only">
            {": "}
            <span dir="auto">{name}</span>
          </span>
        </Link>
      )}
    </div>
  );
}
