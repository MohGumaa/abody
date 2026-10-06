import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/actions/auth";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const { account } = await getDictionary();
  return { title: account.title, robots: { index: false, follow: false } };
}

// Feature 9 replaces this body with the customer dashboard.
export default async function AccountPage() {
  const locale = await getLocale();
  // The real check: the header link only looks at whether a cookie exists.
  const user = await getCurrentUser();
  if (!user) {
    const next = localizedPath(locale, "/account");
    redirect(`${localizedPath(locale, "/login")}?${new URLSearchParams({ next })}`);
  }
  const { account: text } = await getDictionary();

  return (
    <div className="flex-1 font-sans">
      <main className="mx-auto grid w-full max-w-site gap-6 px-4 pt-6 pb-16">
        <section className="grid gap-6 rounded-panel bg-panel p-5 shadow-soft min-[600px]:p-6 min-[960px]:p-10">
          <div>
            <h1 className="text-3xl font-semibold">{text.heading}</h1>
            <p className="mt-2 text-muted">{text.intro}</p>
          </div>
          <dl className="grid gap-4 text-sm min-[600px]:grid-cols-[max-content_1fr] min-[600px]:gap-x-8">
            <dt className="font-medium text-muted">{text.name}</dt>
            <dd className="font-semibold break-words">{user.name}</dd>
            <dt className="font-medium text-muted">{text.email}</dt>
            <dd dir="ltr" className="font-semibold break-all rtl:text-right">
              {user.email}
            </dd>
          </dl>
          <Link
            href={localizedPath(locale, "/account/settings")}
            className="justify-self-start font-semibold text-primary-strong underline-offset-4 outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary-strong"
          >
            {text.settings}
          </Link>
          <form action={signOut}>
            <input type="hidden" name="lang" value={locale} />
            <button
              type="submit"
              className="h-11 rounded-control border border-border bg-surface px-5 text-sm font-semibold text-foreground outline-offset-2 hover:border-primary hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-primary-strong"
            >
              {text.signOut}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
