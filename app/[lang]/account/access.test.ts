import { beforeEach, describe, expect, it, vi } from "vitest";

// Every customer account page, and onboarding without a checkout session id,
// sends a signed-out visitor to sign in before it reads data (feature 24a).
// Pages are found with import.meta.glob, so a new account page is covered
// without editing this file.

const { getCurrentUser, lang, touched } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  lang: vi.fn(),
  touched: [] as string[],
}));

vi.mock("@/lib/session", () => ({ getCurrentUser }));
vi.mock("next/root-params", () => ({ lang }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  usePathname: () => "/en/account",
}));
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

type PageModule = { default: (props: unknown) => unknown };

const pages = {
  ...import.meta.glob("./**/page.tsx"),
  ...import.meta.glob("../onboarding/[[]itemId]/page.tsx"),
} as Record<string, () => Promise<PageModule>>;

const ITEM_ID = "cm1abc";

// "./services/[itemId]/page.tsx" is /account/services/cm1abc;
// "../onboarding/[itemId]/page.tsx" is /onboarding/cm1abc.
function pagePath(file: string): string {
  const route = file
    .replace(/^\.\//, "/account/")
    .replace(/^\.\.\//, "/")
    .replace(/\/?page\.tsx$/, "")
    .replace("[itemId]", ITEM_ID);
  return route.replace(/\/$/, "");
}

const cases = Object.keys(pages)
  .sort()
  .flatMap((file) => (["en", "ar"] as const).map((locale) => [file, locale] as const));

beforeEach(() => {
  touched.length = 0;
  getCurrentUser.mockReset().mockResolvedValue(null);
  lang.mockReset();
});

describe("customer account pages", () => {
  it("finds every account page and onboarding", () => {
    expect(Object.keys(pages).length).toBeGreaterThanOrEqual(7);
    expect(Object.keys(pages)).toContain("../onboarding/[itemId]/page.tsx");
  });

  it.each(cases)("%s sends a signed-out visitor to sign in (%s)", async (file, locale) => {
    lang.mockResolvedValue(locale);
    const page = await pages[file]();
    const next = `/${locale}${pagePath(file)}`;

    await expect(
      Promise.resolve().then(() =>
        page.default({
          params: Promise.resolve({ lang: locale, itemId: ITEM_ID }),
          searchParams: Promise.resolve({}),
        }),
      ),
    ).rejects.toThrow(`REDIRECT:/${locale}/login?${new URLSearchParams({ next })}`);
    expect(touched).toEqual([]);
  });
});
