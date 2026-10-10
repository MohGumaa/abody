import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { db } from "@/lib/db";
import { canDownload, storagePath } from "@/lib/delivery";
import { objectExists, signedDownloadUrl } from "@/lib/object-storage";

// Server code only. Private product files live in a private bucket when one is
// configured (feature 18), otherwise in storage/ at the project root, outside
// public/. Only the download route hands them out.
export const STORAGE_ROOT = path.join(process.cwd(), "storage");

// Order items that deliver a file.
export const DOWNLOADABLE_PRODUCT = {
  type: "DIGITAL_PRODUCT",
  digitalFile: { not: null },
} as const;

export interface OrderDownload {
  itemId: string;
  name: string;
  nameAr: string | null;
}

// The storage key for one order item, only when the checkout session owns a
// paid order holding it. Both ids scope the query, so an item from another
// order never matches.
export async function findDownload(
  sessionId: string,
  itemId: string,
): Promise<string | null> {
  const item = await db.orderItem.findFirst({
    where: {
      id: itemId,
      order: { stripeCheckoutSessionId: sessionId },
      product: DOWNLOADABLE_PRODUCT,
    },
    select: {
      order: { select: { status: true } },
      product: { select: { digitalFile: true } },
    },
  });
  if (!item || !canDownload(item.order.status)) return null;
  return item.product.digitalFile;
}

// What the success page shows. Never selects digitalFile.
export async function listOrderDownloads(
  sessionId: string,
): Promise<{ number: number; downloads: OrderDownload[] } | null> {
  const order = await db.order.findUnique({
    where: { stripeCheckoutSessionId: sessionId },
    select: {
      number: true,
      status: true,
      items: {
        where: { product: DOWNLOADABLE_PRODUCT },
        orderBy: { product: { name: "asc" } },
        select: {
          id: true,
          product: { select: { name: true, nameAr: true } },
        },
      },
    },
  });
  if (!order) return null;
  const downloads = canDownload(order.status)
    ? order.items.map((item) => ({
        itemId: item.id,
        name: item.product.name,
        nameAr: item.product.nameAr,
      }))
    : [];
  return { number: order.number, downloads };
}

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}

// Bucket mode: a short-lived link to a granted key, or null when the object is
// missing. Any other error propagates.
export async function signedStoredFileUrl(key: string): Promise<string | null> {
  if (!(await objectExists(key))) return null;
  return signedDownloadUrl(key);
}

// An unsafe key or a missing file is null; any other error propagates.
export async function openStoredFile(
  key: string,
): Promise<{ size: number; stream: ReadableStream<Uint8Array> } | null> {
  const filePath = storagePath(STORAGE_ROOT, key);
  if (!filePath) return null;
  let size: number;
  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) return null;
    size = stats.size;
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
  const stream = Readable.toWeb(
    createReadStream(filePath),
  ) as ReadableStream<Uint8Array>;
  return { size, stream };
}
