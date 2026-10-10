import "dotenv/config";
import { stat } from "node:fs/promises";
import path from "node:path";
import { bucketConfig, objectExists, putObjectFromFile } from "../lib/object-storage";
import { localStorageKeys } from "./storage-keys";

// Usage: pnpm storage:upload
// Copies the local storage/seed and storage/products files to the configured
// bucket under the same keys, so stored digitalFile values keep working.
// Objects that already exist are skipped. Nothing is ever deleted.

async function main() {
  if (!bucketConfig()) {
    console.error(
      "No bucket is configured. Set S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY (see .env.example).",
    );
    process.exitCode = 1;
    return;
  }
  const { keys, rejected } = await localStorageKeys(path.join(process.cwd(), "storage"));
  let uploaded = 0;
  let skipped = 0;
  for (const { key, file } of keys) {
    if (await objectExists(key)) {
      skipped += 1;
      continue;
    }
    await putObjectFromFile(key, file, (await stat(file)).size);
    uploaded += 1;
  }
  console.log(`Uploaded ${uploaded}, skipped ${skipped} already in the bucket, rejected ${rejected}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Upload failed");
  process.exitCode = 1;
});
