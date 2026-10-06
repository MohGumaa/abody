import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  user,
  session,
  transaction,
  getCurrentUser,
  otherSessionsWhere,
  revalidatePath,
} = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  session: { deleteMany: vi.fn() },
  // The array form: the queries are already built, so resolve them in order.
  transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
  getCurrentUser: vi.fn(),
  otherSessionsWhere: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { user, session, $transaction: transaction } }));
vi.mock("@/lib/session", () => ({ getCurrentUser, otherSessionsWhere }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { clearLoginFailures, LOGIN_MAX_ATTEMPTS } from "@/lib/auth";
import { Prisma } from "@/lib/generated/prisma/client";
import { hashPassword, verifyPassword } from "@/lib/password";
import { changePassword, signOutOtherSessions, updateProfile } from "./account";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const me = { id: "u1", name: "Layla", email: "layla@example.com", role: "CUSTOMER" };
const otherSessions = { userId: "u1", tokenHash: { not: "current" } };
let storedHash: string;

beforeEach(async () => {
  storedHash ??= await hashPassword("right password");
  user.findUnique.mockReset().mockResolvedValue({ passwordHash: storedHash });
  user.update.mockReset().mockResolvedValue({ id: "u1" });
  session.deleteMany.mockReset().mockResolvedValue({ count: 2 });
  transaction.mockClear();
  getCurrentUser.mockReset().mockResolvedValue(me);
  otherSessionsWhere.mockReset().mockResolvedValue(otherSessions);
  revalidatePath.mockClear();
  clearLoginFailures("user:u1");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("updateProfile", () => {
  const profile = { name: "Layla M", email: "layla@example.com", currentPassword: "" };

  it("updates only the signed-in user's name without a password", async () => {
    await expect(updateProfile(null, form(profile))).resolves.toEqual({ success: true });
    expect(user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { name: "Layla M", email: "layla@example.com" },
    });
    expect(user.findUnique).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/[lang]/account", "layout");
  });

  it("changes the email after checking the current password", async () => {
    const result = await updateProfile(
      null,
      form({ ...profile, email: "New@Example.com", currentPassword: "right password" }),
    );
    expect(result).toEqual({ success: true });
    expect(user.findUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { passwordHash: true },
    });
    expect(user.update.mock.calls[0][0].data.email).toBe("new@example.com");
  });

  it("rejects a wrong current password without writing", async () => {
    const result = await updateProfile(
      null,
      form({ ...profile, email: "new@example.com", currentPassword: "wrong password" }),
    );
    expect(result).toEqual({
      success: false,
      error: "invalid_fields",
      fieldErrors: { currentPassword: "current_password_wrong" },
      values: { name: "Layla M", email: "new@example.com" },
    });
    expect(user.update).not.toHaveBeenCalled();
  });

  it("stops checking the password after too many attempts", async () => {
    const wrong = form({
      ...profile,
      email: "new@example.com",
      currentPassword: "nope nope",
    });
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i += 1) await updateProfile(null, wrong);
    user.findUnique.mockClear();
    await expect(updateProfile(null, wrong)).resolves.toMatchObject({
      success: false,
      error: "rate_limited",
    });
    expect(user.findUnique).not.toHaveBeenCalled();
  });

  it("reports a taken email", async () => {
    user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    const result = await updateProfile(
      null,
      form({ ...profile, email: "taken@example.com", currentPassword: "right password" }),
    );
    expect(result).toEqual({
      success: false,
      error: "email_taken",
      values: { name: "Layla M", email: "taken@example.com" },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input", async () => {
    await expect(
      updateProfile(null, form({ ...profile, name: " " })),
    ).resolves.toMatchObject({
      success: false,
      error: "invalid_fields",
      fieldErrors: { name: "name_required" },
    });
    await expect(updateProfile(null, form({ name: "x" }))).resolves.toEqual({
      success: false,
      error: "invalid_input",
    });
  });

  it("reports a signed-out visitor without writing", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expect(updateProfile(null, form(profile))).resolves.toEqual({
      success: false,
      error: "signed_out",
    });
    expect(user.update).not.toHaveBeenCalled();
  });

  it("logs an unexpected failure", async () => {
    user.update.mockRejectedValue(new Error("db down"));
    await expect(updateProfile(null, form(profile))).resolves.toEqual({
      success: false,
      error: "unexpected",
    });
    expect(console.error).toHaveBeenCalledWith(
      "updateProfile failed",
      expect.any(Error),
    );
  });
});

describe("changePassword", () => {
  const change = {
    currentPassword: "right password",
    newPassword: "brand new password",
    confirm: "brand new password",
  };

  it("replaces the hash and signs out the other sessions together", async () => {
    await expect(changePassword(null, form(change))).resolves.toEqual({
      success: true,
      ended: 2,
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    const { where, data } = user.update.mock.calls[0][0];
    expect(where).toEqual({ id: "u1" });
    expect(await verifyPassword("brand new password", data.passwordHash)).toBe(true);
    expect(otherSessionsWhere).toHaveBeenCalledWith("u1");
    expect(session.deleteMany).toHaveBeenCalledWith({ where: otherSessions });
  });

  it("clears the attempt count after a correct password", async () => {
    const wrong = form({ ...change, currentPassword: "nope nope" });
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS - 1; i += 1) {
      await changePassword(null, wrong);
    }
    await changePassword(null, form(change));
    await expect(changePassword(null, wrong)).resolves.toMatchObject({
      error: "invalid_fields",
    });
  });

  it("rejects a wrong current password without writing", async () => {
    await expect(
      changePassword(null, form({ ...change, currentPassword: "nope nope" })),
    ).resolves.toEqual({
      success: false,
      error: "invalid_fields",
      fieldErrors: { currentPassword: "current_password_wrong" },
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("is rate limited per user", async () => {
    const wrong = form({ ...change, currentPassword: "nope nope" });
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i += 1) await changePassword(null, wrong);
    await expect(changePassword(null, form(change))).resolves.toEqual({
      success: false,
      error: "rate_limited",
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("returns field errors without echoing passwords", async () => {
    const result = await changePassword(
      null,
      form({ ...change, confirm: "different" }),
    );
    expect(result).toEqual({
      success: false,
      error: "invalid_fields",
      fieldErrors: { confirm: "password_mismatch" },
    });
  });

  it("reports a signed-out visitor", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expect(changePassword(null, form(change))).resolves.toEqual({
      success: false,
      error: "signed_out",
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("logs an unexpected failure", async () => {
    transaction.mockRejectedValueOnce(new Error("db down"));
    await expect(changePassword(null, form(change))).resolves.toEqual({
      success: false,
      error: "unexpected",
    });
    expect(console.error).toHaveBeenCalledWith(
      "changePassword failed",
      expect.any(Error),
    );
  });
});

describe("signOutOtherSessions", () => {
  it("deletes the other sessions and reports how many", async () => {
    await expect(signOutOtherSessions()).resolves.toEqual({ success: true, ended: 2 });
    expect(session.deleteMany).toHaveBeenCalledWith({ where: otherSessions });
  });

  it("reports a signed-out visitor", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expect(signOutOtherSessions()).resolves.toEqual({
      success: false,
      error: "signed_out",
    });
    expect(session.deleteMany).not.toHaveBeenCalled();
  });

  it("logs an unexpected failure", async () => {
    session.deleteMany.mockRejectedValue(new Error("db down"));
    await expect(signOutOtherSessions()).resolves.toEqual({
      success: false,
      error: "unexpected",
    });
    expect(console.error).toHaveBeenCalledWith(
      "signOutOtherSessions failed",
      expect.any(Error),
    );
  });
});
