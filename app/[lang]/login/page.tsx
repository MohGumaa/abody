import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { safeNextPath } from "@/lib/auth";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const { auth } = await getDictionary();
  return { title: auth.signInTitle, robots: { index: false, follow: true } };
}

export default async function LoginPage({
  searchParams,
}: PageProps<"/[lang]/login">) {
  const locale = await getLocale();
  const next = safeNextPath((await searchParams).next, locale);
  if (await getCurrentUser()) redirect(next);
  const { auth } = await getDictionary();

  return (
    <div className="flex-1">
      <AuthPanel mode="signIn" locale={locale} next={next} text={auth} />
    </div>
  );
}
