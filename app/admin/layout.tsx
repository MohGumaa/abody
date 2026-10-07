import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/actions/auth";
import { AdminNav, type AdminNavSection } from "@/components/admin/AdminNav";
import { ArrowIcon, LogoutIcon } from "@/components/icons";
import { initials } from "@/lib/account";
import { adminMetadata } from "@/lib/admin";
import { getCurrentUser } from "@/lib/session";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateMetadata(): Promise<Metadata> {
  return adminMetadata();
}

// Kept here, not in AdminNav: a layout's client code loads even on the 404 a
// non-admin gets, while this data reaches the browser only when an admin
// renders. Only pages that exist are linked; each admin feature adds its entry.
const NAV_SECTIONS: AdminNavSection[] = [
  {
    label: "Admin",
    links: [{ href: "/admin", label: "Dashboard", icon: "chart" }],
  },
  {
    label: "Storefront",
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
// the page (which redirects or 404s), so no admin chrome reaches anyone else.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "ADMIN";

  return (
    <html
      lang="en"
      dir="ltr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-canvas font-sans">
        {isAdmin ? (
          <>
            <header className="sticky top-0 z-20 border-b border-border bg-panel shadow-soft">
              <div className="flex items-center gap-3 px-4 py-3 min-[600px]:px-6">
                <Link href="/admin" className={`flex items-center gap-3 rounded-control ${FOCUS}`}>
                  <Image
                    src="/Logo-0.jpg"
                    alt="Abody"
                    width={164}
                    height={32}
                    priority
                    className="h-7 w-auto"
                  />
                  <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary-strong">
                    Admin
                  </span>
                </Link>
                <div className="ms-auto flex items-center gap-2 min-[600px]:gap-4">
                  <Link
                    href="/en"
                    className={`hidden items-center gap-2 rounded-control px-3 py-2 text-sm font-medium text-muted hover:bg-surface hover:text-foreground min-[600px]:flex ${FOCUS}`}
                  >
                    View store
                    <ArrowIcon className="h-4 w-4" />
                  </Link>
                  <div className="flex min-w-0 items-center gap-3 border-border min-[600px]:border-s min-[600px]:ps-4">
                    <span
                      aria-hidden="true"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-strong text-sm font-semibold text-white"
                    >
                      {initials(user.name)}
                    </span>
                    {/* React text: the name and email never render as HTML. */}
                    <span className="hidden min-w-0 max-w-56 min-[768px]:grid">
                      <strong className="truncate text-sm font-semibold" dir="auto">
                        {user.name}
                      </strong>
                      <span className="truncate text-xs text-muted">{user.email}</span>
                    </span>
                  </div>
                  <form action={signOut}>
                    <input type="hidden" name="lang" value="en" />
                    <button
                      type="submit"
                      className={`flex items-center gap-2 rounded-control px-3 py-2 text-sm font-medium text-muted hover:bg-surface hover:text-foreground ${FOCUS}`}
                    >
                      <LogoutIcon className="h-5 w-5" />
                      <span className="max-[599px]:sr-only">Sign out</span>
                    </button>
                  </form>
                </div>
              </div>
            </header>
            <div className="grid w-full flex-1 grid-cols-[minmax(0,1fr)] min-[960px]:grid-cols-[248px_minmax(0,1fr)]">
              <aside className="min-w-0 border-b border-border bg-panel px-4 py-3 min-[600px]:px-6 min-[960px]:sticky min-[960px]:top-15.25 min-[960px]:h-[calc(100dvh-61px)] min-[960px]:border-e min-[960px]:border-b-0 min-[960px]:px-4 min-[960px]:py-6">
                <AdminNav label="Admin navigation" sections={NAV_SECTIONS} />
              </aside>
              <main className="grid min-w-0 content-start gap-6 px-4 pt-6 pb-16 min-[600px]:px-6 min-[1200px]:px-10">
                {children}
              </main>
            </div>
          </>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
