import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { order, orderItem, stat } = vi.hoisted(() => ({
  order: { findUnique: vi.fn() },
  orderItem: { findFirst: vi.fn() },
  stat: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { order, orderItem } }));

// Real fs, except stat can be made to fail in one test.
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs/promises")>()),
  stat,
}));

import {
  findDownload,
  listOrderDownloads,
  openStoredFile,
  STORAGE_ROOT,
} from "@/lib/downloads";

// Every key named in a select tree, at any depth.
function selectedKeys(select: Record<string, unknown>): string[] {
  return Object.entries(select).flatMap(([key, value]) => {
    if (value && typeof value === "object" && "select" in value) {
      return [key, ...selectedKeys(value.select as Record<string, unknown>)];
    }
    return [key];
  });
}

beforeEach(() => {
  order.findUnique.mockReset();
  orderItem.findFirst.mockReset();
});

describe("findDownload", () => {
  it("scopes the lookup by item, checkout session, and digital product", async () => {
    orderItem.findFirst.mockResolvedValue(null);

    await findDownload("cs_test_1", "item_1");

    expect(orderItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "item_1",
          order: { stripeCheckoutSessionId: "cs_test_1" },
          product: { type: "DIGITAL_PRODUCT", digitalFile: { not: null } },
        },
      }),
    );
  });

  it("returns the storage key for a paid order", async () => {
    orderItem.findFirst.mockResolvedValue({
      order: { status: "PAID" },
      product: { digitalFile: "seed/a.pdf" },
    });

    expect(await findDownload("cs_test_1", "item_1")).toBe("seed/a.pdf");
  });

  it.each(["PENDING", "CANCELLED", "REFUNDED"])(
    "returns null for a %s order",
    async (status) => {
      orderItem.findFirst.mockResolvedValue({
        order: { status },
        product: { digitalFile: "seed/a.pdf" },
      });

      expect(await findDownload("cs_test_1", "item_1")).toBeNull();
    },
  );

  it("returns null when nothing matches", async () => {
    orderItem.findFirst.mockResolvedValue(null);

    expect(await findDownload("cs_test_1", "item_1")).toBeNull();
  });
});

describe("listOrderDownloads", () => {
  const items = [
    { id: "item_1", product: { name: "Guide", nameAr: "دليل" } },
    { id: "item_2", product: { name: "Template", nameAr: null } },
  ];

  it("returns null when the session has no order", async () => {
    order.findUnique.mockResolvedValue(null);

    expect(await listOrderDownloads("cs_test_1")).toBeNull();
  });

  it("lists the digital items of a paid order", async () => {
    order.findUnique.mockResolvedValue({ number: 1001, status: "PAID", items });

    expect(await listOrderDownloads("cs_test_1")).toEqual({
      number: 1001,
      downloads: [
        { itemId: "item_1", name: "Guide", nameAr: "دليل" },
        { itemId: "item_2", name: "Template", nameAr: null },
      ],
    });
  });

  it("lists nothing for an order that is no longer paid", async () => {
    order.findUnique.mockResolvedValue({
      number: 1001,
      status: "CANCELLED",
      items,
    });

    expect(await listOrderDownloads("cs_test_1")).toEqual({
      number: 1001,
      downloads: [],
    });
  });

  it("filters to digital products and never selects digitalFile", async () => {
    order.findUnique.mockResolvedValue(null);

    await listOrderDownloads("cs_test_1");

    const query = order.findUnique.mock.calls[0][0];
    expect(query.where).toEqual({ stripeCheckoutSessionId: "cs_test_1" });
    expect(query.select.items.where).toEqual({
      product: { type: "DIGITAL_PRODUCT", digitalFile: { not: null } },
    });
    expect(selectedKeys(query.select)).not.toContain("digitalFile");
  });
});

describe("openStoredFile", () => {
  beforeEach(async () => {
    const real =
      await vi.importActual<typeof import("node:fs/promises")>(
        "node:fs/promises",
      );
    stat.mockReset();
    stat.mockImplementation(real.stat);
  });

  it("streams a stored file with its exact size", async () => {
    const key = "seed/facebook-ads-guide.pdf";
    const expected = await readFile(path.join(STORAGE_ROOT, key));

    const file = await openStoredFile(key);

    expect(file).not.toBeNull();
    expect(file!.size).toBe(expected.length);
    const bytes = Buffer.from(await new Response(file!.stream).arrayBuffer());
    expect(bytes.equals(expected)).toBe(true);
  });

  it.each([
    ["a missing file", "seed/missing.pdf"],
    ["a path through a file", "seed/facebook-ads-guide.pdf/extra"],
    ["a directory", "seed"],
  ])("returns null for %s", async (_label, key) => {
    expect(await openStoredFile(key)).toBeNull();
  });

  it.each(["../package.json", "/etc/passwd"])(
    "returns null for the unsafe key %s without touching the disk",
    async (key) => {
      expect(await openStoredFile(key)).toBeNull();
      expect(stat).not.toHaveBeenCalled();
    },
  );

  it("passes on any other file system error", async () => {
    const denied = Object.assign(new Error("permission denied"), {
      code: "EACCES",
    });
    stat.mockRejectedValue(denied);

    await expect(openStoredFile("seed/facebook-ads-guide.pdf")).rejects.toBe(
      denied,
    );
  });
});
