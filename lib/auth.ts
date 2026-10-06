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

type ParseResult<T, E = AuthFieldErrors> =
  | { ok: true; data: T }
  | { ok: false; invalidInput: true }
  | {
      ok: false;
      invalidInput: false;
      fieldErrors: E;
      values: { name?: string; email?: string };
    };

function text(form: FormData, key: string): string | null {
  const value = form.get(key);
  return typeof value === "string" ? value : null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function nameError(name: string): AuthFieldError | undefined {
  if (name.length === 0) return "name_required";
  if (name.length > NAME_MAX_LENGTH) return "name_too_long";
  return undefined;
}

function newPasswordError(password: string): AuthFieldError | undefined {
  if (password.length < PASSWORD_MIN_LENGTH) return "password_too_short";
  if (password.length > PASSWORD_MAX_LENGTH) return "password_too_long";
  return undefined;
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
  const invalidName = nameError(name);
  if (invalidName) fieldErrors.name = invalidName;
  const invalidEmail = emailError(email);
  if (invalidEmail) fieldErrors.email = invalidEmail;
  const invalidPassword = newPasswordError(password);
  if (invalidPassword) fieldErrors.password = invalidPassword;
  else if (confirm !== password) fieldErrors.confirm = "password_mismatch";

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

// Account settings forms (feature 8b). The signed-in user comes from the
// session, never from these fields.

export type AccountFieldError =
  | AuthFieldError
  | "current_password_required"
  | "current_password_wrong";

export type AccountField =
  | "name"
  | "email"
  | "currentPassword"
  | "newPassword"
  | "confirm";
export type AccountFieldErrors = Partial<Record<AccountField, AccountFieldError>>;

function currentPasswordError(password: string): AccountFieldError | undefined {
  if (password.length === 0) return "current_password_required";
  // No account can hold a longer password; reject it before any hashing.
  if (password.length > PASSWORD_MAX_LENGTH) return "current_password_wrong";
  return undefined;
}

export interface ProfileInput {
  name: string;
  email: string;
  // Set only when the email changes: the email is the sign-in identity.
  currentPassword: string | null;
}

export function parseProfileForm(
  form: FormData,
  currentEmail: string,
): ParseResult<ProfileInput, AccountFieldErrors> {
  const rawName = text(form, "name");
  const rawEmail = text(form, "email");
  const currentPassword = text(form, "currentPassword");
  if (rawName === null || rawEmail === null || currentPassword === null) {
    return { ok: false, invalidInput: true };
  }

  const name = rawName.trim();
  const email = normalizeEmail(rawEmail);
  const emailChanged = email !== currentEmail;
  const fieldErrors: AccountFieldErrors = {};
  const invalidName = nameError(name);
  if (invalidName) fieldErrors.name = invalidName;
  const invalidEmail = emailError(email);
  if (invalidEmail) fieldErrors.email = invalidEmail;
  else if (emailChanged) {
    const invalidCurrent = currentPasswordError(currentPassword);
    if (invalidCurrent) fieldErrors.currentPassword = invalidCurrent;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, invalidInput: false, fieldErrors, values: { name, email } };
  }
  return {
    ok: true,
    data: { name, email, currentPassword: emailChanged ? currentPassword : null },
  };
}

export interface PasswordChangeInput {
  currentPassword: string;
  newPassword: string;
}

export function parsePasswordChangeForm(
  form: FormData,
): ParseResult<PasswordChangeInput, AccountFieldErrors> {
  const currentPassword = text(form, "currentPassword");
  const newPassword = text(form, "newPassword");
  const confirm = text(form, "confirm");
  if (currentPassword === null || newPassword === null || confirm === null) {
    return { ok: false, invalidInput: true };
  }

  const fieldErrors: AccountFieldErrors = {};
  const invalidCurrent = currentPasswordError(currentPassword);
  if (invalidCurrent) fieldErrors.currentPassword = invalidCurrent;
  const invalidNew = newPasswordError(newPassword);
  if (invalidNew) fieldErrors.newPassword = invalidNew;
  else if (confirm !== newPassword) fieldErrors.confirm = "password_mismatch";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, invalidInput: false, fieldErrors, values: {} };
  }
  return { ok: true, data: { currentPassword, newPassword } };
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

// Sign-in attempts per email, and current-password checks in account settings
// per "user:<id>" (an email always contains @ and these keys never do, so they
// cannot collide). Kept in this server process's memory only: it
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
