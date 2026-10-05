import Image from "next/image";
import Link from "next/link";
import { AuthForm, type AuthMode } from "@/components/auth/AuthForm";
import {
  ChevronIcon,
  DownloadIcon,
  MegaphoneIcon,
  ShieldIcon,
} from "@/components/icons";
import { localizedPath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

interface AuthPanelProps {
  mode: AuthMode;
  locale: Locale;
  next: string;
  text: Dictionary["auth"];
}

const TAB =
  "rounded-full border px-4 py-2 text-sm font-medium outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary-strong";

// The sign-in and register pages share this panel; the tabs are links, so
// each mode has its own URL and works without JavaScript.
export function AuthPanel({ mode, locale, next, text }: AuthPanelProps) {
  const isRegister = mode === "register";
  // Only a non-default next is carried, so plain links stay clean.
  const query =
    next === localizedPath(locale, "/account")
      ? ""
      : `?${new URLSearchParams({ next }).toString()}`;
  const tabs = [
    { mode: "signIn", href: `${localizedPath(locale, "/login")}${query}`, label: text.signInTab },
    { mode: "register", href: `${localizedPath(locale, "/register")}${query}`, label: text.registerTab },
  ] as const;
  const other = isRegister ? tabs[0] : tabs[1];
  const artCards = [
    { icon: DownloadIcon, ...text.artCards.downloads },
    { icon: MegaphoneIcon, ...text.artCards.services },
    { icon: ShieldIcon, ...text.artCards.protected },
  ];

  return (
    <main className="mx-auto grid w-full max-w-site gap-6 px-4 pt-6 pb-16 font-sans">
      <nav
        aria-label={text.breadcrumb}
        className="flex flex-wrap items-center gap-2 rounded-panel bg-panel px-5 py-4 text-sm text-muted shadow-soft min-[600px]:px-6 min-[960px]:px-10"
      >
        <Link
          href={localizedPath(locale, "/")}
          className="rounded-control outline-offset-2 hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-primary-strong"
        >
          {text.home}
        </Link>
        <ChevronIcon className="h-3 w-3 text-faint rtl:-scale-x-100" />
        <span aria-current="page" className="font-semibold text-foreground">
          {isRegister ? text.registerTab : text.signInTab}
        </span>
      </nav>

      <section className="grid gap-4 rounded-panel bg-panel p-4 shadow-soft min-[860px]:grid-cols-2">
        <div className="relative isolate hidden min-h-140 flex-col justify-between gap-10 overflow-hidden rounded-card bg-ink p-10 text-white min-[860px]:flex">
          {/* Decorative: the heading beside it says what the page is for.
              Unsplash photo-1563013544-824ae1b704d3 (Unsplash License). */}
          <Image
            src="/auth/shopping-online.jpg"
            alt=""
            fill
            sizes="(min-width: 1200px) 580px, 50vw"
            className="-z-20 object-cover object-[70%_center]"
          />
          {/* Darkens the photo so white text keeps its contrast. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-linear-to-b from-ink/85 via-ink/45 to-ink/85"
          />
          <div>
            <h2 className="text-2xl font-semibold">{text.artTitle}</h2>
            <p className="mt-3 max-w-[36ch] text-white/90">{text.artBody}</p>
          </div>
          <ul aria-hidden="true" className="grid max-w-75 gap-3">
            {artCards.map(({ icon: Icon, title, body }, index) => (
              <li
                key={title}
                className={`flex items-center gap-3 rounded-card bg-surface px-4 py-3 text-sm text-foreground shadow-raised ${
                  index === 1 ? "ms-8 -me-8" : ""
                }`}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-strong">
                  <Icon />
                </span>
                <span>
                  <strong className="block">{title}</strong>
                  <span className="block text-xs text-muted">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto grid w-full max-w-105 content-center gap-6 px-4 py-8">
          <nav aria-label={text.tabs} className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const current = tab.mode === mode;
              return (
                <Link
                  key={tab.mode}
                  href={tab.href}
                  aria-current={current ? "page" : undefined}
                  className={`${TAB} ${
                    current
                      ? "border-primary-strong bg-primary-strong text-white"
                      : "border-border bg-surface text-muted hover:border-primary hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
          <div>
            <h1 className="text-3xl font-semibold">
              {isRegister ? text.registerHeading : text.signInHeading}
            </h1>
            <p className="mt-2 text-muted">
              {isRegister ? text.registerIntro : text.signInIntro}
            </p>
          </div>
          <AuthForm
            mode={mode}
            locale={locale}
            next={next}
            text={{
              name: text.name,
              email: text.email,
              password: text.password,
              passwordHint: text.passwordHint,
              confirm: text.confirm,
              showPassword: text.showPassword,
              hidePassword: text.hidePassword,
              submit: isRegister ? text.submitRegister : text.submitSignIn,
              pending: isRegister ? text.registering : text.signingIn,
              errors: text.errors,
              fieldErrors: text.fieldErrors,
            }}
          />
          <p className="text-sm text-muted">
            {isRegister ? text.toSignIn : text.toRegister}{" "}
            <Link
              href={other.href}
              className="rounded-control font-semibold text-primary-strong underline-offset-2 outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary-strong"
            >
              {isRegister ? text.toSignInLink : text.toRegisterLink}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
