"use client";

import { useActionState } from "react";
import { updateCartQuantity, type CartActionError } from "@/actions/cart";
import { MinusIcon, PlusIcon } from "@/components/icons";
import { MAX_QUANTITY } from "@/lib/cart";

export interface CartQuantityText {
  decrease: string;
  increase: string;
  errors: Record<CartActionError, string>;
}

interface CartQuantityFormProps {
  productId: string;
  productName: string;
  quantity: number;
  text: CartQuantityText;
}

const STEP_BUTTON =
  "grid h-9 w-9 place-items-center rounded-control text-muted outline-offset-2 hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-not-allowed disabled:opacity-40";

export function CartQuantityForm({
  productId,
  productName,
  quantity,
  text,
}: CartQuantityFormProps) {
  const [state, action, pending] = useActionState(updateCartQuantity, null);
  const error = state?.success === false ? text.errors[state.error] : null;

  return (
    // "contents" lets the line's controls row lay out the stepper and the error.
    <form action={action} className="contents">
      <input type="hidden" name="productId" value={productId} />
      <span className="inline-flex items-center rounded-control border border-border bg-panel">
        {/* Each button submits the new quantity. Removing is the trash button's job. */}
        <button
          type="submit"
          name="quantity"
          value={quantity - 1}
          disabled={pending || quantity <= 1}
          className={STEP_BUTTON}
        >
          <MinusIcon />
          <span className="sr-only">
            {text.decrease}
            {": "}
            <span dir="auto">{productName}</span>
          </span>
        </button>
        <output className="min-w-7 text-center text-sm font-semibold">
          {quantity}
        </output>
        <button
          type="submit"
          name="quantity"
          value={quantity + 1}
          disabled={pending || quantity >= MAX_QUANTITY}
          className={STEP_BUTTON}
        >
          <PlusIcon />
          <span className="sr-only">
            {text.increase}
            {": "}
            <span dir="auto">{productName}</span>
          </span>
        </button>
      </span>
      <p
        role="alert"
        className="order-last w-0 min-w-full text-end text-sm text-danger empty:hidden"
      >
        {!pending && error}
      </p>
    </form>
  );
}
