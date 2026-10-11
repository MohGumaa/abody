import { recordPageView } from "@/lib/analytics";
import { parseTrackedPath } from "@/lib/analytics-rules";
import { apiError } from "@/lib/api-error";
import { clientKey, reserveRateLimit } from "@/lib/rate-limit";

const BODY_MAX_BYTES = 1024;

function invalidPath(): Response {
  return apiError(400, "invalid_path", "path must be a store page path.");
}

// The body as text, or null when it passes the byte limit or is not UTF-8.
// Stops reading at the limit, even when no Content-Length was sent.
async function readBody(request: Request): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > BODY_MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

// Page-view beacon from the customer layout (feature 23). Unauthenticated by
// design: it only adds a count and returns nothing. Limited per visitor
// (feature 24b); only valid requests count.
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > BODY_MAX_BYTES) {
    return invalidPath();
  }

  try {
    const text = await readBody(request);
    if (text === null) return invalidPath();

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

    if (!(await reserveRateLimit("analytics", clientKey(request.headers)))) {
      return apiError(429, "rate_limited", "Too many requests.");
    }
    await recordPageView(tracked.path, tracked.detail);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("POST /api/analytics failed", error);
    return apiError(500, "internal_error", "Something went wrong.");
  }
}
