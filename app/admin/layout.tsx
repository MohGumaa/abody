import type { Metadata } from "next";
import { Geist, Geist_Mono, Tajawal } from "next/font/google";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/actions/auth";
import { SideNav, type SideNavSection } from "@/components/admin/SideNav";
import { SidebarShell } from "@/components/admin/SidebarShell";
import { ExternalIcon, LogoutIcon } from "@/components/icons";
import { initials } from "@/lib/account";
import { adminMetadata } from "@/lib/admin";
import { getCurrentUser } from "@/lib/session";
import {
  RAIL_CENTER,
  RAIL_HIDE,
  SIDEBAR_COLLAPSED,
  SIDEBAR_COOKIE,
} from "@/lib/sidebar";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Same font set as the storefront: --font-body needs every variable it names,
// and Arabic customer names in admin tables need Tajawal.
const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
});

export function generateMetadata(): Promise<Metadata> {
  return adminMetadata();
}

// Kept here, not in SideNav: a layout's client code loads even on the 404 a
// non-admin gets, while this data reaches the browser only when an admin
// renders. Only pages that exist are linked; each admin feature adds its entry.
const NAV_SECTIONS: SideNavSection[] = [
  {
    label: "Admin",
    links: [
      { href: "/admin", label: "Dashboard", icon: "dashboard" },
      { href: "/admin/products", label: "Products", icon: "grid" },
      { href: "/admin/services", label: "Services", icon: "megaphone" },
    ],
  },
  {
    label: "Storefront",
    external: true,
    links: [
      { href: "/en", label: "Store home", icon: "globe" },
      { href: "/en/products", label: "Products", icon: "grid" },
      { href: "/en/services", label: "Services", icon: "megaphone" },
    ],
  },
];

const FOCUS =
  "outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary-strong";

// The admin area's own root layout: English-only, outside the language
// prefix. Not an auth boundary: layouts do not re-render on navigation, so every
// admin page calls requireAdmin() itself. Without an admin this renders only
// the page (which 404s), so no admin chrome reaches anyone else.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "ADMIN";
  const collapsed =
    (await cookies()).get(SIDEBAR_COOKIE)?.value === SIDEBAR_COLLAPSED;

  return (
    <html
      lang="en"
      dir="ltr"
      className={`${geistSans.variable} ${geistMono.variable} ${tajawal.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas font-sans">
        {isAdmin ? (
          <SidebarShell
            initialCollapsed={collapsed}
            crumbRoot="Admin"
            pages={NAV_SECTIONS[0].links}
            topbarEnd={
              <Link
                href="/en"
                className={`flex h-10 items-center gap-2 rounded-control border border-border bg-panel px-3 text-sm font-medium hover:bg-surface min-[600px]:px-4 ${FOCUS}`}
              >
                <span className="max-[599px]:sr-only">View store</span>
                <ExternalIcon className="h-4 w-4" />
              </Link>
            }
            sidebar={
              <>
                <Link
                  href="/admin"
                  className={`flex h-11 shrink-0 items-center gap-3 rounded-control px-2 ${RAIL_CENTER} ${FOCUS}`}
                >
                  {/* The rail shows only the logo mark; display toggles, so the
                      link has exactly one image name in either state. */}
                  <Image
                    src="/Logo-0.jpg"
                    alt="Abody"
                    width={164}
                    height={32}
                    priority
                    className="h-7 w-auto min-[960px]:group-data-collapsed/shell:hidden"
                  />
                  <Image
                    src="/android-chrome-192x192.png"
                    alt="Abody"
                    width={36}
                    height={36}
                    className="hidden h-9 w-9 min-[960px]:group-data-collapsed/shell:block"
                  />
                  <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary-strong min-[960px]:group-data-collapsed/shell:hidden">
                    Admin
                  </span>
                </Link>
                <SideNav label="Admin navigation" sections={NAV_SECTIONS} />
                <div className="mt-auto grid gap-2 border-t border-border pt-4">
                  <div className={`flex items-center gap-3 p-2 ${RAIL_CENTER}`}>
                    <span
                      aria-hidden="true"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-strong text-xs font-semibold text-white"
                    >
                      {initials(user.name)}
                    </span>
                    {/* React text: the name and email never render as HTML. */}
                    <span className={`grid min-w-0 leading-snug ${RAIL_HIDE}`}>
                      <strong className="truncate text-sm font-semibold" dir="auto">
                        {user.name}
                      </strong>
                      <span className="truncate text-xs text-faint">{user.email}</span>
                    </span>
                  </div>
                  <form action={signOut}>
                    <input type="hidden" name="lang" value="en" />
                    <button
                      type="submit"
                      className={`flex h-10 w-full items-center gap-3 rounded-control px-3 text-sm font-medium whitespace-nowrap text-muted hover:bg-danger-soft hover:text-danger ${RAIL_CENTER} ${FOCUS}`}
                    >
                      <LogoutIcon className="h-5 w-5" />
                      <span className={RAIL_HIDE}>Sign out</span>
                    </button>
                  </form>
                </div>
              </>
            }
          >
            {children}
          </SidebarShell>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
