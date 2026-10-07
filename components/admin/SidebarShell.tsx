"use client";

import { usePathname } from "next/navigation";
import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { ChevronIcon, MenuIcon, SidebarIcon } from "@/components/icons";
import { SIDEBAR_COLLAPSED, SIDEBAR_COOKIE } from "@/lib/sidebar";

const ONE_YEAR = 60 * 60 * 24 * 365;

const ICON_BUTTON =
  "grid h-10 w-10 shrink-0 place-items-center rounded-control border border-border bg-panel text-muted outline-offset-2 hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary-strong";

interface SidebarShellProps {
  initialCollapsed: boolean;
  sidebar: ReactNode;
  topbarEnd: ReactNode;
  crumbRoot: string;
  pages: { href: string; label: string }[];
  children: ReactNode;
}

// Neutral wording only, like SideNav: this file ships with every response from
// the layout. At 960px and up the toggle collapses the sidebar to an icon rail
// (remembered in a cookie the server layout reads); below that it opens the
// sidebar as a drawer.
export function SidebarShell({
  initialCollapsed,
  sidebar,
  topbarEnd,
  crumbRoot,
  pages,
  children,
}: SidebarShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  // The drawer is open only on the path it was opened on, so back and forward
  // navigation close it without an effect.
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const drawerOpen = drawerPath === pathname;
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    sidebarRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setDrawerPath(null);
      menuButtonRef.current?.focus();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [drawerOpen]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? SIDEBAR_COLLAPSED : "expanded"}; path=/admin; max-age=${ONE_YEAR}; samesite=lax`;
  }

  // A link to the current page does not change the path, so close explicitly.
  function closeOnLink(event: MouseEvent<HTMLElement>) {
    if (event.target instanceof Element && event.target.closest("a")) {
      setDrawerPath(null);
    }
  }

  const current = pages.find((page) => page.href === pathname);

  return (
    <div
      data-collapsed={collapsed ? "" : undefined}
      className="group/shell grid flex-1 grid-cols-[minmax(0,1fr)] min-[960px]:grid-cols-[264px_minmax(0,1fr)] min-[960px]:transition-[grid-template-columns] min-[960px]:duration-200 min-[960px]:data-collapsed:grid-cols-[76px_minmax(0,1fr)] motion-reduce:transition-none"
    >
      <aside
        id="sidebar"
        ref={sidebarRef}
        onClick={closeOnLink}
        className={`flex flex-col gap-6 overflow-hidden border-e border-border bg-panel px-3 py-4 max-[959px]:fixed max-[959px]:inset-y-0 max-[959px]:start-0 max-[959px]:z-30 max-[959px]:w-70 max-[959px]:shadow-raised max-[959px]:transition-[translate,visibility] max-[959px]:duration-200 motion-reduce:transition-none min-[960px]:sticky min-[960px]:top-0 min-[960px]:z-20 min-[960px]:h-dvh min-[960px]:group-data-collapsed/shell:overflow-visible ${
          drawerOpen ? "" : "max-[959px]:invisible max-[959px]:-translate-x-full"
        }`}
      >
        {sidebar}
      </aside>
      {drawerOpen && (
        <div
          aria-hidden="true"
          onClick={() => setDrawerPath(null)}
          className="fixed inset-0 z-20 bg-ink/40 min-[960px]:hidden"
        />
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-10 flex h-17 items-center gap-3 border-b border-border bg-canvas/80 px-4 backdrop-blur min-[600px]:px-6">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setDrawerPath(drawerOpen ? null : pathname)}
            aria-controls="sidebar"
            aria-expanded={drawerOpen}
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            className={`${ICON_BUTTON} min-[960px]:hidden`}
          >
            <MenuIcon />
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-controls="sidebar"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`${ICON_BUTTON} max-[959px]:hidden`}
          >
            <SidebarIcon />
          </button>
          <p className="flex min-w-0 items-center gap-2 text-sm text-faint">
            {crumbRoot}
            {current && (
              <>
                <ChevronIcon className="h-3.5 w-3.5" />
                <span className="truncate font-semibold text-foreground">
                  {current.label}
                </span>
              </>
            )}
          </p>
          <div className="ms-auto">{topbarEnd}</div>
        </header>
        <main className="grid w-full max-w-340 grid-cols-[minmax(0,1fr)] content-start gap-6 px-4 pt-8 pb-16 min-[600px]:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
