import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { CartLineItem } from "@/components/cart/CartLineItem";
import { CartSummary } from "@/components/cart/CartSummary";
import {
  buildCartView,
  CART_COOKIE,
  CART_HEADING_ID,
  parseCart,
} from "@/lib/cart";
import { listPublishedProductsByIds } from "@/lib/catalog";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const { cart } = await getDictionary();
  return { title: cart.title };
}

export default async function CartPage() {
  const locale = await getLocale();
  const { cart: text, product: productText } = await getDictionary();
  const entries = parseCart((await cookies()).get(CART_COOKIE)?.value);
  const products = await listPublishedProductsByIds(
    entries.map((entry) => entry.productId),
    locale,
  );
  const view = buildCartView(entries, products);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 font-sans sm:px-6 lg:py-14">
      <h1
        id={CART_HEADING_ID}
        tabIndex={-1}
        className="text-3xl font-semibold tracking-tight outline-none"
      >
        {text.title}
      </h1>

      {view.removedCount > 0 && (
        <p className="mt-4 rounded-card bg-warning-soft px-4 py-3 text-sm text-warning">
          {text.itemsRemoved}
        </p>
      )}

      {view.lines.length === 0 ? (
        <div className="mt-8">
          <p className="text-lg text-muted">{text.empty}</p>
          <Link
            href={localizedPath(locale, "/")}
            className="mt-6 inline-block rounded-full bg-primary-strong px-6 py-3 font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong"
          >
            {text.continueShopping}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
          <ul className="divide-y divide-border border-y border-border">
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
          <CartSummary
            subtotalCents={view.subtotalCents}
            totalCents={view.totalCents}
            text={text}
          />
        </div>
      )}
    </main>
  );
}
