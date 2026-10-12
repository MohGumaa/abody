import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  user,
  passwordResetToken,
  session,
  transaction,
  createSession,
  deleteCurrentSession,
  redirect,
  reserveRateLimit,
  after,
  sendPasswordResetEmail,
} = vi.hoisted(() => ({
  user: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  passwordResetToken: { findUnique: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  session: { deleteMany: vi.fn() },
  transaction: vi.fn(),
  createSession: vi.fn(),
  deleteCurrentSession: vi.fn(),
  // Like Next.js, redirect throws so nothing after it runs.
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
  reserveRateLimit: vi.fn(),
  after: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { user, passwordResetToken, session, $transaction: transaction },
}));
vi.mock("@/lib/session", () => ({ createSession, deleteCurrentSession }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/server", () => ({ after }));
vi.mock("@/lib/rate-limit", () => ({ clientKey: () => "ip", reserveRateLimit }));
vi.mock("@/lib/password-reset-notifications", () => ({ sendPasswordResetEmail }));

import { clearLoginFailures, LOGIN_MAX_ATTEMPTS } from "@/lib/auth";
import { Prisma } from "@/lib/generated/prisma/client";
import { hashPassword, verifyPassword } from "@/lib/password";
import { hashResetToken } from "@/lib/password-reset";
import {
  register,
  requestPasswordReset,
  resetPassword,
  signIn,
  signOut,
} from "./auth";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const registerFields = {
  lang: "en",
  name: "Layla",
  email: "Layla@Example.com",
  password: "long enough",
  confirm: "long enough",
  next: "/en/cart",
};

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint", {
    code: "P2002",
    clientVersion: "test",
  });
}

let storedHash: string;

beforeEach(async () => {
  storedHash ??= await hashPassword("right password");
  user.create.mockReset().mockResolvedValue({ id: "u1" });
  user.findUnique.mockReset().mockResolvedValue({ id: "u1", passwordHash: storedHash });
  createSession.mockReset().mockResolvedValue(undefined);
  deleteCurrentSession.mockReset().mockResolvedValue(undefined);
  redirect.mockClear();
  reserveRateLimit.mockReset().mockResolvedValue(true);
  user.update.mockReset().mockResolvedValue({});
  passwordResetToken.findUnique.mockReset().mockResolvedValue(null);
  passwordResetToken.create.mockReset().mockResolvedValue({ id: "prt1" });
  passwordResetToken.deleteMany.mockReset().mockResolvedValue({ count: 1 });
  session.deleteMany.mockReset().mockResolvedValue({ count: 2 });
  // Arrays run as given; a callback gets the same mocked models.
  transaction.mockReset().mockImplementation(async (work: unknown) =>
    typeof work === "function"
      ? work({ user, passwordResetToken, session })
      : Promise.all(work as Promise<unknown>[]),
  );
  after.mockReset();
  sendPasswordResetEmail.mockReset().mockResolvedValue(undefined);
  clearLoginFailures("layla@example.com");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("register", () => {
  it("creates a customer, starts a session, and redirects to next", async () => {
    await expect(register(null, form(registerFields))).rejects.toThrow(
      "REDIRECT /en/cart",
    );

    const { data, select } = user.create.mock.calls[0][0];
    expect(select).toEqual({ id: true });
    expect(data).toMatchObject({ name: "Layla", email: "layla@example.com" });
    expect(data).not.toHaveProperty("role");
    expect(data.passwordHash).toMatch(/^scrypt\$/);
    expect(data.passwordHash).not.toContain("long enough");
    expect(createSession).toHaveBeenCalledWith("u1");
  });

  it("redirects to the account page when next is unsafe", async () => {
    await expect(
      register(null, form({ ...registerFields, next: "//evil.com" })),
    ).rejects.toThrow("REDIRECT /en/account");
  });

  it("reports a taken email without a session", async () => {
    user.create.mockRejectedValue(uniqueViolation());

    expect(await register(null, form(registerFields))).toEqual({
      success: false,
      error: "email_taken",
      values: { name: "Layla", email: "layla@example.com" },
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("returns field errors without touching the database", async () => {
    const result = await register(
      null,
      form({ ...registerFields, confirm: "other" }),
    );

    expect(result).toEqual({
      success: false,
      error: "invalid_fields",
      fieldErrors: { confirm: "password_mismatch" },
      values: { name: "Layla", email: "layla@example.com" },
    });
    expect(user.create).not.toHaveBeenCalled();
    expect(reserveRateLimit).not.toHaveBeenCalled();
  });

  it("rejects a tampered language", async () => {
    expect(
      await register(null, form({ ...registerFields, lang: "xx" })),
    ).toEqual({ success: false, error: "invalid_input" });
  });

  it("reports an unexpected failure", async () => {
    user.create.mockRejectedValue(new Error("connection lost"));

    expect(await register(null, form(registerFields))).toMatchObject({
      success: false,
      error: "unexpected",
    });
  });

  it("counts a valid registration against the visitor's limit", async () => {
    await expect(register(null, form(registerFields))).rejects.toThrow("REDIRECT");

    expect(reserveRateLimit).toHaveBeenCalledWith("register", "ip");
  });

  it("stops at the limit without creating an account", async () => {
    reserveRateLimit.mockResolvedValue(false);

    expect(await register(null, form(registerFields))).toEqual({
      success: false,
      error: "rate_limited",
      values: { name: "Layla", email: "layla@example.com" },
    });
    expect(user.create).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("reports a limiter failure as unexpected", async () => {
    reserveRateLimit.mockRejectedValue(new Error("db down"));

    expect(await register(null, form(registerFields))).toMatchObject({
      success: false,
      error: "unexpected",
    });
    expect(user.create).not.toHaveBeenCalled();
  });
});

describe("signIn", () => {
  const loginFields = {
    lang: "ar",
    email: " LAYLA@example.com",
    password: "right password",
    next: "/ar/account",
  };

  it("starts a session and redirects to next", async () => {
    await expect(signIn(null, form(loginFields))).rejects.toThrow(
      "REDIRECT /ar/account",
    );

    expect(user.findUnique).toHaveBeenCalledWith({
      where: { email: "layla@example.com" },
      select: { id: true, passwordHash: true },
    });
    expect(createSession).toHaveBeenCalledWith("u1");
  });

  it("rejects a wrong password with the generic error", async () => {
    expect(
      await signIn(null, form({ ...loginFields, password: "wrong" })),
    ).toEqual({
      success: false,
      error: "invalid_credentials",
      values: { email: "layla@example.com" },
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("rejects an unknown email with the same error", async () => {
    user.findUnique.mockResolvedValue(null);

    expect(await signIn(null, form(loginFields))).toMatchObject({
      error: "invalid_credentials",
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("blocks an email after repeated failures, even with the right password", async () => {
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i += 1) {
      await signIn(null, form({ ...loginFields, password: "wrong" }));
    }
    user.findUnique.mockClear();

    expect(await signIn(null, form(loginFields))).toMatchObject({
      error: "rate_limited",
    });
    expect(user.findUnique).not.toHaveBeenCalled();
  });

  it("lets only five of many parallel attempts reach the password check", async () => {
    // Each lookup waits, so every call is in flight before any finishes.
    user.findUnique.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ id: "u1", passwordHash: storedHash }), 10),
        ),
    );

    const results = await Promise.all(
      Array.from({ length: LOGIN_MAX_ATTEMPTS + 3 }, () =>
        signIn(null, form({ ...loginFields, password: "wrong" })),
      ),
    );

    expect(user.findUnique).toHaveBeenCalledTimes(LOGIN_MAX_ATTEMPTS);
    expect(results.filter((r) => r?.error === "rate_limited")).toHaveLength(3);
    expect(results.filter((r) => r?.error === "invalid_credentials")).toHaveLength(
      LOGIN_MAX_ATTEMPTS,
    );
  });

  it("validates the next path", async () => {
    await expect(
      signIn(null, form({ ...loginFields, next: "/en/account" })),
    ).rejects.toThrow("REDIRECT /ar/account");
  });

  it("returns field errors for an empty password", async () => {
    expect(
      await signIn(null, form({ ...loginFields, password: "" })),
    ).toMatchObject({
      error: "invalid_fields",
      fieldErrors: { password: "password_required" },
    });
  });

  it("reports an unexpected failure", async () => {
    user.findUnique.mockRejectedValue(new Error("connection lost"));

    expect(await signIn(null, form(loginFields))).toMatchObject({
      error: "unexpected",
    });
  });
});

describe("signOut", () => {
  it("deletes the session and goes home in the page language", async () => {
    await expect(signOut(form({ lang: "ar" }))).rejects.toThrow("REDIRECT /ar");

    expect(deleteCurrentSession).toHaveBeenCalled();
  });

  it("falls back to English for an unknown language", async () => {
    await expect(signOut(form({ lang: "xx" }))).rejects.toThrow("REDIRECT /en");
  });
});

describe("requestPasswordReset", () => {
  const fields = { lang: "ar", email: " LAYLA@example.com " };

  beforeEach(() => {
    user.findUnique.mockResolvedValue({ id: "u1", email: "layla@example.com" });
  });

  it("stores a new token hash, drops older ones, and emails after the response", async () => {
    expect(await requestPasswordReset(null, form(fields))).toEqual({ success: true });

    expect(user.findUnique).toHaveBeenCalledWith({
      where: { email: "layla@example.com" },
      select: { id: true, email: true },
    });
    expect(passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    const { data } = passwordResetToken.create.mock.calls[0][0];
    expect(data.userId).toBe("u1");
    expect(data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(data.expiresAt.getTime() - Date.now()).toBeGreaterThan(59 * 60 * 1000);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();

    await after.mock.calls[0][0]();
    const delivery = sendPasswordResetEmail.mock.calls[0][0];
    expect(delivery).toMatchObject({ tokenId: "prt1", email: "layla@example.com", locale: "ar" });
    // Only the hash of the emailed token is stored.
    expect(hashResetToken(delivery.token)).toBe(data.tokenHash);
  });

  it("answers an unknown email the same way without a token or email", async () => {
    user.findUnique.mockResolvedValue(null);

    expect(await requestPasswordReset(null, form(fields))).toEqual({ success: true });
    expect(passwordResetToken.create).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });

  it("counts every valid request against the visitor's limit", async () => {
    await requestPasswordReset(null, form(fields));
    expect(reserveRateLimit).toHaveBeenCalledWith("passwordReset", "ip");
  });

  it("stops at the limit before looking up the account", async () => {
    reserveRateLimit.mockResolvedValue(false);

    expect(await requestPasswordReset(null, form(fields))).toEqual({
      success: false,
      error: "rate_limited",
      values: { email: "layla@example.com" },
    });
    expect(user.findUnique).not.toHaveBeenCalled();
  });

  it("returns a field error for a bad email without counting it", async () => {
    expect(await requestPasswordReset(null, form({ lang: "en", email: "nope" }))).toEqual({
      success: false,
      error: "invalid_fields",
      fieldErrors: { email: "email_invalid" },
      values: { email: "nope" },
    });
    expect(reserveRateLimit).not.toHaveBeenCalled();
  });

  it("rejects a tampered language", async () => {
    expect(await requestPasswordReset(null, form({ ...fields, lang: "xx" }))).toEqual({
      success: false,
      error: "invalid_input",
    });
  });

  it("reports a database failure as unexpected", async () => {
    transaction.mockRejectedValue(new Error("connection lost"));

    expect(await requestPasswordReset(null, form(fields))).toMatchObject({
      success: false,
      error: "unexpected",
    });
    expect(after).not.toHaveBeenCalled();
  });
});

describe("resetPassword", () => {
  const TOKEN = "t".repeat(43);
  const fields = {
    lang: "ar",
    token: TOKEN,
    password: "brand new password",
    confirm: "brand new password",
  };
  const validRow = () => ({ userId: "u1", expiresAt: new Date(Date.now() + 60_000) });

  beforeEach(() => {
    passwordResetToken.findUnique.mockResolvedValue(validRow());
  });

  it("sets the new password, ends every session and link, and goes to sign in", async () => {
    await expect(resetPassword(null, form(fields))).rejects.toThrow(
      "REDIRECT /ar/login?reset=1",
    );

    expect(passwordResetToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashResetToken(TOKEN) },
      select: { userId: true, expiresAt: true },
    });
    const claim = passwordResetToken.deleteMany.mock.calls[0][0];
    expect(claim.where.tokenHash).toBe(hashResetToken(TOKEN));
    expect(claim.where.expiresAt.gt).toBeInstanceOf(Date);

    const { where, data } = user.update.mock.calls[0][0];
    expect(where).toEqual({ id: "u1" });
    expect(await verifyPassword("brand new password", data.passwordHash)).toBe(true);
    expect(await verifyPassword("right password", data.passwordHash)).toBe(false);

    expect(passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(deleteCurrentSession).toHaveBeenCalled();
  });

  it.each([
    ["unknown", () => null],
    ["expired", () => ({ userId: "u1", expiresAt: new Date(Date.now() - 1) })],
  ])("rejects an %s token without changes", async (_label, row) => {
    passwordResetToken.findUnique.mockResolvedValue(row());

    expect(await resetPassword(null, form(fields))).toEqual({
      success: false,
      error: "invalid_token",
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(user.update).not.toHaveBeenCalled();
  });

  it("rejects a token another submit already used", async () => {
    passwordResetToken.deleteMany.mockResolvedValueOnce({ count: 0 });

    expect(await resetPassword(null, form(fields))).toEqual({
      success: false,
      error: "invalid_token",
    });
    expect(user.update).not.toHaveBeenCalled();
    expect(session.deleteMany).not.toHaveBeenCalled();
    expect(deleteCurrentSession).not.toHaveBeenCalled();
  });

  it("returns field errors without checking the token", async () => {
    expect(
      await resetPassword(null, form({ ...fields, confirm: "something else" })),
    ).toEqual({
      success: false,
      error: "invalid_fields",
      fieldErrors: { confirm: "password_mismatch" },
    });
    expect(passwordResetToken.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a missing token as invalid input", async () => {
    expect(await resetPassword(null, form({ ...fields, token: "" }))).toEqual({
      success: false,
      error: "invalid_input",
    });
  });

  it("reports a database failure as unexpected", async () => {
    transaction.mockRejectedValue(new Error("connection lost"));

    expect(await resetPassword(null, form(fields))).toEqual({
      success: false,
      error: "unexpected",
    });
    expect(deleteCurrentSession).not.toHaveBeenCalled();
  });
});
