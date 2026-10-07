import type { ServiceStatus } from "@/lib/generated/prisma/enums";

// Pure: no db or next imports. The customer's view of a purchased service's
// progress, built from its status and the dates stored on it. The status
// decides which steps are done; a date shows only when its field is set.

export type ProgressStepKey =
  | "purchased"
  | "details"
  | "started"
  | "completed"
  | "cancelled";
export type ProgressStepState = "done" | "current" | "upcoming";

export interface ProgressStep {
  key: ProgressStepKey;
  state: ProgressStepState;
  date: Date | null;
}

export interface ServiceProgressInput {
  purchasedAt: Date;
  service: {
    status: ServiceStatus;
    createdAt: Date;
    startDate: Date | null;
    completedDate: Date | null;
    updatedAt: Date;
  } | null;
}

export interface ServiceProgress {
  // Null until the customer sends their onboarding details.
  status: ServiceStatus | null;
  steps: ProgressStep[];
  lastUpdated: Date;
}

export function serviceProgress({
  purchasedAt,
  service,
}: ServiceProgressInput): ServiceProgress {
  const purchased: ProgressStep = { key: "purchased", state: "done", date: purchasedAt };
  if (!service) {
    return {
      status: null,
      steps: [
        purchased,
        { key: "details", state: "current", date: null },
        { key: "started", state: "upcoming", date: null },
        { key: "completed", state: "upcoming", date: null },
      ],
      lastUpdated: purchasedAt,
    };
  }

  const step = (key: ProgressStepKey, state: ProgressStepState, date: Date | null = null) =>
    ({ key, state, date }) satisfies ProgressStep;
  const details = (state: ProgressStepState) => step("details", state, service.createdAt);
  const started = (state: ProgressStepState) =>
    step("started", state, state === "done" ? service.startDate : null);

  let steps: ProgressStep[];
  switch (service.status) {
    case "NEW":
      steps = [details("done"), started("current"), step("completed", "upcoming")];
      break;
    case "WAITING_FOR_INFORMATION":
      steps = [details("current"), started("upcoming"), step("completed", "upcoming")];
      break;
    case "IN_PROGRESS":
      steps = [details("done"), started("done"), step("completed", "current")];
      break;
    case "COMPLETED":
      steps = [
        details("done"),
        started("done"),
        step("completed", "done", service.completedDate),
      ];
      break;
    case "CANCELLED":
      // No cancel date is stored, so the cancelled step has none.
      steps = [
        details("done"),
        ...(service.startDate ? [started("done")] : []),
        step("cancelled", "done"),
      ];
      break;
  }
  return {
    status: service.status,
    steps: [purchased, ...steps],
    lastUpdated: service.updatedAt,
  };
}
