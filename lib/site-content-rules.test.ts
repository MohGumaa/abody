import { describe, expect, it } from "vitest";
import { ar } from "@/lib/i18n/dictionaries/ar";
import { en } from "@/lib/i18n/dictionaries/en";
import {
  parseAnnouncementLink,
  parseSiteContentForm,
  resolveAnnouncement,
  resolveHomeContent,
  SECTION_FLAGS,
  siteContentFormValues,
  type SiteContentRow,
} from "./site-content-rules";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function row(overrides: Partial<SiteContentRow> = {}): SiteContentRow {
  const parsed = parseSiteContentForm(form({}));
  if (!parsed.ok) throw new Error("empty form should parse");
  // An empty form unchecks everything; a fresh row shows every section.
  const data = { ...parsed.data };
  for (const flag of SECTION_FLAGS) data[flag] = true;
  return { ...data, ...overrides };
}

describe("parseSiteContentForm", () => {
  it("stores blank and whitespace-only text as null and trims the rest", () => {
    const parsed = parseSiteContentForm(form({ heroTitle: "  Hello  ", heroTitleAr: "   " }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.heroTitle).toBe("Hello");
    expect(parsed.data.heroTitleAr).toBeNull();
    expect(parsed.data.ctaBody).toBeNull();
  });

  it("folds line breaks to spaces", () => {
    const parsed = parseSiteContentForm(form({ heroLead: "One\r\n\r\n  two\nthree" }));
    expect(parsed.ok && parsed.data.heroLead).toBe("One two three");
  });

  it("rejects text over the limit, per field and language", () => {
    const parsed = parseSiteContentForm(
      form({ heroEyebrow: "x".repeat(60), heroEyebrowAr: "ع".repeat(61), ctaAction: "x".repeat(41) }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.fieldErrors).toEqual({ heroEyebrowAr: "too_long", ctaAction: "too_long" });
    expect(parsed.values.heroEyebrow).toBe("x".repeat(60));
  });

  it("reads checkboxes by presence", () => {
    const parsed = parseSiteContentForm(form({ showFeatured: "on", showCta: "on" }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.showFeatured).toBe(true);
    expect(parsed.data.showCta).toBe(true);
    expect(parsed.data.showCategories).toBe(false);
    expect(parsed.data.announcementEnabled).toBe(false);
  });

  it("needs both announcement texts only when the bar is on", () => {
    expect(parseSiteContentForm(form({ announcementText: "Sale" })).ok).toBe(true);

    const parsed = parseSiteContentForm(
      form({ announcementEnabled: "on", announcementText: "Sale", announcementTextAr: " " }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.fieldErrors).toEqual({ announcementTextAr: "required" });
    expect(parsed.values.announcementEnabled).toBe(true);

    const both = parseSiteContentForm(
      form({ announcementEnabled: "on", announcementText: "Sale", announcementTextAr: "تخفيضات" }),
    );
    expect(both.ok).toBe(true);
  });

  it("checks the link and stores a blank one as null", () => {
    const bad = parseSiteContentForm(form({ announcementLink: "javascript:alert(1)" }));
    expect(bad.ok ? null : bad.fieldErrors).toEqual({ announcementLink: "invalid_link" });

    const blank = parseSiteContentForm(form({ announcementLink: "  " }));
    expect(blank.ok && blank.data.announcementLink).toBeNull();
  });
});

describe("parseAnnouncementLink", () => {
  it.each(["/products", "/services/ads-management", "/products?category=guides", "/", "https://example.com/sale"])(
    "accepts %s",
    (link) => {
      expect(parseAnnouncementLink(link)).toBe(link);
    },
  );

  it.each([
    "//evil.example",
    "/\\evil.example",
    "/products//x",
    "/en/products",
    "/ar",
    "/ar?x=1",
    "http://example.com",
    "javascript:alert(1)",
    "products",
    "/pro ducts",
    "https://exa mple.com",
    `/${"x".repeat(200)}`,
  ])("rejects %s", (link) => {
    expect(parseAnnouncementLink(link)).toBeNull();
  });
});

describe("resolveHomeContent", () => {
  it("uses the built-in text and shows every section with no row", () => {
    const content = resolveHomeContent(null, "en", en.home);
    expect(content.hero).toEqual({
      eyebrow: en.home.hero.eyebrow,
      title: en.home.hero.title,
      lead: en.home.hero.lead,
    });
    expect(content.cta).toEqual(en.home.cta);
    expect(Object.values(content.show).every(Boolean)).toBe(true);
  });

  it("falls back per language, never to the other language's saved text", () => {
    const saved = row({ heroTitle: "Grow faster", ctaActionAr: "تسوق الآن" });

    const english = resolveHomeContent(saved, "en", en.home);
    expect(english.hero.title).toBe("Grow faster");
    expect(english.cta.action).toBe(en.home.cta.action);

    const arabic = resolveHomeContent(saved, "ar", ar.home);
    expect(arabic.hero.title).toBe(ar.home.hero.title);
    expect(arabic.cta.action).toBe("تسوق الآن");
  });

  it("hides the sections the row turns off", () => {
    const content = resolveHomeContent(row({ showServices: false, showCta: false }), "en", en.home);
    expect(content.show.showServices).toBe(false);
    expect(content.show.showCta).toBe(false);
    expect(content.show.showFeatured).toBe(true);
  });
});

describe("resolveAnnouncement", () => {
  const on = {
    announcementEnabled: true,
    announcementText: "Spring sale",
    announcementTextAr: "تخفيضات الربيع",
  };

  it("is null with no row or when the bar is off", () => {
    expect(resolveAnnouncement(null, "en")).toBeNull();
    expect(resolveAnnouncement(row({ ...on, announcementEnabled: false }), "en")).toBeNull();
  });

  it("shows the page language's text", () => {
    expect(resolveAnnouncement(row(on), "ar")).toEqual({ text: "تخفيضات الربيع", href: null });
  });

  it("prefixes a store path with the language and keeps an https link", () => {
    expect(resolveAnnouncement(row({ ...on, announcementLink: "/products" }), "ar")?.href).toBe(
      "/ar/products",
    );
    expect(resolveAnnouncement(row({ ...on, announcementLink: "/" }), "en")?.href).toBe("/en");
    expect(
      resolveAnnouncement(row({ ...on, announcementLink: "https://example.com" }), "en")?.href,
    ).toBe("https://example.com");
  });

  it("drops a stored link that no longer passes the rules", () => {
    expect(resolveAnnouncement(row({ ...on, announcementLink: "//evil" }), "en")?.href).toBeNull();
  });
});

describe("siteContentFormValues", () => {
  it("starts with empty text, every section shown, and the bar off", () => {
    const values = siteContentFormValues(null);
    expect(values.heroTitle).toBe("");
    expect(values.showHowItWorks).toBe(true);
    expect(values.announcementEnabled).toBe(false);
  });
});
