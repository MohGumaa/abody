export type ApiErrorCode =
  | "invalid_type"
  | "invalid_lang"
  | "not_found"
  | "internal_error";

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
): Response {
  return Response.json({ error: { code, message } }, { status });
}
