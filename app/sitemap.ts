import type { MetadataRoute } from "next";
import { listPublishedProducts, productPath } from "@/lib/catalog";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { sitemapEntries } from "@/lib/seo";

// Rendered per request so new and unpublished items show without a rebuild.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Slugs and dates are the same in both languages.
  const items = await listPublishedProducts({ locale: DEFAULT_LOCALE });
  return sitemapEntries([
    { path: "/" },
    { path: "/products" },
    { path: "/services" },
    ...items.map((item) => ({
      path: productPath(item),
      lastModified: item.updatedAt,
    })),
  ]);
}
