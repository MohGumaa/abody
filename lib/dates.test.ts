import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/dates";

describe("formatDate", () => {
  it("formats English dates in UTC", () => {
    expect(formatDate(new Date("2026-09-20T23:30:00Z"), "en")).toBe(
      "Sep 20, 2026",
    );
  });

  it("formats Arabic dates with the month name and Latin digits", () => {
    const text = formatDate(new Date("2026-09-20T12:00:00Z"), "ar");
    expect(text).toContain("20");
    expect(text).toContain("2026");
    expect(text).toContain("سبتمبر");
    expect(text).not.toMatch(/[٠-٩]/);
  });
});
