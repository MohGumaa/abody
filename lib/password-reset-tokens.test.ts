import { beforeEach, describe, expect, it, vi } from "vitest";

const { passwordResetToken } = vi.hoisted(() => ({
  passwordResetToken: { findUnique: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: { passwordResetToken } }));

import { hashResetToken } from "@/lib/password-reset";
import { isResetTokenUsable } from "@/lib/password-reset-tokens";

const NOW = new Date("2026-10-12T10:00:00Z");

beforeEach(() => {
  passwordResetToken.findUnique
    .mockReset()
    .mockResolvedValue({ expiresAt: new Date(NOW.getTime() + 1) });
});

describe("isResetTokenUsable", () => {
  it("accepts a stored token that has not expired, looked up by hash", async () => {
    expect(await isResetTokenUsable("abc", NOW)).toBe(true);
    expect(passwordResetToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashResetToken("abc") },
      select: { expiresAt: true },
    });
  });

  it("rejects an expired or unknown token", async () => {
    passwordResetToken.findUnique.mockResolvedValue({ expiresAt: NOW });
    expect(await isResetTokenUsable("abc", NOW)).toBe(false);
    passwordResetToken.findUnique.mockResolvedValue(null);
    expect(await isResetTokenUsable("abc", NOW)).toBe(false);
  });

  it("rejects a missing, repeated, or oversized token without a lookup", async () => {
    for (const token of [undefined, "", ["a", "b"], "t".repeat(129)]) {
      expect(await isResetTokenUsable(token, NOW)).toBe(false);
    }
    expect(passwordResetToken.findUnique).not.toHaveBeenCalled();
  });
});
