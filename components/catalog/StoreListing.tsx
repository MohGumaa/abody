import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { ListingSearchInput } from "@/components/catalog/ListingSearchInput";
import { ListingSortSelect } from "@/components/catalog/ListingSortSelect";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ChevronIcon } from "@/components/icons";
import { listPublishedProducts } from "@/lib/catalog";
import { ProductType } from "@/lib/generated/prisma/enums";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { formatItemCount } from "@/lib/i18n/plural";
import {
  filterByCategory,
  listingHref,
  type ListingSort,
  sortProducts,
  summarizeCategories,
} from "@/lib/listing";
import { pageMetadata } from "@/lib/seo";

const PANEL = "rounded-panel bg-panel shadow-soft";
const FIELD =
  "h-11 rounded-control border border-border bg-surface px-3 text-sm text-foreground outline-offset-2 placeholder:text-faint focus-visible:outline-2 focus-visible:outline-primary-strong";
const BUTTON =
  "h-11 shrink-0 rounded-control bg-primary-strong px-5 text-sm font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong";
const TEXT_LINK =
  "rounded-control font-semibold text-primary-strong outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary-strong";
const LISTING_PATHS: Record<ProductType, string> = {
  [ProductType.DIGITAL_PRODUCT]: "/products",
  [ProductType.SERVICE]: "/services",
};

export async function listingMetadata(type: ProductType): Promise<Metadata> {
  const { listing, meta } = await getDictionary();
  const text = listing.types[type];
  // ?category=, ?q=, and ?sort= all canonicalize to the unfiltered listing.
  return pageMetadata({
    locale: await getLocale(),
    path: LISTING_PATHS[type],
    title: text.title,
    description: text.intro,
    siteName: meta.title,
  });
}

interface StoreListingProps {
  type: ProductType;
  // The parsed `category` query value; null means All.
  category: string | null;
  // The parsed `q` query value; null means no search.
  q: string | null;
  sort: ListingSort;
}

export async function StoreListing({
  type,
  category,
  q,
  sort,
}: StoreListingProps) {
  const locale = await getLocale();
  const dictionary = await getDictionary();
  const { listing } = dictionary;
  const text = listing.types[type];
  const basePath = localizedPath(locale, LISTING_PATHS[type]);

  // The catalog is small, so one query feeds the counts and the filter.
  // Counts follow the search, so each link shows what it leads to.
  const products = await listPublishedProducts({ type, locale, query: q });
  const categories = summarizeCategories(products);
  const shown = sortProducts(filterByCategory(products, category), sort);
  const view =
    q !== null && shown.length === 0
      ? "search-empty"
      : products.length === 0
        ? "empty"
        : shown.length === 0
          ? "category-empty"
          : "results";
  const href = (state: { category: string | null; q: string | null }) =>
    listingHref(basePath, { ...state, sort });
  const sortOptions: { value: ListingSort; label: string }[] = [
    { value: "newest", label: listing.sort.newest },
    { value: "price-asc", label: listing.sort.priceAsc },
    { value: "price-desc", label: listing.sort.priceDesc },
  ];

  const filterLinks = [
    { key: "all", label: text.all, count: products.length, value: null },
    ...categories.map((item) => ({
      key: `category-${item.category}`,
      label: item.label,
      count: item.count,
      value: item.category,
    })),
  ];

  return (
    <div className="flex-1 font-sans">
      <main className="mx-auto grid w-full max-w-site gap-6 px-4 pt-6 pb-16">
        <nav
          aria-label={dictionary.cart.breadcrumb}
          className={`flex flex-wrap items-center gap-2 px-5 py-4 text-sm text-muted min-[600px]:px-6 min-[960px]:px-10 ${PANEL}`}
        >
          <Link
            href={localizedPath(locale, "/")}
            className="rounded-control outline-offset-2 hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-primary-strong"
          >
            {dictionary.header.home}
          </Link>
          <ChevronIcon className="h-3 w-3 text-faint rtl:-scale-x-100" />
          <span aria-current="page" className="font-semibold text-foreground">
            {text.title}
          </span>
        </nav>

        <section
          className={`flex flex-wrap items-end justify-between gap-4 p-5 min-[600px]:p-6 min-[960px]:p-10 ${PANEL}`}
        >
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {text.title}
            </h1>
            <p className="mt-2 max-w-[56ch] text-muted">{text.intro}</p>
          </div>
          <nav aria-label={listing.catalogType} className="flex flex-wrap gap-2">
            {[ProductType.DIGITAL_PRODUCT, ProductType.SERVICE].map((tabType) => (
              <Link
                key={tabType}
                href={localizedPath(locale, LISTING_PATHS[tabType])}
                aria-current={tabType === type ? "page" : undefined}
                className="rounded-full border border-border bg-panel px-4 py-2 text-sm font-medium text-muted outline-offset-2 hover:border-primary hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary-strong aria-[current=page]:border-primary-strong aria-[current=page]:bg-primary-strong aria-[current=page]:text-white"
              >
                {listing.types[tabType].tab}
              </Link>
            ))}
          </nav>
        </section>

        <div className="grid items-start gap-6 min-[960px]:grid-cols-[280px_minmax(0,1fr)]">
          <aside className={`px-6 py-8 ${PANEL}`}>
            <h2 className="mb-3 text-sm font-semibold">{listing.categories}</h2>
            <ul className="grid gap-1 text-sm">
              {filterLinks.map((link) => (
                <li key={link.key}>
                  <Link
                    href={href({ category: link.value, q })}
                    aria-current={link.value === category ? "true" : undefined}
                    className="flex justify-between gap-3 rounded-control px-3 py-2 text-muted outline-offset-2 hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary-strong aria-[current=true]:bg-primary-soft aria-[current=true]:font-semibold aria-[current=true]:text-primary-strong"
                  >
                    <span dir="auto" className="min-w-0 break-words">
                      {link.label}
                    </span>
                    <span>{link.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>

          <section
            aria-label={text.title}
            className={`p-5 min-[600px]:p-6 min-[960px]:p-10 ${PANEL}`}
          >
            {/* Keyed so a category or sort change resets the fields; the
                search box follows `q` itself so typing keeps focus. */}
            <Form
              key={`${category}|${sort}`}
              action={basePath}
              scroll={false}
              className="mb-8 grid gap-4 min-[960px]:grid-cols-[minmax(0,1fr)_auto] min-[960px]:items-end"
            >
              {category !== null && (
                <input type="hidden" name="category" value={category} />
              )}
              <div className="flex gap-2">
                <ListingSearchInput
                  basePath={basePath}
                  category={category}
                  q={q}
                  sort={sort}
                  text={{
                    label: text.searchLabel,
                    clear: listing.clearSearch,
                  }}
                />
                <noscript>
                  <button type="submit" className={BUTTON}>
                    {listing.searchButton}
                  </button>
                </noscript>
              </div>
              <label className="flex items-center gap-3 text-sm text-muted">
                <span className="shrink-0">{listing.sortBy}</span>
                <ListingSortSelect
                  value={sort}
                  options={sortOptions}
                  className={`min-w-0 flex-1 ${FIELD}`}
                />
              </label>
            </Form>

            {/* One status line that stays mounted, so screen readers hear
                each change as results update while the customer types. */}
            <p
              role="status"
              className={
                view === "results" ? "mb-8 text-sm text-muted" : "text-muted"
              }
            >
              {view === "search-empty" ? (
                <>
                  {listing.searchEmpty}{" "}
                  <q dir="auto" className="font-semibold text-foreground">
                    {q}
                  </q>
                </>
              ) : view === "empty" ? (
                text.empty
              ) : view === "category-empty" ? (
                listing.categoryEmpty
              ) : (
                formatItemCount(locale, shown.length, text.count)
              )}
            </p>
            {view === "search-empty" ? (
              <Link
                href={href({ category, q: null })}
                className={`mt-3 inline-block ${TEXT_LINK}`}
              >
                {listing.clearSearch}
              </Link>
            ) : view === "category-empty" ? (
              <Link
                href={href({ category: null, q })}
                className={`mt-3 inline-block ${TEXT_LINK}`}
              >
                {text.all}
              </Link>
            ) : view === "results" ? (
              <ul className="grid gap-6 min-[600px]:grid-cols-2 min-[960px]:grid-cols-3">
                {shown.map((item, index) => (
                  <li key={item.id}>
                    <ProductCard
                      product={item}
                      locale={locale}
                      index={index}
                      text={dictionary.product}
                      headingLevel="h2"
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
