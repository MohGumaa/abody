import { beforeEach, describe, expect, it, vi } from "vitest";

// Every admin Server Action refuses anyone but an admin before it touches
// data or a side effect (feature 24a). Actions are found with
// import.meta.glob, so a new admin action is covered without editing this
// file. The real requireAdmin() runs; only its session source is mocked.

const { getCurrentUser, touched, sideEffect } = vi.hoisted(() => {
  const touched: string[] = [];
  return {
    getCurrentUser: vi.fn(),
    touched,
    sideEffect: (name: string) => () => {
      touched.push(name);
      throw new Error(`side effect: ${name}`);
    },
  };
});

vi.mock("@/lib/session", () => ({ getCurrentUser }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: sideEffect("revalidatePath") }));
vi.mock("next/server", () => ({ after: sideEffect("after") }));
vi.mock("@/lib/stripe", () => ({ getStripe: sideEffect("stripe") }));
vi.mock("@/lib/product-files", () => ({ removeProductUploads: sideEffect("storage") }));
vi.mock("@/lib/service-notifications", () => ({
  sendServiceStatusEmail: sideEffect("email"),
}));
vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get(_target, key) {
        if (typeof key === "symbol" || key === "then") return undefined;
        touched.push(`db.${String(key)}`);
        throw new Error(`database touched: ${String(key)}`);
      },
    },
  ),
}));

type ActionModule = Record<string, unknown>;

const modules = import.meta.glob(["./admin-*.ts", "!./*.test.ts"], {
  eager: true,
}) as Record<string, ActionModule>;

const actions = Object.entries(modules)
  .flatMap(([path, module]) =>
    Object.entries(module)
      .filter(([, value]) => typeof value === "function")
      .map(([name, fn]) => [`${path} ${name}`, fn as (...args: unknown[]) => unknown] as const),
  )
  .sort(([a], [b]) => a.localeCompare(b));

const ACTORS = [
  ["signed out", null],
  ["a customer", { id: "u1", name: "Layla", email: "layla@example.com", role: "CUSTOMER" }],
] as const;

const cases = actions.flatMap(([label, fn]) =>
  ACTORS.map(([actor, user]) => [label, actor, fn, user] as const),
);

beforeEach(() => {
  touched.length = 0;
  getCurrentUser.mockReset();
});

describe("admin actions", () => {
  it("finds every admin action", () => {
    expect(Object.keys(modules).length).toBeGreaterThanOrEqual(6);
    expect(actions.length).toBeGreaterThanOrEqual(16);
  });

  it.each(cases)("%s refuses %s", async (_label, _actor, fn, user) => {
    getCurrentUser.mockResolvedValue(user);

    await expect(
      Promise.resolve().then(() => fn(null, new FormData())),
    ).rejects.toThrow("NOT_FOUND");
    expect(touched).toEqual([]);
  });
});
