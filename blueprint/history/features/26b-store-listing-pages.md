# Feature: Store Listing Pages

**From build-plan:** feature 26b
**Build attempt:** 1
**Status:** verified
**Branch:** feature/store-listing-pages

## Goal

Give customers a way to browse the store in English and Arabic. Add one shared
product card from the mockups, plus `/<lang>/products` and `/<lang>/services`
listing pages with a category filter. Use the card for "You might also like" on
the detail pages and the cart. Products and Services join the header and the
footer.

## Design reference

- `prototypes/products.html`: breadcrumb, page head with the type tabs,
  sidebar category filter (`.filters`, `.filter-list`), the results panel, and
  the card markup.
- `prototypes/index.html` (services section, lines ~235-250): the service card
  (ink cover, duration chip on the cover, "Starts after onboarding" foot chip).
- `prototypes/cart.html` (`#more-heading` section) and `prototypes/product.html`
  (`#related-heading` section, with its "View all" link): the related rows.
- `prototypes/mockup.css`: `.card`, `.card-body`, `.card-title`, `.card-desc`,
  `.card-foot`, `.price`, `.cover`, `.cover--2/3/4/ink`, `.cover::before`,
  `.cover-art`, `.cover .chip`, `.chip-success`, `.chip-accent`, `.eyebrow`,
  `.tabs`, `.tab`, `.breadcrumb`, `.with-sidebar`, `.grid-3`, `.grid-4`,
  `.section-head`, `.link`, plus their rules in the 960px and 600px media
  queries.
- `prototypes/i18n.js`: the Arabic wording.

Use the token map from 26a: `--surface` is `panel`, `--surface-2` is
`surface`, `--accent*` is `primary*`, `--radius-lg` is `rounded-panel`,
`--radius` is `rounded-card`, `--radius-sm` is `rounded-control`, `--shadow` is
`shadow-raised`, and `--tint-N` is `tint-N`. `prototypes/` is untracked and for
reference only. Nothing in the app imports from it.

## In scope

- **Shared card (`ProductCard`).** A server component that takes one
  `PublicProduct`, the locale, and a position index. It renders a `relative`
  bordered `rounded-panel` card on `panel` with `p-3`. On hover the border turns
  `primary` and the card gets `shadow-raised` and lifts 2px (lift only under
  `motion-safe`). `focus-within` shows a 2px `primary-strong` outline. It holds:
  - **Cover.** A 4:3 `rounded-card` area.
    - If `publicImageSrc(image)` returns a URL, show the image with
      `object-cover` and empty `alt`. The title names the card.
    - Otherwise, show a decorative placeholder (`aria-hidden`) built from the
      mockup's tilted card shapes. Products cycle `tint-1` to `tint-4` by
      position. Services use the `ink` cover.
    - A service with `durationDays > 0` shows a chip on the cover at the
      inline start: `formatDurationDays(days, locale)`.
  - **Eyebrow.** The category in small uppercase `primary-strong` text, with
    `dir="auto"`.
  - **Title.** An `h3` (the heading level can be set by a prop) with a
    stretched `Link` to `localizedPath(locale, productPath(item))`. The link's
    accessible name is the item name, with `dir="auto"`.
  - **Description.** `shortDescription` in small muted text, with `dir="auto"`.
  - **Foot.** `formatPriceCents(priceCents)` at the start. At the end:
    - Products show a `success` chip with the bolt icon: "Instant download" /
      "تحميل فوري".
    - Services show a `primary` (accent) chip with the clock icon: "Starts
      after onboarding" / "تبدأ بعد استلام بياناتك".
  - **Not shown.** No "Best seller" or "New" badges. There is no data for them.
- **Listing pages.** Add `app/[lang]/products/page.tsx` and
  `app/[lang]/services/page.tsx`. Each one renders a shared `StoreListing`
  server component for its `ProductType`. The page holds, in a `max-w-site`
  container with the cart page's spacing:
  - **Breadcrumb panel.** Home › Products (or Services), styled like the cart
    breadcrumb. The current item has `aria-current="page"`, and the chevron
    mirrors in Arabic.
  - **Page head panel.**
    - An `h1` with "Products" / "المنتجات" or "Services" / "الخدمات".
    - The intro sentence:
      - products: "Templates, guides, and resources you can download as soon
        as your payment is confirmed." / "قوالب وأدلة وموارد يمكنك تحميلها فور
        تأكيد الدفع."
      - services: "Services run by the Abody team, from ad campaigns to
        account management. Work starts once we have your details." / "خدمات
        ينفذها فريق عبودي، من الحملات الإعلانية إلى إدارة الحسابات. يبدأ العمل
        فور استلام بياناتك."
    - Type tabs: two pill links, "Digital products" / "منتجات رقمية" to
      `/<lang>/products` and "Services" / "الخدمات" to `/<lang>/services`. They
      sit in a `nav` labelled "Catalog type" / "نوع المنتجات". The current
      type has `aria-current="page"` and the filled `primary-strong` style.
      These are links, not a tablist.
  - **Two-column body (`280px` sidebar plus results).** It drops to one column
    below 960px, with the filter above the results.
    - **Category filter panel.** The heading is "Categories" / "الفئات". It
      holds a list of links:
      - The first link is "All products" / "كل المنتجات" (or "All services" /
        "كل الخدمات") with the total count.
      - Then one link per category that has published items of this type,
        with its count. Categories are sorted with
        `localeCompare(…, "en")` and shown with `dir="auto"`.
      - The selected link has `aria-current="true"` and the
        `primary-soft`/`primary-strong` treatment.
      - Counts use Latin digits.
    - **Results panel.** A `section` labelled "Products" / "Services".
      - A count line using plural forms, for example "6 products" / "6
        منتجات".
      - Then the cards in a list: 3 columns at 960px and up, 2 below 960px,
        and 1 below 600px.
  - **Filter behavior.**
    - The filter is `?category=<stored category text>`, encoded with
      `URLSearchParams`. It is server-rendered and works without JavaScript.
    - A missing, empty, or repeated (array) parameter means "All".
    - A category with no published items of this type renders the page with
      "All" not selected and the empty state below. It is not a 404.
  - **Empty states.** These show in the results panel and replace the grid
    and the count line.
    - No published items of this type: "No products yet. Check back soon." /
      "لا توجد منتجات بعد. عد قريباً." (services: "No services yet. Check back
      soon." / "لا توجد خدمات بعد. عد قريباً.").
    - Category with no items: "Nothing in this category right now." / "لا
      يوجد شيء في هذه الفئة حالياً." plus a link to "All products" or "All
      services".
  - **Order.** Items keep `listPublishedProducts` order: newest first, then
    `id`.
  - **Metadata.** The `title` is the translated page heading and the
    `description` is the intro sentence.
- **Related on detail pages.** `RelatedProducts` uses `ProductCard` in the
  mockup's `section-head` layout:
  - The `h2` "You might also like".
  - A "View all" / "عرض الكل" link to the item's type listing, styled as
    `.link`, with a mirroring arrow icon.
  - Cards in 4 columns at 960px and up, 2 below 960px, and 1 below 600px.
  - `RELATED_LIMIT` goes from 3 to 4 to fill the mockup's 4-column row. The
    selection rule stays the same: same type, same category first.
- **Cart "You might also like".** This shows only when the cart has lines. It
  is a `panel` section below the cart grid, with the same heading and up to 4
  cards. It holds the newest published items of any type that are not in the
  cart, ordered newest first then `id`. If there are none, the section is not
  rendered.
- **Navigation.**
  - The header `navItems` gain Products and Services after Home. Products and
    Services become current on their listing and their detail pages, through
    the existing `isCurrentNavPath`.
  - The footer gains the Shop column ("Shop" / "المتجر") with Products and
    Services links.
  - The empty cart's "Browse the store" link goes to `/<lang>/products`, and
    its "until item 26" comment is removed.

## Out of scope

- Sorting and pagination from the mockup. They are not in the plan line, and
  the catalog is small. Every item of the type shows on one page.
- The mockup's "Prefer done for you?" sidebar promo. Nothing says which
  service it features.
- The footer's category links (Templates, Guides). No rule says which
  categories to list. They can join once that is decided.
- "Best seller" / "New" badges, and per-item icons on the placeholder cover.
- Translating category names (overview open question 3). They show as stored,
  with `dir="auto"`.
- The detail page layout redesign (26c) and the home page (26d). The detail
  page only gets the new related row.
- Search, the `/api/products` contract, schema changes, and SEO work beyond the
  title and description (item 22).

## Build loop

Per `blueprint/config.json` (`stepReview: "feature"`, `checkpointCommits:
"disabled"`): build all steps, then hand over one review packet at the end of
the feature. No per-step checkpoint commits. `/complete` makes the single
feature commit.

## Build steps

- [x] **1. Listing logic.** Add pure helpers with tests, in a new
  `lib/listing.ts` (no `next/*` or `db` imports):
  - `parseCategoryParam(value: string | string[] | undefined): string | null`
    returns a non-empty string, or `null` for "All".
  - `summarizeCategories(products): { category: string; count: number }[]`
    sorts with `localeCompare(…, "en")`.
  - `filterByCategory(products, category | null)`.
  - `categoryHref(basePath, category | null)` returns the base path, or the
    base path plus `?category=` with the value encoded.

  In `lib/catalog.ts`, add `listCartSuggestions(excludeIds, locale)`
  (published, `id` not in the cart, newest first then `id`, take 4) and set
  `RELATED_LIMIT = 4`.
  **Done when:** `pnpm test` passes. It covers: an array or empty parameter
  becoming `null`; counts per category; sort order; filtering to an unknown
  category returning `[]`; and an href for a category holding `&`, a space, and
  Arabic text round-tripping through `URLSearchParams`.
- [x] **2. Product card.** Add `components/catalog/ProductCard.tsx` and the
  dictionary strings for both chips. Switch `RelatedProducts` to the card, add
  the "View all" link, and use the 4-column grid.
  **Done when:** a product detail page and a service detail page show the
  related row with product and service cards that match the mockup at 1280px,
  768px, and 375px in both languages. The whole card is clickable, it shows a
  focus outline when tabbed to, and the link's name is the item name.
  `pnpm lint` passes.
- [x] **3. Listing pages.** Add `components/catalog/StoreListing.tsx` and the
  two `page.tsx` routes with `generateMetadata`. Read `searchParams` per the
  Next.js 16 `PageProps` guide in `node_modules/next/dist/docs/`. Add the
  `listing` dictionary group in both languages, including the plural forms for
  products and services.
  **Done when:**
  - `/en/products`, `/ar/products`, `/en/services`, and `/ar/services` match
    the mockup layout at 1280px, 768px, and 375px, mirrored in Arabic.
  - The type tabs and category links work with JavaScript disabled, and the
    selected filter carries `aria-current`.
  - `?category=Guides` shows only guides, with "Guides" selected.
    `?category=Nope` shows the category empty state with a working "All" link.
  - A type with no published items shows its empty state.
  - Nothing scrolls sideways at 375px. `pnpm lint` passes.
- [x] **4. Navigation and cart row.** Add Products and Services to the header
  navigation and the Shop column to the footer. Point the empty cart's button
  at `/products`. Add the cart's "You might also like" section.
  **Done when:**
  - The header shows Home, Products, and Services, with Products current on
    `/en/products` and on a product detail page.
  - The footer shows the Shop column in both languages.
  - A cart with one item shows up to 4 suggested cards, none of them already in
    the cart. An empty cart shows no suggestions, and its button opens
    `/<lang>/products`.
  - `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Files / areas

- `lib/listing.ts`, `lib/listing.test.ts` (new)
- `lib/catalog.ts`: `listCartSuggestions`, `RELATED_LIMIT`
- `components/catalog/ProductCard.tsx`, `components/catalog/StoreListing.tsx`
  (new, server components)
- `components/catalog/RelatedProducts.tsx`
- `app/[lang]/products/page.tsx`, `app/[lang]/services/page.tsx` (new). They
  sit next to the existing `[slug]` folders. The `[...rest]` catch-all no
  longer handles these two paths.
- `app/[lang]/cart/page.tsx`: suggestions section and the empty-state link
- `components/layout/SiteHeader.tsx`, `components/layout/SiteFooter.tsx`
- `components/icons.tsx`: reuse `BoltIcon`, `ClockIcon`, `ChevronIcon`, and
  `ArrowIcon`. Add nothing unless the placeholder needs it.
- `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/ar.ts`: new `listing`
  group, the card chip strings, `header.products` and `header.services`,
  `footer.shop`, and `product.viewAll`

## Data / contracts

- No schema, migration, API, or dependency changes.
- New public URLs: `/<lang>/products` and `/<lang>/services`, with an optional
  `category` query parameter. Its value is the exact stored `category` text.
  It is untrusted input and is only compared against categories already loaded
  from published rows. It never reaches a query as anything other than an
  in-memory string comparison, and it is rendered only as React text.
- The listing data comes from `listPublishedProducts({ type, locale })`. That
  function already uses the public select, so `digitalFile` and `status` never
  load. Filtering and counts happen in memory on that one result.
- `listCartSuggestions` uses the same `publicProductSelect` and the published
  filter. Cart ids come from `parseCart`, which already validates them.
- Card text in the dictionaries:
  - `product.instantDownload`: "Instant download" / "تحميل فوري"
  - `product.startsAfterOnboarding`: "Starts after onboarding" / "تبدأ بعد
    استلام بياناتك"
  - `product.viewAll`: "View all" / "عرض الكل"
- `listing.countProducts` (plural forms):
  - en: "{count} product" (one) and "{count} products" (other)
  - ar: zero "لا منتجات", one "منتج واحد", two "منتجان", few "{count}
    منتجات", many "{count} منتجاً", other "{count} منتج"
- `listing.countServices` (plural forms):
  - en: "{count} service" (one) and "{count} services" (other)
  - ar: zero "لا خدمات", one "خدمة واحدة", two "خدمتان", few "{count}
    خدمات", many "{count} خدمة", other "{count} خدمة"

## Testing

- Unit: `lib/listing.test.ts` (Vitest, `pnpm test`) for the step 1 helpers.
  `listCartSuggestions` is a thin Prisma query and is checked in the running
  app, like the other catalog queries.
- No browser harness is configured. The visual and no-JavaScript checks at
  1280px, 768px, and 375px in both languages are done by hand or during
  `/check`, using the seed data (Templates, Guides, Marketing Resources,
  Marketing Services).
- Final gate: `pnpm test`, `pnpm lint`, and `pnpm build`. There is no Verify
  command, and none of the three were run while writing this spec. The last
  recorded pass is 26a's on `258aee9`. Run them on `main` (`3ff04e7`) before
  step 1 to get a baseline.

## Notes for the AI

- Use logical properties only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`,
  `text-start`). Directional icons (chevron, arrow) get `rtl:-scale-x-100`.
- Keep `focus-visible` outlines (`outline-primary-strong`) on every link. The
  card's stretched link uses `outline-none` because the card shows the outline
  through `focus-within`.
- AA contrast: no white text on `primary` (finding F-05). Filled tabs use
  `primary-strong`.
- The services intro sentence and the empty-state wording are new copy, not
  from the mockup. Keep them in the dictionaries so they are easy to edit.
- `ProductCard` must not fetch data. Callers pass the products in. Keep
  `StoreListing`, `RelatedProducts`, and the cart page as the only places that
  query.
- Read the relevant guides in `node_modules/next/dist/docs/` before using any
  Next.js API that is new to this codebase, especially page `searchParams`.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":16612,"specSha256":"a2c6e39c0bd1ca9fcbc17a2134f1bf03233d3c52896241649523edf98524102f","branch":"refs/heads/feature/store-listing-pages","head":"3ff04e739336892b927f0d045709682e6d75b7d3","baseRef":"refs/heads/main","baseCommit":"3ff04e739336892b927f0d045709682e6d75b7d3","sourceTree":"15021f6f8dd3dab19f6cd3c64b0f1b8059dab584","absentOptional":[]} -->
