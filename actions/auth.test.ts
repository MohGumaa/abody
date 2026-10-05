import { beforeEach, describe, expect, it, vi } from "vitest";

const { user, createSession, deleteCurrentSession, redirect } = vi.hoisted(
  () => ({
    user: { create: vi.fn(), findUnique: vi.fn() },
    createSession: vi.fn(),
    deleteCurrentSession: vi.fn(),
    // Like Next.js, redirect throws so nothing after it runs.
    redirect: vi.fn((url: string) => {
      throw new Error(`REDIRECT ${url}`);
    }),
  }),
);

vi.mock("@/lib/db", () => ({ db: { user } }));
vi.mock("@/lib/session", () => ({ createSession, deleteCurrentSession }));
vi.mock("next/navigation", () => ({ redirect }));

import { clearLoginFailures, LOGIN_MAX_ATTEMPTS } from "@/lib/auth";
import { Prisma } from "@/lib/generated/prisma/client";
import { hashPassword } from "@/lib/password";
import { register, signIn, signOut } from "./auth";

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
