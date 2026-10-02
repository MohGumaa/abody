import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { getPublishedProductBySlug } from "@/lib/catalog";

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/products/[slug]">,
) {
  const { slug } = await ctx.params;

  try {
    const product = await getPublishedProductBySlug(slug);
    if (!product) {
      return apiError(404, "not_found", "Product not found.");
    }
    return Response.json({ product });
  } catch (error) {
    console.error("GET /api/products/[slug] failed", error);
    return apiError(500, "internal_error", "Something went wrong.");
  }
}
