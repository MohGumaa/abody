import Image from "next/image";
import Link from "next/link";
import { LockIcon, MailIcon } from "@/components/icons";
import type { NavItem } from "@/components/layout/MainNav";
import { PaymentCards } from "@/components/layout/PaymentCards";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { getSiteContent } from "@/lib/site-content";

interface FooterColumn {
  heading: string;
  links: NavItem[];
}

export async function SiteFooter() {
  const locale = await getLocale();
  const { header, footer } = await getDictionary();
  // Admin-set in /admin/settings (feature 21c); no line when none is saved.
  const contactEmail = (await getSiteContent())?.contactEmail;
  // Company and Account columns join as their pages ship; a column with no
  // links is not shown.
  const columns: FooterColumn[] = [
    {
      heading: footer.shop,
      links: [
        { href: localizedPath(locale, "/products"), label: header.products },
        { href: localizedPath(locale, "/services"), label: header.services },
      ],
    },
  ];
  const shownColumns = columns.filter((column) => column.links.length > 0);

  return (
    <footer className="mt-auto border-t border-border bg-panel pt-12 pb-8 font-sans">
      <div className="mx-auto w-full max-w-site px-4">
        <div className="grid grid-cols-2 gap-8 min-[960px]:grid-cols-[1.6fr_repeat(3,1fr)]">
          <div className="col-span-2 min-[960px]:col-span-1">
            <Link
              href={localizedPath(locale, "/")}
              className="inline-flex rounded-control outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary-strong"
            >
              <Image
                src="/Logo-0.jpg"
                alt={header.logoAlt}
                width={164}
                height={32}
                className="h-8.5 w-auto"
              />
            </Link>
            <p className="mt-4 max-w-[34ch] text-sm text-muted">
              {footer.blurb}
            </p>
            {contactEmail && (
              <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
                <MailIcon className="size-[1.25em]" />
                <span>{footer.contactLabel}</span>
                {/* Validated on save; React text, so it never renders as HTML. */}
                <a
                  href={`mailto:${contactEmail}`}
                  dir="ltr"
                  className="rounded-control font-medium text-foreground outline-offset-2 hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-primary-strong"
                >
                  {contactEmail}
                </a>
              </p>
            )}
          </div>
          {shownColumns.map((column) => (
            <div key={column.heading}>
              <h3 className="mb-4 text-sm font-semibold">{column.heading}</h3>
              <ul className="grid gap-2 text-sm text-muted">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="rounded-control outline-offset-2 hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-primary-strong"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap justify-between gap-3 border-t border-border pt-6 text-sm text-muted">
          <span>{footer.rights(new Date().getFullYear())}</span>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2">
              <LockIcon className="size-[1.25em]" />
              {footer.securePayment}
            </span>
            <PaymentCards label={footer.acceptedCards} />
          </div>
        </div>
      </div>
    </footer>
  );
}
