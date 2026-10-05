import type { ReactNode } from "react";
import Link from "next/link";
import { AddToCartButton } from "@/components/catalog/AddToCartButton";
import { ProductCover } from "@/components/catalog/ProductCover";
import { RelatedProducts } from "@/components/catalog/RelatedProducts";
import {
  BoltIcon,
  ChartIcon,
  CheckIcon,
  ChevronIcon,
  ClockIcon,
  DownloadIcon,
  LockIcon,
} from "@/components/icons";
import {
  checklistLines,
  formatDurationDays,
  type PublicProduct,
} from "@/lib/catalog";
import { ProductType } from "@/lib/generated/prisma/enums";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { formatPriceCents } from "@/lib/money";

const PANEL = "rounded-panel bg-panel shadow-soft";
const CHIP =
  "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap";

interface ProductDetailProps {
  product: PublicProduct;
}

function Checklist({ lines }: { lines: string[] }) {
  return (
    <ul className="grid gap-4">
      {lines.map((line, index) => (
        <li key={index} className="flex gap-3">
          <CheckIcon className="mt-1 size-5 text-primary" />
          <span dir="auto" className="min-w-0 break-words">
            {line}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{term}</dt>
      <dd className="text-end font-semibold">{children}</dd>
    </div>
  );
}

// A field with no Arabic content falls back to English, so stored content
// carries dir="auto" to keep its own alignment and punctuation on Arabic pages.
export async function ProductDetail({ product }: ProductDetailProps) {
  const locale = await getLocale();
  const dictionary = await getDictionary();
  const { product: text, cart } = dictionary;
  const isService = product.type === ProductType.SERVICE;
  const included = checklistLines(product.included.join("\n"));
  const requirements = isService ? checklistLines(product.requirements) : [];
  const duration =
    isService && product.durationDays && product.durationDays > 0
      ? formatDurationDays(product.durationDays, locale)
      : null;
  const listing = isService
    ? { path: "/services", label: dictionary.header.services }
    : { path: "/products", label: dictionary.header.products };

  return (
    <div className="flex-1 font-sans">
      <main className="mx-auto grid w-full max-w-site gap-6 px-4 pt-6 pb-16">
        <nav
          aria-label={cart.breadcrumb}
          className={`flex flex-wrap items-center gap-2 px-5 py-4 text-sm text-muted min-[600px]:px-6 min-[960px]:px-10 ${PANEL}`}
        >
          <Link
            href={localizedPath(locale, "/")}
            className="rounded-control outline-offset-2 hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-primary-strong"
          >
            {dictionary.header.home}
          </Link>
          <ChevronIcon className="h-3 w-3 text-faint rtl:-scale-x-100" />
          <Link
            href={localizedPath(locale, listing.path)}
            className="rounded-control outline-offset-2 hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-primary-strong"
          >
            {listing.label}
          </Link>
          <ChevronIcon className="h-3 w-3 text-faint rtl:-scale-x-100" />
          <span
            aria-current="page"
            dir="auto"
            className="min-w-0 font-semibold break-words text-foreground"
          >
            {product.name}
          </span>
        </nav>

        <section
          className={`grid items-start gap-10 p-5 min-[600px]:p-6 min-[720px]:grid-cols-2 min-[960px]:p-10 min-[1100px]:grid-cols-[minmax(0,1.05fr)_minmax(0,1.2fr)_320px] ${PANEL}`}
        >
          <ProductCover
            product={product}
            locale={locale}
            index={0}
            alt={product.name}
          />

          <div className="grid min-w-0 gap-6">
            <div>
              <p className="text-xs font-semibold tracking-[0.06em] text-primary-strong uppercase rtl:tracking-normal">
                {text.typeLabels[product.type]}
                {" · "}
                <span dir="auto">{product.categoryLabel}</span>
              </p>
              <h1
                dir="auto"
                className="mt-2 text-3xl font-semibold tracking-tight break-words rtl:tracking-normal"
              >
                {product.name}
              </h1>
            </div>
            <p dir="auto" className="text-lg break-words text-muted">
              {product.shortDescription}
            </p>
            <div className="flex flex-wrap gap-2">
              {isService ? (
                <>
                  {duration && (
                    <span className={`${CHIP} bg-primary-soft text-primary-strong`}>
                      <ClockIcon className="size-[1.25em]" />
                      {duration}
                    </span>
                  )}
                  <span className={`${CHIP} bg-surface text-muted`}>
                    <ChartIcon className="size-[1.25em]" />
                    {text.statusUpdates}
                  </span>
                </>
              ) : (
                <>
                  <span className={`${CHIP} bg-success-soft text-success`}>
                    <BoltIcon className="size-[1.25em]" />
                    {text.instantDownload}
                  </span>
                  <span className={`${CHIP} bg-surface text-muted`}>
                    <DownloadIcon className="size-[1.25em]" />
                    {text.keptInAccount}
                  </span>
                </>
              )}
            </div>
            {included.length > 0 && (
              <div>
                <h2 className="mb-4 text-base font-semibold">{text.included}</h2>
                <Checklist lines={included} />
              </div>
            )}
          </div>

          <aside
            aria-label={text.purchase}
            className="grid gap-5 rounded-panel border border-border bg-surface p-6 min-[720px]:col-span-full min-[1100px]:col-span-1"
          >
            <div>
              <p className="text-xs font-semibold tracking-[0.06em] text-muted uppercase rtl:tracking-normal">
                {text.price}
              </p>
              <p className="text-3xl leading-tight font-bold tracking-tight">
                {formatPriceCents(product.priceCents)}
                {duration && (
                  <small className="ms-1 text-sm font-medium tracking-normal text-muted">
                    / {duration}
                  </small>
                )}
              </p>
            </div>
            <AddToCartButton
              productId={product.id}
              cartHref={localizedPath(locale, "/cart")}
              text={{
                addToCart: text.addToCart,
                adding: text.adding,
                added: text.added,
                alreadyInCart: text.alreadyInCart,
                maxQuantity: text.maxQuantity,
                viewCart: text.viewCart,
                errors: cart.errors,
              }}
            />
            <p className="flex items-center justify-center gap-2 text-sm text-muted">
              <LockIcon className="size-4" />
              {text.securePayment}
            </p>
            <dl className="grid gap-3 border-t border-border pt-4 text-sm">
              <Fact term={text.delivery}>
                {isService ? text.startsAfterOnboarding : text.instantDownload}
              </Fact>
              {duration && <Fact term={text.duration}>{duration}</Fact>}
              <Fact term={text.access}>{text.fromAccount}</Fact>
            </dl>
          </aside>
        </section>

        <section
          className={`grid gap-10 p-5 min-[600px]:p-6 min-[720px]:grid-cols-2 min-[960px]:p-10 ${PANEL}`}
        >
          <div
            className={
              isService && requirements.length === 0 ? "col-span-full" : undefined
            }
          >
            <h2 className="mb-4 text-xl font-semibold">{text.description}</h2>
            <p
              dir="auto"
              className="leading-7 break-words whitespace-pre-line"
            >
              {product.description}
            </p>
          </div>
          {isService ? (
            requirements.length > 0 && (
              <div>
                <h2 className="mb-4 text-xl font-semibold">
                  {text.requirements}
                </h2>
                <Checklist lines={requirements} />
              </div>
            )
          ) : (
            <div>
              <h2 className="mb-4 text-xl font-semibold">{text.afterYouBuy}</h2>
              <Checklist lines={text.afterYouBuySteps} />
            </div>
          )}
        </section>

        <section
          aria-labelledby="how-it-works-heading"
          className={`p-5 min-[600px]:p-6 min-[960px]:p-10 ${PANEL}`}
        >
          <h2 id="how-it-works-heading" className="mb-8 text-2xl font-semibold">
            {text.howItWorks}
          </h2>
          <ol className="grid gap-6 min-[600px]:grid-cols-2 min-[960px]:grid-cols-3">
            {text.steps[product.type].map((step, index) => (
              <li
                key={step}
                className="flex items-center gap-4 rounded-card bg-surface p-5 font-medium"
              >
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-strong text-sm font-semibold text-white"
                >
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <RelatedProducts product={product} />
      </main>
    </div>
  );
}
