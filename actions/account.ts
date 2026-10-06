"use server";

import { revalidatePath } from "next/cache";
import {
  clearLoginFailures,
  parsePasswordChangeForm,
  parseProfileForm,
  reserveLoginAttempt,
  type AccountFieldErrors,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getCurrentUser, otherSessionsWhere } from "@/lib/session";

export type AccountActionError =
  | "invalid_input"
  | "invalid_fields"
  | "email_taken"
  | "rate_limited"
  | "signed_out"
  | "unexpected";

// Passwords are never echoed. ended: how many other sessions were signed out.
export type AccountActionResult =
  | { success: true; ended?: number }
  | {
      success: false;
      error: AccountActionError;
      fieldErrors?: AccountFieldErrors;
      values?: { name?: string; email?: string };
    }
  | null;

function isEmailTaken(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

// Counted per user, so a stolen session cannot guess the password without
// limit, and a lock here does not lock the email out of signing in.
async function checkCurrentPassword(
  userId: string,
  password: string,
): Promise<"ok" | "wrong" | "rate_limited"> {
  const key = `user:${userId}`;
  if (!reserveLoginAttempt(key)) return "rate_limited";
  const row = await db.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!row || !(await verifyPassword(password, row.passwordHash))) {
    return "wrong";
  }
  clearLoginFailures(key);
  return "ok";
}

function wrongCurrentPassword(
  values?: { name?: string; email?: string },
): AccountActionResult {
  return {
    success: false,
    error: "invalid_fields",
    fieldErrors: { currentPassword: "current_password_wrong" },
    values,
  };
}

export async function updateProfile(
  _previous: AccountActionResult,
  formData: FormData,
): Promise<AccountActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "signed_out" };

    const parsed = parseProfileForm(formData, user.email);
    if (!parsed.ok) {
      return parsed.invalidInput
        ? { success: false, error: "invalid_input" }
        : {
            success: false,
            error: "invalid_fields",
            fieldErrors: parsed.fieldErrors,
            values: parsed.values,
          };
    }
    const { name, email, currentPassword } = parsed.data;
    const values = { name, email };

    if (currentPassword !== null) {
      const check = await checkCurrentPassword(user.id, currentPassword);
      if (check === "rate_limited") {
        return { success: false, error: "rate_limited", values };
      }
      if (check === "wrong") return wrongCurrentPassword(values);
    }

    try {
      await db.user.update({ where: { id: user.id }, data: { name, email } });
    } catch (error) {
      // The unique email index also catches two accounts racing for it.
      if (isEmailTaken(error)) {
        return { success: false, error: "email_taken", values };
      }
      throw error;
    }
    revalidatePath("/[lang]/account", "layout");
    return { success: true };
  } catch (error) {
    console.error("updateProfile failed", error);
    return { success: false, error: "unexpected" };
  }
}

export async function changePassword(
  _previous: AccountActionResult,
  formData: FormData,
): Promise<AccountActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "signed_out" };

    const parsed = parsePasswordChangeForm(formData);
    if (!parsed.ok) {
      return parsed.invalidInput
        ? { success: false, error: "invalid_input" }
        : {
            success: false,
            error: "invalid_fields",
            fieldErrors: parsed.fieldErrors,
          };
    }
    const { currentPassword, newPassword } = parsed.data;

    const check = await checkCurrentPassword(user.id, currentPassword);
    if (check === "rate_limited") return { success: false, error: "rate_limited" };
    if (check === "wrong") return wrongCurrentPassword();

    // Anyone who knew the old password is signed out with it; this session stays.
    const passwordHash = await hashPassword(newPassword);
    const [, ended] = await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash } }),
      db.session.deleteMany({ where: await otherSessionsWhere(user.id) }),
    ]);
    return { success: true, ended: ended.count };
  } catch (error) {
    console.error("changePassword failed", error);
    return { success: false, error: "unexpected" };
  }
}

export async function signOutOtherSessions(): Promise<AccountActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "signed_out" };
    const { count } = await db.session.deleteMany({
      where: await otherSessionsWhere(user.id),
    });
    return { success: true, ended: count };
  } catch (error) {
    console.error("signOutOtherSessions failed", error);
    return { success: false, error: "unexpected" };
  }
}
