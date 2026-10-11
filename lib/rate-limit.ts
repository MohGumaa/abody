import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

// Limits on anonymous public writes (feature 24b), counted per visitor in
// fixed windows. The sign-in limiter in lib/auth.ts is separate.
export const RATE_LIMITS = {
  register: { max: 5, windowMs: 60 * 60 * 1000 },
  coupon: { max: 10, windowMs: 15 * 60 * 1000 },
  analytics: { max: 120, windowMs: 60 * 1000 },
} as const;

export type RateLimitAction = keyof typeof RATE_LIMITS;

const UNKNOWN_CLIENT = "unknown";

// The visitor's IP from the one header RATE_LIMIT_IP_HEADER names: the header
// the host or proxy sets, never one clients can set directly. For
// x-forwarded-for only the rightmost entry (added by the proxy) is used. With
// no setting (development) or no header, every visitor shares one bucket.
export function clientKey(headers: Headers): string {
  const name = process.env.RATE_LIMIT_IP_HEADER?.trim().toLowerCase();
  if (!name) return UNKNOWN_CLIENT;
  const value = headers.get(name);
  if (!value) return UNKNOWN_CLIENT;
  const client =
    name === "x-forwarded-for"
      ? value.split(",").map((entry) => entry.trim()).filter(Boolean).at(-1)
      : value.trim();
  return client || UNKNOWN_CLIENT;
}

// Counts this request and reports whether it is within the limit. One
// statement starts or bumps the window, so parallel requests cannot all pass.
// Blocked requests still count. Only a hash of the client reaches the database.
export async function reserveRateLimit(
  action: RateLimitAction,
  client: string,
  now = new Date(),
): Promise<boolean> {
  const { max, windowMs } = RATE_LIMITS[action];
  const key = createHash("sha256").update(`${action}:${client}`).digest("hex");
  const resetAt = new Date(now.getTime() + windowMs);

  const [row] = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN 1
                     ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN ${resetAt}
                       ELSE "RateLimit"."resetAt" END
    RETURNING "count"`;

  // A new window started: drop finished ones so the table stays small.
  if (row.count === 1) {
    await db.rateLimit.deleteMany({ where: { resetAt: { lt: now } } });
  }
  return row.count <= max;
}
