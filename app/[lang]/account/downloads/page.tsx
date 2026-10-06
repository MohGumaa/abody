import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ACCOUNT_PANEL,
  DownloadList,
  EmptyState,
  PageHead,
} from "@/components/account/AccountParts";
import { listAccountDownloads } from "@/lib/account";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const { account } = await getDictionary();
  return { title: account.downloads.title, robots: { index: false, follow: false } };
}

export default async function AccountDownloadsPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    const next = localizedPath(locale, "/account/downloads");
    redirect(`${localizedPath(locale, "/login")}?${new URLSearchParams({ next })}`);
  }
  const { account: text } = await getDictionary();
  const downloads = await listAccountDownloads(user.id);

  return (
    <>
      <PageHead title={text.downloads.title} intro={text.downloads.intro} />
      <section className={ACCOUNT_PANEL}>
        {downloads.length === 0 ? (
          <EmptyState
            message={text.downloads.empty}
            action={{ href: localizedPath(locale, "/products"), label: text.browseProducts }}
          />
        ) : (
          <DownloadList downloads={downloads} locale={locale} text={text} />
        )}
      </section>
    </>
  );
}
