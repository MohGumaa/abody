import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { isProductType, listPublishedProducts } from "@/lib/catalog";

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  if (type !== null && !isProductType(type)) {
    return apiError(
      400,
      "invalid_type",
      "type must be DIGITAL_PRODUCT or SERVICE.",
    );
  }

  try {
    const products = await listPublishedProducts({ type: type ?? undefined });
    return Response.json({ products });
  } catch (error) {
    console.error("GET /api/products failed", error);
    return apiError(500, "internal_error", "Something went wrong.");
  }
}
