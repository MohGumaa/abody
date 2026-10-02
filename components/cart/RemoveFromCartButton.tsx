"use client";

import { useActionState } from "react";
import {
  removeFromCart,
  type CartActionError,
  type CartActionResult,
} from "@/actions/cart";
import { CART_HEADING_ID } from "@/lib/cart";

export interface RemoveFromCartText {
  remove: string;
  removing: string;
  errors: Record<CartActionError, string>;
}

interface RemoveFromCartButtonProps {
  productId: string;
  productName: string;
  text: RemoveFromCartText;
}

// The removed line unmounts with its button, so focus moves to the heading
// instead of falling back to the page.
async function removeAndRefocus(
  previous: CartActionResult,
  formData: FormData,
): Promise<CartActionResult> {
  const result = await removeFromCart(previous, formData);
  if (result?.success) document.getElementById(CART_HEADING_ID)?.focus();
  return result;
}

export function RemoveFromCartButton({
  productId,
  productName,
  text,
}: RemoveFromCartButtonProps) {
  const [state, action, pending] = useActionState(removeAndRefocus, null);
  // Remove has no user-typed input, so a rejected id is reported as unexpected.
  const error =
    state?.success === false
      ? text.errors[state.error === "invalid_input" ? "unexpected" : state.error]
      : null;

  return (
    <form action={action}>
      <input type="hidden" name="productId" value={productId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-control text-sm font-semibold text-danger underline-offset-2 outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? text.removing : text.remove}
        <span className="sr-only">
          {": "}
          <span dir="auto">{productName}</span>
        </span>
      </button>
      <p role="alert" className="mt-1 text-sm text-danger empty:mt-0">
        {!pending && error}
      </p>
    </form>
  );
}
