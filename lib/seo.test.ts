import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import type { PublicProduct } from "@/lib/catalog";
import { ProductType } from "@/lib/generated/prisma/enums";
import {
  absoluteUrl,
  jsonLdScript,
  pageAlternates,
  pageMetadata,
  productJsonLd,
  productUrl,
  siteUrl,
  sitemapEntries,
  socialImageSrc,
} from "@/lib/seo";

const product: PublicProduct = {
  id: "p1",
  name: "Digital Marketing Template",
  slug: "digital-marketing-template",
  shortDescription: "A ready-made plan.",
  description: "Long description.",
  priceCents: 1900,
  currency: "USD",
  type: ProductType.DIGITAL_PRODUCT,
  category: "Templates",
  image: "/seed/cover.png",
  included: [],
  durationDays: null,
  requirements: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.stubEnv("SITE_URL", "https://abody.example");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("siteUrl", () => {
  it("reads SITE_URL", () => {
    expect(siteUrl().href).toBe("https://abody.example/");
  });

  it("defaults to localhost when unset", () => {
    vi.stubEnv("SITE_URL", "");
    expect(siteUrl().href).toBe("http://localhost:3000/");
  });

  it("throws on an invalid value", () => {
    vi.stubEnv("SITE_URL", "not a url");
    expect(() => siteUrl()).toThrow();
  });
});

describe("absoluteUrl", () => {
  it("keeps a base path", () => {
    vi.stubEnv("SITE_URL", "https://abody.example/shop/");
    expect(absoluteUrl("/en/products")).toBe(
      "https://abody.example/shop/en/products",
    );
  });
});

describe("pageAlternates", () => {
  it("handles the home page", () => {
    expect(pageAlternates("ar", "/")).toEqual({
      canonical: "/ar",
      languages: { en: "/en", ar: "/ar", "x-default": "/en" },
    });
  });

  it("handles nested paths", () => {
    expect(pageAlternates("en", "/services/ads")).toEqual({
      canonical: "/en/services/ads",
      languages: {
        en: "/en/services/ads",
        ar: "/ar/services/ads",
        "x-default": "/en/services/ads",
      },
    });
  });
});

describe("pageMetadata", () => {
  const base = {
    path: "/products",
    title: "Products",
    description: "All products",
    siteName: "Abody",
  };

  it("builds a full Open Graph block", () => {
    const metadata = pageMetadata({ ...base, locale: "ar" });
    expect(metadata.title).toBe("Products");
    expect(metadata.alternates?.canonical).toBe("/ar/products");
    expect(metadata.openGraph).toEqual({
      type: "website",
      url: "/ar/products",
      title: "Products",
      description: "All products",
      siteName: "Abody",
      locale: "ar_AR",
      alternateLocale: "en_US",
      images: [
        { url: "/og-image.png", width: 1200, height: 630, alt: "Abody" },
      ],
    });
  });

  it("supports an absolute title and an image", () => {
    const metadata = pageMetadata({
      ...base,
      locale: "en",
      absoluteTitle: true,
      image: "/cover.png",
    });
    expect(metadata.title).toEqual({ absolute: "Products" });
    expect(metadata.openGraph).toMatchObject({
      locale: "en_US",
      images: ["/cover.png"],
    });
  });
});

describe("socialImageSrc", () => {
  it("keeps raster images", () => {
    expect(socialImageSrc("/seed/cover.png")).toBe("/seed/cover.png");
    expect(socialImageSrc("https://cdn.example/a.jpg?v=1")).toBe(
      "https://cdn.example/a.jpg?v=1",
    );
  });

  it("drops SVG and unsafe images", () => {
    expect(socialImageSrc("/seed/cover.svg")).toBeNull();
    expect(socialImageSrc("https://cdn.example/a.SVG?v=1")).toBeNull();
    expect(socialImageSrc("//evil.example/a.png")).toBeNull();
    expect(socialImageSrc("http://cdn.example/a.png")).toBeNull();
    expect(socialImageSrc(null)).toBeNull();
  });
});

describe("productJsonLd", () => {
  it("describes the product and its offer", () => {
    const url = productUrl(product, "ar");
    expect(url).toBe(
      "https://abody.example/ar/products/digital-marketing-template",
    );
    expect(productJsonLd(product, url)).toEqual({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Digital Marketing Template",
      description: "A ready-made plan.",
      image: "https://abody.example/seed/cover.png",
      sku: "p1",
      category: "Templates",
      offers: {
        "@type": "Offer",
        price: "19.00",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url,
      },
    });
  });

  it("formats small prices and omits a missing image", () => {
    const data = productJsonLd(
      { ...product, priceCents: 5, image: "/seed/cover.svg" },
      "u",
    );
    expect(data.offers.price).toBe("0.05");
    expect(data).not.toHaveProperty("image");
  });
});

describe("jsonLdScript", () => {
  it("escapes text that could close the script element", () => {
    const script = jsonLdScript({ name: "</script><script>alert(1)" });
    expect(script).not.toContain("<");
    expect(JSON.parse(script)).toEqual({ name: "</script><script>alert(1)" });
  });
});

describe("sitemapEntries", () => {
  it("lists every page in both languages with alternates", () => {
    const entries = sitemapEntries([
      { path: "/" },
      { path: "/services/ads", lastModified: "2026-02-01T00:00:00.000Z" },
    ]);
    const home = {
      en: "https://abody.example/en",
      ar: "https://abody.example/ar",
    };
    const ads = {
      en: "https://abody.example/en/services/ads",
      ar: "https://abody.example/ar/services/ads",
    };
    expect(entries).toEqual([
      { url: home.en, alternates: { languages: home } },
      { url: home.ar, alternates: { languages: home } },
      {
        url: ads.en,
        lastModified: "2026-02-01T00:00:00.000Z",
        alternates: { languages: ads },
      },
      {
        url: ads.ar,
        lastModified: "2026-02-01T00:00:00.000Z",
        alternates: { languages: ads },
      },
    ]);
  });
});
