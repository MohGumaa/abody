import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { isCheckoutSessionId } from "@/lib/checkout";
import { contentDisposition, contentTypeFor } from "@/lib/delivery";
import { findDownload, openStoredFile, signedStoredFileUrl } from "@/lib/downloads";
import { bucketConfig } from "@/lib/object-storage";

const ITEM_ID_MAX_LENGTH = 64;

// Every denial looks the same, so the response never reveals whether an item,
// order, or file exists.
function notFound(): Response {
  return apiError(404, "not_found", "Download not found");
}

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/downloads/[itemId]">,
) {
  const { itemId } = await ctx.params;
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (
    !isCheckoutSessionId(sessionId) ||
    itemId.length === 0 ||
    itemId.length > ITEM_ID_MAX_LENGTH
  ) {
    return notFound();
  }

  try {
    const key = await findDownload(sessionId, itemId);
    if (!key) return notFound();

    if (bucketConfig()) {
      const url = await signedStoredFileUrl(key);
      if (!url) {
        // Never log the session id, the key, or a signed link.
        console.error(`GET /api/downloads: order item ${itemId} stored object missing`);
        return apiError(500, "internal_error", "Something went wrong.");
      }
      return new Response(null, {
        status: 302,
        headers: {
          Location: url,
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
        },
      });
    }

    const file = await openStoredFile(key);
    if (!file) {
      // Never log the session id or the storage path.
      console.error(
        `GET /api/downloads: order item ${itemId} stored file missing or invalid`,
      );
      return apiError(500, "internal_error", "Something went wrong.");
    }

    return new Response(file.stream, {
      headers: {
        "Content-Type": contentTypeFor(key),
        "Content-Length": String(file.size),
        "Content-Disposition": contentDisposition(key),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(`GET /api/downloads: order item ${itemId} failed`, error);
    return apiError(500, "internal_error", "Something went wrong.");
  }
}
