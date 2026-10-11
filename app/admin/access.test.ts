import { beforeEach, describe, expect, it, vi } from "vitest";

// Every admin page refuses anyone but an admin before it reads data (feature
// 24a). Pages are found with import.meta.glob, so a new page is covered
// without editing this file. The real requireAdmin() and adminMetadata() run;
// only the session source and the database are mocked.

const { getCurrentUser, touched } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  touched: [] as string[],
}));

vi.mock("@/lib/session", () => ({ getCurrentUser }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  usePathname: () => "/admin",
}));
// Any use of the database fails the test; Vitest's own inspection (symbols,
// then) is ignored.
vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get(_target, key) {
        if (typeof key === "symbol" || key === "then") return undefined;
        touched.push(String(key));
        throw new Error(`database touched: ${String(key)}`);
      },
    },
  ),
}));

type PageModule = {
  default: (props: unknown) => unknown;
  generateMetadata?: (props: unknown) => Promise<unknown>;
};

const pages = import.meta.glob("./**/page.tsx") as Record<string, () => Promise<PageModule>>;
const paths = Object.keys(pages).sort();

const ACTORS = [
  ["signed out", null],
  ["a customer", { id: "u1", name: "Layla", email: "layla@example.com", role: "CUSTOMER" }],
] as const;

const cases = paths.flatMap((path) => ACTORS.map(([actor, user]) => [path, actor, user] as const));

function props() {
  return {
    params: Promise.resolve({ id: "cm1abc", itemId: "cm1abc", rest: ["x"] }),
    searchParams: Promise.resolve({}),
  };
}

beforeEach(() => {
  touched.length = 0;
  getCurrentUser.mockReset();
});

describe("admin pages", () => {
  it("finds every admin page", () => {
    expect(paths.length).toBeGreaterThanOrEqual(20);
  });

  it.each(cases)("%s refuses %s", async (path, _actor, user) => {
    getCurrentUser.mockResolvedValue(user);
    const page = await pages[path]();

    await expect(Promise.resolve().then(() => page.default(props()))).rejects.toThrow(
      "NOT_FOUND",
    );
    expect(touched).toEqual([]);
  });

  it.each(cases)("%s metadata hides the area from %s", async (path, _actor, user) => {
    getCurrentUser.mockResolvedValue(user);
    const page = await pages[path]();
    if (!page.generateMetadata) return;

    await expect(page.generateMetadata(props())).resolves.toEqual({
      title: { absolute: "Page not found" },
      robots: { index: false, follow: false },
    });
    expect(touched).toEqual([]);
  });
});
