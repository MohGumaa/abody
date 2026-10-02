import Link from "next/link";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";

export default async function NotFound() {
  const locale = await getLocale();
  const { notFound } = await getDictionary();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center font-sans">
      <h1 className="text-2xl font-semibold">{notFound.title}</h1>
      <p className="mt-2 text-muted">{notFound.body}</p>
      <Link
        href={localizedPath(locale, "/")}
        className="mt-6 rounded-full bg-primary-strong px-6 py-3 font-semibold text-white outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary-strong"
      >
        {notFound.home}
      </Link>
    </main>
  );
}
