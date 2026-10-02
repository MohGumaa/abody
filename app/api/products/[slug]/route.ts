import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { getPublishedProductBySlug } from "@/lib/catalog";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/products/[slug]">,
) {
  const { slug } = await ctx.params;
  const lang = request.nextUrl.searchParams.get("lang");
  if (lang !== null && !isLocale(lang)) {
    return apiError(400, "invalid_lang", "lang must be en or ar.");
  }

  try {
    const product = await getPublishedProductBySlug(
      slug,
      lang ?? DEFAULT_LOCALE,
    );
    if (!product) {
      return apiError(404, "not_found", "Product not found.");
    }
    return Response.json({ product });
  } catch (error) {
    console.error("GET /api/products/[slug] failed", error);
    return apiError(500, "internal_error", "Something went wrong.");
  }
}
