import { describe, expect, it } from "vitest";
import {
  ADMIN_NOTES_MAX_LENGTH,
  isServiceStatus,
  parseAdminNotes,
  statusChangeData,
} from "./service-work-rules";

const now = new Date("2026-10-08T12:00:00Z");
const started = new Date("2026-10-01T09:00:00Z");
const finished = new Date("2026-10-05T09:00:00Z");
const noDates = { startDate: null, completedDate: null };

describe("isServiceStatus", () => {
  it.each(["NEW", "WAITING_FOR_INFORMATION", "IN_PROGRESS", "COMPLETED", "CANCELLED"])(
    "allows %s",
    (status) => {
      expect(isServiceStatus(status)).toBe(true);
    },
  );

  it.each(["new", "PAID", "", null, undefined, 1])("rejects %s", (status) => {
    expect(isServiceStatus(status)).toBe(false);
  });
});

describe("parseAdminNotes", () => {
  it("trims notes", () => {
    expect(parseAdminNotes("  Called the client.\n")).toEqual({
      ok: true,
      notes: "Called the client.",
    });
  });

  it("stores empty notes as null", () => {
    expect(parseAdminNotes("   \n ")).toEqual({ ok: true, notes: null });
  });

  it("accepts notes at the limit and keeps line breaks", () => {
    const notes = `a\n${"b".repeat(ADMIN_NOTES_MAX_LENGTH - 2)}`;
    expect(parseAdminNotes(notes)).toEqual({ ok: true, notes });
  });

  it("rejects notes over the limit after trimming", () => {
    expect(parseAdminNotes("x".repeat(ADMIN_NOTES_MAX_LENGTH + 1))).toEqual({
      ok: false,
      error: "too_long",
    });
    expect(parseAdminNotes(` ${"x".repeat(ADMIN_NOTES_MAX_LENGTH)} `).ok).toBe(true);
  });

  it("rejects a missing or file value", () => {
    expect(parseAdminNotes(null)).toEqual({ ok: false, error: "invalid" });
    expect(parseAdminNotes(new Blob(["x"]))).toEqual({ ok: false, error: "invalid" });
  });
});

describe("statusChangeData", () => {
  it("records the start on the first move to In progress", () => {
    expect(statusChangeData("NEW", "IN_PROGRESS", noDates, now)).toEqual({
      status: "IN_PROGRESS",
      startDate: now,
      completedDate: null,
    });
  });

  it("keeps an earlier start when work resumes", () => {
    expect(
      statusChangeData("WAITING_FOR_INFORMATION", "IN_PROGRESS", { ...noDates, startDate: started }, now),
    ).toEqual({ status: "IN_PROGRESS", startDate: started, completedDate: null });
  });

  it("clears the completion date when a completed service reopens", () => {
    expect(
      statusChangeData("COMPLETED", "IN_PROGRESS", { startDate: started, completedDate: finished }, now),
    ).toEqual({ status: "IN_PROGRESS", startDate: started, completedDate: null });
  });

  it("records completion, and the start when it was skipped", () => {
    expect(statusChangeData("NEW", "COMPLETED", noDates, now)).toEqual({
      status: "COMPLETED",
      startDate: now,
      completedDate: now,
    });
    expect(
      statusChangeData("IN_PROGRESS", "COMPLETED", { ...noDates, startDate: started }, now),
    ).toEqual({ status: "COMPLETED", startDate: started, completedDate: now });
  });

  it.each(["NEW", "WAITING_FOR_INFORMATION", "CANCELLED"] as const)(
    "keeps the start and clears completion when moving to %s",
    (next) => {
      expect(
        statusChangeData("COMPLETED", next, { startDate: started, completedDate: finished }, now),
      ).toEqual({ status: next, startDate: started, completedDate: null });
      expect(statusChangeData("IN_PROGRESS", next, noDates, now)).toEqual({
        status: next,
        startDate: null,
        completedDate: null,
      });
    },
  );

  it.each(["NEW", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const)(
    "keeps both dates when %s is saved again",
    (status) => {
      const dates = { startDate: started, completedDate: finished };
      expect(statusChangeData(status, status, dates, now)).toEqual({ status, ...dates });
    },
  );
});
