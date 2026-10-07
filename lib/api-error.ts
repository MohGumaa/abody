export type ApiErrorCode =
  | "invalid_type"
  | "invalid_lang"
  | "not_found"
  | "invalid_signature"
  | "forbidden"
  | "invalid_file_type"
  | "empty_file"
  | "file_too_large"
  | "internal_error";

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
): Response {
  return Response.json({ error: { code, message } }, { status });
}
