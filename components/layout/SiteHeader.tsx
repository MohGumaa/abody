import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
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
            className="flex h-11 items-center gap-2 rounded-card px-3 text-sm font-semibold outline-offset-2 hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary-strong"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 shrink-0"
            >
              <path d="M3.5 4.5h2.2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.1l1.6-6.3H6.4" />
              <circle cx="10" cy="19.5" r="1" />
              <circle cx="17" cy="19.5" r="1" />
            </svg>
            {/* The icon and count fit narrow phones; the label names the link. */}
            <span className="hidden sm:inline">{header.cart}</span>
            <span className="min-w-6 rounded-full bg-primary-soft px-1.5 text-center text-xs leading-6 text-primary-strong">
              {count}
            </span>
          </Link>
          <LanguageSwitcher locale={locale} />
        </div>
      </div>
    </header>
  );
}
