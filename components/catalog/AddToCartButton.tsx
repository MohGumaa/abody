"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  addToCart,
  type CartActionError,
  type CartActionOutcome,
} from "@/actions/cart";

export interface AddToCartText {
  addToCart: string;
  adding: string;
  added: string;
  alreadyInCart: string;
  maxQuantity: string;
  viewCart: string;
  errors: Record<CartActionError, string>;
}

interface AddToCartButtonProps {
  productId: string;
  cartHref: string;
  text: AddToCartText;
}

export function AddToCartButton({
  productId,
  cartHref,
  text,
}: AddToCartButtonProps) {
  const [state, action, pending] = useActionState(addToCart, null);

  const notices: Partial<Record<CartActionOutcome, string>> = {
    added: text.added,
    already_in_cart: text.alreadyInCart,
    max_quantity: text.maxQuantity,
  };
  const notice = state?.success === true ? notices[state.data.outcome] : null;
  // Add has no user-typed input, so a rejected id is reported as unexpected.
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
        className="w-full rounded-full bg-primary-strong px-8 py-3.5 text-base font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:min-w-56"
      >
        {pending ? text.adding : text.addToCart}
      </button>
      <p role="status" className="mt-2 text-sm text-success empty:mt-0">
        {!pending && notice && (
          <>
            {notice}{" "}
            <Link
              href={cartHref}
              className="font-semibold text-primary-strong underline underline-offset-2"
            >
              {text.viewCart}
            </Link>
          </>
        )}
      </p>
      <p role="alert" className="mt-2 text-sm text-danger empty:mt-0">
        {!pending && error}
      </p>
    </form>
  );
}
