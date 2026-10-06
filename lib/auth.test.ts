import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearLoginFailures,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_MS,
  normalizeEmail,
  parseLoginForm,
  parsePasswordChangeForm,
  parseProfileForm,
  parseRegisterForm,
  reserveLoginAttempt,
  safeNextPath,
} from "./auth";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const validRegister = {
  lang: "en",
  name: "  Layla Mansour ",
  email: " Layla@Example.COM ",
  password: "long enough",
  confirm: "long enough",
  next: "/en/cart",
};

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  A.B@Example.Com ")).toBe("a.b@example.com");
  });
});

describe("parseRegisterForm", () => {
  it("returns trimmed values and the validated next path", () => {
    expect(parseRegisterForm(form(validRegister))).toEqual({
      ok: true,
      data: {
        locale: "en",
        name: "Layla Mansour",
        email: "layla@example.com",
        password: "long enough",
        next: "/en/cart",
      },
    });
  });

  it("does not trim the password", () => {
    const result = parseRegisterForm(
      form({ ...validRegister, password: " spaced  ", confirm: " spaced  " }),
    );

    expect(result.ok && result.data.password).toBe(" spaced  ");
  });

  it.each([
    ["lang", { lang: "fr" }],
    ["a missing field", { name: undefined }],
  ])("rejects %s as invalid input", (_label, change) => {
    const fields: Record<string, string> = { ...validRegister };
    for (const [key, value] of Object.entries(change)) {
      if (value === undefined) delete fields[key];
      else fields[key] = value;
    }

    expect(parseRegisterForm(form(fields))).toEqual({
      ok: false,
      invalidInput: true,
    });
  });

  it.each([
    [{ name: "   " }, { name: "name_required" }],
    [{ name: "x".repeat(101) }, { name: "name_too_long" }],
    [{ email: "no-at-sign" }, { email: "email_invalid" }],
    [{ email: "a@nodot" }, { email: "email_invalid" }],
    [{ email: "a b@example.com" }, { email: "email_invalid" }],
    [{ email: `${"a".repeat(250)}@x.co` }, { email: "email_invalid" }],
    [{ password: "short", confirm: "short" }, { password: "password_too_short" }],
    [
      { password: "x".repeat(129), confirm: "x".repeat(129) },
      { password: "password_too_long" },
    ],
    [{ confirm: "different" }, { confirm: "password_mismatch" }],
  ])("reports %j as %j and keeps name and email", (fields, fieldErrors) => {
    const change: Record<string, string> = fields;
    const result = parseRegisterForm(form({ ...validRegister, ...change }));

    expect(result).toMatchObject({ ok: false, invalidInput: false, fieldErrors });
    expect(result.ok === false && !result.invalidInput && result.values).toEqual({
      name: (change.name ?? validRegister.name).trim(),
      email: normalizeEmail(change.email ?? validRegister.email),
    });
  });

  it("accepts the length limits exactly", () => {
    const result = parseRegisterForm(
      form({
        ...validRegister,
        name: "x".repeat(100),
        password: "x".repeat(128),
        confirm: "x".repeat(128),
      }),
    );

    expect(result.ok).toBe(true);
  });

  it("falls back when next is missing or unsafe", () => {
    const result = parseRegisterForm(
      form({ ...validRegister, lang: "ar", next: "https://evil.com" }),
    );

    expect(result.ok && result.data.next).toBe("/ar/account");
  });
});

describe("parseLoginForm", () => {
  it("returns the normalized email and the raw password", () => {
    expect(
      parseLoginForm(
        form({ lang: "ar", email: " A@B.co ", password: " pw ", next: "/ar" }),
      ),
    ).toEqual({
      ok: true,
      data: { locale: "ar", email: "a@b.co", password: " pw ", next: "/ar" },
    });
  });

  it("requires a password and a valid email", () => {
    expect(
      parseLoginForm(form({ lang: "en", email: "bad", password: "" })),
    ).toEqual({
      ok: false,
      invalidInput: false,
      fieldErrors: { email: "email_invalid", password: "password_required" },
      values: { email: "bad" },
    });
  });

  it("caps the password at 128 characters before any hashing", () => {
    expect(
      parseLoginForm(form({ lang: "en", email: "a@b.co", password: "x".repeat(129) })),
    ).toEqual({
      ok: false,
      invalidInput: false,
      fieldErrors: { password: "password_too_long" },
      values: { email: "a@b.co" },
    });
    expect(
      parseLoginForm(form({ lang: "en", email: "a@b.co", password: "x".repeat(128) })).ok,
    ).toBe(true);
  });

  it("rejects a missing field or an unknown language", () => {
    expect(parseLoginForm(form({ lang: "en", email: "a@b.co" }))).toEqual({
      ok: false,
      invalidInput: true,
    });
    expect(
      parseLoginForm(form({ lang: "de", email: "a@b.co", password: "x" })),
    ).toEqual({ ok: false, invalidInput: true });
  });
});

describe("safeNextPath", () => {
  it.each(["/en", "/en/account", "/en/products/x?ref=1", "/en?x=1"])(
    "accepts %s",
    (path) => {
      expect(safeNextPath(path, "en")).toBe(path);
    },
  );

  it.each([
    null,
    undefined,
    "",
    "//evil.com",
    "/en//evil.com",
    "/\\evil.com",
    "/en/\\evil.com",
    "https://evil.com/en/account",
    "/account",
    "/ar/account",
    "/english",
    "en/account",
    "/en/login",
    "/en/login/",
    "/en/login?next=/en",
    "/en/register",
    `/en/${"x".repeat(520)}`,
  ])("rejects %j", (value) => {
    expect(safeNextPath(value, "en")).toBe("/en/account");
  });
});

describe("login rate limit", () => {
  afterEach(() => {
    clearLoginFailures("a@b.co");
    vi.useRealTimers();
  });

  it("allows five attempts per window and resets after it", () => {
    vi.useFakeTimers();
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i += 1) {
      expect(reserveLoginAttempt("a@b.co")).toBe(true);
    }
    expect(reserveLoginAttempt("a@b.co")).toBe(false);
    expect(reserveLoginAttempt("other@b.co")).toBe(true);
    clearLoginFailures("other@b.co");

    vi.advanceTimersByTime(LOGIN_WINDOW_MS - 1);
    expect(reserveLoginAttempt("a@b.co")).toBe(false);
    vi.advanceTimersByTime(1);
    expect(reserveLoginAttempt("a@b.co")).toBe(true);
  });

  it("does not count a refused attempt", () => {
    vi.useFakeTimers();
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS + 3; i += 1) reserveLoginAttempt("a@b.co");
    vi.advanceTimersByTime(LOGIN_WINDOW_MS);

    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i += 1) {
      expect(reserveLoginAttempt("a@b.co")).toBe(true);
    }
  });

  it("clears on success", () => {
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i += 1) reserveLoginAttempt("a@b.co");
    clearLoginFailures("a@b.co");

    expect(reserveLoginAttempt("a@b.co")).toBe(true);
  });
});

describe("parseProfileForm", () => {
  const current = "layla@example.com";
  const profile = { name: " Layla ", email: " Layla@Example.com ", currentPassword: "" };

  it("accepts a name change without the current password", () => {
    expect(parseProfileForm(form(profile), current)).toEqual({
      ok: true,
      data: { name: "Layla", email: current, currentPassword: null },
    });
  });

  it("requires the current password to change the email", () => {
    const result = parseProfileForm(
      form({ ...profile, email: "new@example.com" }),
      current,
    );
    expect(result).toEqual({
      ok: false,
      invalidInput: false,
      fieldErrors: { currentPassword: "current_password_required" },
      values: { name: "Layla", email: "new@example.com" },
    });
  });

  it("passes the current password on when the email changes", () => {
    const result = parseProfileForm(
      form({ ...profile, email: "New@Example.com", currentPassword: "secret pass" }),
      current,
    );
    expect(result).toEqual({
      ok: true,
      data: { name: "Layla", email: "new@example.com", currentPassword: "secret pass" },
    });
  });

  it("rejects a current password no account can hold", () => {
    const result = parseProfileForm(
      form({ ...profile, email: "new@example.com", currentPassword: "x".repeat(129) }),
      current,
    );
    expect(result).toMatchObject({
      fieldErrors: { currentPassword: "current_password_wrong" },
    });
  });

  it("reports name and email errors", () => {
    expect(
      parseProfileForm(form({ ...profile, name: "  ", email: "nope" }), current),
    ).toMatchObject({ fieldErrors: { name: "name_required", email: "email_invalid" } });
    expect(
      parseProfileForm(form({ ...profile, name: "x".repeat(101) }), current),
    ).toMatchObject({ fieldErrors: { name: "name_too_long" } });
  });

  it("rejects a missing field as invalid input", () => {
    expect(parseProfileForm(form({ name: "Layla", email: current }), current)).toEqual({
      ok: false,
      invalidInput: true,
    });
  });
});

describe("parsePasswordChangeForm", () => {
  const change = {
    currentPassword: "old password",
    newPassword: "new password",
    confirm: "new password",
  };

  it("returns the current and new passwords", () => {
    expect(parsePasswordChangeForm(form(change))).toEqual({
      ok: true,
      data: { currentPassword: "old password", newPassword: "new password" },
    });
  });

  it("checks every field without echoing passwords", () => {
    expect(
      parsePasswordChangeForm(
        form({ currentPassword: "", newPassword: "short", confirm: "short" }),
      ),
    ).toEqual({
      ok: false,
      invalidInput: false,
      fieldErrors: {
        currentPassword: "current_password_required",
        newPassword: "password_too_short",
      },
      values: {},
    });
    expect(
      parsePasswordChangeForm(form({ ...change, newPassword: "x".repeat(129) })),
    ).toMatchObject({ fieldErrors: { newPassword: "password_too_long" } });
    expect(
      parsePasswordChangeForm(form({ ...change, confirm: "different" })),
    ).toMatchObject({ fieldErrors: { confirm: "password_mismatch" } });
  });

  it("rejects a missing field as invalid input", () => {
    expect(
      parsePasswordChangeForm(form({ currentPassword: "a", newPassword: "b" })),
    ).toEqual({ ok: false, invalidInput: true });
  });
});
