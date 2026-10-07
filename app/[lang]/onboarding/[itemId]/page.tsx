import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OrderNumber } from "@/components/account/AccountParts";
import { OnboardingAnswers } from "@/components/onboarding/OnboardingAnswers";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import { localizedName } from "@/lib/catalog";
import { isCheckoutSessionId } from "@/lib/checkout";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { canEditOnboarding, readRequirements } from "@/lib/onboarding";
import { findOnboardingItem } from "@/lib/services";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const { onboarding } = await getDictionary();
  // Per-purchase page: never indexed, no canonical.
  return { title: onboarding.title, robots: { index: false, follow: false } };
}

const PANEL =
  "grid gap-6 rounded-panel bg-panel p-5 shadow-soft min-[600px]:p-6 min-[960px]:p-8";

// The onboarding form for one purchased service item. The signed-in owner of
// the order, or anyone holding its checkout session id (the success page
// link), can open it.
export default async function OnboardingPage({
  params,
  searchParams,
}: PageProps<"/[lang]/onboarding/[itemId]">) {
  const { itemId } = await params;
  const rawSessionId = (await searchParams).session_id;
  const sessionId = isCheckoutSessionId(rawSessionId) ? rawSessionId : null;
  const locale = await getLocale();
  const next = localizedPath(locale, `/onboarding/${encodeURIComponent(itemId)}`);
  const loginHref = `${localizedPath(locale, "/login")}?${new URLSearchParams({ next })}`;

  const user = await getCurrentUser();
  if (!user && rawSessionId === undefined) redirect(loginHref);
  const item = await findOnboardingItem(itemId, {
    userId: user?.id ?? null,
    sessionId,
  });
  if (!item) notFound();

  const saved = item.service ? readRequirements(item.service.requirements) : null;
  if (item.service && !saved) {
    throw new Error(`Service for order item ${item.itemId} has malformed requirements`);
  }
  const editable = canEditOnboarding(item.service?.status ?? null);
  const { onboarding: text } = await getDictionary();

  return (
    <div className="flex-1 font-sans">
      <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 pt-6 pb-16">
        <div className="grid gap-2">
          <p className="text-sm text-muted">
            <span dir="auto" className="font-semibold text-foreground">
              {localizedName(item, locale)}
            </span>
            {" · "}
            {text.orderLabel} <OrderNumber number={item.orderNumber} />
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{text.heading}</h1>
          <p className="text-muted">{text.intro}</p>
        </div>
        <section className={PANEL}>
          {editable ? (
            <OnboardingForm
              text={text}
              itemId={item.itemId}
              sessionId={sessionId}
              saved={saved}
              loginHref={loginHref}
            />
          ) : (
            <>
              <p className="rounded-control bg-surface px-4 py-3 text-sm">
                {text.locked}
              </p>
              <OnboardingAnswers answers={saved} text={text} />
            </>
          )}
        </section>
      </main>
    </div>
  );
}
