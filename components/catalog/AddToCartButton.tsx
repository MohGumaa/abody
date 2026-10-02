import { getDictionary } from "@/lib/i18n/dictionaries";

// Disabled until the cart ships; the cart feature gives this button its behavior.
export async function AddToCartButton() {
  const { product } = await getDictionary();

  return (
    <div>
      <button
        type="button"
        disabled
        aria-describedby="add-to-cart-note"
        className="w-full rounded-full bg-primary-strong px-8 py-3.5 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-56"
      >
        {product.addToCart}
      </button>
      <p id="add-to-cart-note" className="mt-2 text-sm text-muted">
        {product.cartComingSoon}
      </p>
    </div>
  );
}
