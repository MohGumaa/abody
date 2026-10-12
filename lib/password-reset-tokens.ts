import "server-only";
import { isResetTokenShape } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashResetToken, isResetTokenExpired } from "@/lib/password-reset";

// Read-only check for the reset page (feature 28). The reset action checks
// again and claims the token; this only decides which view to show.
export async function isResetTokenUsable(token: unknown, now = new Date()): Promise<boolean> {
  if (!isResetTokenShape(token)) return false;
  const row = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    select: { expiresAt: true },
  });
  return row !== null && !isResetTokenExpired(row.expiresAt, now);
}
