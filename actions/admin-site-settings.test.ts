import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, requireAdmin, revalidatePath } = vi.hoisted(() => ({
  db: { siteContent: { upsert: vi.fn() } },
  // Throws in Next.js, ending the action.
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/admin", () => ({ requireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { saveSiteSettings } from "./admin-site-settings";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  requireAdmin.mockReset().mockResolvedValue({ id: "admin", role: "ADMIN" });
  db.siteContent.upsert.mockReset().mockResolvedValue({ id: 1 });
  revalidatePath.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("saveSiteSettings", () => {
  it("stops before any write when requireAdmin throws", async () => {
    requireAdmin.mockRejectedValue(new Error("NEXT_NOT_FOUND"));

    await expect(
      saveSiteSettings(null, form({ contactEmail: "hello@abody.example" })),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(db.siteContent.upsert).not.toHaveBeenCalled();
  });

  it("returns the field error and the typed value without writing", async () => {
    expect(await saveSiteSettings(null, form({ contactEmail: "no-at" }))).toEqual({
      success: false,
      error: "invalid_fields",
      fieldErrors: { contactEmail: "invalid_email" },
      values: { contactEmail: "no-at" },
    });
    expect(db.siteContent.upsert).not.toHaveBeenCalled();
  });

  it("upserts row 1 writing only the contact email and refreshes the store", async () => {
    const result = await saveSiteSettings(null, form({ contactEmail: " Hello@Abody.Example " }));

    expect(result).toEqual({ success: true });
    expect(db.siteContent.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      create: { id: 1, contactEmail: "hello@abody.example" },
      update: { contactEmail: "hello@abody.example" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/[lang]", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/settings");
  });

  it("clears the email when the field is blank", async () => {
    await saveSiteSettings(null, form({ contactEmail: "  " }));

    expect(db.siteContent.upsert.mock.calls[0][0].update).toEqual({ contactEmail: null });
  });

  it("returns unexpected with the typed email when the database write fails", async () => {
    db.siteContent.upsert.mockRejectedValue(new Error("db down"));

    expect(await saveSiteSettings(null, form({ contactEmail: "new@abody.example" }))).toEqual({
      success: false,
      error: "unexpected",
      values: { contactEmail: "new@abody.example" },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
