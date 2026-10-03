import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { CartIcon } from "@/components/icons";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { CART_COOKIE, cartItemCount, parseCart } from "@/lib/cart";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";

export async function SiteHeader() {
  const locale = await getLocale();
  const { header } = await getDictionary();
  // Read straight from the cookie: the cart page and every write recheck items.
  const count = cartItemCount(
    parseCart((await cookies()).get(CART_COOKIE)?.value),
  );

  return (
    <header className="border-b border-border bg-panel font-sans">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link
          href={localizedPath(locale, "/")}
          className="rounded-control outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary-strong"
        >
          {/* The logo is bilingual and is used as is in both languages. */}
          <Image
            src="/Logo-0.jpg"
            alt={header.logoAlt}
            width={164}
            height={32}
            priority
            className="h-8 w-auto"
          />
        </Link>
        <div className="ms-auto flex items-center gap-1">
          <Link
            href={localizedPath(locale, "/cart")}
            aria-label={header.cartLabel(count)}
            className="flex h-11 items-center gap-2 rounded-card bg-primary-soft px-3 text-sm font-semibold text-primary-strong outline-offset-2 hover:bg-tint-1 focus-visible:outline-2 focus-visible:outline-primary-strong sm:px-5"
          >
            <CartIcon />
            {/* The icon and count fit narrow phones; the label names the link. */}
            <span className="hidden sm:inline">{header.cart}</span>
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary-strong px-1 text-xs text-white">
              {count}
            </span>
          </Link>
          <LanguageSwitcher locale={locale} />
        </div>
      </div>
    </header>
  );
}
