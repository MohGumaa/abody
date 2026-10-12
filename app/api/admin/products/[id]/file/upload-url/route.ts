import type { NextRequest } from "next/server";
import { isProductId } from "@/lib/admin";
import { PRODUCT_FILE_MAX_BYTES } from "@/lib/admin-product-rules";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { bucketConfig } from "@/lib/object-storage";
import { startDirectUpload } from "@/lib/product-files";
import { getCurrentUser } from "@/lib/session";
import {
  isCrossOrigin,
  productNotFound as notFound,
  readSmallJson,
  uploadError,
} from "@/lib/upload-route";

// Step one of a direct upload (feature 25b): a short-lived link the admin's
// browser PUTs the file to, straight into the bucket, because Vercel caps
// function request bodies at 4.5 MB. Body: { fileName, size }. Nothing is
// stored until the complete route checks what arrived.

const NAME_MAX_LENGTH = 255;

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/admin/products/[id]/file/upload-url">,
) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return notFound();
  if (isCrossOrigin(request)) {
    return apiError(403, "forbidden", "Cross-origin uploads are not allowed");
  }

  const { id } = await ctx.params;
  if (!isProductId(id)) return notFound();

  try {
    if (!bucketConfig()) {
      return apiError(409, "direct_upload_unavailable", "Direct upload needs a bucket.");
    }
    const body = await readSmallJson(request);
    const fileName = body?.fileName;
    const size = body?.size;
    if (
      typeof fileName !== "string" ||
      fileName.length === 0 ||
      fileName.length > NAME_MAX_LENGTH ||
      !Number.isSafeInteger(size)
    ) {
      return apiError(400, "invalid_request", "Send the file's name and size.");
    }

    const product = await db.product.findFirst({
      where: { id, type: "DIGITAL_PRODUCT" },
      select: { id: true },
    });
    if (!product) return notFound();

    const started = await startDirectUpload(
      id,
      fileName,
      size as number,
      PRODUCT_FILE_MAX_BYTES,
    );
    if (!started.ok) return uploadError(started.error);
    return Response.json(
      { url: started.url, key: started.key, contentType: started.contentType },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // Never log keys, signed links, or storage settings.
    console.error(
      `POST /api/admin/products: upload link for ${id} failed`,
      error instanceof Error ? error.name : "unknown error",
    );
    return apiError(500, "internal_error", "Something went wrong.");
  }
}
