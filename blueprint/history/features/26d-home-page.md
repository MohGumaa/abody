# Feature: Home Page

**From build-plan:** feature 26d
**Build attempt:** 1
**Status:** verified
**Branch:** feature/home-page

## Goal

Replace the create-next-app placeholder at `/<lang>` with the approved home
mockup in English and Arabic: hero, Shop by category, featured products,
services, value proposition, How it works, and a closing call to action. The
mockup's social proof section is left out until real reviews exist. Every product, service, category, and count comes from the published
catalog. The header, footer, routes, and other pages stay as they are.

## Design reference

- `prototypes/index.html`: the whole `<main>`. Its inline `<style>` holds
  `.hero`, `.hero-card`, `.promo`, `.promo--ink`, `.cats`, `.cat`,
  `.cat-icon`, `.value-icon`, `.services`, `.value`, `.steps` (numbered
  circles and dashed connectors), `.quote`, `.avatar`, `.cta`, and the 960px
  and 600px breakpoints.
- `prototypes/mockup.css`: `.stack`, `.panel`, `.section-head`, `.link`,
  `.btn-light`, `.btn-glass`, `.btn-lg`, `.grid-2/3/4` and their 960px and
  600px collapse rules, `.eyebrow`.
- `prototypes/i18n.js` (lines ~100-150): the Arabic wording.

Use the 26a/26b/26c token map: `--surface` is `panel`, `--surface-2` is
`surface`, `--accent*` is `primary*`, `--accent-ink` is `white`, `--radius-lg`
is `rounded-panel`, `--radius` is `rounded-card`, `--radius-sm` is
`rounded-control`, `--shadow` is `shadow-raised`, `--ink*` is `ink*`.
`prototypes/` is untracked and reference only; nothing in the app imports
from it.

## In scope

- **Page frame.** `app/[lang]/page.tsx` renders a `max-w-site` `main` with the
  same container, gutters, and `gap-6` panel stack as `StoreListing`
  (`px-4 pt-6 pb-16`). Panels use `rounded-panel bg-panel shadow-soft` with the
  listing page's padding steps. Section headings follow the mockup's
  `.section-head` (an `h2` at `text-2xl`, optional muted intro, a trailing
  link). Trailing "View all" links reuse the `RelatedProducts` link style with
  the arrow mirrored in Arabic.
- **Hero.** A `primary-strong` panel with white text, two columns
  (`minmax(0,1.35fr) minmax(0,1fr)`) from 960px, one column below with smaller
  padding and `text-3xl` heading.
  - Eyebrow, `h1` (`text-4xl`), and lead from the mockup wording.
  - Two large buttons: "Browse products" (light: `bg-panel text-primary-strong`,
    hover `bg-primary-soft`) to `/<lang>/products`, and "Explore services"
    (glass: translucent white border, white text, arrow icon) to
    `/<lang>/services`.
  - Hero card: the newest published digital product rendered with the shared
    `ProductCard` (`headingLevel="h2"`, max width 380px, aligned to the inline
    end). Hidden below 960px as in the mockup. Omitted when there is no
    published digital product. No "Best seller" chip (see Notes).
- **Shop by category.** Panel with "Shop by category" and a "View all" link to
  `/<lang>/products`. One tile per distinct category of published items, per
  type: product categories first, then service categories, each group in the
  existing `summarizeCategories` order. A tile links to
  `categoryHref(<that type's listing path>, category)`, shows an icon square
  (products: download icon; services: users icon), the category name
  (`dir="auto"`, wraps), and the count from `formatItemCount` with the
  listing's `count` forms for that type. Grid: 5 columns at 960px and up, 3
  from 600px, 2 below; hover lifts the tile and inverts the icon square
  (`motion-safe` for the lift). The panel is omitted when the catalog is
  empty.
- **Featured products.** Panel with "Featured products" and "Ready to use the
  minute your payment clears.". Up to four newest published digital products
  as `ProductCard`s (`h3`), 4 columns at 960px, 2 from 600px, 1 below. When
  there are none, the listing's `DIGITAL_PRODUCT.empty` text shows instead.
  No tabs (see Notes).
- **Services.** Panel with "Services", "Buy online, tell us what we need, and
  we get started.", and "View all services" to `/<lang>/services`. Two
  columns from 960px (`minmax(0,1fr) minmax(0,2fr)`):
  - Ink promo: users icon square (`primary-strong`), eyebrow "Done for you",
    `h3` "Hand it to the Abody team", body text, and a light button "See how
    services work" to `/<lang>/services`.
  - Up to two newest published services as `ProductCard`s (2 columns from
    600px). When there are none, the listing's `SERVICE.empty` text shows in
    that column.
- **Value proposition.** A section labelled "Why Abody" with three panels
  (3 columns at 960px, 2 from 600px, 1 below): icon square, `h3`, muted text.
  Delivered instantly (bolt), Secure payment (lock), Real people on your
  services (users). Mockup wording.
- **How it works.** Panel with an `h2` and an `ol` of four steps (Discover,
  Purchase, Receive, Manage) with the mockup descriptions. Each step has the
  numbered `primary-strong` circle placed at the inline start (CSS counter or
  the rendered index, `aria-hidden` since the `ol` already numbers) and the
  dashed connector between steps from 960px only. 4 columns at 960px, 2 from
  600px, 1 below.
- **Social proof.** Left out: the mockup's quotes would be invented
  testimonials and no review data exists (see Resolved questions).
- **Call to action.** `primary-strong` panel with white text: `h2` "Ready to
  grow your business?", the supporting line, and a large light button "Browse
  the store" with the arrow to `/<lang>/products`. Wraps on narrow screens.
- **Bilingual text.** A new `home` dictionary block in `en.ts` and `ar.ts`
  holds every new string, with the Arabic from `prototypes/i18n.js`. RTL
  mirrors via logical properties; directional arrows flip with
  `rtl:-scale-x-100`. Prices stay `formatPriceCents`.
- **Header state.** The existing `MainNav` already marks Home with
  `aria-current="page"` on `/<lang>`; confirm it, do not change it.

## Out of scope

- Admin-managed featured items or homepage content (feature 21).
- Sales-based "Best sellers" / "New" tabs, best-seller badges, or ordering by
  popularity (no order data until feature 6).
- Per-page SEO metadata, Open Graph, structured data (feature 22). The home
  page keeps the layout's title and description.
- About, Contact, Sign in, account links (no pages yet).
- Translated category names (overview open question 3).
- Changes to `ProductCard`, `ProductCover`, the header, the footer, or any
  other page beyond adding one icon.

## Build loop

`workflow.stepReview` is `feature` and `workflow.checkpointCommits` is
`disabled`: build all steps in order, run each step's checks, then present one
review packet at the end. No checkpoint commits; `/complete` makes the feature
commit.

## Build steps

- [x] 1. **Home selection logic.** Add `lib/home.ts` (no `next/*` or db
  imports, like `lib/listing.ts`) with one pure function that takes the
  published items (newest first, as `listPublishedProducts` returns them) and
  returns `{ heroProduct, featured, services, categories }`: the first digital
  product or `null`, the first four digital products, the first two services,
  and `{ type, category, count }[]` with product categories before service
  categories, each via `summarizeCategories`. Add `lib/home.test.ts`.
  **Done when:** tests cover empty input, products only, services only, more
  than four products and two services, and a category name used by both types
  (two tiles); `pnpm test` passes.
- [x] 2. **Strings and icon.** Add the `home` block to `en.ts` and `ar.ts`
  (Arabic must type-check against `Dictionary`), and a `UsersIcon` to
  `components/icons.tsx` in the existing style. **Done when:** `pnpm lint` and
  `pnpm build` pass.
- [x] 3. **Hero, categories, featured.** Replace `app/[lang]/page.tsx` with an
  async server component that loads `listPublishedProducts({ locale })` once,
  calls the step 1 function, and renders the frame, hero, Shop by category,
  and Featured products, including their empty states. Remove the unused
  `public/next.svg` and `public/vercel.svg` only if nothing else references
  them. **Done when:** `/en` and `/ar` show these sections with seeded data,
  category tiles link to the filtered listing, `pnpm lint` and `pnpm build`
  pass.
- [x] 4. **Services, value, How it works, CTA.** Add the remaining static and
  data sections except social proof. **Done when:** both languages render
  every section in mockup order with correct mirroring at 375px, 768px, and
  1280px; `pnpm lint` and `pnpm build` pass.
- [x] 5. **Social proof.** Dropped: the user chose to leave the section out
  until real reviews exist. No code.

## Files / areas

- `app/[lang]/page.tsx` (replace the scaffold)
- `lib/home.ts`, `lib/home.test.ts` (new)
- `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/ar.ts` (`home` block)
- `components/icons.tsx` (`UsersIcon`)
- Reused, unchanged: `components/catalog/ProductCard.tsx`, `lib/catalog.ts`
  (`listPublishedProducts`), `lib/listing.ts` (`summarizeCategories`,
  `categoryHref`), `lib/i18n/plural.ts` (`formatItemCount`),
  `lib/i18n/config.ts` (`localizedPath`)
- Possibly removed: `public/next.svg`, `public/vercel.svg`

Section components may live in the page file or in `components/home/` if the
page grows hard to read; no other new modules.

## Data / contracts

- Read-only. One `listPublishedProducts({ locale })` call; it selects only
  public fields and published rows, so unpublished items and `digitalFile`
  never reach the page. No new queries, API routes, schema changes, or writes.
- "Newest" means the existing `createdAt desc, id asc` order.
- Category counts use the same data as the listing pages, so a tile's count
  matches what the filtered listing shows.
- Stored text (names, descriptions, categories) renders as React text with
  `dir="auto"`; nothing uses `dangerouslySetInnerHTML`.
- A database failure falls through to the existing `app/[lang]/error.tsx`.

## Testing

- Unit: `lib/home.test.ts` for the selection function (step 1). UI sections are
  verified by build plus a visual check, per the coding standards.
- Automated gates: `pnpm test`, `pnpm lint`, `pnpm build`. There is no Verify
  command and no Browser tests command.
- Manual/visual (for `/check`): `/en` and `/ar` at 375px, 768px, and 1280px
  against `prototypes/index.html`; every link carries the language prefix;
  keyboard focus is visible on tiles, cards, and buttons; with no published
  items the hero card and category panel disappear and the featured and
  services empty texts show.

## Notes for the AI

- Read `node_modules/next/dist/docs/` for any App Router API used beyond what
  `StoreListing` and `RelatedProducts` already do (`getLocale`,
  `getDictionary`, `localizedPath`).
- The mockup's "Best seller" / "New" chips and Best sellers / New / Templates
  tabs imply sales data and editorial picks that do not exist. Showing them
  would make claims the store cannot back, so this spec drops them and uses
  newest-first. Feature 21 can add curated picks later.
- The mockup's hero card omits the description; reusing `ProductCard`
  unchanged keeps it. This is an accepted small deviation that avoids a new
  card variant.
- Mockup category icons (layout, book, file, megaphone) map to fixed category
  names; categories are free text, so icons are per type instead.
- Mockup links that point to `products.html` for services go to
  `/<lang>/services` here, as 26b and 26c did.
- Keep the heading order valid: one `h1` in the hero, `h2` per section
  (the hero card is `h2` as in the mockup), `h3` inside sections.

## Resolved questions

1. **Social proof content.** The mockup's three named-customer quotes would be
   invented testimonials; there is no review data and no orders yet. Decision
   (user, during `/implement`): leave the "What customers say" section out until
   real reviews exist. Step 5 is dropped. Adding real social proof later needs
   its own build-plan item.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":11894,"specSha256":"d2c8e3187eee577dcdc0513e433b86279fdf0c4ae07965a77befa882279175f2","branch":"refs/heads/feature/home-page","head":"2046ac869046cfa7269774d7d2be620fdda36036","baseRef":"refs/heads/main","baseCommit":"2046ac869046cfa7269774d7d2be620fdda36036","sourceTree":"1dd0216f322e1f5fa1d89d5da6413c41c8a35be0","absentOptional":[]} -->
