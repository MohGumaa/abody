import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ACCOUNT_PANEL,
  EmptyState,
  OrderNumber,
  PageHead,
  StatusChip,
} from "@/components/account/AccountParts";
import { listAccountOrders } from "@/lib/account";
import { localizedName } from "@/lib/catalog";
import { formatDate } from "@/lib/dates";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { formatPriceCents } from "@/lib/money";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const { account } = await getDictionary();
  return { title: account.orders.title, robots: { index: false, follow: false } };
}

export default async function AccountOrdersPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    const next = localizedPath(locale, "/account/orders");
    redirect(`${localizedPath(locale, "/login")}?${new URLSearchParams({ next })}`);
  }
  const { account: text } = await getDictionary();
  const orders = await listAccountOrders(user.id);
  // Only the price is left-to-right, not the words around it.
  const [eachBefore, eachAfter = ""] = text.orders.each.split("{price}");

  return (
    <>
      <PageHead title={text.orders.title} intro={text.orders.intro} />
      {orders.length === 0 ? (
        <section className={ACCOUNT_PANEL}>
          <EmptyState
            message={text.orders.empty}
            action={{ href: localizedPath(locale, "/products"), label: text.browseProducts }}
          />
        </section>
      ) : (
        <ul className="grid gap-6">
          {orders.map((order) => (
            <li key={order.id}>
              <article
                aria-labelledby={`order-${order.id}`}
                className={ACCOUNT_PANEL}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <h2 id={`order-${order.id}`} className="text-lg font-semibold">
                      {text.orderLabel} <OrderNumber number={order.number} />
                    </h2>
                    <p className="text-sm text-muted">
                      {formatDate(order.createdAt, locale)}
                    </p>
                  </div>
                  <StatusChip status={order.status} text={text} />
                </div>
                <ul className="grid">
                  {order.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border py-4 text-sm"
                    >
                      <span className="min-w-0 font-medium wrap-break-word" dir="auto">
                        {localizedName(item, locale)}
                      </span>
                      <span className="text-muted">
                        {text.orders.quantity.replace("{count}", String(item.quantity))}
                        {" · "}
                        {eachBefore}
                        <span dir="ltr">{formatPriceCents(item.priceCents)}</span>
                        {eachAfter}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="flex justify-between gap-4 border-t border-border pt-4">
                  <span className="font-semibold">{text.columns.total}</span>
                  <strong dir="ltr" className="font-semibold">
                    {formatPriceCents(order.totalCents)}
                  </strong>
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
