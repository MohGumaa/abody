"use client";

import { useActionState, useId } from "react";
import { updateCartQuantity, type CartActionError } from "@/actions/cart";
import { MAX_QUANTITY } from "@/lib/cart";

export interface CartQuantityText {
  quantity: string;
  update: string;
  updating: string;
  errors: Record<CartActionError, string>;
}

interface CartQuantityFormProps {
  productId: string;
  productName: string;
  quantity: number;
  text: CartQuantityText;
}

export function CartQuantityForm({
  productId,
  productName,
  quantity,
  text,
}: CartQuantityFormProps) {
  const [state, action, pending] = useActionState(updateCartQuantity, null);
  const inputId = useId();
  const errorId = useId();
  const error = state?.success === false ? text.errors[state.error] : null;

  return (
    <form action={action}>
      <input type="hidden" name="productId" value={productId} />
      <label htmlFor={inputId} className="block text-sm text-muted">
        {text.quantity}
        <span className="sr-only">
          {": "}
          <span dir="auto">{productName}</span>
        </span>
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          // Remount after an update so the field shows the saved quantity.
          key={quantity}
          id={inputId}
          name="quantity"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_QUANTITY}
          step={1}
          required
          defaultValue={quantity}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-10 w-20 rounded-control border border-border bg-panel px-2 text-center outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary-strong aria-invalid:border-danger"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-control border border-border px-3 text-sm font-semibold outline-offset-2 hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? text.updating : text.update}
        </button>
      </div>
      <p id={errorId} role="alert" className="mt-1 text-sm text-danger empty:mt-0">
        {!pending && error}
      </p>
    </form>
  );
}
