"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlobeIcon } from "@/components/icons";
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
      <GlobeIcon />
      {/* Hidden on phones but still the link's accessible name. */}
      <span className="sr-only min-[600px]:not-sr-only">
        {LOCALE_NAMES[target]}
      </span>
    </Link>
  );
}
