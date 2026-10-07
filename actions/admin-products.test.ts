import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, requireAdmin, revalidatePath, redirect, removeProductUploads } =
  vi.hoisted(() => ({
    db: {
      product: {
        create: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
        count: vi.fn(),
      },
      orderItem: { count: vi.fn() },
    },
    // Both throw in Next.js, ending the action.
    requireAdmin: vi.fn(),
    redirect: vi.fn((url: string) => {
      throw new Error(`redirect:${url}`);
    }),
    revalidatePath: vi.fn(),
    removeProductUploads: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin")>()),
  requireAdmin,
}));
vi.mock("@/lib/product-files", () => ({ removeProductUploads }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect, notFound: vi.fn() }));

import { Prisma } from "@/lib/generated/prisma/client";
import {
  createProduct,
  createService,
  deleteProduct,
  deleteService,
  setProductStatus,
  setServiceStatus,
  updateProduct,
  updateService,
} from "./admin-products";

const valid = {
  name: "Facebook Ads Guide",
  slug: "facebook-ads-guide",
  shortDescription: "A short guide.",
  description: "The full description.",
  price: "49.50",
  category: "Guides",
  image: "",
  included: "PDF guide",
  nameAr: "",
  categoryAr: "",
  shortDescriptionAr: "",
  descriptionAr: "",
  includedAr: "",
};

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("db error", {
    code,
    clientVersion: "test",
  });
}

const DIGITAL = { id: "p1", type: "DIGITAL_PRODUCT" };

beforeEach(() => {
  requireAdmin.mockReset().mockResolvedValue({ id: "admin", role: "ADMIN" });
  db.product.create.mockReset().mockResolvedValue({ id: "p1" });
  db.product.updateMany.mockReset().mockResolvedValue({ count: 1 });
  db.product.deleteMany.mockReset().mockResolvedValue({ count: 1 });
  db.product.count.mockReset().mockResolvedValue(1);
  db.orderItem.count.mockReset().mockResolvedValue(0);
  revalidatePath.mockClear();
  redirect.mockClear();
  removeProductUploads.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("admin role", () => {
  it.each([
    ["createProduct", () => createProduct(null, form(valid))],
    ["updateProduct", () => updateProduct(null, form({ ...valid, id: "p1" }))],
    ["setProductStatus", () => setProductStatus(null, form({ id: "p1", status: "PUBLISHED" }))],
    ["deleteProduct", () => deleteProduct(null, form({ id: "p1" }))],
  ])("%s never reaches the database for a non-admin", async (_name, run) => {
    requireAdmin.mockRejectedValue(new Error("notFound"));
    await expect(run()).rejects.toThrow("notFound");
    expect(db.product.create).not.toHaveBeenCalled();
    expect(db.product.updateMany).not.toHaveBeenCalled();
    expect(db.product.deleteMany).not.toHaveBeenCalled();
    expect(db.orderItem.count).not.toHaveBeenCalled();
  });
});

describe("createProduct", () => {
  it("creates an unpublished digital product and opens it", async () => {
    await expect(createProduct(null, form(valid))).rejects.toThrow(
      "redirect:/admin/products/p1",
    );
    const { data } = db.product.create.mock.calls[0][0];
    expect(data).toMatchObject({
      name: "Facebook Ads Guide",
      priceCents: 4950,
      included: ["PDF guide"],
      type: "DIGITAL_PRODUCT",
      status: "UNPUBLISHED",
    });
    expect(data).not.toHaveProperty("digitalFile");
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("ignores status, type, and file fields from the form", async () => {
    await expect(
      createProduct(
        null,
        form({ ...valid, status: "PUBLISHED", type: "SERVICE", digitalFile: "x.pdf" }),
      ),
    ).rejects.toThrow("redirect:");
    expect(db.product.create.mock.calls[0][0].data).toMatchObject({
      type: "DIGITAL_PRODUCT",
      status: "UNPUBLISHED",
    });
    expect(db.product.create.mock.calls[0][0].data).not.toHaveProperty("digitalFile");
  });

  it("returns field errors with the typed values", async () => {
    const result = await createProduct(null, form({ ...valid, price: "abc" }));
    expect(result).toMatchObject({
      success: false,
      error: "invalid_fields",
      fieldErrors: { price: "invalid_price" },
      values: { price: "abc", name: "Facebook Ads Guide" },
    });
    expect(db.product.create).not.toHaveBeenCalled();
  });

  it("reports a taken slug on the slug field", async () => {
    db.product.create.mockRejectedValue(prismaError("P2002"));
    expect(await createProduct(null, form(valid))).toMatchObject({
      success: false,
      error: "invalid_fields",
      fieldErrors: { slug: "slug_taken" },
      values: { slug: "facebook-ads-guide" },
    });
  });

  it("hides unexpected errors", async () => {
    db.product.create.mockRejectedValue(new Error("down"));
    expect(await createProduct(null, form(valid))).toEqual({
      success: false,
      error: "unexpected",
    });
  });
});

describe("updateProduct", () => {
  it("updates only a digital product, never status or file", async () => {
    expect(await updateProduct(null, form({ ...valid, id: "p1" }))).toEqual({
      success: true,
    });
    const { where, data } = db.product.updateMany.mock.calls[0][0];
    expect(where).toEqual(DIGITAL);
    expect(data).not.toHaveProperty("status");
    expect(data).not.toHaveProperty("digitalFile");
  });

  it("returns not_found for a service or unknown id", async () => {
    db.product.updateMany.mockResolvedValue({ count: 0 });
    expect(await updateProduct(null, form({ ...valid, id: "s1" }))).toEqual({
      success: false,
      error: "not_found",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a missing or oversized id", async () => {
    expect(await updateProduct(null, form(valid))).toMatchObject({ error: "not_found" });
    expect(
      await updateProduct(null, form({ ...valid, id: "x".repeat(65) })),
    ).toMatchObject({ error: "not_found" });
    expect(db.product.updateMany).not.toHaveBeenCalled();
  });

  it("reports a taken slug", async () => {
    db.product.updateMany.mockRejectedValue(prismaError("P2002"));
    expect(await updateProduct(null, form({ ...valid, id: "p1" }))).toMatchObject({
      fieldErrors: { slug: "slug_taken" },
    });
  });
});

describe("setProductStatus", () => {
  it("publishes only when a file is attached", async () => {
    expect(
      await setProductStatus(null, form({ id: "p1", status: "PUBLISHED" })),
    ).toEqual({ success: true });
    expect(db.product.updateMany).toHaveBeenCalledWith({
      where: { ...DIGITAL, digitalFile: { not: null } },
      data: { status: "PUBLISHED" },
    });
  });

  it("refuses to publish without a file", async () => {
    db.product.updateMany.mockResolvedValue({ count: 0 });
    expect(
      await setProductStatus(null, form({ id: "p1", status: "PUBLISHED" })),
    ).toEqual({ success: false, error: "file_required" });
  });

  it("returns not_found when the product does not exist", async () => {
    db.product.updateMany.mockResolvedValue({ count: 0 });
    db.product.count.mockResolvedValue(0);
    expect(
      await setProductStatus(null, form({ id: "s1", status: "PUBLISHED" })),
    ).toEqual({ success: false, error: "not_found" });
  });

  it("unpublishes without a file check", async () => {
    await setProductStatus(null, form({ id: "p1", status: "UNPUBLISHED" }));
    expect(db.product.updateMany).toHaveBeenCalledWith({
      where: DIGITAL,
      data: { status: "UNPUBLISHED" },
    });
  });

  it("rejects any other status", async () => {
    expect(
      await setProductStatus(null, form({ id: "p1", status: "ARCHIVED" })),
    ).toMatchObject({ error: "not_found" });
    expect(db.product.updateMany).not.toHaveBeenCalled();
  });
});

describe("deleteProduct", () => {
  it("deletes an unordered product and its uploads", async () => {
    await expect(deleteProduct(null, form({ id: "p1" }))).rejects.toThrow(
      "redirect:/admin/products",
    );
    expect(db.product.deleteMany).toHaveBeenCalledWith({ where: DIGITAL });
    expect(removeProductUploads).toHaveBeenCalledWith("p1");
  });

  it("refuses a product with orders", async () => {
    db.orderItem.count.mockResolvedValue(2);
    expect(await deleteProduct(null, form({ id: "p1" }))).toEqual({
      success: false,
      error: "has_orders",
    });
    expect(db.product.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses when an order lands after the check", async () => {
    db.product.deleteMany.mockRejectedValue(prismaError("P2003"));
    expect(await deleteProduct(null, form({ id: "p1" }))).toEqual({
      success: false,
      error: "has_orders",
    });
    expect(removeProductUploads).not.toHaveBeenCalled();
  });

  it("returns not_found for a service or unknown id", async () => {
    db.product.deleteMany.mockResolvedValue({ count: 0 });
    expect(await deleteProduct(null, form({ id: "s1" }))).toEqual({
      success: false,
      error: "not_found",
    });
    expect(removeProductUploads).not.toHaveBeenCalled();
  });

  it("still deletes when file cleanup fails", async () => {
    removeProductUploads.mockRejectedValue(new Error("EPERM"));
    await expect(deleteProduct(null, form({ id: "p1" }))).rejects.toThrow(
      "redirect:/admin/products",
    );
  });
});

describe("service actions", () => {
  const service = {
    ...valid,
    name: "Facebook Ads Management",
    slug: "facebook-ads-management",
    price: "299",
    category: "Ads",
    durationDays: "30",
    requirements: "Business name\nAd account access",
    requirementsAr: "",
  };
  const SERVICE = { id: "s1", type: "SERVICE" };

  it.each([
    ["createService", () => createService(null, form(service))],
    ["updateService", () => updateService(null, form({ ...service, id: "s1" }))],
    ["setServiceStatus", () => setServiceStatus(null, form({ id: "s1", status: "PUBLISHED" }))],
    ["deleteService", () => deleteService(null, form({ id: "s1" }))],
  ])("%s never reaches the database for a non-admin", async (_name, run) => {
    requireAdmin.mockRejectedValue(new Error("notFound"));
    await expect(run()).rejects.toThrow("notFound");
    expect(db.product.create).not.toHaveBeenCalled();
    expect(db.product.updateMany).not.toHaveBeenCalled();
    expect(db.product.deleteMany).not.toHaveBeenCalled();
    expect(db.orderItem.count).not.toHaveBeenCalled();
  });

  it("creates an unpublished service with its duration and requirements", async () => {
    db.product.create.mockResolvedValue({ id: "s1" });
    await expect(
      createService(null, form({ ...service, type: "DIGITAL_PRODUCT", status: "PUBLISHED" })),
    ).rejects.toThrow("redirect:/admin/services/s1");
    const { data } = db.product.create.mock.calls[0][0];
    expect(data).toMatchObject({
      type: "SERVICE",
      status: "UNPUBLISHED",
      priceCents: 29_900,
      durationDays: 30,
      requirements: "Business name\nAd account access",
      requirementsAr: null,
    });
    expect(data).not.toHaveProperty("digitalFile");
  });

  it("returns field errors with the typed values", async () => {
    expect(await createService(null, form({ ...service, durationDays: "0" }))).toMatchObject({
      success: false,
      error: "invalid_fields",
      fieldErrors: { durationDays: "invalid_duration" },
      values: { durationDays: "0", name: "Facebook Ads Management" },
    });
    expect(db.product.create).not.toHaveBeenCalled();
  });

  it("reports a taken slug", async () => {
    db.product.create.mockRejectedValue(prismaError("P2002"));
    expect(await createService(null, form(service))).toMatchObject({
      fieldErrors: { slug: "slug_taken" },
      values: { slug: "facebook-ads-management" },
    });
    db.product.updateMany.mockRejectedValue(prismaError("P2002"));
    expect(await updateService(null, form({ ...service, id: "s1" }))).toMatchObject({
      fieldErrors: { slug: "slug_taken" },
    });
  });

  it("updates only a service, never status or file", async () => {
    expect(await updateService(null, form({ ...service, id: "s1" }))).toEqual({
      success: true,
    });
    const { where, data } = db.product.updateMany.mock.calls[0][0];
    expect(where).toEqual(SERVICE);
    expect(data).toMatchObject({ durationDays: 30 });
    expect(data).not.toHaveProperty("status");
    expect(data).not.toHaveProperty("digitalFile");
  });

  it("publishes without a file condition", async () => {
    expect(
      await setServiceStatus(null, form({ id: "s1", status: "PUBLISHED" })),
    ).toEqual({ success: true });
    expect(db.product.updateMany).toHaveBeenCalledWith({
      where: SERVICE,
      data: { status: "PUBLISHED" },
    });
  });

  it("returns not_found for a digital product id on every service action", async () => {
    db.product.updateMany.mockResolvedValue({ count: 0 });
    db.product.deleteMany.mockResolvedValue({ count: 0 });
    expect(await updateService(null, form({ ...service, id: "p1" }))).toEqual({
      success: false,
      error: "not_found",
    });
    expect(
      await setServiceStatus(null, form({ id: "p1", status: "PUBLISHED" })),
    ).toEqual({ success: false, error: "not_found" });
    expect(await deleteService(null, form({ id: "p1" }))).toEqual({
      success: false,
      error: "not_found",
    });
    expect(db.product.updateMany.mock.calls[0][0].where).toEqual({ id: "p1", type: "SERVICE" });
    expect(db.product.deleteMany).toHaveBeenCalledWith({ where: { id: "p1", type: "SERVICE" } });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("deletes an unordered service without touching files", async () => {
    await expect(deleteService(null, form({ id: "s1" }))).rejects.toThrow(
      "redirect:/admin/services",
    );
    expect(db.orderItem.count).toHaveBeenCalledWith({
      where: { productId: "s1", product: { type: "SERVICE" } },
    });
    expect(db.product.deleteMany).toHaveBeenCalledWith({ where: SERVICE });
    expect(removeProductUploads).not.toHaveBeenCalled();
  });

  it("refuses a service with orders, including the race", async () => {
    db.orderItem.count.mockResolvedValue(1);
    expect(await deleteService(null, form({ id: "s1" }))).toEqual({
      success: false,
      error: "has_orders",
    });
    db.orderItem.count.mockResolvedValue(0);
    db.product.deleteMany.mockRejectedValue(prismaError("P2003"));
    expect(await deleteService(null, form({ id: "s1" }))).toEqual({
      success: false,
      error: "has_orders",
    });
  });
});
