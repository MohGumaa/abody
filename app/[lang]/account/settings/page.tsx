import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  OtherSessionsForm,
  PasswordForm,
  ProfileForm,
} from "@/components/account/SettingsForms";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getDictionary();
  return { title: settings.title, robots: { index: false, follow: false } };
}

const PANEL =
  "grid gap-5 rounded-panel bg-panel p-5 shadow-soft min-[600px]:p-6 min-[960px]:p-8";

export default async function AccountSettingsPage() {
  const locale = await getLocale();
  const next = localizedPath(locale, "/account/settings");
  const loginHref = `${localizedPath(locale, "/login")}?${new URLSearchParams({ next })}`;
  const user = await getCurrentUser();
  if (!user) redirect(loginHref);
  const { settings: text } = await getDictionary();
  const formProps = { text, loginHref };

  return (
    <div className="flex-1 font-sans">
      <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 pt-6 pb-16">
        <div className="grid gap-2">
          <Link
            href={localizedPath(locale, "/account")}
            className="justify-self-start text-sm font-medium text-muted underline-offset-4 outline-offset-2 hover:text-primary-strong hover:underline focus-visible:outline-2 focus-visible:outline-primary-strong"
          >
            {text.back}
          </Link>
          <h1 className="text-3xl font-semibold">{text.heading}</h1>
          <p className="text-muted">{text.intro}</p>
        </div>

        <section aria-labelledby="profile-heading" className={PANEL}>
          <h2 id="profile-heading" className="text-xl font-semibold">
            {text.profile.heading}
          </h2>
          <ProfileForm {...formProps} name={user.name} email={user.email} />
        </section>

        <section aria-labelledby="password-heading" className={PANEL}>
          <h2 id="password-heading" className="text-xl font-semibold">
            {text.password.heading}
          </h2>
          <PasswordForm {...formProps} />
        </section>

        <section aria-labelledby="sessions-heading" className={PANEL}>
          <div className="grid gap-2">
            <h2 id="sessions-heading" className="text-xl font-semibold">
              {text.sessions.heading}
            </h2>
            <p className="text-sm text-muted">{text.sessions.intro}</p>
          </div>
          <OtherSessionsForm {...formProps} locale={locale} />
        </section>
      </main>
    </div>
  );
}
