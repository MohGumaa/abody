import { apiError } from "@/lib/api-error";
import type { UploadError } from "@/lib/product-files";

// Shared by the admin product file routes (features 13 and 25b). Server code
// only; no next/* imports, so Vitest can load it.

const UPLOAD_ERRORS: Record<UploadError, [number, string]> = {
  file_too_large: [413, "The file is larger than 25 MB."],
  empty_file: [400, "The file is empty."],
  invalid_file_type: [400, "The file is not a valid PDF or ZIP."],
};

export function uploadError(error: UploadError): Response {
  const [status, message] = UPLOAD_ERRORS[error];
  return apiError(status, error, message);
}

// Anyone but an admin gets the same answer as a missing product.
export function productNotFound(): Response {
  return apiError(404, "not_found", "Product not found");
}

// Server Actions check the origin themselves; these routes do it by hand. The
// session cookie is also SameSite=Lax.
export function isCrossOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return false;
  try {
    return new URL(origin).host !== request.headers.get("host");
  } catch {
    return true;
  }
}

const JSON_BODY_MAX_BYTES = 2048;

// A small JSON object body, or null when it is too large, not JSON, or not an
// object.
export async function readSmallJson(
  request: Request,
): Promise<Record<string, unknown> | null> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (!(length <= JSON_BODY_MAX_BYTES)) return null;
  const text = await request.text();
  if (Buffer.byteLength(text) > JSON_BODY_MAX_BYTES) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
