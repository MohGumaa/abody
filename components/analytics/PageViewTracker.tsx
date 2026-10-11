"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// Sends one page view per customer page (feature 23). Customer pages can be
// prerendered, so views are counted from the browser, not while rendering.
// Renders nothing; every failure is ignored.
export function PageViewTracker() {
  const pathname = usePathname();
  // Strict Mode runs effects twice in development; the ref survives that, so
  // a page is still counted once.
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;
    fetch("/api/analytics", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
