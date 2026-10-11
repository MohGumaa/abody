import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw, deleteMany } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { $queryRaw: queryRaw, rateLimit: { deleteMany } },
}));

import { clientKey, RATE_LIMITS, reserveRateLimit } from "./rate-limit";

const now = new Date("2026-10-11T12:00:00Z");

// The interpolated values of the last $queryRaw tagged-template call.
function queryValues(): unknown[] {
  return queryRaw.mock.calls.at(-1)!.slice(1);
}

beforeEach(() => {
  queryRaw.mockReset().mockResolvedValue([{ count: 2 }]);
  deleteMany.mockReset().mockResolvedValue({ count: 0 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("clientKey", () => {
  const headers = new Headers({
    "x-real-ip": "203.0.113.7",
    "x-forwarded-for": "1.1.1.1, 2.2.2.2",
  });

  it("uses one shared bucket when no header is configured", () => {
    vi.stubEnv("RATE_LIMIT_IP_HEADER", "");
    expect(clientKey(headers)).toBe("unknown");
  });

  it("returns the whole value of the configured header", () => {
    vi.stubEnv("RATE_LIMIT_IP_HEADER", "x-real-ip");
    expect(clientKey(headers)).toBe("203.0.113.7");
  });

  it("takes the rightmost x-forwarded-for entry", () => {
    vi.stubEnv("RATE_LIMIT_IP_HEADER", "x-forwarded-for");
    expect(clientKey(headers)).toBe("2.2.2.2");
    expect(clientKey(new Headers({ "x-forwarded-for": "1.1.1.1, , " }))).toBe("1.1.1.1");
  });

  it("accepts the setting with spaces and upper case", () => {
    vi.stubEnv("RATE_LIMIT_IP_HEADER", "  X-Real-IP ");
    expect(clientKey(headers)).toBe("203.0.113.7");
  });

  it("falls back to the shared bucket when the header is missing or empty", () => {
    vi.stubEnv("RATE_LIMIT_IP_HEADER", "x-real-ip");
    expect(clientKey(new Headers())).toBe("unknown");
    expect(clientKey(new Headers({ "x-real-ip": "  " }))).toBe("unknown");
  });
});

describe("reserveRateLimit", () => {
  it.each(Object.entries(RATE_LIMITS))(
    "allows %s up to its max and blocks the next",
    async (action, { max }) => {
      queryRaw.mockResolvedValueOnce([{ count: max }]);
      expect(await reserveRateLimit(action as keyof typeof RATE_LIMITS, "ip", now)).toBe(true);

      queryRaw.mockResolvedValueOnce([{ count: max + 1 }]);
      expect(await reserveRateLimit(action as keyof typeof RATE_LIMITS, "ip", now)).toBe(false);
    },
  );

  it("stores only a hash of the client and sets the window end", async () => {
    await reserveRateLimit("coupon", "203.0.113.7", now);

    const values = queryValues();
    expect(values[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(values.some((value) => String(value).includes("203.0.113.7"))).toBe(false);
    expect(values).toContainEqual(new Date(now.getTime() + RATE_LIMITS.coupon.windowMs));
  });

  it("keys each action separately", async () => {
    await reserveRateLimit("coupon", "ip", now);
    const couponKey = queryValues()[0];
    await reserveRateLimit("register", "ip", now);

    expect(queryValues()[0]).not.toBe(couponKey);
  });

  it("prunes finished windows when a new window starts", async () => {
    queryRaw.mockResolvedValue([{ count: 1 }]);

    await reserveRateLimit("analytics", "ip", now);

    expect(deleteMany).toHaveBeenCalledWith({ where: { resetAt: { lt: now } } });
  });

  it("does not prune inside a window", async () => {
    await reserveRateLimit("analytics", "ip", now);

    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("propagates a database failure", async () => {
    queryRaw.mockRejectedValue(new Error("db down"));

    await expect(reserveRateLimit("register", "ip", now)).rejects.toThrow("db down");
  });
});
