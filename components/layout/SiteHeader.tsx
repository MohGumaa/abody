import Image from "next/image";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";

export async function SiteHeader() {
  const locale = await getLocale();
  const { header } = await getDictionary();

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
        <div className="ms-auto">
          <LanguageSwitcher locale={locale} />
        </div>
      </div>
    </header>
  );
}
