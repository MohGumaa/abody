"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_NAMES,
  otherLocale,
  switchLocalePath,
  type Locale,
} from "@/lib/i18n/config";

interface LanguageSwitcherProps {
  locale: Locale;
}

export function LanguageSwitcher({ locale }: LanguageSwitcherProps) {
  const pathname = usePathname();
  const target = otherLocale(locale);

  // A real link, so switching still works without JavaScript; only the saved
  // choice needs the click handler.
  function saveChoice() {
    document.cookie = `${LOCALE_COOKIE}=${target}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
  }

  return (
    <Link
      href={switchLocalePath(pathname, target)}
      lang={target}
      hrefLang={target}
      onClick={saveChoice}
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
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17M12 3.5c2.5 2.6 3.8 5.4 3.8 8.5s-1.3 5.9-3.8 8.5c-2.5-2.6-3.8-5.4-3.8-8.5s1.3-5.9 3.8-8.5z" />
      </svg>
      {LOCALE_NAMES[target]}
    </Link>
  );
}
