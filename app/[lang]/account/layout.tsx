import Link from "next/link";
import { signOut } from "@/actions/auth";
import { AccountNav } from "@/components/account/AccountNav";
import { ChevronIcon, LogoutIcon } from "@/components/icons";
import { initials } from "@/lib/account";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { getCurrentUser } from "@/lib/session";

const PANEL = "rounded-panel bg-panel shadow-soft";

// The shared account frame. Not an auth boundary: layouts do not re-render on
// navigation, so every account page checks the session and redirects itself.
// Without a user this renders only the page, which then redirects.
export default async function AccountLayout({
  children,
}: LayoutProps<"/[lang]/account">) {
  const user = await getCurrentUser();
  if (!user) return children;
  const locale = await getLocale();
  const { account: text } = await getDictionary();
  const path = (rest: string) => localizedPath(locale, `/account${rest}`);

  return (
    <div className="flex-1 font-sans">
      <main className="mx-auto grid w-full max-w-site gap-6 px-4 pt-6 pb-16">
        <nav
          aria-label={text.breadcrumb}
          className={`flex flex-wrap items-center gap-2 px-5 py-4 text-sm text-muted min-[600px]:px-6 min-[960px]:px-10 ${PANEL}`}
        >
          <Link
            href={localizedPath(locale, "/")}
            className="rounded-control outline-offset-2 hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-primary-strong"
          >
            {text.home}
          </Link>
          <ChevronIcon className="h-3 w-3 text-faint rtl:-scale-x-100" />
          <span aria-current="page" className="font-semibold text-foreground">
            {text.breadcrumbCurrent}
          </span>
        </nav>

        <div className="grid items-start gap-6 min-[960px]:grid-cols-[280px_minmax(0,1fr)]">
          <aside className={`grid min-w-0 gap-6 p-5 min-[960px]:px-6 min-[960px]:py-8 ${PANEL}`}>
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="grid h-13 w-13 shrink-0 place-items-center rounded-card bg-primary-strong font-semibold text-white"
              >
                {initials(user.name)}
              </span>
              <span className="grid min-w-0">
                <strong className="font-semibold wrap-break-word" dir="auto">
                  {user.name}
                </strong>
                <span dir="ltr" className="text-sm break-all text-muted rtl:text-right">
                  {user.email}
                </span>
              </span>
            </div>
            <div className="grid min-w-0 gap-3">
              <AccountNav
                label={text.navLabel}
                items={[
                  { segment: null, href: path(""), label: text.nav.overview, icon: "overview" },
                  { segment: "orders", href: path("/orders"), label: text.nav.orders, icon: "orders" },
                  { segment: "downloads", href: path("/downloads"), label: text.nav.downloads, icon: "downloads" },
                  { segment: "services", href: path("/services"), label: text.nav.services, icon: "services" },
                  { segment: "settings", href: path("/settings"), label: text.nav.profile, icon: "profile" },
                ]}
              />
              <form action={signOut} className="border-t border-border pt-3">
                <input type="hidden" name="lang" value={locale} />
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-control p-3 text-sm font-medium text-muted outline-offset-2 hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary-strong"
                >
                  <LogoutIcon className="h-5 w-5 rtl:-scale-x-100" />
                  {text.signOut}
                </button>
              </form>
            </div>
          </aside>

          <div className="grid min-w-0 gap-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
