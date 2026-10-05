"use server";

import { redirect } from "next/navigation";
import {
  clearLoginFailures,
  parseLoginForm,
  parseRegisterForm,
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

export async function signOut(formData: FormData): Promise<void> {
  const lang = formData.get("lang");
  const locale = typeof lang === "string" && isLocale(lang) ? lang : "en";
  await deleteCurrentSession();
  redirect(localizedPath(locale, "/"));
}
