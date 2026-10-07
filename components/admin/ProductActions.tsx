"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  deleteProduct,
  deleteService,
  setProductStatus,
  setServiceStatus,
  type ProductActionResult,
} from "@/actions/admin-products";
import type { ProductStatus, ProductType } from "@/lib/generated/prisma/enums";

const PRIMARY =
  "h-11 justify-self-start rounded-control bg-primary-strong px-5 text-sm font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY =
  "h-11 justify-self-start rounded-control border border-border bg-surface px-5 text-sm font-semibold text-foreground outline-offset-2 hover:border-primary hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-wait disabled:opacity-70";
const DANGER =
  "h-11 justify-self-start rounded-control bg-danger px-5 text-sm font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-danger disabled:cursor-wait disabled:opacity-70";
const DANGER_OUTLINE =
  "h-11 justify-self-start rounded-control border border-danger/40 bg-panel px-5 text-sm font-semibold text-danger outline-offset-2 hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-danger";

type ActionError = Exclude<ProductActionResult, null | { success: true }>["error"];

function messages(noun: string): Record<ActionError, string> {
  return {
    file_required: "Upload a file before publishing.",
    has_orders: `This ${noun} has orders, so it cannot be deleted. Unpublish it instead.`,
    not_found: `This ${noun} no longer exists.`,
    invalid_fields: "Something went wrong. Try again.",
    unexpected: "Something went wrong. Try again.",
  };
}

const nounFor = (type: ProductType) => (type === "SERVICE" ? "service" : "product");

function ErrorMessage({
  state,
  pending,
  noun,
}: {
  state: ProductActionResult;
  pending: boolean;
  noun: string;
}) {
  const error = !pending && state?.success === false ? messages(noun)[state.error] : null;
  return (
    <p
      role="alert"
      className={error ? "rounded-control bg-danger-soft px-4 py-3 text-sm text-danger" : "sr-only"}
    >
      {error}
    </p>
  );
}

// Services have no file, so only a digital product waits for one.
export function ProductStatusControl({
  type,
  productId,
  status,
  hasFile,
}: {
  type: ProductType;
  productId: string;
  status: ProductStatus;
  hasFile: boolean;
}) {
  const [state, action, pending] = useActionState<ProductActionResult, FormData>(
    type === "SERVICE" ? setServiceStatus : setProductStatus,
    null,
  );
  const noun = nounFor(type);
  const published = status === "PUBLISHED";
  const needsFile = type === "DIGITAL_PRODUCT" && !published && !hasFile;

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="id" value={productId} />
      <input type="hidden" name="status" value={published ? "UNPUBLISHED" : "PUBLISHED"} />
      <p className="text-sm text-muted">
        {published
          ? `Customers can see and buy this ${noun}.`
          : needsFile
            ? "Hidden from customers. Upload a file before you can publish it."
            : "Hidden from customers until you publish it."}
      </p>
      {/* Disabled without a file only as a hint; the server refuses it anyway. */}
      <button
        type="submit"
        disabled={pending || needsFile}
        aria-describedby={needsFile ? "publish-needs-file" : undefined}
        className={published ? SECONDARY : PRIMARY}
      >
        {pending ? "Saving…" : published ? "Unpublish" : "Publish"}
      </button>
      {needsFile && (
        <span id="publish-needs-file" className="sr-only">
          A file is required before publishing.
        </span>
      )}
      <ErrorMessage state={state} pending={pending} noun={noun} />
    </form>
  );
}

export function DeleteProduct({ type, productId }: { type: ProductType; productId: string }) {
  const noun = nounFor(type);
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<ProductActionResult, FormData>(
    async (previous, formData) => {
      const remove = type === "SERVICE" ? deleteService : deleteProduct;
      const result = await remove(previous, formData);
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
        {type === "SERVICE"
          ? "Deleting removes the service for good. Services with orders cannot be deleted."
          : "Deleting removes the product and its uploaded files for good. Products with orders cannot be deleted."}
      </p>
      {confirming ? (
        <form
          action={action}
          className="grid gap-3 rounded-control border border-danger/40 bg-danger-soft p-4"
        >
          <input type="hidden" name="id" value={productId} />
          <p className="text-sm font-medium text-danger">
            Delete this {noun} permanently? This cannot be undone.
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
          Delete {noun}
        </button>
      )}
      <ErrorMessage state={state} pending={pending} noun={noun} />
    </div>
  );
}
