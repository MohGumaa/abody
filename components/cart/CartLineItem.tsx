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
import { BoltIcon, ClockIcon } from "@/components/icons";
import type { CartLine } from "@/lib/cart";
import { formatDurationDays, productPath } from "@/lib/catalog";
import { ProductType } from "@/lib/generated/prisma/enums";
import { localizedPath, type Locale } from "@/lib/i18n/config";
import { formatPriceCents } from "@/lib/money";

export interface CartLineText extends CartQuantityText, RemoveFromCartText {
  quantity: string;
  instantDownload: string;
  onboardingAfterPayment: string;
  typeLabel: string;
}

interface CartLineItemProps {
  line: CartLine;
  locale: Locale;
  text: CartLineText;
}

const CHIP =
  "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold";

export function CartLineItem({ line, locale, text }: CartLineItemProps) {
  const { product, quantity, lineTotalCents } = line;
  const isService = product.type === ProductType.SERVICE;
  const durationDays =
    isService && product.durationDays && product.durationDays > 0
      ? product.durationDays
      : null;

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-card bg-surface p-5 min-[600px]:grid-cols-[auto_minmax(0,1fr)_auto] min-[600px]:gap-6">
      <div className="w-16 min-[600px]:w-24">
        <ProductImage image={product.image} alt="" />
      </div>

      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-[0.06em] text-primary-strong uppercase rtl:tracking-normal">
          {text.typeLabel} · <span dir="auto">{product.category}</span>
        </p>
        <h2 className="mt-1 text-lg font-semibold">
          <Link
            href={localizedPath(locale, productPath(product))}
            dir="auto"
            className="break-words outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary-strong"
          >
            {product.name}
          </Link>
        </h2>
        <p className="mt-3 flex flex-wrap items-center gap-2">
          {isService ? (
            <>
              {durationDays && (
                <span className={`${CHIP} bg-primary-soft text-primary-strong`}>
                  <ClockIcon className="h-4 w-4" />
                  {formatDurationDays(durationDays, locale)}
                </span>
              )}
              <span className={`${CHIP} bg-panel text-muted`}>
                {text.onboardingAfterPayment}
              </span>
            </>
          ) : (
            <span className={`${CHIP} bg-success-soft text-success`}>
              <BoltIcon className="h-4 w-4" />
              {text.instantDownload}
            </span>
          )}
        </p>
      </div>

      {/* Below 600px this column moves under the details as one row. */}
      <div className="col-span-full flex items-center justify-between gap-3 min-[600px]:col-span-1 min-[600px]:flex-col min-[600px]:items-end">
        <p className="text-lg font-bold">{formatPriceCents(lineTotalCents)}</p>
        <div className="flex flex-wrap items-center justify-end gap-2">
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
