"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  deleteProduct,
  setProductStatus,
  type ProductActionResult,
} from "@/actions/admin-products";
import type { ProductStatus } from "@/lib/generated/prisma/enums";

const PRIMARY =
  "h-11 justify-self-start rounded-control bg-primary-strong px-5 text-sm font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY =
  "h-11 justify-self-start rounded-control border border-border bg-surface px-5 text-sm font-semibold text-foreground outline-offset-2 hover:border-primary hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-wait disabled:opacity-70";
const DANGER =
  "h-11 justify-self-start rounded-control bg-danger px-5 text-sm font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-danger disabled:cursor-wait disabled:opacity-70";
const DANGER_OUTLINE =
  "h-11 justify-self-start rounded-control border border-danger/40 bg-panel px-5 text-sm font-semibold text-danger outline-offset-2 hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-danger";

const MESSAGES: Record<Exclude<ProductActionResult, null | { success: true }>["error"], string> = {
  file_required: "Upload a file before publishing.",
  has_orders: "This product has orders, so it cannot be deleted. Unpublish it instead.",
  not_found: "This product no longer exists.",
  invalid_fields: "Something went wrong. Try again.",
  unexpected: "Something went wrong. Try again.",
};

function ErrorMessage({ state, pending }: { state: ProductActionResult; pending: boolean }) {
  const error = !pending && state?.success === false ? MESSAGES[state.error] : null;
  return (
    <p
      role="alert"
      className={error ? "rounded-control bg-danger-soft px-4 py-3 text-sm text-danger" : "sr-only"}
    >
      {error}
    </p>
  );
}

export function ProductStatusControl({
  productId,
  status,
  hasFile,
}: {
  productId: string;
  status: ProductStatus;
  hasFile: boolean;
}) {
  const [state, action, pending] = useActionState<ProductActionResult, FormData>(
    setProductStatus,
    null,
  );
  const published = status === "PUBLISHED";

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="id" value={productId} />
      <input type="hidden" name="status" value={published ? "UNPUBLISHED" : "PUBLISHED"} />
      <p className="text-sm text-muted">
        {published
          ? "Customers can see and buy this product."
          : hasFile
            ? "Hidden from customers until you publish it."
            : "Hidden from customers. Upload a file before you can publish it."}
      </p>
      {/* Disabled without a file only as a hint; the server refuses it anyway. */}
      <button
        type="submit"
        disabled={pending || (!published && !hasFile)}
        aria-describedby={!published && !hasFile ? "publish-needs-file" : undefined}
        className={published ? SECONDARY : PRIMARY}
      >
        {pending ? "Saving…" : published ? "Unpublish" : "Publish"}
      </button>
      {!published && !hasFile && (
        <span id="publish-needs-file" className="sr-only">
          A file is required before publishing.
        </span>
      )}
      <ErrorMessage state={state} pending={pending} />
    </form>
  );
}

export function DeleteProduct({ productId }: { productId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<ProductActionResult, FormData>(
    async (previous, formData) => {
      const result = await deleteProduct(previous, formData);
      // A refused delete closes the panel, so the message replaces it.
      if (result?.success === false) setConfirming(false);
      return result;
    },
    null,
  );
  const confirmRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  // Focus follows the step: into the confirm panel, and back when it closes.
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
    else if (wasConfirming.current) startRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted">
        Deleting removes the product and its uploaded files for good. Products
        with orders cannot be deleted.
      </p>
      {confirming ? (
        <form
          action={action}
          className="grid gap-3 rounded-control border border-danger/40 bg-danger-soft p-4"
        >
          <input type="hidden" name="id" value={productId} />
          <p className="text-sm font-medium text-danger">
            Delete this product permanently? This cannot be undone.
          </p>
          <div className="flex flex-wrap gap-3">
            <button ref={confirmRef} type="submit" disabled={pending} className={DANGER}>
              {pending ? "Deleting…" : "Delete permanently"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className={SECONDARY}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          ref={startRef}
          type="button"
          onClick={() => setConfirming(true)}
          className={DANGER_OUTLINE}
        >
          Delete product
        </button>
      )}
      <ErrorMessage state={state} pending={pending} />
    </div>
  );
}
