import Link from "next/link";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { getSiteContent } from "@/lib/site-content";
import { resolveAnnouncement } from "@/lib/site-content-rules";

// The admin's site-wide announcement (feature 21b), above the header on every
// customer page. Renders nothing while the bar is off.
export async function AnnouncementBar() {
  const locale = await getLocale();
  const announcement = resolveAnnouncement(await getSiteContent(), locale);
  if (!announcement) return null;
  const { announcement: text } = await getDictionary();

  return (
    <aside
      aria-label={text.label}
      className="bg-primary-strong px-4 py-2.5 text-center font-sans text-sm font-medium text-white"
    >
      {announcement.href ? (
        <Link
          href={announcement.href}
          className="rounded-control underline underline-offset-2 outline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-white"
        >
          {announcement.text}
        </Link>
      ) : (
        <p>{announcement.text}</p>
      )}
    </aside>
  );
}
