import { readdir } from "node:fs/promises";
import path from "node:path";
import { isSafeStorageKey } from "../lib/delivery";

// The folders under storage/ that hold product files: seed data and admin
// uploads. Anything else in storage/ is never copied.
const FOLDERS = ["seed", "products"];

export interface LocalStorageKeys {
  keys: { key: string; file: string }[];
  rejected: number;
}

// Every file under the product folders, keyed the way digitalFile stores it
// (forward slashes). Unfinished .tmp uploads and unsafe paths are rejected.
export async function localStorageKeys(root: string): Promise<LocalStorageKeys> {
  const keys: { key: string; file: string }[] = [];
  let rejected = 0;
  for (const folder of FOLDERS) {
    let entries;
    try {
      entries = await readdir(path.join(root, folder), {
        recursive: true,
        withFileTypes: true,
      });
    } catch (error) {
      if ((error as { code?: string }).code === "ENOENT") continue;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const file = path.join(entry.parentPath, entry.name);
      const key = path.relative(root, file).split(path.sep).join("/");
      if (key.endsWith(".tmp") || !isSafeStorageKey(key)) rejected += 1;
      else keys.push({ key, file });
    }
  }
  keys.sort((a, b) => a.key.localeCompare(b.key));
  return { keys, rejected };
}
