"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import {
  clearLoginFailures,
  parseForgotPasswordForm,
  parseLoginForm,
  parseRegisterForm,
  parseResetPasswordForm,
  reserveLoginAttempt,
  type AuthFieldErrors,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from "@/lib/password";
import {
  createResetToken,
  hashResetToken,
  isResetTokenExpired,
  resetTokenExpiry,
} from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/password-reset-notifications";
import { clientKey, reserveRateLimit } from "@/lib/rate-limit";
import { createSession, deleteCurrentSession } from "@/lib/session";

export type AuthActionError =
  | "invalid_input"
  | "invalid_fields"
  | "email_taken"
  | "invalid_credentials"
  | "rate_limited"
  | "unexpected";

// Success never returns: the action redirects. Passwords are never echoed.
export type AuthActionResult = {
  success: false;
  error: AuthActionError;
  fieldErrors?: AuthFieldErrors;
  values?: { name?: string; email?: string };
} | null;

function isEmailTaken(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function register(
  _previous: AuthActionResult,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = parseRegisterForm(formData);
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
  const { name, email, password, next } = parsed.data;

  try {
    // Counted before the costly hash; invalid forms above do not count.
    if (!(await reserveRateLimit("register", clientKey(await headers())))) {
      return { success: false, error: "rate_limited", values: { name, email } };
    }
    const user = await db.user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
      select: { id: true },
    });
    await createSession(user.id);
  } catch (error) {
    // The unique email index also catches two registrations racing.
    if (isEmailTaken(error)) {
      return { success: false, error: "email_taken", values: { name, email } };
    }
    console.error("register failed", error);
    return { success: false, error: "unexpected", values: { name, email } };
  }
  // Outside the try block, so the redirect is not caught as an error.
  redirect(next);
}

export async function signIn(
  _previous: AuthActionResult,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = parseLoginForm(formData);
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
  const { email, password, next } = parsed.data;
  if (!reserveLoginAttempt(email)) {
    return { success: false, error: "rate_limited", values: { email } };
  }

  try {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });
    // An unknown email still pays for one hash, so timing does not reveal it.
    const valid = await verifyPassword(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !valid) {
      return { success: false, error: "invalid_credentials", values: { email } };
    }
    clearLoginFailures(email);
    await createSession(user.id);
  } catch (error) {
    console.error("signIn failed", error);
    return { success: false, error: "unexpected", values: { email } };
  }
  redirect(next);
}

export type ForgotPasswordError =
  | "invalid_input"
  | "invalid_fields"
  | "rate_limited"
  | "unexpected";

// Success is the same whether or not the email has an account.
export type ForgotPasswordResult =
  | { success: true }
  | {
      success: false;
      error: ForgotPasswordError;
      fieldErrors?: AuthFieldErrors;
      values?: { email?: string };
    }
  | null;

export async function requestPasswordReset(
  _previous: ForgotPasswordResult,
  formData: FormData,
): Promise<ForgotPasswordResult> {
  const parsed = parseForgotPasswordForm(formData);
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
  const { locale, email } = parsed.data;

  try {
    if (!(await reserveRateLimit("passwordReset", clientKey(await headers())))) {
      return { success: false, error: "rate_limited", values: { email } };
    }
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });
    if (user) {
      // Only the newest link works.
      const token = createResetToken();
      const [, created] = await db.$transaction([
        db.passwordResetToken.deleteMany({ where: { userId: user.id } }),
        db.passwordResetToken.create({
          data: {
            tokenHash: hashResetToken(token),
            userId: user.id,
            expiresAt: resetTokenExpiry(new Date()),
          },
          select: { id: true },
        }),
      ]);
      // After the response, so sending never delays or changes it.
      after(() =>
        sendPasswordResetEmail({ tokenId: created.id, email: user.email, token, locale }),
      );
    }
  } catch (error) {
    console.error("requestPasswordReset failed", error);
    return { success: false, error: "unexpected", values: { email } };
  }
  return { success: true };
}

export type ResetPasswordError =
  | "invalid_input"
  | "invalid_fields"
  | "invalid_token"
  | "unexpected";

// Success never returns: the action redirects. Passwords are never echoed.
export type ResetPasswordResult = {
  success: false;
  error: ResetPasswordError;
  fieldErrors?: AuthFieldErrors;
} | null;

export async function resetPassword(
  _previous: ResetPasswordResult,
  formData: FormData,
): Promise<ResetPasswordResult> {
  const parsed = parseResetPasswordForm(formData);
  if (!parsed.ok) {
    return parsed.invalidInput
      ? { success: false, error: "invalid_input" }
      : { success: false, error: "invalid_fields", fieldErrors: parsed.fieldErrors };
  }
  const { locale, token, password } = parsed.data;

  try {
    const tokenHash = hashResetToken(token);
    const now = new Date();
    // The account comes from the token row, never from the form.
    const row = await db.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { userId: true, expiresAt: true },
    });
    if (!row || isResetTokenExpired(row.expiresAt, now)) {
      return { success: false, error: "invalid_token" };
    }
    const passwordHash = await hashPassword(password);
    // Claiming the token by deleting it makes it single use: of two racing
    // submits only one deletes the row.
    const reset = await db.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.deleteMany({
        where: { tokenHash, expiresAt: { gt: now } },
      });
      if (claimed.count !== 1) return false;
      await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
      await tx.passwordResetToken.deleteMany({ where: { userId: row.userId } });
      // Everyone signed in with the old password is signed out.
      await tx.session.deleteMany({ where: { userId: row.userId } });
      return true;
    });
    if (!reset) return { success: false, error: "invalid_token" };
    await deleteCurrentSession();
  } catch (error) {
    console.error("resetPassword failed", error);
    return { success: false, error: "unexpected" };
  }
  redirect(`${localizedPath(locale, "/login")}?reset=1`);
}

export async function signOut(formData: FormData): Promise<void> {
  const lang = formData.get("lang");
  const locale = typeof lang === "string" && isLocale(lang) ? lang : "en";
  await deleteCurrentSession();
  redirect(localizedPath(locale, "/"));
}
