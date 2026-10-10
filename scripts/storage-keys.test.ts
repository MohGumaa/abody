import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { localStorageKeys } from "./storage-keys";

let root: string;

function write(relative: string) {
  const file = path.join(root, ...relative.split("/"));
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, "x");
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "abody-keys-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("localStorageKeys", () => {
  it("collects seed and product files as forward-slash keys", async () => {
    write("seed/guide.pdf");
    write("products/p1/abc123/kit.zip");

    const { keys, rejected } = await localStorageKeys(root);

    expect(keys.map((entry) => entry.key)).toEqual([
      "products/p1/abc123/kit.zip",
      "seed/guide.pdf",
    ]);
    expect(keys[1].file).toBe(path.join(root, "seed", "guide.pdf"));
    expect(rejected).toBe(0);
  });

  it("rejects unfinished uploads and unsafe names", async () => {
    write("products/p1/upload-abc.tmp");
    write("seed/a b.pdf");
    write("seed/.hidden");
    write("seed/ok.pdf");

    const { keys, rejected } = await localStorageKeys(root);

    expect(keys.map((entry) => entry.key)).toEqual(["seed/ok.pdf"]);
    expect(rejected).toBe(3);
  });

  it("ignores other folders and a missing storage root", async () => {
    write("other/notes.pdf");
    expect((await localStorageKeys(root)).keys).toEqual([]);
    expect(await localStorageKeys(path.join(root, "missing"))).toEqual({
      keys: [],
      rejected: 0,
    });
  });
});
