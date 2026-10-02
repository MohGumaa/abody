import Link from "next/link";
import {
  CartQuantityForm,
  type CartQuantityText,
} from "@/components/cart/CartQuantityForm";
import {
  RemoveFromCartButton,
  type RemoveFromCartText,
} from "@/components/cart/RemoveFromCartButton";
import { ProductImage } from "@/components/catalog/ProductImage";
import type { CartLine } from "@/lib/cart";
import { productPath } from "@/lib/catalog";
import { ProductType } from "@/lib/generated/prisma/enums";
import { localizedPath, type Locale } from "@/lib/i18n/config";
import { formatPriceCents } from "@/lib/money";

export interface CartLineText extends CartQuantityText, RemoveFromCartText {
  unitPrice: string;
  lineTotal: string;
  typeLabel: string;
}

interface CartLineItemProps {
  line: CartLine;
  locale: Locale;
  text: CartLineText;
}

export function CartLineItem({ line, locale, text }: CartLineItemProps) {
  const { product, quantity, lineTotalCents } = line;
  const isService = product.type === ProductType.SERVICE;

  return (
    <li className="flex gap-4 py-5">
      <div className="w-24 shrink-0 sm:w-32">
        <ProductImage image={product.image} alt="" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-primary-strong">{text.typeLabel}</p>
          <Link
            href={localizedPath(locale, productPath(product))}
            dir="auto"
            className="block font-semibold break-words outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary-strong"
          >
            {product.name}
          </Link>
          <p className="mt-1 text-sm text-muted">
            {text.unitPrice}: {formatPriceCents(product.priceCents)}
          </p>
          <div className="mt-3">
            {isService ? (
              <p className="text-sm text-muted">
                {text.quantity}: {quantity}
              </p>
            ) : (
              <CartQuantityForm
                productId={product.id}
                productName={product.name}
                quantity={quantity}
                text={text}
              />
            )}
          </div>
        </div>

        <div className="flex items-start justify-between gap-4 sm:flex-col sm:items-end">
          <p className="font-semibold">
            <span className="sr-only">{text.lineTotal}: </span>
            {formatPriceCents(lineTotalCents)}
          </p>
          <RemoveFromCartButton
            productId={product.id}
            productName={product.name}
            text={text}
          />
        </div>
      </div>
    </li>
  );
}
