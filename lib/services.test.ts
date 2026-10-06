import { beforeEach, describe, expect, it, vi } from "vitest";

const { orderItem, service } = vi.hoisted(() => ({
  orderItem: { findFirst: vi.fn(), findMany: vi.fn() },
  service: { create: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: { orderItem, service } }));

import { Prisma } from "@/lib/generated/prisma/client";
import {
  findOnboardingItem,
  listOrderServices,
  saveOnboarding,
} from "@/lib/services";

const PAID = { in: ["PAID", "PROCESSING", "COMPLETED"] };
const SESSION = "cs_test_abc123";
const answers = {
  businessName: "Layla Cafe",
  website: null,
  adAccount: null,
  campaignGoals: null,
  budget: null,
  notes: null,
};

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

beforeEach(() => {
  orderItem.findFirst.mockReset();
  orderItem.findMany.mockReset();
  service.create.mockReset();
  service.updateMany.mockReset();
});

describe("findOnboardingItem", () => {
  const row = {
    id: "i1",
    product: { name: "Ads Management", nameAr: "إدارة الإعلانات" },
    order: { number: 1004 },
    service: null,
  };

  it("matches a paid service item owned by the signed-in user", async () => {
    orderItem.findFirst.mockResolvedValue(row);
    await expect(
      findOnboardingItem("i1", { userId: "u1", sessionId: null }),
    ).resolves.toEqual({
      itemId: "i1",
      name: "Ads Management",
      nameAr: "إدارة الإعلانات",
      orderNumber: 1004,
      service: null,
    });
    expect(orderItem.findFirst.mock.calls[0][0].where).toEqual({
      id: "i1",
      product: { type: "SERVICE" },
      order: { status: PAID, OR: [{ userId: "u1" }] },
    });
  });

  it("matches by checkout session id for a guest", async () => {
    orderItem.findFirst.mockResolvedValue(row);
    await findOnboardingItem("i1", { userId: null, sessionId: SESSION });
    expect(orderItem.findFirst.mock.calls[0][0].where.order).toEqual({
      status: PAID,
      OR: [{ stripeCheckoutSessionId: SESSION }],
    });
  });

  it("accepts either owner rule when both are present", async () => {
    orderItem.findFirst.mockResolvedValue(row);
    await findOnboardingItem("i1", { userId: "u1", sessionId: SESSION });
    expect(orderItem.findFirst.mock.calls[0][0].where.order.OR).toEqual([
      { userId: "u1" },
      { stripeCheckoutSessionId: SESSION },
    ]);
  });

  it("ignores a malformed session id", async () => {
    await expect(
      findOnboardingItem("i1", { userId: null, sessionId: "cs_test_<x>" }),
    ).resolves.toBeNull();
    expect(orderItem.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ["a missing id", null],
    ["an empty id", ""],
    ["an over-long id", "a".repeat(65)],
  ])("returns null for %s without a query", async (_label, itemId) => {
    await expect(
      findOnboardingItem(itemId, { userId: "u1", sessionId: null }),
    ).resolves.toBeNull();
    expect(orderItem.findFirst).not.toHaveBeenCalled();
  });

  it("returns null when no item matches", async () => {
    orderItem.findFirst.mockResolvedValue(null);
    await expect(
      findOnboardingItem("i1", { userId: "u2", sessionId: null }),
    ).resolves.toBeNull();
  });
});

describe("saveOnboarding", () => {
  it("creates a NEW record on the first save", async () => {
    service.create.mockResolvedValue({});
    await expect(saveOnboarding("i1", answers)).resolves.toBe("saved");
    expect(service.create).toHaveBeenCalledWith({
      data: { orderItemId: "i1", status: "NEW", requirements: answers },
    });
    expect(service.updateMany).not.toHaveBeenCalled();
  });

  it("updates an existing record only while it is editable", async () => {
    service.create.mockRejectedValue(uniqueViolation());
    service.updateMany.mockResolvedValue({ count: 1 });
    await expect(saveOnboarding("i1", answers)).resolves.toBe("saved");
    expect(service.updateMany).toHaveBeenCalledWith({
      where: {
        orderItemId: "i1",
        status: { in: ["NEW", "WAITING_FOR_INFORMATION"] },
      },
      data: { requirements: answers },
    });
  });

  it("reports a locked record without changing it", async () => {
    service.create.mockRejectedValue(uniqueViolation());
    service.updateMany.mockResolvedValue({ count: 0 });
    await expect(saveOnboarding("i1", answers)).resolves.toBe("locked");
  });

  it("rethrows any other database error", async () => {
    service.create.mockRejectedValue(new Error("connection lost"));
    await expect(saveOnboarding("i1", answers)).rejects.toThrow("connection lost");
    expect(service.updateMany).not.toHaveBeenCalled();
  });
});

describe("listOrderServices", () => {
  it("lists the service items of the paid order with their status", async () => {
    orderItem.findMany.mockResolvedValue([
      { id: "i1", product: { name: "Ads Management", nameAr: null }, service: null },
      {
        id: "i2",
        product: { name: "Account Management", nameAr: null },
        service: { status: "NEW" },
      },
    ]);
    await expect(listOrderServices(SESSION)).resolves.toEqual([
      { itemId: "i1", name: "Ads Management", nameAr: null, status: null },
      { itemId: "i2", name: "Account Management", nameAr: null, status: "NEW" },
    ]);
    const args = orderItem.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      product: { type: "SERVICE" },
      order: { stripeCheckoutSessionId: SESSION, status: PAID },
    });
    expect(JSON.stringify(args.select)).not.toContain("digitalFile");
  });
});
