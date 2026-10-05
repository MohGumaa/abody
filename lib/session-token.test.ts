import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  hashSessionToken,
  isSessionExpired,
  SESSION_DURATION_MS,
  sessionCookieOptions,
  sessionExpiry,
} from "./session-token";

describe("session tokens", () => {
  it("creates distinct 32-byte base64url tokens", () => {
    const a = createSessionToken();
    const b = createSessionToken();

    expect(a).toMatch(/^[\w-]{43}$/);
    expect(a).not.toBe(b);
  });

  it("hashes a token to stable SHA-256 hex that differs from the token", () => {
    const token = createSessionToken();

    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toBe(token);
  });
});

describe("session expiry", () => {
  const now = new Date("2026-10-05T12:00:00Z");

  it("lasts 30 days", () => {
    expect(sessionExpiry(now).getTime() - now.getTime()).toBe(SESSION_DURATION_MS);
    expect(SESSION_DURATION_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("is expired at and after its expiry time", () => {
    const expiresAt = new Date(now.getTime() + 1000);

    expect(isSessionExpired(expiresAt, now)).toBe(false);
    expect(isSessionExpired(expiresAt, expiresAt)).toBe(true);
    expect(isSessionExpired(expiresAt, new Date(now.getTime() + 2000))).toBe(true);
  });
});

describe("sessionCookieOptions", () => {
  it("is http-only, lax, site-wide, and expires with the session", () => {
    const expires = new Date("2026-11-04T12:00:00Z");

    expect(sessionCookieOptions(expires)).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      expires,
    });
  });
});
