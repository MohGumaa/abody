import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, TEXT_LINK } from "@/components/auth/AuthPanel";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { isResetTokenUsable } from "@/lib/password-reset-tokens";

export async function generateMetadata(): Promise<Metadata> {
  const { auth } = await getDictionary();
  return { title: auth.resetTitle, robots: { index: false, follow: false } };
}

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/[lang]/reset-password">) {
  const locale = await getLocale();
  const { auth } = await getDictionary();
  const { token } = await searchParams;
  const usable = await isResetTokenUsable(token);

  return (
    <div className="flex-1">
      <AuthShell locale={locale} text={auth} current={auth.resetTitle}>
        {usable && typeof token === "string" ? (
          <>
            <div>
              <h1 className="text-3xl font-semibold">{auth.resetHeading}</h1>
              <p className="mt-2 text-muted">{auth.resetIntro}</p>
            </div>
            <ResetPasswordForm
              locale={locale}
              token={token}
              text={{
                password: auth.newPassword,
                passwordHint: auth.passwordHint,
                confirm: auth.confirm,
                showPassword: auth.showPassword,
                hidePassword: auth.hidePassword,
                submit: auth.submitReset,
                pending: auth.resetting,
                errors: auth.errors,
                fieldErrors: auth.fieldErrors,
              }}
            />
          </>
        ) : (
          <div>
            <h1 className="text-3xl font-semibold">{auth.invalidLinkHeading}</h1>
            <p className="mt-2 text-muted">{auth.invalidLinkBody}</p>
            <p className="mt-6">
              <Link href={localizedPath(locale, "/forgot-password")} className={TEXT_LINK}>
                {auth.requestNewLink}
              </Link>
            </p>
          </div>
        )}
        <p className="text-sm">
          <Link href={localizedPath(locale, "/login")} className={TEXT_LINK}>
            {auth.backToSignIn}
          </Link>
        </p>
      </AuthShell>
    </div>
  );
}
