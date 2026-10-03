"use client";

import { useActionState } from "react";
import {
  removeFromCart,
  type CartActionError,
  type CartActionResult,
} from "@/actions/cart";
import { TrashIcon } from "@/components/icons";
import { CART_HEADING_ID } from "@/lib/cart";

export interface RemoveFromCartText {
  remove: string;
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
    // "contents" lets the line's controls row lay out the button and the error.
    <form action={action} className="contents">
      <input type="hidden" name="productId" value={productId} />
      <button
        type="submit"
        disabled={pending}
        className="grid h-9 w-9 place-items-center rounded-control text-muted outline-offset-2 hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-wait disabled:opacity-60"
      >
        <TrashIcon />
        <span className="sr-only">
          {text.remove}
          {": "}
          <span dir="auto">{productName}</span>
        </span>
      </button>
      <p
        role="alert"
        className="order-last w-0 min-w-full text-end text-sm text-danger empty:hidden"
      >
        {!pending && error}
      </p>
    </form>
  );
}
