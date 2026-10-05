import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import type { Role } from "@/lib/generated/prisma/enums";
import {
  createSessionToken,
  hashSessionToken,
  isSessionExpired,
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionExpiry,
} from "@/lib/session-token";

// Server code only. Cookies can be written only from Server Actions and route
// handlers, so pages call getCurrentUser() and never the writers.

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export async function createSession(userId: string): Promise<void> {
  const token = createSessionToken();
  const expiresAt = sessionExpiry(new Date());
  await db.session.create({
    data: { tokenHash: hashSessionToken(token), userId, expiresAt },
  });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

// One lookup per request, however many components ask.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  const session = await db.session.findUnique({
    where: { tokenHash },
    select: {
      expiresAt: true,
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });
  if (!session) return null;
  if (isSessionExpired(session.expiresAt, new Date())) {
    await db.session.deleteMany({ where: { tokenHash } });
    return null;
  }
  return session.user;
});

export async function deleteCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }
  store.delete(SESSION_COOKIE);
}
