"use client";

import { useParams } from "next/navigation";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { ERROR_MESSAGES } from "@/lib/i18n/error-messages";

interface ErrorScreenProps {
  error: Error & { digest?: string };
  retry: () => void;
}

// Never renders the error itself: server details must not reach the page.
export default function ErrorScreen({ retry }: ErrorScreenProps) {
  const { lang } = useParams<{ lang: string }>();
  const messages = ERROR_MESSAGES[isLocale(lang) ? lang : DEFAULT_LOCALE];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center font-sans">
      <h1 className="text-2xl font-semibold">{messages.title}</h1>
      <p className="mt-2 text-muted">{messages.body}</p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-6 rounded-full bg-primary-strong px-6 py-3 font-semibold text-white outline-offset-2 hover:bg-primary focus-visible:outline-2 focus-visible:outline-primary-strong"
      >
        {messages.retry}
      </button>
    </main>
  );
}
