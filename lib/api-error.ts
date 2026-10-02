export type ApiErrorCode = "invalid_type" | "not_found" | "internal_error";

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
): Response {
  return Response.json({ error: { code, message } }, { status });
}
