import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { isProductType, listPublishedProducts } from "@/lib/catalog";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  if (type !== null && !isProductType(type)) {
    return apiError(
      400,
      "invalid_type",
      "type must be DIGITAL_PRODUCT or SERVICE.",
    );
  }
  const lang = request.nextUrl.searchParams.get("lang");
  if (lang !== null && !isLocale(lang)) {
    return apiError(400, "invalid_lang", "lang must be en or ar.");
  }

  try {
    const products = await listPublishedProducts({
      type: type ?? undefined,
      locale: lang ?? DEFAULT_LOCALE,
    });
    return Response.json({ products });
  } catch (error) {
    console.error("GET /api/products failed", error);
    return apiError(500, "internal_error", "Something went wrong.");
  }
}
