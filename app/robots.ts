import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

// Reads SITE_URL at request time, like the sitemap it points to.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    // The cart is crawlable so its noindex tag can be seen.
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
