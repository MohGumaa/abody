import { beforeEach, describe, expect, it, vi } from "vitest";

const { order, orderItem } = vi.hoisted(() => ({
  order: { findUnique: vi.fn() },
  orderItem: { findFirst: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: { order, orderItem } }));

import { findDownload, listOrderDownloads } from "@/lib/downloads";

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
