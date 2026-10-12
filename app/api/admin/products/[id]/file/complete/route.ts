import path from "node:path";
import type { NextRequest } from "next/server";
import { isProductId } from "@/lib/admin";
import { PRODUCT_FILE_MAX_BYTES } from "@/lib/admin-product-rules";
import { isUploadKeyFor } from "@/lib/admin-products";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { bucketConfig } from "@/lib/object-storage";
import { finishDirectUpload, removeOwnUpload } from "@/lib/product-files";
import { getCurrentUser } from "@/lib/session";
import {
  isCrossOrigin,
  productNotFound as notFound,
  readSmallJson,
  uploadError,
} from "@/lib/upload-route";

// Step two of a direct upload (feature 25b). Body: { key } from the upload-url
// route. The object's real size and first bytes are checked before the product
// points at it; a failed check removes the upload.

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/admin/products/[id]/file/complete">,
) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return notFound();
  if (isCrossOrigin(request)) {
    return apiError(403, "forbidden", "Cross-origin uploads are not allowed");
  }

  const { id } = await ctx.params;
  if (!isProductId(id)) return notFound();

  // The new upload, removed again on any failure until the product points at it.
  let pending: string | null = null;
  try {
    if (!bucketConfig()) {
      return apiError(409, "direct_upload_unavailable", "Direct upload needs a bucket.");
    }
    const key = (await readSmallJson(request))?.key;
    if (!isUploadKeyFor(id, key)) {
      return apiError(400, "invalid_request", "Send the key from the upload link.");
    }
    const fileName = path.posix.basename(key);

    const product = await db.product.findFirst({
      where: { id, type: "DIGITAL_PRODUCT" },
      select: { digitalFile: true },
    });
    if (!product) {
      await removeOwnUpload(id, key);
      return notFound();
    }
    // A repeated completion: the product already uses this file, so nothing
    // may be removed.
    if (product.digitalFile === key) return Response.json({ fileName });

    pending = key;
    const saved = await finishDirectUpload(id, key, PRODUCT_FILE_MAX_BYTES);
    if (!saved.ok) {
      pending = null; // finishDirectUpload removed it.
      return uploadError(saved.error);
    }

    const { count } = await db.product.updateMany({
      where: { id, type: "DIGITAL_PRODUCT" },
      data: { digitalFile: key },
    });
    if (count === 0) {
      pending = null;
      await removeOwnUpload(id, key);
      return notFound();
    }
    pending = null;

    try {
      await removeOwnUpload(id, product.digitalFile);
    } catch (error) {
      console.error(
        `POST /api/admin/products: old file for ${id} not removed`,
        error instanceof Error ? error.name : "unknown error",
      );
    }
    return Response.json({ fileName: saved.fileName });
  } catch (error) {
    // Never log keys, signed links, or storage settings.
    console.error(
      `POST /api/admin/products: completing the upload for ${id} failed`,
      error instanceof Error ? error.name : "unknown error",
    );
    if (pending) await removeOwnUpload(id, pending).catch(() => {});
    return apiError(500, "internal_error", "Something went wrong.");
  }
}
