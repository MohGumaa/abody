import type { ServiceStatus } from "@/lib/generated/prisma/enums";

// Pure: no db or next imports. The admin's service work rules (feature 16):
// which statuses exist, the notes limit, and the dates a status change stamps.

export const SERVICE_STATUSES = [
  "NEW",
  "WAITING_FOR_INFORMATION",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const satisfies readonly ServiceStatus[];

export function isServiceStatus(value: unknown): value is ServiceStatus {
  return (SERVICE_STATUSES as readonly unknown[]).includes(value);
}

// Counted in JavaScript string length after trimming.
export const ADMIN_NOTES_MAX_LENGTH = 5000;

export type AdminNotesResult =
  | { ok: true; notes: string | null }
  | { ok: false; error: "invalid" | "too_long" };

export function parseAdminNotes(value: unknown): AdminNotesResult {
  if (typeof value !== "string") return { ok: false, error: "invalid" };
  const notes = value.trim();
  if (notes.length > ADMIN_NOTES_MAX_LENGTH) return { ok: false, error: "too_long" };
  return { ok: true, notes: notes || null };
}

export interface ServiceDates {
  startDate: Date | null;
  completedDate: Date | null;
}

export interface StatusChangeData {
  status: ServiceStatus;
  startDate: Date | null;
  completedDate: Date | null;
}

// Dates come from the server clock. The first move to In progress or
// Completed records the start; Completed records its date; leaving Completed
// clears it. Saving the same status keeps both dates.
export function statusChangeData(
  current: ServiceStatus,
  next: ServiceStatus,
  dates: ServiceDates,
  now: Date,
): StatusChangeData {
  if (current === next) return { status: next, ...dates };
  switch (next) {
    case "IN_PROGRESS":
      return { status: next, startDate: dates.startDate ?? now, completedDate: null };
    case "COMPLETED":
      return { status: next, startDate: dates.startDate ?? now, completedDate: now };
    default:
      return { status: next, startDate: dates.startDate, completedDate: null };
  }
}
