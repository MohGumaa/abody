# Feature: Featured Product Tabs

**From build-plan:** feature 29a
**Build attempt:** 1
**Branch:** feature/featured-product-tabs
**Status:** verified

## Goal

The home page Featured products section gets Best sellers / New / Templates
tabs, as in the prototype, so visitors can switch between the store's most sold
products, its newest products, and its templates without leaving the page. Works
in English and Arabic.

## Design reference

- `prototypes/index.html` lines 164-176: the section head keeps the title and
  intro on one side and the tabs on the other, wrapping under the text on
  narrow screens; a four-card row below.
- `prototypes/mockup.css` `.tabs` / `.tab` (lines 185-198): pill buttons with a
  border, muted text, `--space-2` gap; the selected tab is filled with the
  strong brand color and white text. The app already draws the same pill in
  `components/catalog/StoreListing.tsx` (the Digital products / Services
  switch); reuse those classes with `aria-[selected=true]:` in place of
  `aria-[current=page]:`.

## In scope

- Three tabs in the Featured products section, in this order:
  1. **Best sellers** (selected on load) - published digital products ranked by
     units sold in paid orders (`PAID_ORDER_STATUSES`: Paid, Processing,
     Completed; Pending, Cancelled, and Refunded orders don't count), the
     largest first. Equal counts, including products that never sold, fall back
     to newest first. So with no sales yet the tab shows the newest products.
  2. **New** - published digital products, newest first.
  3. **Templates** - published digital products whose `category` key is
     `Templates` (compared trimmed and case-insensitively, since admins type the
     key), newest first. The tab is left out entirely when no published digital
     product has that category.
- Each tab shows up to 4 cards (the current row size) with the shared
  `ProductCard`.
- Accessible tabs following the WAI-ARIA tabs pattern: `role="tablist"` with an
  `aria-label` of the section title, `role="tab"` buttons with
  `aria-selected` and `aria-controls`, and `role="tabpanel"` panels with
  `aria-labelledby`. Only the selected tab is in the tab order (roving
  `tabindex`). Arrow keys move focus and select the tab at once: Right/Left move forward/back in English and are
  swapped in Arabic so they follow the visual order; Home and End go to the first
  and last tab. Click selects. Inactive panels use the `hidden` attribute.
- Without JavaScript, or before hydration, the Best sellers panel shows and the
  others stay hidden.
- Tab labels in both dictionaries: `Best sellers` / `الأكثر مبيعًا`, `New` /
  `الأحدث`, `Templates` / `القوالب`.
- The admin "Featured position" hint in `components/admin/ProductForm.tsx`
  updated so it no longer promises the Featured products row (see Data /
  contracts).
- A browser test of the tabs in English and Arabic.

## Out of scope

- Search, sorting, and listing changes (feature 29b).
- A "Best seller" chip on product cards (shown on the prototype cover, not in
  the build-plan line).
- Remembering the selected tab in the URL or across visits.
- Changing the hero card or the Services row; both keep following featured
  positions (feature 21a).
- Any schema or migration change.
- Analytics events for tab clicks.

## Build loop

`workflow.stepReview` is `feature` and `checkpointCommits` is `disabled`: build
all steps, running each step's checks as it lands, then present one review
packet for the whole feature. No checkpoint commits; `/complete` makes the one
feature commit on `feature/featured-product-tabs`.

## Build steps

- [x] **1. Tab selection logic and units-sold query.**
  - `lib/home.ts` (stays free of `db` and `next/*`): replace
    `HomeSections.featured` with
    `featuredTabs: { bestSellers: T[]; newest: T[]; templates: T[] }`.
    `selectHomeSections(items, unitsSold)` takes a
    `ReadonlyMap<string, number>` of product id to units sold; a missing id
    counts as 0. Use a stable sort on the newest-first input so ties keep
    newest first. Add a `TEMPLATES_CATEGORY = "templates"` constant and a
    trimmed, lowercased comparison. `heroProduct`, `services`, and
    `categories` behave exactly as before.
  - `lib/catalog.ts`: `listUnitsSold(): Promise<Map<string, number>>`, one
    `db.orderItem.groupBy({ by: ["productId"], _sum: { quantity: true } })`
    where the order status is in `PAID_ORDER_STATUSES` and the product is a
    published `DIGITAL_PRODUCT`. Returns only ids and counts, never order or
    customer data.
  - `app/[lang]/page.tsx`: load `listHomeProducts(locale)` and
    `listUnitsSold()` with `Promise.all`; the existing row renders
    `featuredTabs.bestSellers` for now, so the page keeps working.
  - Tests in `lib/home.test.ts`: best sellers ordered by units with
    newest-first ties and unsold products after sold ones; no sales gives the
    newest four; a product that sold but has no entry in the input (unpublished
    or a service) never appears; only digital products in every tab; new is the
    newest four; templates matches `Templates`, ` templates `, and `TEMPLATES`
    but not `Template` or `Templates Pro`, and is empty without a match; each
    list caps at 4; hero and services keep their featured-position order (move
    the existing featured-pick assertions from `featured` to `heroProduct`,
    which still uses picks, and keep the services ones). In
    `lib/catalog.test.ts`, with the db mocked as that file already does (check
    the existing pattern first), assert that `listUnitsSold` filters on
    `PAID_ORDER_STATUSES` and published digital products and maps the summed
    quantities, treating a null sum as 0.

  *Done when:* `pnpm test` and `pnpm lint` pass, and the home page still shows a
  four-card Featured products row (now the best sellers).

- [x] **2. Tabs UI on the home page.**
  - Read the Next.js 16 guide on Server and Client Components in
    `node_modules/next/dist/docs/` before writing the client component.
  - `components/home/FeaturedTabs.tsx` (`"use client"`): props
    `label: string`, `dir: "ltr" | "rtl"`, and
    `tabs: { id: string; label: string; panel: ReactNode }[]`. Owns only the
    selected index and keyboard handling; the server page renders each panel's
    card list and passes it in as `panel`, so product data and card markup stay
    server-rendered. Tab and panel ids derive from `useId()` plus the tab id.
  - `app/[lang]/page.tsx`: build the tab list (Templates only when
    `featuredTabs.templates` is non-empty) and put the tabs in the section
    head opposite the title, matching the prototype layout. Keep the
    existing empty state (`listing.types.DIGITAL_PRODUCT.empty`, no tabs) when
    there are no published digital products, and keep the `showFeatured`
    switch around the whole section.
  - Dictionary keys `home.featured.tabs.bestSellers`, `.new`, `.templates` in
    `lib/i18n/dictionaries/en.ts` and `ar.ts` (the `Dictionary` type makes a
    missing key a build error).

  *Done when:* `pnpm lint` and `pnpm build` pass; on `pnpm dev`, `/en` shows the
  three tabs with Best sellers selected, clicking New or Templates swaps the row,
  arrow keys, Home, and End move between tabs, and `/ar` shows the Arabic labels
  with arrows following the right-to-left order; at phone width the tabs wrap
  under the intro without horizontal scroll.

- [x] **3. Admin hint and browser test.**
  - `components/admin/ProductForm.tsx`: change the Featured position hint to
    say it orders the home page hero card and Services row, for example "Orders
    the home page hero card and Services row (1 first). Leave blank to not
    feature. Only published items appear." Products and services share the
    form, so one hint covers both.
  - `e2e/home.spec.ts` (new): in English, the Featured products tablist has
    Best sellers selected and its panel visible; clicking Templates selects it
    and shows a card whose category reads Templates (the seed has one);
    ArrowRight from Best sellers selects New. In Arabic, the Arabic labels show
    and ArrowLeft from the first tab selects the second. Don't assert which products are best sellers, since
    other browser tests create orders.

  *Done when:* `pnpm test`, `pnpm lint`, and `pnpm build` pass, and
  `pnpm test:browser` passes including `e2e/home.spec.ts`.

## Files / areas

- `lib/home.ts`, `lib/home.test.ts`
- `lib/catalog.ts`, `lib/catalog.test.ts`
- `app/[lang]/page.tsx`
- `components/home/FeaturedTabs.tsx` (new)
- `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/ar.ts`
- `components/admin/ProductForm.tsx`
- `e2e/home.spec.ts` (new)

## Data / contracts

- No schema, migration, route, or API change. `PAID_ORDER_STATUSES` comes from
  `lib/delivery.ts`, the same rule the admin dashboard, analytics, and accounts
  use.
- **Featured positions (21a) change meaning on the home page:** they keep
  ordering the hero card and the Services row, but the Featured products row now
  shows the selected tab instead of admin picks. This follows the choice of
  "most sold" over "picks first" for Best sellers. The hint in step 3 tells
  admins.
- The units-sold map is public-safe aggregate data: product ids of published
  products and counts only. It reveals relative sales order through the tab,
  which is the purpose of the feature; it is never sent as raw numbers.
- `listUnitsSold` filters on the product too, so a product that sold and was
  later unpublished never surfaces; `selectHomeSections` only ranks items from
  `listHomeProducts`, which is already published-only.

## Testing

- Unit (Vitest, `pnpm test`): step 1 logic in `lib/home.test.ts` and the query
  shape in `lib/catalog.test.ts`, listed in step 1.
- Browser (`pnpm test:browser`, Playwright): `e2e/home.spec.ts` in step 3.
- No Verify command is declared; the gates are `pnpm test`, `pnpm lint`, and
  `pnpm build`.
- Visual match with the prototype is checked by eye in `/check`, not claimed by
  tests.

## Notes for the AI

- The catalog is small; keep one product query plus one grouped order-item
  query, as the page comment says. No caching layer.
- Pass server-rendered `ProductCard` lists into the client component as
  `ReactNode` panels; don't send `PublicProduct` arrays to the client or import
  `lib/catalog` there.
- Keep `ProductCard`'s `index` per panel (0-3) so covers keep their colors.
- Reuse the StoreListing pill classes rather than adding tokens; no new
  dependency and no shadcn Tabs install.
- Card headings stay `h3` under the section's `h2`.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":10580,"specSha256":"38daf88e6e2e09ca9285d7950f9e3b814c5fa828214205e9388bb50f96097c65","branch":"refs/heads/feature/featured-product-tabs","head":"381013fe9ab993c97f873bca8d9df267aaa0e2da","baseRef":"refs/heads/main","baseCommit":"381013fe9ab993c97f873bca8d9df267aaa0e2da","sourceTree":"d93e258b78f39c67a01c14796c92966a567bfffe","absentOptional":[]} -->

## Findings

- None (no new findings; open P3 entries carried from earlier work unchanged)
