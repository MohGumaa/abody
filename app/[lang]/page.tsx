import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ProductCard } from "@/components/catalog/ProductCard";
import {
  ArrowIcon,
  BoltIcon,
  DownloadIcon,
  LockIcon,
  UsersIcon,
} from "@/components/icons";
import { listPublishedProducts } from "@/lib/catalog";
import { ProductType } from "@/lib/generated/prisma/enums";
import { selectHomeSections } from "@/lib/home";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { formatItemCount } from "@/lib/i18n/plural";
import { categoryHref } from "@/lib/listing";
import { pageMetadata } from "@/lib/seo";

const PANEL = "rounded-panel bg-panel shadow-soft";
const PANEL_PADDING = "p-5 min-[600px]:p-6 min-[960px]:p-10";
const LISTING_PATHS: Record<ProductType, string> = {
  [ProductType.DIGITAL_PRODUCT]: "/products",
  [ProductType.SERVICE]: "/services",
};
// Large buttons on the primary-strong hero and call to action.
const LIGHT_BUTTON =
  "inline-flex h-13 items-center gap-2 rounded-card bg-panel px-6 font-semibold text-primary-strong outline-offset-2 hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-white";
const ICON_SQUARE =
  "grid size-12 shrink-0 place-items-center rounded-card bg-primary-soft text-primary-strong";

interface SectionHeadProps {
  id: string;
  title: string;
  intro?: string;
  link?: { href: string; label: string };
}

function SectionHead({ id, title, intro, link }: SectionHeadProps) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id={id} className="text-2xl font-semibold">
          {title}
        </h2>
        {intro ? <p className="mt-2 text-muted">{intro}</p> : null}
      </div>
      {link ? (
        <Link
          href={link.href}
          className="inline-flex items-center gap-1 rounded-control font-semibold text-primary-strong outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary-strong"
        >
          {link.label}
          <ArrowIcon className="size-[1.1em] rtl:-scale-x-100" />
        </Link>
      ) : null}
    </div>
  );
}

function ValuePanel({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className={`${PANEL} ${PANEL_PADDING}`}>
      <span className={ICON_SQUARE}>{icon}</span>
      <h3 className="mt-5 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = await getDictionary();
  return pageMetadata({
    locale: await getLocale(),
    path: "/",
    title: meta.title,
    description: meta.description,
    siteName: meta.title,
    absoluteTitle: true,
  });
}

export default async function Home() {
  const locale = await getLocale();
  const dictionary = await getDictionary();
  const { home, listing } = dictionary;
  const productsPath = localizedPath(locale, "/products");
  const servicesPath = localizedPath(locale, "/services");

  // The catalog is small, so one query feeds every section.
  const items = await listPublishedProducts({ locale });
  const { heroProduct, featured, services, categories } =
    selectHomeSections(items);

  return (
    <div className="flex-1 font-sans">
      <main className="mx-auto grid w-full max-w-site gap-6 px-4 pt-6 pb-16">
        <section className="grid items-center gap-16 rounded-panel bg-primary-strong p-8 text-white min-[960px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] min-[960px]:p-16">
          <div className="grid gap-6">
            <p className="text-xs font-semibold tracking-[0.06em] uppercase opacity-85 rtl:tracking-normal">
              {home.hero.eyebrow}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight min-[960px]:text-4xl">
              {home.hero.title}
            </h1>
            <p className="max-w-[46ch] text-lg opacity-92">{home.hero.lead}</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link href={productsPath} className={LIGHT_BUTTON}>
                {home.hero.browseProducts}
              </Link>
              <Link
                href={servicesPath}
                className="inline-flex h-13 items-center gap-2 rounded-card border border-white/45 px-6 font-semibold text-white outline-offset-2 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
              >
                {home.hero.exploreServices}
                <ArrowIcon className="size-[1.1em] rtl:-scale-x-100" />
              </Link>
            </div>
          </div>
          {heroProduct ? (
            <div className="hidden w-full max-w-[380px] justify-self-end text-foreground min-[960px]:block">
              <ProductCard
                product={heroProduct}
                locale={locale}
                index={0}
                text={dictionary.product}
                headingLevel="h2"
              />
            </div>
          ) : null}
        </section>

        {categories.length > 0 ? (
          <section
            aria-labelledby="categories-heading"
            className={`${PANEL} ${PANEL_PADDING}`}
          >
            <SectionHead
              id="categories-heading"
              title={home.categories}
              link={{ href: productsPath, label: home.viewAll }}
            />
            <ul className="grid grid-cols-2 gap-4 min-[600px]:grid-cols-3 min-[960px]:grid-cols-5">
              {categories.map(({ type, category, count }) => (
                <li key={`${type}-${category}`}>
                  <Link
                    href={categoryHref(
                      localizedPath(locale, LISTING_PATHS[type]),
                      category,
                    )}
                    className="group flex h-full flex-col gap-5 rounded-panel border border-border bg-panel p-5 outline-offset-2 transition-[box-shadow,border-color,transform] duration-150 hover:border-primary hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong motion-safe:hover:-translate-y-0.5 min-[600px]:p-6"
                  >
                    <span
                      className={`${ICON_SQUARE} group-hover:bg-primary-strong group-hover:text-white`}
                    >
                      {type === ProductType.SERVICE ? (
                        <UsersIcon className="size-6" />
                      ) : (
                        <DownloadIcon className="size-6" />
                      )}
                    </span>
                    <span className="grid gap-1">
                      <strong
                        dir="auto"
                        className="leading-[1.3] font-semibold break-words"
                      >
                        {category}
                      </strong>
                      <span className="text-sm text-muted">
                        {formatItemCount(
                          locale,
                          count,
                          listing.types[type].count,
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section
          aria-labelledby="featured-heading"
          className={`${PANEL} ${PANEL_PADDING}`}
        >
          <SectionHead
            id="featured-heading"
            title={home.featured.title}
            intro={home.featured.intro}
          />
          {featured.length === 0 ? (
            <p className="text-muted">
              {listing.types.DIGITAL_PRODUCT.empty}
            </p>
          ) : (
            <ul className="grid gap-5 min-[600px]:grid-cols-2 min-[960px]:grid-cols-4">
              {featured.map((item, index) => (
                <li key={item.id}>
                  <ProductCard
                    product={item}
                    locale={locale}
                    index={index}
                    text={dictionary.product}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="services-heading"
          className={`${PANEL} ${PANEL_PADDING}`}
        >
          <SectionHead
            id="services-heading"
            title={home.services.title}
            intro={home.services.intro}
            link={{ href: servicesPath, label: home.services.viewAll }}
          />
          <div className="grid gap-6 min-[960px]:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div className="flex flex-col justify-between gap-6 rounded-panel bg-ink p-8 text-ink-text shadow-soft">
              <span className="grid size-12 shrink-0 place-items-center rounded-card bg-primary-strong text-white">
                <UsersIcon className="size-6" />
              </span>
              <div>
                <p className="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase rtl:tracking-normal">
                  {home.services.promoEyebrow}
                </p>
                <h3 className="mt-2 text-2xl font-semibold">
                  {home.services.promoTitle}
                </h3>
                <p className="mt-2 text-sm text-ink-muted">
                  {home.services.promoBody}
                </p>
              </div>
              <Link
                href={servicesPath}
                className="inline-flex h-11 items-center self-start rounded-card bg-panel px-5 font-semibold text-primary-strong outline-offset-2 hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-white"
              >
                {home.services.promoAction}
              </Link>
            </div>
            {services.length === 0 ? (
              <p className="self-center text-muted">
                {listing.types.SERVICE.empty}
              </p>
            ) : (
              <ul className="grid gap-6 min-[600px]:grid-cols-2">
                {services.map((item, index) => (
                  <li key={item.id}>
                    <ProductCard
                      product={item}
                      locale={locale}
                      index={index}
                      text={dictionary.product}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section
          aria-label={home.why}
          className="grid gap-6 min-[600px]:grid-cols-2 min-[960px]:grid-cols-3"
        >
          <ValuePanel
            icon={<BoltIcon className="size-6" />}
            title={home.values.instant.title}
            body={home.values.instant.body}
          />
          <ValuePanel
            icon={<LockIcon className="size-6" />}
            title={home.values.secure.title}
            body={home.values.secure.body}
          />
          <ValuePanel
            icon={<UsersIcon className="size-6" />}
            title={home.values.people.title}
            body={home.values.people.body}
          />
        </section>

        <section
          aria-labelledby="how-heading"
          className={`${PANEL} ${PANEL_PADDING}`}
        >
          <SectionHead id="how-heading" title={home.howItWorks} />
          <ol className="grid gap-8 min-[600px]:grid-cols-2 min-[960px]:grid-cols-4 min-[960px]:gap-5">
            {home.steps.map((step, index) => (
              <li
                key={step.title}
                className="relative pt-16 min-[960px]:not-last:after:absolute min-[960px]:not-last:after:start-12 min-[960px]:not-last:after:end-0 min-[960px]:not-last:after:top-[18px] min-[960px]:not-last:after:border-t min-[960px]:not-last:after:border-dashed min-[960px]:not-last:after:border-border"
              >
                {/* The ol already numbers the steps for assistive tech. */}
                <span
                  aria-hidden="true"
                  className="absolute start-0 top-0 grid size-9 place-items-center rounded-full bg-primary-strong text-sm font-semibold text-white"
                >
                  {index + 1}
                </span>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-5 rounded-panel bg-primary-strong p-5 text-white shadow-soft min-[600px]:p-6 min-[960px]:p-10">
          <div>
            <h2 className="text-2xl font-semibold">{home.cta.title}</h2>
            <p className="mt-1 opacity-90">{home.cta.body}</p>
          </div>
          <Link href={productsPath} className={LIGHT_BUTTON}>
            {home.cta.action}
            <ArrowIcon className="size-[1.1em] rtl:-scale-x-100" />
          </Link>
        </section>
      </main>
    </div>
  );
}
