import path from "node:path";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

// No node:fs, db, or next/* imports here: route handlers, server code, and
// Vitest all load this module.

// Paid orders, including the later fulfilment statuses, keep their downloads.
const DOWNLOADABLE_STATUSES: ReadonlySet<OrderStatus> = new Set([
  "PAID",
  "PROCESSING",
  "COMPLETED",
]);

const KEY_MAX_LENGTH = 255;
// Each segment starts with a letter or digit, so "." and ".." never match.
const KEY_SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".zip": "application/zip",
};

export function canDownload(status: OrderStatus): boolean {
  return DOWNLOADABLE_STATUSES.has(status);
}

// Storage keys are relative paths under the storage root, such as
// "seed/facebook-ads-guide.pdf". Returns null for any key that could escape it.
export function storagePath(root: string, key: string): string | null {
  if (key.length === 0 || key.length > KEY_MAX_LENGTH) return null;
  if (!key.split("/").every((segment) => KEY_SEGMENT_PATTERN.test(segment))) {
    return null;
  }
  const base = path.resolve(root);
  const resolved = path.resolve(base, key);
  return resolved.startsWith(base + path.sep) ? resolved : null;
}

export function contentTypeFor(key: string): string {
  return (
    CONTENT_TYPES[path.posix.extname(key).toLowerCase()] ??
    "application/octet-stream"
  );
}

// Safe keys hold only ASCII letters, digits, ".", "_", and "-", so the file
// name needs no quoting or encoding.
export function contentDisposition(key: string): string {
  return `attachment; filename="${path.posix.basename(key)}"`;
}
