import type { Locale } from "@/lib/i18n/config";

// Kept apart from the dictionaries: the error screen is a client component and
// should ship only these strings.
export const ERROR_MESSAGES: Record<
  Locale,
  { title: string; body: string; retry: string }
> = {
  en: {
    title: "Something went wrong.",
    body: "Please try again.",
    retry: "Try again",
  },
  ar: {
    title: "حدث خطأ ما.",
    body: "يرجى المحاولة مرة أخرى.",
    retry: "حاول مرة أخرى",
  },
};
