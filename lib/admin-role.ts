import { isValidEmail, normalizeEmail } from "@/lib/auth";
import { db } from "@/lib/db";

// Granting the admin role. Only scripts/promote-admin.ts calls this, from a
// shell with database access; no web request can reach it. No next/* imports.

export type PromoteResult =
  | "promoted"
  | "already-admin"
  | "not-found"
  | "invalid-email";

// Never creates a user: the account must already be registered.
export async function promoteToAdmin(rawEmail: string): Promise<PromoteResult> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) return "invalid-email";
  const user = await db.user.findUnique({
    where: { email },
    select: { role: true },
  });
  if (!user) return "not-found";
  if (user.role === "ADMIN") return "already-admin";
  await db.user.update({ where: { email }, data: { role: "ADMIN" } });
  return "promoted";
}
