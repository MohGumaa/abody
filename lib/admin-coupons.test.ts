import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { dateInputValue, parseCouponForm, parseDateInput } from "@/lib/admin-coupons";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const valid = {
  code: " spring-10 ",
  percentOff: "10",
  appliesTo: "SERVICES",
  expiresOn: "2026-10-31",
  maxRedemptions: "100",
};

describe("parseCouponForm", () => {
  it("parses a full create form and normalizes the code", () => {
    const result = parseCouponForm(form(valid), true);

    expect(result).toEqual({
      ok: true,
      code: "SPRING-10",
      values: { ...valid, code: "SPRING-10" },
      data: {
        percentOff: 10,
        appliesTo: "SERVICES",
        expiresOn: new Date("2026-10-31T00:00:00.000Z"),
        maxRedemptions: 100,
      },
    });
  });

  it("allows blank optional limits", () => {
    const result = parseCouponForm(form({ ...valid, expiresOn: "", maxRedemptions: " " }), true);

    expect(result).toMatchObject({ ok: true, data: { expiresOn: null, maxRedemptions: null } });
  });

  it("ignores the code on edit", () => {
    const result = parseCouponForm(form({ ...valid, code: "!!" }), false);

    expect(result).toMatchObject({ ok: true, code: "" });
    expect(result.values).not.toHaveProperty("code");
  });

  it("reports every field error", () => {
    const cases: [Record<string, string>, Record<string, string>][] = [
      [{ code: "" }, { code: "required" }],
      [{ code: "AB" }, { code: "invalid_code" }],
      [{ code: "SAVE 10" }, { code: "invalid_code" }],
      [{ code: "A".repeat(33) }, { code: "invalid_code" }],
      [{ percentOff: "" }, { percentOff: "required" }],
      [{ percentOff: "0" }, { percentOff: "invalid_percent" }],
      [{ percentOff: "100" }, { percentOff: "invalid_percent" }],
      [{ percentOff: "12.5" }, { percentOff: "invalid_percent" }],
      [{ appliesTo: "" }, { appliesTo: "required" }],
      [{ appliesTo: "EVERYTHING" }, { appliesTo: "invalid_scope" }],
      [{ expiresOn: "2026-02-30" }, { expiresOn: "invalid_date" }],
      [{ expiresOn: "31/10/2026" }, { expiresOn: "invalid_date" }],
      [{ maxRedemptions: "0" }, { maxRedemptions: "invalid_max" }],
      [{ maxRedemptions: "1000001" }, { maxRedemptions: "invalid_max" }],
      [{ maxRedemptions: "-5" }, { maxRedemptions: "invalid_max" }],
    ];
    for (const [overrides, fieldErrors] of cases) {
      const result = parseCouponForm(form({ ...valid, ...overrides }), true);
      expect(result).toMatchObject({ ok: false, fieldErrors });
    }
  });

  it("returns the typed values with errors for redisplay", () => {
    const result = parseCouponForm(form({ ...valid, percentOff: "abc" }), true);

    expect(result).toMatchObject({ ok: false, values: { percentOff: "abc", appliesTo: "SERVICES" } });
  });
});

describe("date input helpers", () => {
  it("round-trips a date", () => {
    const date = parseDateInput("2026-12-01");
    expect(date?.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(dateInputValue(date)).toBe("2026-12-01");
    expect(dateInputValue(null)).toBe("");
  });
});
