"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isProductId, requireAdmin } from "@/lib/admin";
import type { ProductFieldErrors, ProductFormValues } from "@/lib/admin-product-rules";
import { parseProductForm } from "@/lib/admin-products";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import type { ProductType } from "@/lib/generated/prisma/enums";
import { removeProductUploads } from "@/lib/product-files";

// Admin product (feature 13) and service (feature 14) mutations. Each exported
// action binds its type on the server, so the form can never choose it. Every
// action checks the admin role first and scopes writes to its type, so the
// other type's id or an unknown id is not_found. requireAdmin() and redirect()
// throw, so both stay outside the try blocks.

export type ProductActionError =
  | "invalid_fields"
  | "file_required"
  | "has_orders"
  | "not_found"
  | "unexpected";

export type ProductActionResult =
  | { success: true }
  | {
      success: false;
      error: ProductActionError;
      fieldErrors?: ProductFieldErrors;
      values?: ProductFormValues;
    }
  | null;

const ADMIN_PATHS: Record<ProductType, string> = {
  DIGITAL_PRODUCT: "/admin/products",
  SERVICE: "/admin/services",
};

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

// The admin lists and dashboard, plus every storefront page that can show a
// product or service: listings, detail pages, the home page, and the cart.
function revalidateProductPages() {
  revalidatePath("/admin", "layout");
  revalidatePath("/[lang]", "layout");
}

function formId(formData: FormData): string | null {
  const id = formData.get("id");
  return isProductId(id) ? id : null;
}

async function create(
  type: ProductType,
  formData: FormData,
): Promise<ProductActionResult> {
  await requireAdmin();
  let id: string;
  try {
    const parsed = parseProductForm(formData, type);
    if (!parsed.ok) {
      return {
        success: false,
        error: "invalid_fields",
        fieldErrors: parsed.fieldErrors,
        values: parsed.values,
      };
    }
    try {
      const created = await db.product.create({
        data: { ...parsed.data, type, status: "UNPUBLISHED" },
        select: { id: true },
      });
      id = created.id;
    } catch (error) {
      if (hasCode(error, "P2002")) return slugTaken(parsed.values);
      throw error;
    }
    revalidateProductPages();
  } catch (error) {
    console.error(`create ${type} failed`, error);
    return { success: false, error: "unexpected" };
  }
  redirect(`${ADMIN_PATHS[type]}/${id}`);
}

async function update(
  type: ProductType,
  formData: FormData,
): Promise<ProductActionResult> {
  await requireAdmin();
  try {
    const id = formId(formData);
    if (!id) return { success: false, error: "not_found" };
    const parsed = parseProductForm(formData, type);
    if (!parsed.ok) {
      return {
        success: false,
        error: "invalid_fields",
        fieldErrors: parsed.fieldErrors,
        values: parsed.values,
      };
    }
    let count: number;
    try {
      // Status and the file are never set from this form.
      ({ count } = await db.product.updateMany({
        where: { id, type },
        data: parsed.data,
      }));
    } catch (error) {
      if (hasCode(error, "P2002")) return slugTaken(parsed.values);
      throw error;
    }
    if (count === 0) return { success: false, error: "not_found" };
    revalidateProductPages();
    return { success: true };
  } catch (error) {
    console.error(`update ${type} failed`, error);
    return { success: false, error: "unexpected" };
  }
}

// The unique index also catches two saves racing for the same slug.
function slugTaken(values: ProductFormValues): ProductActionResult {
  return {
    success: false,
    error: "invalid_fields",
    fieldErrors: { slug: "slug_taken" },
    values,
  };
}

async function setStatus(
  type: ProductType,
  formData: FormData,
): Promise<ProductActionResult> {
  await requireAdmin();
  try {
    const id = formId(formData);
    const status = formData.get("status");
    if (!id || (status !== "PUBLISHED" && status !== "UNPUBLISHED")) {
      return { success: false, error: "not_found" };
    }
    const where = { id, type };
    // One conditional write, so a digital product is never published without a
    // file. Services have nothing to deliver, so they need no condition.
    const needsFile = type === "DIGITAL_PRODUCT" && status === "PUBLISHED";
    const { count } = await db.product.updateMany({
      where: needsFile ? { ...where, digitalFile: { not: null } } : where,
      data: { status },
    });
    if (count === 0) {
      const exists = needsFile ? await db.product.count({ where }) : 0;
      return { success: false, error: exists > 0 ? "file_required" : "not_found" };
    }
    revalidateProductPages();
    return { success: true };
  } catch (error) {
    console.error(`setStatus ${type} failed`, error);
    return { success: false, error: "unexpected" };
  }
}

async function remove(
  type: ProductType,
  formData: FormData,
): Promise<ProductActionResult> {
  await requireAdmin();
  try {
    const id = formId(formData);
    if (!id) return { success: false, error: "not_found" };
    const orders = await db.orderItem.count({
      where: { productId: id, product: { type } },
    });
    if (orders > 0) return { success: false, error: "has_orders" };
    let count: number;
    try {
      ({ count } = await db.product.deleteMany({ where: { id, type } }));
    } catch (error) {
      // An order placed after the check still blocks the delete (FK Restrict).
      if (hasCode(error, "P2003")) return { success: false, error: "has_orders" };
      throw error;
    }
    if (count === 0) return { success: false, error: "not_found" };
    // Only digital products have uploads.
    if (type === "DIGITAL_PRODUCT") {
      try {
        await removeProductUploads(id);
      } catch (error) {
        console.error(`deleteProduct: files for product ${id} not removed`, error);
      }
    }
    revalidateProductPages();
  } catch (error) {
    console.error(`delete ${type} failed`, error);
    return { success: false, error: "unexpected" };
  }
  redirect(ADMIN_PATHS[type]);
}

export async function createProduct(
  _previous: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  return create("DIGITAL_PRODUCT", formData);
}

export async function updateProduct(
  _previous: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  return update("DIGITAL_PRODUCT", formData);
}

export async function setProductStatus(
  _previous: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  return setStatus("DIGITAL_PRODUCT", formData);
}

export async function deleteProduct(
  _previous: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  return remove("DIGITAL_PRODUCT", formData);
}

export async function createService(
  _previous: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  return create("SERVICE", formData);
}

export async function updateService(
  _previous: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  return update("SERVICE", formData);
}

export async function setServiceStatus(
  _previous: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  return setStatus("SERVICE", formData);
}

export async function deleteService(
  _previous: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  return remove("SERVICE", formData);
}
