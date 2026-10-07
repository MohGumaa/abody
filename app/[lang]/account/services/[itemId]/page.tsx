import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ACCOUNT_PANEL,
  OrderNumber,
  SectionHead,
  ServiceStatusChip,
  TEXT_LINK,
} from "@/components/account/AccountParts";
import { ServiceProgress } from "@/components/account/ServiceProgress";
import { ChevronIcon } from "@/components/icons";
import { OnboardingAnswers } from "@/components/onboarding/OnboardingAnswers";
import { findAccountService } from "@/lib/account";
import { localizedName } from "@/lib/catalog";
import { formatDate } from "@/lib/dates";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { canEditOnboarding, readRequirements } from "@/lib/onboarding";
import { serviceProgress } from "@/lib/service-progress";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const { account } = await getDictionary();
  return { title: account.service.title, robots: { index: false, follow: false } };
}

// One purchased service's progress and the details the customer sent. Only
// the signed-in owner of the order can open it.
export default async function AccountServicePage({
  params,
}: PageProps<"/[lang]/account/services/[itemId]">) {
  const { itemId } = await params;
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    const next = localizedPath(
      locale,
      `/account/services/${encodeURIComponent(itemId)}`,
    );
    redirect(`${localizedPath(locale, "/login")}?${new URLSearchParams({ next })}`);
  }
  const item = await findAccountService(user.id, itemId);
  if (!item) notFound();

  const saved = item.service ? readRequirements(item.service.requirements) : null;
  if (item.service && !saved) {
    throw new Error(`Service for order item ${item.itemId} has malformed requirements`);
  }
  const progress = serviceProgress(item);
  const editable = canEditOnboarding(progress.status);
  const { account, onboarding } = await getDictionary();
  const text = account.service;
  const onboardingHref = localizedPath(
    locale,
    `/onboarding/${encodeURIComponent(item.itemId)}`,
  );

  return (
    <>
      <div className="grid gap-3">
        <Link
          href={localizedPath(locale, "/account/services")}
          className={`inline-flex items-center gap-2 justify-self-start text-sm ${TEXT_LINK}`}
        >
          <ChevronIcon className="h-3 w-3 -scale-x-100 rtl:scale-x-100" />
          {text.back}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1
            dir="auto"
            className="text-2xl font-semibold tracking-tight wrap-break-word"
          >
            {localizedName(item, locale)}
          </h1>
          <ServiceStatusChip status={progress.status} text={account} />
        </div>
        <p className="text-sm text-muted">
          {account.purchased.replace("{date}", formatDate(item.purchasedAt, locale))}
          {" · "}
          {account.orderLabel} <OrderNumber number={item.orderNumber} />
        </p>
      </div>

      <section aria-labelledby="service-progress" className={ACCOUNT_PANEL}>
        <SectionHead id="service-progress" title={text.progress} />
        <div className="grid gap-2">
          <p>{text.messages[progress.status ?? "none"]}</p>
          <p className="text-sm text-muted">
            {text.lastUpdated.replace(
              "{date}",
              formatDate(progress.lastUpdated, locale),
            )}
          </p>
        </div>
        <ServiceProgress steps={progress.steps} locale={locale} text={text} />
      </section>

      <section aria-labelledby="service-details" className={ACCOUNT_PANEL}>
        <SectionHead
          id="service-details"
          title={text.details}
          link={
            editable
              ? {
                  href: onboardingHref,
                  label: item.service ? onboarding.edit : onboarding.add,
                }
              : undefined
          }
        />
        {saved ? (
          <OnboardingAnswers answers={saved} text={onboarding} />
        ) : (
          <p className="text-muted">{text.noDetails}</p>
        )}
      </section>
    </>
  );
}
