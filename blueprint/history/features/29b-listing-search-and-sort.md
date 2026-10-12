# Feature: Listing Search and Sort

**From build-plan:** feature 29b
**Build attempt:** 1
**Branch:** feature/listing-search-and-sort
**Status:** verified

## Goal

Customers can narrow `/<lang>/products` and `/<lang>/services` with a search box
(`?q=`) and reorder them with a Sort by menu (`?sort=`). Search, sort, and the
existing `?category=` filter work together and live in the URL, so any state can
be bookmarked, shared, or reloaded. A search with no matches shows an empty
state with a clear-search link. Works in English and Arabic. No schema change.

## Design reference

`prototypes/products.html` (untracked, never imported) shows the results
toolbar: the item count on one side and a `Sort by` select with Newest,
Price: low to high, Price: high to low on the other. `prototypes/i18n.js` gives
the Arabic label `ترتيب حسب`. The mockup has no search box. Place it in the same
toolbar row and reuse the existing listing tokens (`rounded-control`,
`border-border`, `bg-panel`, focus outline classes) from `StoreListing.tsx`. No
new theme tokens.

## In scope

- `?q=` search on both listing pages. A product matches when every
  whitespace-separated term of the query appears, case-insensitively, somewhere
  in its name, short description, or category, in English **or** Arabic
  (`name`, `nameAr`, `shortDescription`, `shortDescriptionAr`, `category`,
  `categoryAr`). Both language fields are searched on both sites, so an Arabic
  visitor typing an English name still finds the item.
- `?sort=` with three values: `newest` (default), `price-asc`, `price-desc`.
- Search, sort, and category combine. Category links keep the current `q` and
  `sort`. The search form keeps the current `category` and `sort`. Changing the
  sort keeps `q` and `category`.
- Category counts and the All count reflect the current search, so each link
  shows how many results it leads to.
- Empty states:
  - Catalog empty, no search: the existing `text.empty` message (unchanged).
  - Search set and no results (with or without a category): a "no results"
    message that shows the query, plus a **Clear search** link that drops `q`
    and keeps `category` and `sort`.
  - Category with no items and no search: the existing `categoryEmpty` message
    and All link (unchanged, but the link keeps `sort`).
- Bilingual interface text for every new label and message.
- Unit tests for the parsing, matching, sorting, and URL helpers and for the
  catalog query option, plus one browser test.

## Out of scope

- Arabic text normalization (diacritics, alef/yaa variants), fuzzy matching,
  stemming, typo tolerance, relevance ranking, and search suggestions.
- Searching full descriptions, "What's included", or requirements.
- Pagination (the catalog is small and already loaded in one query).
- Search analytics, a site-wide header search, and search on the home page.
- Changes to `/api/products`, the admin catalog, SEO canonicals, the sitemap,
  or the schema.

## Build loop

`workflow.stepReview` is `feature`: build all steps in order, run each step's
check as you go, and present one review packet after the last step.
`workflow.checkpointCommits` is `disabled`: no step commits. `/complete`
creates the final feature commit.

## Build steps

- [x] **1. Listing URL helpers.** In `lib/listing.ts` add `parseSearchParam`,
  `parseSortParam`, `matchesSearch`, `sortProducts`, and `listingHref`, and
  replace `categoryHref` with `listingHref` (update its callers in
  `StoreListing.tsx` and the home page category cards in `app/[lang]/page.tsx`). See Data / contracts for the exact behavior. Extend
  `lib/listing.test.ts`.
  **Done when:** `pnpm test` passes with cases for every rule in Data /
  contracts (missing, empty, whitespace-only, repeated, over-long, and unknown
  values; multi-term and Arabic matching; price ties; link parameter order and
  default omission), and the listing pages still filter by category.

- [x] **2. Catalog query option.** Give `listPublishedProducts` in
  `lib/catalog.ts` an optional `query: string | null`. When it is set, keep only
  rows where `matchesSearch` passes on the six raw English and Arabic fields,
  then map with `toPublicProduct`. Without it, the function behaves exactly as
  today (`/api/products` and other callers do not change). Extend
  `lib/catalog.test.ts`.
  **Done when:** `pnpm test` covers a row matched only by its Arabic field
  under the `en` locale, a row matched only by its English field under `ar`,
  a non-match, and the unchanged no-query result.

- [x] **3. Listing UI.** Update `components/catalog/StoreListing.tsx` and both
  pages (`app/[lang]/products/page.tsx`, `app/[lang]/services/page.tsx`) to
  read `q` and `sort`, then fetch with the query, summarize categories, filter by
  category, and sort. Add the results toolbar with the search form, the count,
  and the Sort by select, plus the empty states from In scope. Add the
  dictionary keys to `lib/i18n/dictionaries/en.ts` and `ar.ts`. Add one small
  client component for the sort select that submits its form on change. First
  check `node_modules/next/dist/docs/` for the current `next/form` guidance and
  use `Form` from `next/form` for the GET form if it is documented for this
  version. Otherwise use a plain `<form method="get">`.
  **Done when:** `pnpm build` and `pnpm lint` pass, and on `/en/products` and
  `/ar/products` typing a term and submitting, picking a sort, and clicking a
  category all update the URL and results while keeping the other parameters.
  A no-match search shows the query and a working Clear search link, and the
  page has no sideways scroll at phone width.

- [x] **4. Browser test.** Add one test to `e2e/storefront.spec.ts` using the
  seeded products (`SEED` in `e2e/support.ts`). Search for a known product name,
  then apply a category, then switch to Price: high to low and assert the URL
  keeps all three parameters and the results order. Then search for a
  nonsense term, assert the empty state, click Clear search, and assert results
  return.
  **Done when:** `pnpm test:browser` passes, including the existing storefront
  tests.

## Files / areas

- `lib/listing.ts`, `lib/listing.test.ts` - pure helpers (no `next/*` or db
  imports; Vitest loads it directly).
- `lib/catalog.ts`, `lib/catalog.test.ts` - `query` option on
  `listPublishedProducts`.
- `components/catalog/StoreListing.tsx` - toolbar, form, empty states, links.
- New client component next to it, for example
  `components/catalog/ListingSortSelect.tsx`.
- `app/[lang]/products/page.tsx`, `app/[lang]/services/page.tsx` - parse and
  pass `q` and `sort`.
- `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/ar.ts` - new `listing`
  keys.
- `e2e/storefront.spec.ts` - one test.

## Data / contracts

No schema or API change. Everything below is the listing page URL contract.

**`q` (search)**
- `parseSearchParam(value: string | string[] | undefined): string | null`.
- Missing, repeated (array), empty, or whitespace-only → `null` (no search).
- Otherwise trim, collapse internal whitespace runs to one space, and cut to the
  first 100 characters. The input also gets `maxLength={100}`.
- `matchesSearch(fields: (string | null)[], query: string): boolean`.
  Lowercase the query and fields with `toLowerCase()`, split the query on spaces
  into terms, and return true when every term is a substring of at least one
  non-null field. Plain substring only, with no regex built from user input.

**`sort`**
- `type ListingSort = "newest" | "price-asc" | "price-desc"`.
- `parseSortParam(value)`: exactly `price-asc` or `price-desc` → that value.
  Missing, repeated, empty, `newest`, or anything else → `"newest"`.
- `sortProducts(products, sort)` returns a new array and does not mutate.
  `newest` keeps the incoming order, which is already `createdAt` desc then
  `id` asc from the query. `price-asc` and `price-desc` order by `priceCents`,
  and equal prices keep that incoming newest-first order (stable sort).

**Links**
- `listingHref(basePath, { category, q, sort })` returns `basePath` plus only
  the non-default parameters, in the fixed order `category`, `q`, `sort`,
  encoded with `URLSearchParams`. `sort` is left out when it is `newest`, and
  `category` and `q` are left out when they are null. With nothing set it
  returns `basePath` with no `?`.
- The search form submits `q`, `sort` from the select, and a hidden `category`
  input only when a category is active. Form-built URLs may contain `sort=newest`
  or an empty `q=`, and the parsers treat both as defaults.
- The Products/Services type tabs keep resetting to the bare listing
  (categories differ between types).

**Order of work in `StoreListing`:** fetch with `query` → `summarizeCategories`
on the search results (counts and All count reflect the search) → category
filter → `sortProducts` → render. An active `category` that matches no search
result still shows as current only if it appears in the list. The results area
then shows the search empty state.

**Rendering user text:** `q` is shown only through React text and the
`defaultValue` of the input. Use `dir="auto"` on the input and on the echoed
query. Never use `dangerouslySetInnerHTML`.

**Accessibility:** the search input is `type="search"` with a label
(`listing.types[type].searchLabel`, such as "Search products"; it may be
visually hidden), and there is a visible submit button. The sort `<select>` has
the visible label "Sort by". The no-results message sits in the results region
that already holds the count. No extra live region, because each change is a
full navigation.

**Metadata:** unchanged. `listingMetadata` already canonicalizes to the bare
listing path. Update its comment to cover `?q=` and `?sort=`.

**New dictionary keys** (shape to match the existing `listing` object; the
Arabic strings must be real translations):
- `listing.types[type].searchLabel` - "Search products" / "Search services"
- `listing.searchButton` - "Search"
- `listing.sortBy` - "Sort by" / "ترتيب حسب"
- `listing.sort.newest`, `listing.sort.priceAsc`, `listing.sort.priceDesc` -
  "Newest", "Price: low to high", "Price: high to low"
- `listing.searchEmpty` - lead-in text for "No results for" + the query
- `listing.clearSearch` - "Clear search"

## Testing

- Unit (`pnpm test`): `lib/listing.test.ts` for the parsers, `matchesSearch`
  (single term, multiple terms across different fields, case, Arabic text, null
  Arabic fields, no match), `sortProducts` (both directions, stable ties, no
  mutation, newest keeps order), and `listingHref` (all combinations, default
  omission, encoding of Arabic and `&`). `lib/catalog.test.ts` for the `query`
  option.
- Build and lint: `pnpm build`, `pnpm lint`.
- Browser (`pnpm test:browser`): one new storefront test, as in step 4. Existing
  storefront tests must still pass, including the category filter test that
  asserts `category=` in the URL.
- Not claimed: a visual comparison with the prototype or a live production
  check.

## Notes for the AI

- Read `node_modules/next/dist/docs/` for `searchParams` and `next/form` before
  writing the UI. This Next.js version differs from training data.
  `PageProps<"/[lang]/products">` is already in use.
- The catalog is small, and the existing code filters in memory after one query
  ("one query feeds the counts and the filter"). Keep that approach. Do not add
  Prisma `contains` filters or a search index.
- `toLowerCase()` is enough for Arabic (no case). Do not add normalization.
- Keep `lib/listing.ts` free of `next/*` and db imports.
- Prices keep their one format (`priceCents`, USD), and sorting uses
  `priceCents` only.
- The client component holds only the submit-on-change behavior. The form must
  still work without JavaScript: the user picks a sort and presses Search.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":11819,"specSha256":"a6381e4842fbbaed0ce02fb22af806a2d8b340096e60dfc2bd2c3e1ae19c441a","branch":"refs/heads/feature/listing-search-and-sort","head":"778026f8eb10c03be11e7207cf9bc72dae059662","baseRef":"refs/heads/main","baseCommit":"778026f8eb10c03be11e7207cf9bc72dae059662","sourceTree":"0645f3779496362a22baa8c40decbcb23ea3690c","absentOptional":[]} -->

## Findings

- None (no new findings; open entries carried from earlier work unchanged)
