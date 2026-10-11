import type { Metadata } from "next";
import { MailIcon } from "@/components/icons";
import { InfoPage, infoMetadata } from "@/components/info/InfoPage";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getSiteContent } from "@/lib/site-content";

export function generateMetadata(): Promise<Metadata> {
  return infoMetadata("contact");
}

export default async function ContactPage() {
  const { info } = await getDictionary();
  // Admin-set in /admin/settings (feature 21c); null when none is saved or the
  // read fails.
  const contactEmail = (await getSiteContent())?.contactEmail;

  return (
    <InfoPage page="contact">
      {contactEmail ? (
        <p className="mt-6 flex flex-wrap items-center gap-2">
          <MailIcon className="size-[1.25em] text-primary-strong" />
          <span className="text-muted">{info.contact.emailLabel}</span>
          {/* Validated on save; React text, so it never renders as HTML. */}
          <a
            href={`mailto:${contactEmail}`}
            dir="ltr"
            className="rounded-control font-semibold text-primary-strong outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary-strong"
          >
            {contactEmail}
          </a>
        </p>
      ) : (
        <p className="mt-6 text-muted">{info.contact.unavailable}</p>
      )}
    </InfoPage>
  );
}
