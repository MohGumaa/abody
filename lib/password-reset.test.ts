import { describe, expect, it } from "vitest";
import {
  createResetToken,
  hashResetToken,
  isResetTokenExpired,
  RESET_TOKEN_TTL_MS,
  resetTokenExpiry,
} from "./password-reset";

describe("reset tokens", () => {
  it("are 32 random bytes in base64url", () => {
    const token = createResetToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createResetToken()).not.toBe(token);
  });

  it("hash to SHA-256 hex, never the token itself", () => {
    const hash = hashResetToken("abc");
    expect(hash).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(hashResetToken("abc")).toBe(hash);
  });
});

describe("reset token expiry", () => {
  const now = new Date("2026-10-12T10:00:00Z");

  it("lasts one hour", () => {
    expect(RESET_TOKEN_TTL_MS).toBe(60 * 60 * 1000);
    expect(resetTokenExpiry(now)).toEqual(new Date("2026-10-12T11:00:00Z"));
  });

  it("is expired at and after the expiry time only", () => {
    const expiresAt = resetTokenExpiry(now);
    expect(isResetTokenExpired(expiresAt, new Date(expiresAt.getTime() - 1))).toBe(false);
    expect(isResetTokenExpired(expiresAt, expiresAt)).toBe(true);
    expect(isResetTokenExpired(expiresAt, new Date(expiresAt.getTime() + 1))).toBe(true);
  });
});
