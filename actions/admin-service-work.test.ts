import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, requireAdmin, revalidatePath } = vi.hoisted(() => ({
  db: {
    service: { findFirst: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  },
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin")>()),
  requireAdmin,
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));

import { ADMIN_NOTES_MAX_LENGTH } from "@/lib/service-work-rules";
import { saveServiceWork } from "./admin-service-work";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const valid = { id: "svc1", status: "IN_PROGRESS", notes: " Kickoff call booked. " };
const paidServiceItem = {
  product: { type: "SERVICE" },
  order: { status: { in: ["PAID", "PROCESSING", "COMPLETED"] } },
};

beforeEach(() => {
  vi.useRealTimers();
  requireAdmin.mockReset().mockResolvedValue({ id: "admin", role: "ADMIN" });
  revalidatePath.mockReset();
  db.service.findFirst
    .mockReset()
    .mockResolvedValue({ status: "NEW", startDate: null, completedDate: null });
  db.service.updateMany.mockReset().mockResolvedValue({ count: 1 });
  db.service.count.mockReset().mockResolvedValue(0);
});

describe("saveServiceWork", () => {
  it("stops before reading anything when the caller is not an admin", async () => {
    requireAdmin.mockRejectedValue(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
    await expect(saveServiceWork(null, form(valid))).rejects.toThrow("404");
    expect(db.service.findFirst).not.toHaveBeenCalled();
    expect(db.service.updateMany).not.toHaveBeenCalled();
  });

  it("saves the status, stamped dates, and trimmed notes in one conditional write", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-08T12:00:00Z"), toFake: ["Date"] });
    expect(await saveServiceWork(null, form(valid))).toEqual({ success: true });
    expect(db.service.findFirst).toHaveBeenCalledWith({
      where: { id: "svc1", orderItem: paidServiceItem },
      select: { status: true, startDate: true, completedDate: true },
    });
    expect(db.service.updateMany).toHaveBeenCalledWith({
      where: { id: "svc1", orderItem: paidServiceItem, status: "NEW" },
      data: {
        status: "IN_PROGRESS",
        startDate: new Date("2026-10-08T12:00:00Z"),
        completedDate: null,
        adminNotes: "Kickoff call booked.",
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/[lang]", "layout");
  });

  it("clears empty notes", async () => {
    await saveServiceWork(null, form({ ...valid, status: "NEW", notes: "  " }));
    expect(db.service.updateMany.mock.calls[0][0].data.adminNotes).toBeNull();
  });

  it.each([
    [{ ...valid, id: "" }, "not_found"],
    [{ ...valid, id: "x".repeat(65) }, "not_found"],
    [{ ...valid, status: "PAID" }, "invalid_status"],
    [{ id: "svc1", status: "NEW" }, "invalid_status"],
    [{ ...valid, notes: "x".repeat(ADMIN_NOTES_MAX_LENGTH + 1) }, "notes_too_long"],
  ])("rejects %j as %s without writing", async (fields, error) => {
    expect(await saveServiceWork(null, form(fields))).toEqual({ success: false, error });
    expect(db.service.updateMany).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns not_found when there is no record or its order is no longer paid", async () => {
    db.service.findFirst.mockResolvedValue(null);
    expect(await saveServiceWork(null, form(valid))).toEqual({
      success: false,
      error: "not_found",
    });
    expect(db.service.updateMany).not.toHaveBeenCalled();
  });

  it("returns changed when the status moved since it was read", async () => {
    db.service.updateMany.mockResolvedValue({ count: 0 });
    db.service.count.mockResolvedValue(1);
    expect(await saveServiceWork(null, form(valid))).toEqual({
      success: false,
      error: "changed",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns not_found when the order stopped being paid before the write", async () => {
    db.service.updateMany.mockResolvedValue({ count: 0 });
    expect(await saveServiceWork(null, form(valid))).toEqual({
      success: false,
      error: "not_found",
    });
  });

  it("logs an unexpected failure without the notes", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    db.service.updateMany.mockRejectedValue(new Error("connection lost"));
    expect(await saveServiceWork(null, form(valid))).toEqual({
      success: false,
      error: "unexpected",
    });
    expect(log).toHaveBeenCalledWith("saveServiceWork failed", "connection lost");
    expect(JSON.stringify(log.mock.calls)).not.toContain("Kickoff");
    log.mockRestore();
  });
});
