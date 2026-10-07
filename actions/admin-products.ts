"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN_PRODUCT_TYPE, isProductId, requireAdmin } from "@/lib/admin";
import type { ProductFieldErrors, ProductFormValues } from "@/lib/admin-product-rules";
import { parseProductForm } from "@/lib/admin-products";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { removeProductUploads } from "@/lib/product-files";

// Admin product mutations (feature 13). Every action checks the admin role
// first and scopes writes to digital products, so a service id or an unknown
// id is not_found. requireAdmin() and redirect() throw, so both stay outside
// the try blocks.

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

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

// The admin list and dashboard, plus every storefront page that can show a
// product: listings, detail pages, the home page, and the cart.
function revalidateProductPages() {
  revalidatePath("/admin", "layout");
  revalidatePath("/[lang]", "layout");
}

function formId(formData: FormData): string | null {
  const id = formData.get("id");
  return isProductId(id) ? id : null;
}

export async function createProduct(
  _previous: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  await requireAdmin();
  let id: string;
  try {
    const parsed = parseProductForm(formData);
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
        data: { ...parsed.data, type: ADMIN_PRODUCT_TYPE, status: "UNPUBLISHED" },
        select: { id: true },
      });
      id = created.id;
    } catch (error) {
      if (hasCode(error, "P2002")) return slugTaken(parsed.values);
      throw error;
    }
    revalidateProductPages();
  } catch (error) {
    console.error("createProduct failed", error);
    return { success: false, error: "unexpected" };
  }
  redirect(`/admin/products/${id}`);
}

export async function updateProduct(
  _previous: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  await requireAdmin();
  try {
    const id = formId(formData);
    if (!id) return { success: false, error: "not_found" };
    const parsed = parseProductForm(formData);
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
        where: { id, type: ADMIN_PRODUCT_TYPE },
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
    console.error("updateProduct failed", error);
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

export async function setProductStatus(
  _previous: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  await requireAdmin();
  try {
    const id = formId(formData);
    const status = formData.get("status");
    if (!id || (status !== "PUBLISHED" && status !== "UNPUBLISHED")) {
      return { success: false, error: "not_found" };
    }
    const where = { id, type: ADMIN_PRODUCT_TYPE };
    // One conditional write, so a product is never published without a file.
    const { count } = await db.product.updateMany({
      where: status === "PUBLISHED" ? { ...where, digitalFile: { not: null } } : where,
      data: { status },
    });
    if (count === 0) {
      const exists = await db.product.count({ where });
      return { success: false, error: exists > 0 ? "file_required" : "not_found" };
    }
    revalidateProductPages();
    return { success: true };
  } catch (error) {
    console.error("setProductStatus failed", error);
    return { success: false, error: "unexpected" };
  }
}

export async function deleteProduct(
  _previous: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  await requireAdmin();
  try {
    const id = formId(formData);
    if (!id) return { success: false, error: "not_found" };
    const orders = await db.orderItem.count({
      where: { productId: id, product: { type: ADMIN_PRODUCT_TYPE } },
    });
    if (orders > 0) return { success: false, error: "has_orders" };
    let count: number;
    try {
      ({ count } = await db.product.deleteMany({
        where: { id, type: ADMIN_PRODUCT_TYPE },
      }));
    } catch (error) {
      // An order placed after the check still blocks the delete (FK Restrict).
      if (hasCode(error, "P2003")) return { success: false, error: "has_orders" };
      throw error;
    }
    if (count === 0) return { success: false, error: "not_found" };
    try {
      await removeProductUploads(id);
    } catch (error) {
      console.error(`deleteProduct: files for product ${id} not removed`, error);
    }
    revalidateProductPages();
  } catch (error) {
    console.error("deleteProduct failed", error);
    return { success: false, error: "unexpected" };
  }
  redirect("/admin/products");
}
