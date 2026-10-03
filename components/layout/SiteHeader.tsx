import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { BoltIcon, CartIcon, ChartIcon, LockIcon } from "@/components/icons";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { MainNav, type NavItem } from "@/components/layout/MainNav";
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
  // Only pages that exist are linked; each feature adds its own entry.
  const navItems: NavItem[] = [
    { href: localizedPath(locale, "/"), label: header.home },
  ];
  const trustItems = [
    { icon: BoltIcon, text: header.trust.download },
    { icon: LockIcon, text: header.trust.payment },
    { icon: ChartIcon, text: header.trust.tracking },
  ];

  return (
    <header className="mx-auto w-full max-w-site px-4 pt-6 font-sans">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 rounded-t-panel bg-panel px-3 py-5 shadow-soft min-[600px]:gap-x-6 min-[600px]:px-6 min-[960px]:px-10">
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
            className="h-7 w-auto min-[600px]:h-8.5"
          />
        </Link>
        <MainNav label={header.nav} items={navItems} />
        <div className="ms-auto flex items-center gap-1 min-[600px]:gap-2">
          <LanguageSwitcher locale={locale} />
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
        </div>
      </div>
      <ul className="flex flex-wrap justify-between gap-x-6 gap-y-2 rounded-b-panel bg-primary-soft px-5 py-4 text-sm font-medium text-primary-strong min-[600px]:px-6 min-[960px]:px-10">
        {trustItems.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {text}
          </li>
        ))}
      </ul>
    </header>
  );
}
