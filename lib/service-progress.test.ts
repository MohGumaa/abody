import { describe, expect, it } from "vitest";
import type { ServiceStatus } from "@/lib/generated/prisma/enums";
import { serviceProgress } from "@/lib/service-progress";

const purchasedAt = new Date("2026-10-01T00:00:00Z");
const createdAt = new Date("2026-10-02T00:00:00Z");
const startDate = new Date("2026-10-03T00:00:00Z");
const completedDate = new Date("2026-10-04T00:00:00Z");
const updatedAt = new Date("2026-10-05T00:00:00Z");

function service(
  status: ServiceStatus,
  dates: { startDate?: Date; completedDate?: Date } = {},
) {
  return {
    status,
    createdAt,
    startDate: dates.startDate ?? null,
    completedDate: dates.completedDate ?? null,
    updatedAt,
  };
}

const purchased = { key: "purchased", state: "done", date: purchasedAt };

describe("serviceProgress", () => {
  it("asks for details when there is no record", () => {
    expect(serviceProgress({ purchasedAt, service: null })).toEqual({
      status: null,
      steps: [
        purchased,
        { key: "details", state: "current", date: null },
        { key: "started", state: "upcoming", date: null },
        { key: "completed", state: "upcoming", date: null },
      ],
      lastUpdated: purchasedAt,
    });
  });

  it("waits for the team to start a NEW record", () => {
    expect(serviceProgress({ purchasedAt, service: service("NEW") })).toEqual({
      status: "NEW",
      steps: [
        purchased,
        { key: "details", state: "done", date: createdAt },
        { key: "started", state: "current", date: null },
        { key: "completed", state: "upcoming", date: null },
      ],
      lastUpdated: updatedAt,
    });
  });

  it("puts details back to current while waiting for information", () => {
    const result = serviceProgress({
      purchasedAt,
      service: service("WAITING_FOR_INFORMATION"),
    });
    expect(result.status).toBe("WAITING_FOR_INFORMATION");
    expect(result.steps).toEqual([
      purchased,
      { key: "details", state: "current", date: createdAt },
      { key: "started", state: "upcoming", date: null },
      { key: "completed", state: "upcoming", date: null },
    ]);
  });

  it("shows the start date while in progress", () => {
    const result = serviceProgress({
      purchasedAt,
      service: service("IN_PROGRESS", { startDate }),
    });
    expect(result.steps).toEqual([
      purchased,
      { key: "details", state: "done", date: createdAt },
      { key: "started", state: "done", date: startDate },
      { key: "completed", state: "current", date: null },
    ]);
  });

  it("marks the start done without a date when startDate is missing", () => {
    const result = serviceProgress({ purchasedAt, service: service("IN_PROGRESS") });
    expect(result.steps[2]).toEqual({ key: "started", state: "done", date: null });
    expect(result.steps[3]).toEqual({ key: "completed", state: "current", date: null });
  });

  it("marks every step done when completed", () => {
    const result = serviceProgress({
      purchasedAt,
      service: service("COMPLETED", { startDate, completedDate }),
    });
    expect(result.steps).toEqual([
      purchased,
      { key: "details", state: "done", date: createdAt },
      { key: "started", state: "done", date: startDate },
      { key: "completed", state: "done", date: completedDate },
    ]);
  });

  it("keeps completed steps done without dates when none are set", () => {
    const result = serviceProgress({ purchasedAt, service: service("COMPLETED") });
    expect(result.steps.slice(2)).toEqual([
      { key: "started", state: "done", date: null },
      { key: "completed", state: "done", date: null },
    ]);
  });

  it("ends in cancelled without a start step when work never started", () => {
    const result = serviceProgress({ purchasedAt, service: service("CANCELLED") });
    expect(result.status).toBe("CANCELLED");
    expect(result.steps).toEqual([
      purchased,
      { key: "details", state: "done", date: createdAt },
      { key: "cancelled", state: "done", date: null },
    ]);
    expect(result.lastUpdated).toBe(updatedAt);
  });

  it("keeps the start step when cancelled after work started", () => {
    const result = serviceProgress({
      purchasedAt,
      service: service("CANCELLED", { startDate }),
    });
    expect(result.steps).toEqual([
      purchased,
      { key: "details", state: "done", date: createdAt },
      { key: "started", state: "done", date: startDate },
      { key: "cancelled", state: "done", date: null },
    ]);
  });
});
