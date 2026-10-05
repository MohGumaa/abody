import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CartIcon, CheckIcon, ClockIcon } from "@/components/icons";
import { localizedName } from "@/lib/catalog";
import { checkoutState, isCheckoutSessionId } from "@/lib/checkout";
import { listOrderDownloads } from "@/lib/downloads";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { formatPriceCents } from "@/lib/money";
import { formatOrderNumber } from "@/lib/orders";
import { getStripe, isMissingResource } from "@/lib/stripe";

const PRIMARY_LINK =
  "inline-flex h-13 items-center rounded-card bg-primary-strong px-6 font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong";
const SECONDARY_LINK =
  "inline-flex h-13 items-center rounded-card border border-border px-6 font-semibold text-primary-strong outline-offset-2 hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary-strong";
const DOWNLOAD_LINK =
  "inline-flex h-10 items-center rounded-card bg-primary-strong px-4 font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong";

// One Stripe call per request, shared by generateMetadata and the page. An
// invalid or unknown id is a 404; any other Stripe failure reaches error.tsx.
const loadSession = cache(async (sessionId: unknown) => {
  if (!isCheckoutSessionId(sessionId)) notFound();
  try {
    return await getStripe().checkout.sessions.retrieve(sessionId);
  } catch (error) {
    if (isMissingResource(error)) notFound();
    throw error;
  }
});

export async function generateMetadata({
  searchParams,
}: PageProps<"/[lang]/success">): Promise<Metadata> {
  const session = await loadSession((await searchParams).session_id);
  const { checkoutResult } = await getDictionary();
  return {
    title: checkoutResult[checkoutState(session)].title,
    // Per-session page: never indexed, no canonical.
    robots: { index: false, follow: false },
  };
}

export default async function SuccessPage({
  searchParams,
}: PageProps<"/[lang]/success">) {
  const session = await loadSession((await searchParams).session_id);
  const locale = await getLocale();
  const { checkoutResult: text } = await getDictionary();
  const state = checkoutState(session);
  // Only the amount is shown: no email, name, or other customer details.
  const total =
    state === "paid" &&
    session.currency === "usd" &&
    session.amount_total !== null
      ? formatPriceCents(session.amount_total)
      : null;
  // The webhook creates the order; until it arrives the page says it is
  // still being confirmed.
  const order = state === "paid" ? await listOrderDownloads(session.id) : null;
  const orderNumber = order?.number ?? null;
  const downloads = order?.downloads ?? [];
  const body =
    state === "paid" && orderNumber !== null
      ? text.paid.confirmedBody
      : text[state].body;

  return (
    <div className="flex-1 font-sans">
      <main className="mx-auto grid w-full max-w-site px-4 pt-6 pb-16">
        <section className="grid justify-items-center gap-4 rounded-panel bg-panel px-5 py-16 text-center shadow-soft">
          <span className="grid h-18 w-18 place-items-center rounded-full bg-primary-soft text-primary-strong">
            {state === "paid" ? (
              <CheckIcon className="h-8 w-8" />
            ) : state === "processing" ? (
              <ClockIcon className="h-8 w-8" />
            ) : (
              <CartIcon className="h-8 w-8" />
            )}
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">
            {text[state].title}
          </h1>
          <p className="max-w-[48ch] text-muted">{body}</p>
          {state === "paid" && order === null && (
            <p className="max-w-[48ch] text-muted">{text.downloads.pending}</p>
          )}
          {total && (
            <p className="text-lg">
              {text.total}: <strong className="font-semibold">{total}</strong>
            </p>
          )}
          {orderNumber !== null && (
            <p className="text-lg">
              {text.orderNumber}:{" "}
              <strong className="font-semibold" dir="ltr">
                {formatOrderNumber(orderNumber)}
              </strong>
            </p>
          )}
          {downloads.length > 0 && (
            <section className="mt-2 grid w-full max-w-xl gap-3 text-start">
              <h2 className="text-lg font-semibold">{text.downloads.title}</h2>
              <ul className="grid gap-2">
                {downloads.map((item) => {
                  const name = localizedName(item, locale);
                  const query = new URLSearchParams({ session_id: session.id });
                  return (
                    <li
                      key={item.itemId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border px-4 py-3"
                    >
                      <span className="min-w-0 font-medium wrap-break-word" dir="auto">
                        {name}
                      </span>
                      <a
                        href={`/api/downloads/${encodeURIComponent(item.itemId)}?${query}`}
                        download
                        className={DOWNLOAD_LINK}
                      >
                        {text.downloads.download}
                        <span className="sr-only">
                          {": "}
                          <span dir="auto">{name}</span>
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
              <p className="text-sm text-muted">{text.downloads.keepLink}</p>
            </section>
          )}
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {state === "not_completed" ? (
              <Link href={localizedPath(locale, "/cart")} className={PRIMARY_LINK}>
                {text.backToCart}
              </Link>
            ) : (
              <>
                <Link
                  href={localizedPath(locale, "/products")}
                  className={PRIMARY_LINK}
                >
                  {text.keepShopping}
                </Link>
                <Link
                  href={localizedPath(locale, "/services")}
                  className={SECONDARY_LINK}
                >
                  {text.viewServices}
                </Link>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
