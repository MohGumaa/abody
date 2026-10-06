import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHead } from "@/components/account/AccountParts";
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

// Rendered inside the account layout, which supplies main and the side nav.
export default async function AccountSettingsPage() {
  const locale = await getLocale();
  const next = localizedPath(locale, "/account/settings");
  const loginHref = `${localizedPath(locale, "/login")}?${new URLSearchParams({ next })}`;
  const user = await getCurrentUser();
  if (!user) redirect(loginHref);
  const { settings: text } = await getDictionary();
  const formProps = { text, loginHref };

  return (
    <>
      <PageHead title={text.heading} intro={text.intro} />

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
    </>
  );
}
