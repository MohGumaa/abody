import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { CartLineItem } from "@/components/cart/CartLineItem";
import { CartSummary } from "@/components/cart/CartSummary";
import { CartIcon, ChevronIcon } from "@/components/icons";
import {
  buildCartView,
  CART_COOKIE,
  CART_HEADING_ID,
  parseCart,
} from "@/lib/cart";
import { ProductCard } from "@/components/catalog/ProductCard";
import { listCartSuggestions, listPublishedProductsByIds } from "@/lib/catalog";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { formatItemCount } from "@/lib/i18n/plural";

const PANEL =
  "rounded-panel bg-panel p-5 shadow-soft min-[600px]:p-6 min-[960px]:p-10";

export async function generateMetadata(): Promise<Metadata> {
  const { cart } = await getDictionary();
  return { title: cart.title };
}

export default async function CartPage() {
  const locale = await getLocale();
  const {
    cart: text,
    header: headerText,
    product: productText,
  } = await getDictionary();
  const entries = parseCart((await cookies()).get(CART_COOKIE)?.value);
  const products = await listPublishedProductsByIds(
    entries.map((entry) => entry.productId),
    locale,
  );
  const view = buildCartView(entries, products);
  const isEmpty = view.lines.length === 0;
  // Suggestions only sit beside a cart that has something in it.
  const suggestions = isEmpty
    ? []
    : await listCartSuggestions(
        view.lines.map((line) => line.product.id),
        locale,
      );
  const itemCountLabel = formatItemCount(locale, view.itemCount, text.itemCount);

  return (
    <div className="flex-1 font-sans">
      <main className="mx-auto grid w-full max-w-site gap-6 px-4 pt-6 pb-16">
        <nav
          aria-label={text.breadcrumb}
          className="flex flex-wrap items-center gap-2 rounded-panel bg-panel px-5 py-4 text-sm text-muted shadow-soft min-[600px]:px-6 min-[960px]:px-10"
        >
          <Link
            href={localizedPath(locale, "/")}
            className="rounded-control outline-offset-2 hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-primary-strong"
          >
            {text.home}
          </Link>
          <ChevronIcon className="h-3 w-3 text-faint rtl:-scale-x-100" />
          <span aria-current="page" className="font-semibold text-foreground">
            {headerText.cart}
          </span>
        </nav>

        {view.removedCount > 0 && (
          <p className="rounded-panel bg-warning-soft px-5 py-4 text-sm text-warning min-[600px]:px-6 min-[960px]:px-10">
            {text.itemsRemoved}
          </p>
        )}

        {/* Both states share one tree shape so the heading element survives the
            last removal and keeps the focus RemoveFromCartButton gives it. */}
        <div
          className={
            isEmpty
              ? undefined
              : "grid items-start gap-6 min-[960px]:grid-cols-[minmax(0,1fr)_360px]"
          }
        >
          <section
            aria-labelledby={CART_HEADING_ID}
            className={
              isEmpty
                ? "grid justify-items-center gap-4 rounded-panel bg-panel px-5 py-16 text-center shadow-soft"
                : PANEL
            }
          >
            <div
              className={
                isEmpty
                  ? "contents"
                  : "mb-8 flex flex-wrap items-baseline justify-between gap-3"
              }
            >
              {isEmpty && (
                <span className="grid h-18 w-18 place-items-center rounded-full bg-primary-soft text-primary-strong">
                  <CartIcon className="h-8 w-8" />
                </span>
              )}
              <h1
                id={CART_HEADING_ID}
                tabIndex={-1}
                className="text-2xl font-semibold tracking-tight outline-none"
              >
                {isEmpty ? text.emptyTitle : text.title}
              </h1>
              {!isEmpty && <span className="text-muted">{itemCountLabel}</span>}
            </div>
            {isEmpty ? (
              <>
                <p className="max-w-[44ch] text-muted">{text.emptyBody}</p>
                <Link
                  href={localizedPath(locale, "/products")}
                  className="inline-flex h-13 items-center rounded-card bg-primary-strong px-6 font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong"
                >
                  {text.browseStore}
                </Link>
              </>
            ) : (
              <ul className="grid gap-4">
                {view.lines.map((line) => (
                  <CartLineItem
                    key={line.product.id}
                    line={line}
                    locale={locale}
                    text={{
                      ...text,
                      typeLabel: productText.typeLabels[line.product.type],
                    }}
                  />
                ))}
              </ul>
            )}
          </section>
          {!isEmpty && (
            <CartSummary
              subtotalCents={view.subtotalCents}
              totalCents={view.totalCents}
              itemCountLabel={itemCountLabel}
              text={text}
            />
          )}
        </div>

        {suggestions.length > 0 && (
          <section aria-labelledby="more-heading" className={PANEL}>
            <h2 id="more-heading" className="mb-8 text-2xl font-semibold">
              {productText.related}
            </h2>
            <ul className="grid gap-5 min-[600px]:grid-cols-2 min-[960px]:grid-cols-4">
              {suggestions.map((item, index) => (
                <li key={item.id}>
                  <ProductCard
                    product={item}
                    locale={locale}
                    index={index}
                    text={productText}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
