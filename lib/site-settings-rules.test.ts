import { describe, expect, it } from "vitest";
import { parseSiteSettingsForm } from "./site-settings-rules";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("parseSiteSettingsForm", () => {
  it("clears the email when the field is blank, whitespace, or missing", () => {
    for (const data of [form({ contactEmail: "" }), form({ contactEmail: "   " }), form({})]) {
      expect(parseSiteSettingsForm(data)).toEqual({ ok: true, data: { contactEmail: null } });
    }
  });

  it("trims and lowercases a valid address", () => {
    expect(parseSiteSettingsForm(form({ contactEmail: "  Hello@Abody.Example " }))).toEqual({
      ok: true,
      data: { contactEmail: "hello@abody.example" },
    });
  });

  it("rejects invalid addresses and keeps the typed value", () => {
    const tooLong = `${"a".repeat(243)}@example.com`;
    expect(tooLong).toHaveLength(255);
    for (const input of ["a@b", "no-at", "a b@c.com", tooLong]) {
      const result = parseSiteSettingsForm(form({ contactEmail: input }));
      expect(result).toEqual({
        ok: false,
        fieldErrors: { contactEmail: "invalid_email" },
        values: { contactEmail: input.toLowerCase() },
      });
    }
  });
});
