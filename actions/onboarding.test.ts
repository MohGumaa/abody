import { beforeEach, describe, expect, it, vi } from "vitest";

const { orderItem, service, getCurrentUser, revalidatePath } = vi.hoisted(() => ({
  orderItem: { findFirst: vi.fn() },
  service: { create: vi.fn(), updateMany: vi.fn() },
  getCurrentUser: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { orderItem, service } }));
vi.mock("@/lib/session", () => ({ getCurrentUser }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { Prisma } from "@/lib/generated/prisma/client";
import { submitOnboarding } from "./onboarding";

const SESSION = "cs_test_abc123";
const me = { id: "u1", name: "Layla", email: "layla@example.com", role: "CUSTOMER" };
const answers = {
  businessName: "Layla Cafe",
  website: "https://layla.example",
  adAccount: "act_123",
  campaignGoals: "",
  budget: "$500",
  notes: "",
};
const item = {
  id: "i1",
  product: { name: "Ads Management", nameAr: null },
  order: { number: 1004 },
  service: null,
};

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  orderItem.findFirst.mockReset().mockResolvedValue(item);
  service.create.mockReset().mockResolvedValue({});
  service.updateMany.mockReset().mockResolvedValue({ count: 1 });
  getCurrentUser.mockReset().mockResolvedValue(me);
  revalidatePath.mockClear();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

function ownerFilter() {
  return orderItem.findFirst.mock.calls[0][0].where.order.OR;
}

describe("submitOnboarding", () => {
  it("saves the signed-in owner's answers", async () => {
    const result = await submitOnboarding(null, form({ itemId: "i1", ...answers }));
    expect(result).toEqual({ success: true });
    expect(ownerFilter()).toEqual([{ userId: "u1" }]);
    expect(service.create).toHaveBeenCalledWith({
      data: {
        orderItemId: "i1",
        status: "NEW",
        requirements: {
          businessName: "Layla Cafe",
          website: "https://layla.example",
          adAccount: "act_123",
          campaignGoals: null,
          budget: "$500",
          notes: null,
        },
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/[lang]/onboarding/[itemId]", "page");
    expect(revalidatePath).toHaveBeenCalledWith("/[lang]/account", "layout");
  });

  it("saves for a guest holding the checkout session id", async () => {
    getCurrentUser.mockResolvedValue(null);
    const result = await submitOnboarding(
      null,
      form({ itemId: "i1", sessionId: SESSION, ...answers }),
    );
    expect(result).toEqual({ success: true });
    expect(ownerFilter()).toEqual([{ stripeCheckoutSessionId: SESSION }]);
  });

  it("asks a visitor with neither a session nor a session id to sign in", async () => {
    getCurrentUser.mockResolvedValue(null);
    const result = await submitOnboarding(null, form({ itemId: "i1", ...answers }));
    expect(result).toEqual({ success: false, error: "signed_out" });
    expect(orderItem.findFirst).not.toHaveBeenCalled();
  });

  // The query scopes by owner, paid status, and product type; a row outside
  // that scope comes back as null.
  it.each([
    ["another user's item", { itemId: "i9" }, me],
    ["a wrong session id", { itemId: "i1", sessionId: "cs_test_other" }, null],
    ["an unpaid or refunded order", { itemId: "i1" }, me],
    ["a digital product item", { itemId: "i2" }, me],
  ])("returns not_found for %s", async (_label, fields, user) => {
    getCurrentUser.mockResolvedValue(user);
    orderItem.findFirst.mockResolvedValue(null);
    const result = await submitOnboarding(null, form({ ...fields, ...answers }));
    expect(result).toEqual({ success: false, error: "not_found" });
    expect(service.create).not.toHaveBeenCalled();
  });

  it("checks paid status and product type in the query", async () => {
    await submitOnboarding(null, form({ itemId: "i1", ...answers }));
    const { where } = orderItem.findFirst.mock.calls[0][0];
    expect(where.product).toEqual({ type: "SERVICE" });
    expect(where.order.status).toEqual({ in: ["PAID", "PROCESSING", "COMPLETED"] });
  });

  it("returns not_found for a malformed session id from a guest", async () => {
    getCurrentUser.mockResolvedValue(null);
    const result = await submitOnboarding(
      null,
      form({ itemId: "i1", sessionId: "not-a-session", ...answers }),
    );
    expect(result).toEqual({ success: false, error: "not_found" });
    expect(orderItem.findFirst).not.toHaveBeenCalled();
  });

  it("refuses a record the team has started", async () => {
    orderItem.findFirst.mockResolvedValue({
      ...item,
      service: { status: "IN_PROGRESS", requirements: {} },
    });
    const result = await submitOnboarding(null, form({ itemId: "i1", ...answers }));
    expect(result).toEqual({ success: false, error: "locked" });
    expect(service.create).not.toHaveBeenCalled();
  });

  it("falls back to the guarded update when the record already exists", async () => {
    orderItem.findFirst.mockResolvedValue({
      ...item,
      service: { status: "NEW", requirements: {} },
    });
    service.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    const result = await submitOnboarding(null, form({ itemId: "i1", ...answers }));
    expect(result).toEqual({ success: true });
    expect(service.updateMany).toHaveBeenCalledTimes(1);
  });

  it("reports locked when the status changed during the save", async () => {
    service.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    service.updateMany.mockResolvedValue({ count: 0 });
    const result = await submitOnboarding(null, form({ itemId: "i1", ...answers }));
    expect(result).toEqual({ success: false, error: "locked" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns field errors with the typed values", async () => {
    const result = await submitOnboarding(
      null,
      form({ itemId: "i1", ...answers, businessName: " ", budget: "x".repeat(101) }),
    );
    expect(result).toEqual({
      success: false,
      error: "invalid_fields",
      fieldErrors: { businessName: "business_name_required", budget: "too_long" },
      values: { ...answers, businessName: "", budget: "x".repeat(101) },
    });
    expect(service.create).not.toHaveBeenCalled();
  });

  it("returns invalid_input when a field is missing", async () => {
    const missing = form({ itemId: "i1", ...answers });
    missing.delete("notes");
    const result = await submitOnboarding(null, missing);
    expect(result).toEqual({ success: false, error: "invalid_input" });
  });

  it("returns unexpected on a database error without logging the answers", async () => {
    service.create.mockRejectedValue(
      new Error(`Invalid invocation: requirements ${answers.adAccount}`),
    );
    const result = await submitOnboarding(null, form({ itemId: "i1", ...answers }));
    expect(result).toEqual({ success: false, error: "unexpected" });
    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).not.toContain("act_123");
    expect(logged).not.toContain("Layla Cafe");
  });
});
