import type { Metadata, MetadataRoute } from "next";
import { productPath, publicImageSrc, type PublicProduct } from "@/lib/catalog";
import {
  DEFAULT_LOCALE,
  LOCALES,
  localizedPath,
  otherLocale,
  type Locale,
} from "@/lib/i18n/config";

const OPEN_GRAPH_LOCALES: Record<Locale, string> = {
  en: "en_US",
  ar: "ar_AR",
};

// Served by app/og-image.png/route.tsx.
export const DEFAULT_SOCIAL_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
} as const;

// An invalid SITE_URL throws, so a misconfigured deploy fails loudly instead of
// publishing wrong canonical URLs.
export function siteUrl(): URL {
  return new URL(process.env.SITE_URL || "http://localhost:3000");
}

// Keeps any base path in SITE_URL, which new URL(path, base) would drop.
export function absoluteUrl(path: string): string {
  return siteUrl().href.replace(/\/$/, "") + path;
}

// `path` is unprefixed: "/", "/products", "/products/<slug>".
export function pageAlternates(locale: Locale, path: string) {
  const languages: Record<string, string> = {};
  for (const lang of LOCALES) languages[lang] = localizedPath(lang, path);
  languages["x-default"] = localizedPath(DEFAULT_LOCALE, path);
  return { canonical: localizedPath(locale, path), languages };
}

interface PageMetadataInput {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  siteName: string;
  // Ignores the layout's "%s | <brand>" template, for the home page.
  absoluteTitle?: boolean;
  image?: string | null;
}

// Next.js merges openGraph shallowly, so every page sets the whole block here.
export function pageMetadata({
  locale,
  path,
  title,
  description,
  siteName,
  absoluteTitle = false,
  image,
}: PageMetadataInput): Metadata {
  const alternates = pageAlternates(locale, path);
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates,
    openGraph: {
      type: "website",
      url: alternates.canonical,
      title,
      description,
      siteName,
      locale: OPEN_GRAPH_LOCALES[locale],
      alternateLocale: OPEN_GRAPH_LOCALES[otherLocale(locale)],
      images: [image ?? defaultSocialImage(siteName)],
    },
  };
}

// The brand name is the logo's alt text.
export function defaultSocialImage(alt: string) {
  return { ...DEFAULT_SOCIAL_IMAGE, alt };
}

// Social platforms do not render SVG previews.
export function socialImageSrc(image: string | null): string | null {
  const src = publicImageSrc(image);
  if (!src || /\.svg$/i.test(new URL(src, "http://local").pathname)) return null;
  return src;
}

function absoluteImageUrl(src: string): string {
  return src.startsWith("/") ? absoluteUrl(src) : src;
}

export function productJsonLd(product: PublicProduct, url: string) {
  const image = socialImageSrc(product.image);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription,
    ...(image ? { image: absoluteImageUrl(image) } : {}),
    sku: product.id,
    category: product.categoryLabel,
    offers: {
      "@type": "Offer",
      price: (product.priceCents / 100).toFixed(2),
      priceCurrency: product.currency,
      // Only published items render, so they are always available.
      availability: "https://schema.org/InStock",
      url,
    },
  };
}

export function productUrl(product: PublicProduct, locale: Locale): string {
  return absoluteUrl(localizedPath(locale, productPath(product)));
}

// "<" never appears raw, so product text cannot close the <script> element.
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export interface SitemapPage {
  path: string;
  lastModified?: string;
}

// One entry per page and language, each listing both languages.
export function sitemapEntries(pages: SitemapPage[]): MetadataRoute.Sitemap {
  return pages.flatMap(({ path, lastModified }) => {
    const languages = Object.fromEntries(
      LOCALES.map((lang) => [lang, absoluteUrl(localizedPath(lang, path))]),
    );
    return LOCALES.map((locale) => ({
      url: languages[locale],
      ...(lastModified ? { lastModified } : {}),
      alternates: { languages },
    }));
  });
}
