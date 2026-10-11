import { recordPageView } from "@/lib/analytics";
import { parseTrackedPath } from "@/lib/analytics-rules";
import { apiError } from "@/lib/api-error";

const BODY_MAX_BYTES = 1024;

function invalidPath(): Response {
  return apiError(400, "invalid_path", "path must be a store page path.");
}

// Page-view beacon from the customer layout (feature 23). Unauthenticated by
// design: it only adds a count and returns nothing.
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > BODY_MAX_BYTES) {
    return invalidPath();
  }

  try {
    const text = await request.text();
    if (text.length > BODY_MAX_BYTES) return invalidPath();

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return invalidPath();
    }
    const tracked = parseTrackedPath(
      typeof body === "object" && body !== null ? (body as { path?: unknown }).path : null,
    );
    if (!tracked) return invalidPath();

    await recordPageView(tracked.path, tracked.detail);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("POST /api/analytics failed", error);
    return apiError(500, "internal_error", "Something went wrong.");
  }
}
