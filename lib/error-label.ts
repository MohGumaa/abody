// A safe log label for an unexpected error: its name and, for Prisma, its
// code. Never the message, which for a Prisma error can repeat the query's
// data (emails, hashes, form answers).
export function errorLabel(error: unknown): string {
  if (!(error instanceof Error)) return "unknown error";
  const code = "code" in error ? ` ${String(error.code)}` : "";
  return `${error.name}${code}`;
}
