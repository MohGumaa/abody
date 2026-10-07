import type { NextRequest } from "next/server";
import { ADMIN_PRODUCT_TYPE, isProductId } from "@/lib/admin";
import { PRODUCT_FILE_MAX_BYTES, productFileExtension } from "@/lib/admin-product-rules";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import {
  removeOwnUpload,
  saveProductUpload,
  type UploadError,
} from "@/lib/product-files";
import { getCurrentUser } from "@/lib/session";

// Uploads a digital product's downloadable file (feature 13). The body is the
// raw file and x-file-name holds its URI-encoded name. A route handler, not a
// Server Action, so the global action body limit stays at its 1 MB default.

const NAME_MAX_LENGTH = 255;

const UPLOAD_ERRORS: Record<UploadError, [number, string]> = {
  file_too_large: [413, "The file is larger than 25 MB."],
  empty_file: [400, "The file is empty."],
  invalid_file_type: [400, "The file is not a valid PDF or ZIP."],
};

// Anyone but an admin gets the same answer as a missing product.
function notFound(): Response {
  return apiError(404, "not_found", "Product not found");
}

function fileName(request: NextRequest): string | null {
  const header = request.headers.get("x-file-name");
  if (!header || header.length > NAME_MAX_LENGTH * 3) return null;
  try {
    const name = decodeURIComponent(header);
    return name.length > 0 && name.length <= NAME_MAX_LENGTH ? name : null;
  } catch {
    return null;
  }
}

// Server Actions check the origin themselves; this route does it by hand. The
// session cookie is also SameSite=Lax.
function isCrossOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return false;
  try {
    return new URL(origin).host !== request.headers.get("host");
  } catch {
    return true;
  }
}

export async function PUT(
  request: NextRequest,
  ctx: RouteContext<"/api/admin/products/[id]/file">,
) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return notFound();
  if (isCrossOrigin(request)) {
    return apiError(403, "forbidden", "Cross-origin uploads are not allowed");
  }

  const { id } = await ctx.params;
  if (!isProductId(id)) return notFound();

  const name = fileName(request);
  if (!name || !productFileExtension(name)) {
    return apiError(400, "invalid_file_type", "Upload a PDF or ZIP file.");
  }
  // A missing length is allowed; the stream is counted either way.
  const lengthHeader = request.headers.get("content-length");
  const length = lengthHeader === null ? null : Number(lengthHeader);
  if (length !== null && length > PRODUCT_FILE_MAX_BYTES) {
    return apiError(413, "file_too_large", "The file is larger than 25 MB.");
  }
  if (!request.body || length === 0) {
    return apiError(400, "empty_file", "The file is empty.");
  }

  let key: string | null = null;
  try {
    const product = await db.product.findFirst({
      where: { id, type: ADMIN_PRODUCT_TYPE },
      select: { digitalFile: true },
    });
    if (!product) return notFound();

    const saved = await saveProductUpload(id, request.body, name, PRODUCT_FILE_MAX_BYTES);
    if (!saved.ok) {
      const [status, message] = UPLOAD_ERRORS[saved.error];
      return apiError(status, saved.error, message);
    }
    key = saved.key;

    // The product points at the new file only once it is fully on disk.
    const { count } = await db.product.updateMany({
      where: { id, type: ADMIN_PRODUCT_TYPE },
      data: { digitalFile: saved.key },
    });
    if (count === 0) {
      await removeOwnUpload(id, saved.key);
      return notFound();
    }
    key = null;

    try {
      await removeOwnUpload(id, product.digitalFile);
    } catch (error) {
      console.error(`PUT /api/admin/products: old file for ${id} not removed`, error);
    }
    return Response.json({ fileName: saved.fileName });
  } catch (error) {
    // Never log storage paths or file contents.
    console.error(`PUT /api/admin/products: upload for ${id} failed`, error);
    if (key) await removeOwnUpload(id, key).catch(() => {});
    return apiError(500, "internal_error", "Something went wrong.");
  }
}
