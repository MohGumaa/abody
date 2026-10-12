import { createHash, randomBytes } from "node:crypto";

// Pure forgot-password token helpers (feature 28), free of next/* so Vitest
// can load them. Only the hash is stored; the raw token lives in the emailed
// link alone.

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export function createResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function resetTokenExpiry(now: Date): Date {
  return new Date(now.getTime() + RESET_TOKEN_TTL_MS);
}

export function isResetTokenExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}
