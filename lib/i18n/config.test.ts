import { describe, expect, it } from "vitest";
import {
  isAdminPath,
  isLocale,
  localeDirection,
  localizedPath,
  otherLocale,
  pathLocale,
  resolveLocale,
  switchLocalePath,
} from "@/lib/i18n/config";

describe("isLocale", () => {
  it("accepts the two supported locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("ar")).toBe(true);
  });

  it("rejects anything else", () => {
    for (const value of ["EN", "fr", "", "ar-SA", null, undefined]) {
      expect(isLocale(value)).toBe(false);
    }
  });
});

describe("localeDirection and otherLocale", () => {
  it("makes Arabic right-to-left and English left-to-right", () => {
    expect(localeDirection("ar")).toBe("rtl");
    expect(localeDirection("en")).toBe("ltr");
  });

  it("returns the other language", () => {
    expect(otherLocale("en")).toBe("ar");
    expect(otherLocale("ar")).toBe("en");
  });
});

describe("resolveLocale", () => {
  it("prefers a valid cookie over the header", () => {
    expect(resolveLocale("ar", "en-GB,en;q=0.9")).toBe("ar");
    expect(resolveLocale("en", "ar")).toBe("en");
  });

  it("ignores an invalid cookie", () => {
    expect(resolveLocale("fr", "ar")).toBe("ar");
    expect(resolveLocale("AR", "en")).toBe("en");
    expect(resolveLocale("", "ar")).toBe("ar");
  });

  it("picks the highest-ranked supported language from the header", () => {
    expect(resolveLocale(null, "ar-SA,ar;q=0.9,en;q=0.8")).toBe("ar");
    expect(resolveLocale(null, "en-GB,en;q=0.9")).toBe("en");
    expect(resolveLocale(null, "fr-FR,fr;q=0.9,ar;q=0.5")).toBe("ar");
    expect(resolveLocale(null, "en;q=0.4, ar;q=0.7")).toBe("ar");
    expect(resolveLocale(null, "AR-eg")).toBe("ar");
  });

  it("keeps the first entry on a tie", () => {
    expect(resolveLocale(null, "ar,en")).toBe("ar");
    expect(resolveLocale(null, "en;q=0.5,ar;q=0.5")).toBe("en");
  });

  it("ignores entries with q=0", () => {
    expect(resolveLocale(null, "ar;q=0,en;q=0.1")).toBe("en");
    expect(resolveLocale(null, "ar;q=0")).toBe("en");
  });

  it("falls back to English", () => {
    for (const header of [null, undefined, "", "fr,de", ";;;,,,", "ar;q=abc", "*"]) {
      expect(resolveLocale(undefined, header)).toBe("en");
    }
  });
});

describe("isAdminPath", () => {
  it.each(["/admin", "/admin/", "/admin/orders", "/admin?x=1"])(
    "matches %s",
    (path) => {
      expect(isAdminPath(path)).toBe(true);
    },
  );

  it.each(["/", "/administrator", "/admins", "/en/admin", "/ar/admin", "admin", "/Admin"])(
    "does not match %s",
    (path) => {
      expect(isAdminPath(path)).toBe(false);
    },
  );
});

describe("pathLocale", () => {
  it("reads a locale prefix", () => {
    expect(pathLocale("/en")).toBe("en");
    expect(pathLocale("/ar/products/x")).toBe("ar");
  });

  it("returns null without one", () => {
    for (const pathname of ["/", "/products/x", "/enx", "/arabic", "/AR/x", "/fr/x"]) {
      expect(pathLocale(pathname)).toBeNull();
    }
  });
});

describe("localizedPath", () => {
  it("prefixes a root-relative path", () => {
    expect(localizedPath("ar", "/")).toBe("/ar");
    expect(localizedPath("ar", "/products/x")).toBe("/ar/products/x");
    expect(localizedPath("en", "/services/ads")).toBe("/en/services/ads");
  });
});

describe("switchLocalePath", () => {
  it("swaps the prefix and keeps the rest of the path", () => {
    expect(switchLocalePath("/en/products/x", "ar")).toBe("/ar/products/x");
    expect(switchLocalePath("/ar", "en")).toBe("/en");
    expect(switchLocalePath("/en/english", "ar")).toBe("/ar/english");
  });

  it("prefixes a path that has no locale", () => {
    expect(switchLocalePath("/products/x", "ar")).toBe("/ar/products/x");
  });

  it("keeps the query string", () => {
    expect(
      switchLocalePath("/en/success", "ar", "session_id=cs_test_1"),
    ).toBe("/ar/success?session_id=cs_test_1");
    expect(switchLocalePath("/ar", "en", "a=1&b=2")).toBe("/en?a=1&b=2");
  });

  it("adds no ? for an empty query", () => {
    expect(switchLocalePath("/en/cart", "ar", "")).toBe("/ar/cart");
  });

  it("keeps an encoded Arabic value intact", () => {
    const search = new URLSearchParams({ category: "قوالب" }).toString();
    const href = switchLocalePath("/ar/products", "en", search);
    const url = new URL(href, "https://example.com");
    expect(url.pathname).toBe("/en/products");
    expect(url.searchParams.get("category")).toBe("قوالب");
  });
});
