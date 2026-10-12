import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, TEXT_LINK } from "@/components/auth/AuthPanel";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const { auth } = await getDictionary();
  return { title: auth.forgotTitle, robots: { index: false, follow: true } };
}

export default async function ForgotPasswordPage() {
  const locale = await getLocale();
  const { auth } = await getDictionary();

  return (
    <div className="flex-1">
      <AuthShell locale={locale} text={auth} current={auth.forgotTitle}>
        <div>
          <h1 className="text-3xl font-semibold">{auth.forgotHeading}</h1>
          <p className="mt-2 text-muted">{auth.forgotIntro}</p>
        </div>
        <ForgotPasswordForm
          locale={locale}
          text={{
            email: auth.email,
            submit: auth.submitForgot,
            pending: auth.sendingForgot,
            sent: auth.forgotSent,
            errors: auth.errors,
            fieldErrors: auth.fieldErrors,
          }}
        />
        <p className="text-sm">
          <Link href={localizedPath(locale, "/login")} className={TEXT_LINK}>
            {auth.backToSignIn}
          </Link>
        </p>
      </AuthShell>
    </div>
  );
}
