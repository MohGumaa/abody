import { isLocale, type Locale } from "@/lib/i18n/config";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/password";

// Form parsing for the sign-in and register Server Actions. No next/* imports.

export type AuthFieldError =
  | "name_required"
  | "name_too_long"
  | "email_invalid"
  | "password_required"
  | "password_too_short"
  | "password_too_long"
  | "password_mismatch";

export type AuthField = "name" | "email" | "password" | "confirm";
export type AuthFieldErrors = Partial<Record<AuthField, AuthFieldError>>;

const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 254;
const NEXT_MAX_LENGTH = 512;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; invalidInput: true }
  | {
      ok: false;
      invalidInput: false;
      fieldErrors: AuthFieldErrors;
      values: { name?: string; email?: string };
    };

function text(form: FormData, key: string): string | null {
  const value = form.get(key);
  return typeof value === "string" ? value : null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function emailError(email: string): AuthFieldError | undefined {
  return email.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(email)
    ? undefined
    : "email_invalid";
}

export interface RegisterInput {
  locale: Locale;
  name: string;
  email: string;
  password: string;
  next: string;
}

export function parseRegisterForm(form: FormData): ParseResult<RegisterInput> {
  const locale = text(form, "lang");
  const rawName = text(form, "name");
  const rawEmail = text(form, "email");
  const password = text(form, "password");
  const confirm = text(form, "confirm");
  if (
    !locale ||
    !isLocale(locale) ||
    rawName === null ||
    rawEmail === null ||
    password === null ||
    confirm === null
  ) {
    return { ok: false, invalidInput: true };
  }

  const name = rawName.trim();
  const email = normalizeEmail(rawEmail);
  const fieldErrors: AuthFieldErrors = {};
  if (name.length === 0) fieldErrors.name = "name_required";
  else if (name.length > NAME_MAX_LENGTH) fieldErrors.name = "name_too_long";
  const invalidEmail = emailError(email);
  if (invalidEmail) fieldErrors.email = invalidEmail;
  if (password.length < PASSWORD_MIN_LENGTH) {
    fieldErrors.password = "password_too_short";
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    fieldErrors.password = "password_too_long";
  } else if (confirm !== password) {
    fieldErrors.confirm = "password_mismatch";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, invalidInput: false, fieldErrors, values: { name, email } };
  }
  return {
    ok: true,
    data: { locale, name, email, password, next: safeNextPath(text(form, "next"), locale) },
  };
}

export interface LoginInput {
  locale: Locale;
  email: string;
  password: string;
  next: string;
}

export function parseLoginForm(form: FormData): ParseResult<LoginInput> {
  const locale = text(form, "lang");
  const rawEmail = text(form, "email");
  const password = text(form, "password");
  if (!locale || !isLocale(locale) || rawEmail === null || password === null) {
    return { ok: false, invalidInput: true };
  }

  const email = normalizeEmail(rawEmail);
  const fieldErrors: AuthFieldErrors = {};
  const invalidEmail = emailError(email);
  if (invalidEmail) fieldErrors.email = invalidEmail;
  if (password.length === 0) fieldErrors.password = "password_required";
  // No account can hold a longer password; reject it before any hashing.
  else if (password.length > PASSWORD_MAX_LENGTH) {
    fieldErrors.password = "password_too_long";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, invalidInput: false, fieldErrors, values: { email } };
  }
  return {
    ok: true,
    data: { locale, email, password, next: safeNextPath(text(form, "next"), locale) },
  };
}

// Where to go after signing in. Only a path inside this language's site is
// accepted, so the parameter cannot send anyone to another origin.
export function safeNextPath(value: unknown, locale: Locale): string {
  const fallback = `/${locale}/account`;
  if (typeof value !== "string" || value.length > NEXT_MAX_LENGTH) {
    return fallback;
  }
  const prefix = `/${locale}`;
  const inSite =
    value === prefix ||
    value.startsWith(`${prefix}/`) ||
    value.startsWith(`${prefix}?`);
  if (!inSite || value.includes("//") || value.includes("\\")) return fallback;
  // The sign-in pages redirect a signed-in visitor to next, so pointing next
  // back at them would loop.
  const path = value.split(/[?#]/)[0].replace(/\/+$/, "");
  if (path === `${prefix}/login` || path === `${prefix}/register`) {
    return fallback;
  }
  return value;
}

// Sign-in attempts per email. Kept in this server process's memory only: it
// resets on restart and is not shared between instances (feature 24 owns
// stronger limits).
export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

const failures = new Map<string, { count: number; resetAt: number }>();

// Checks and counts in one synchronous call, before any await, so parallel
// requests cannot all pass the check before a failure is recorded. Every
// attempt counts; a successful sign-in clears the email.
export function reserveLoginAttempt(email: string, now = Date.now()): boolean {
  const entry = failures.get(email);
  if (!entry || entry.resetAt <= now) {
    failures.set(email, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    // Drop finished windows so the map stays small.
    for (const [key, value] of failures) {
      if (value.resetAt <= now) failures.delete(key);
    }
    return true;
  }
  if (entry.count >= LOGIN_MAX_ATTEMPTS) return false;
  entry.count += 1;
  return true;
}

export function clearLoginFailures(email: string): void {
  failures.delete(email);
}
