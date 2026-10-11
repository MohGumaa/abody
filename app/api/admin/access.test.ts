import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Every admin API route answers 404 to anyone but an admin before it reads
// input, data, or storage (feature 24a). Routes are found with
// import.meta.glob, so a new admin route is covered without editing this file.

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
vi.mock("@/lib/product-files", () => ({
  saveProductUpload: sideEffect("storage"),
  removeOwnUpload: sideEffect("storage"),
  removeProductUploads: sideEffect("storage"),
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

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type Handler = (request: NextRequest, ctx: unknown) => Promise<Response>;

const modules = import.meta.glob(["./**/route.ts"], { eager: true }) as Record<
  string,
  Partial<Record<string, Handler>>
>;

const handlers = Object.entries(modules)
  .flatMap(([path, module]) =>
    METHODS.filter((method) => typeof module[method] === "function").map(
      (method) => [`${method} ${path}`, method, module[method] as Handler] as const,
    ),
  )
  .sort(([a], [b]) => a.localeCompare(b));

const ACTORS = [
  ["signed out", null],
  ["a customer", { id: "u1", name: "Layla", email: "layla@example.com", role: "CUSTOMER" }],
] as const;

const cases = handlers.flatMap(([label, method, handler]) =>
  ACTORS.map(([actor, user]) => [label, actor, method, handler, user] as const),
);

beforeEach(() => {
  touched.length = 0;
  getCurrentUser.mockReset();
});

describe("admin API routes", () => {
  it("finds every admin route handler", () => {
    expect(handlers.length).toBeGreaterThanOrEqual(1);
  });

  it.each(cases)("%s refuses %s", async (_label, _actor, method, handler, user) => {
    getCurrentUser.mockResolvedValue(user);
    const hasBody = method !== "GET" && method !== "DELETE";
    const request = new NextRequest("http://localhost/api/admin/x", {
      method,
      headers: { origin: "http://localhost", "x-file-name": "guide.pdf" },
      body: hasBody ? "%PDF-1.4" : undefined,
    });

    const response = await handler(request, {
      params: Promise.resolve({ id: "cm1abc" }),
    });

    expect(response.status).toBe(404);
    expect(touched).toEqual([]);
  });
});
