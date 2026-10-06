import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ACCOUNT_PANEL,
  EmptyState,
  OrderNumber,
  PageHead,
  StatusChip,
} from "@/components/account/AccountParts";
import { listAccountServices } from "@/lib/account";
import { localizedName } from "@/lib/catalog";
import { formatDate } from "@/lib/dates";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const { account } = await getDictionary();
  return { title: account.services.title, robots: { index: false, follow: false } };
}

// Purchased service items only. Onboarding and service progress arrive with
// features 10 and 11.
export default async function AccountServicesPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    const next = localizedPath(locale, "/account/services");
    redirect(`${localizedPath(locale, "/login")}?${new URLSearchParams({ next })}`);
  }
  const { account: text } = await getDictionary();
  const services = await listAccountServices(user.id);

  return (
    <>
      <PageHead title={text.services.title} intro={text.services.intro} />
      <section className={ACCOUNT_PANEL}>
        {services.length === 0 ? (
          <EmptyState
            message={text.services.empty}
            action={{ href: localizedPath(locale, "/services"), label: text.browseServices }}
          />
        ) : (
          <ul className="grid gap-4">
            {services.map((service) => (
              <li
                key={service.itemId}
                className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border p-4"
              >
                <div className="grid min-w-0 flex-1 gap-1">
                  <strong className="font-semibold wrap-break-word" dir="auto">
                    {localizedName(service, locale)}
                  </strong>
                  <span className="text-sm text-muted">
                    {text.purchased.replace(
                      "{date}",
                      formatDate(service.purchasedAt, locale),
                    )}
                    {" · "}
                    {text.orderLabel} <OrderNumber number={service.orderNumber} />
                  </span>
                </div>
                <StatusChip status={service.orderStatus} text={text} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
