# Feature: SEO & Social Sharing

**From build-plan:** feature 22
**Build attempt:** 1
**Branch:** feature/seo-social-sharing
**Status:** verified

## Goal

Make every public customer page findable and shareable in English and Arabic:
per-page titles and meta descriptions, Open Graph and social images, `hreflang`
alternates between `/en` and `/ar`, canonical URLs, a sitemap covering both
languages, robots configuration, and product structured data.

## In scope

- A site base URL from a new `SITE_URL` environment variable, used as
  `metadataBase` and for absolute URLs in the sitemap, robots, and JSON-LD.
- A title template (`<page> | Abody` / `<page> | عبودي`) with the brand name as
  the default title, from the existing `meta` dictionary entries.
- Per-page title, description, canonical URL, `hreflang` alternates (`en`, `ar`,
  `x-default`), and Open Graph / Twitter tags for the indexable pages: home,
  `/products`, `/services`, product detail, and service detail.
- A default generated social image (1200x630 PNG, brand logo on the brand
  background, no text, so it suits both languages), with product and service
  detail pages using the item's own raster image when it has one.
- `app/sitemap.ts` at `/sitemap.xml` listing every indexable page in both
  languages with language alternates, including each published product and
  service.
- `app/robots.ts` at `/robots.txt` allowing crawling, disallowing `/api/`, and
  pointing to the sitemap.
- `noindex` on the cart page.
- `Product` JSON-LD on product and service detail pages.

## Out of scope

- Pages that do not exist yet (checkout, success, login, account, admin, About,
  Contact). Later features add their own metadata through the helper this
  feature introduces.
- Per-product generated Open Graph images, image upload, or image conversion.
- Translating `category` (overview open question 3).
- Analytics, search-console verification tags, `Organization`, `BreadcrumbList`,
  or review/rating structured data.
- Choosing a production domain or deployment target (`SITE_URL` is set per
  environment).
- Indexing filtered listing URLs (`?category=`); they canonicalize to the
  unfiltered listing.

## Build loop

`workflow.stepReview` is `feature`: build all steps, running the step's checks
as you go, then present one review packet at the end of the feature. Step
checkpoint commits are disabled. `/complete` creates the single feature commit.

## Build steps

- [x] 1. **SEO helpers.** Add `lib/seo.ts` with:
  - `siteUrl(): URL` - `new URL(process.env.SITE_URL ?? "http://localhost:3000")`;
    an invalid value throws (misconfiguration should fail loudly, not emit
    wrong canonicals).
  - `pageAlternates(locale, path)` - returns `{ canonical, languages }` where
    canonical is `localizedPath(locale, path)` and languages maps `en`, `ar`, and
    `x-default` (English) to `localizedPath(...)` for each. `path` is the
    unprefixed path (`/`, `/products`, `/products/<slug>`).
  - `pageMetadata({ locale, path, title, description, image? })` - returns a
    `Metadata` object with `title`, `description`, `alternates`, and a complete
    `openGraph` block (`type: "website"`, `url` = canonical, `title`,
    `description`, `siteName` from `meta.title`, `locale` `en_US` / `ar_AR`,
    `alternateLocale` the other one, and `images` only when `image` is given).
    Pages always build metadata through this helper because Next.js merges
    `openGraph` shallowly; a page-level block replaces the layout's.
  - `socialImageSrc(image)` - `publicImageSrc(image)` but `null` for `.svg`
    (social platforms do not render SVG previews).
  - `productJsonLd(product, url)` - schema.org `Product` with `name`,
    `description` (localized short description), `image` (absolute, only when
    `socialImageSrc` returns one), `sku` (id), `category`, and `offers`
    (`Offer`, `price` as a two-decimal string from `priceCents`, `priceCurrency`
    `USD`, `availability` `https://schema.org/InStock`, `url`).
  - `jsonLdScript(data)` - `JSON.stringify` with every `<` replaced by
    `<`, so product text cannot close the `<script>` element.
  Add `SITE_URL` to `.env.example` with a comment.
  **Done when:** `lib/seo.test.ts` covers canonical and alternates for `/` and
  nested paths in both locales, `x-default`, the SVG and unsafe-image rules,
  JSON-LD price formatting (for example 1900 → `"19.00"`, 5 → `"0.05"`), image
  omission, and `</script>` escaping; `pnpm test` passes.

- [x] 2. **Layout defaults and page metadata.** In `app/[lang]/layout.tsx` add
  `metadataBase: siteUrl()`, `title: { default: meta.title, template: "%s | " +
  meta.title }`, keep the description and icons, and add
  `twitter: { card: "summary_large_image" }`. Wire `pageMetadata` into:
  - `app/[lang]/page.tsx` (new `generateMetadata`; title absolute `meta.title`,
    `meta.description`, path `/`)
  - `listingMetadata` in `components/catalog/StoreListing.tsx` (path `/products`
    or `/services`)
  - `app/[lang]/products/[slug]/page.tsx` and `app/[lang]/services/[slug]/page.tsx`
    (item name and short description, path from `productPath`, image from
    `socialImageSrc`)
  - `app/[lang]/cart/page.tsx` keeps its title and adds
    `robots: { index: false, follow: true }`.
  **Done when:** `pnpm build` passes and the rendered `<head>` of `/en/products`
  and `/ar/products/<seed-slug>` shows the templated title, description,
  canonical, three `hreflang` links, and `og:*` tags with absolute URLs; `/en/cart`
  shows `noindex`; an unknown URL's 404 still renders (check its robots tag and
  record what Next.js emits).

- [x] 3. **Default social image.** Add `app/[lang]/opengraph-image.tsx` using
  `ImageResponse` from `next/og` (built in, no new dependency): 1200x630 PNG,
  `public/Logo.png` read with `node:fs/promises`, centred on the brand color,
  `alt` "Abody". Confirm in the rendered head that a page without its own image
  gets this `og:image`, and that a product with a raster `https://` or `/` image
  gets its own image instead. Next.js gives file-based metadata priority over
  config; if the file image overrides the product's image, replace the file
  convention with a `/[lang]/og` route handler referenced from the layout's
  `openGraph.images`, and note it in the review packet.
  **Done when:** the image URL from the head loads as a 1200x630 PNG through
  `pnpm start`, and the product-image precedence check passes.
  **Outcome:** the check showed the reverse problem: a page-level `openGraph`
  block dropped the file-based image. The image moved to a static route handler,
  `app/og-image.png/route.tsx` (`/og-image.png`, outside `[lang]` and skipped by
  the proxy because of the dot), and `pageMetadata` and the layout always set
  `images`: the item's raster image when it has one, else this default.

- [x] 4. **Product structured data.** Render
  `<script type="application/ld+json">` with `jsonLdScript(productJsonLd(...))`
  on product and service detail pages (in the page files or `ProductDetail`,
  whichever already has the absolute URL inputs with less plumbing).
  **Done when:** the detail page HTML contains one valid `Product` JSON-LD block
  with localized name and description, absolute `offers.url`, and USD price;
  `pnpm test` and `pnpm build` pass.

- [x] 5. **Sitemap and robots.** Add `app/sitemap.ts` (`dynamic = "force-dynamic"`
  so new products appear without a rebuild) listing, for each locale, the home,
  `/products`, `/services`, and every published item from
  `listPublishedProducts` at its `productPath`, each with absolute `url`,
  `alternates.languages` for `en` and `ar`, and `lastModified` from `updatedAt`
  for items. Keep the URL-building logic in a pure function in `lib/seo.ts`
  with a unit test. Add `app/robots.ts`: allow `/`, disallow `/api/`, `sitemap`
  absolute `/sitemap.xml`. Both paths contain a dot, so `proxy.ts` already skips
  them; confirm they are not redirected.
  **Done when:** `/sitemap.xml` and `/robots.txt` return 200 with absolute URLs
  from `SITE_URL`, the sitemap includes both languages of every published item
  and no unpublished item, and `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Files / areas

- New: `lib/seo.ts`, `lib/seo.test.ts`, `app/og-image.png/route.tsx`,
  `components/catalog/ProductJsonLd.tsx`,
  `app/sitemap.ts`, `app/robots.ts`
- Changed: `app/[lang]/layout.tsx`, `app/[lang]/page.tsx`,
  `components/catalog/StoreListing.tsx` (`listingMetadata`),
  `app/[lang]/products/[slug]/page.tsx`, `app/[lang]/services/[slug]/page.tsx`,
  possibly `components/catalog/ProductDetail.tsx`, `app/[lang]/cart/page.tsx`,
  `.env.example`
- Reused: `localizedPath`, `LOCALES`, `DEFAULT_LOCALE` (`lib/i18n/config.ts`),
  `productPath`, `publicImageSrc`, `listPublishedProducts` (`lib/catalog.ts`),
  `requirePublishedProduct` (`lib/product-page.ts`, already cached per request),
  `meta` dictionary entries
- Unchanged: `proxy.ts` (its matcher already excludes dotted paths and `/api/`)

## Data / contracts

- `SITE_URL` - absolute origin, optionally with a base path, no trailing slash
  required. Default `http://localhost:3000` when unset. Production must set it;
  until it is, canonicals and the sitemap point at localhost.
- URL shape is unchanged: `/<lang>`, `/<lang>/products[/<slug>]`,
  `/<lang>/services[/<slug>]`. One slug serves both languages, so every item has
  an exact counterpart in the other language.
- `x-default` → the English URL (the default locale; it does not redirect).
- Canonical never includes a query string.
- Open Graph locale codes: `en_US`, `ar_AR`.
- JSON-LD price: `(priceCents / 100).toFixed(2)`, currency `USD`. Availability is
  always `InStock` because only published items render.
- No database or API changes.

## Testing

- Unit (Vitest, `pnpm test`): `lib/seo.test.ts` for alternates, metadata shape,
  image filtering, JSON-LD output and escaping, and sitemap entry building.
- Build and lint: `pnpm build`, `pnpm lint`.
- Rendered evidence: inspect the HTML of `/en`, `/ar`, `/en/products`,
  `/ar/services`, one product and one service detail in each language,
  `/en/cart`, an unknown URL, `/sitemap.xml`, `/robots.txt`, and the social image
  URL against a running app with the seeded database. No browser test command
  exists, so none is added.

## Notes for the AI

- Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`
  and the `01-metadata/` file-convention docs (`opengraph-image.md`,
  `sitemap.md`, `robots.md`) before writing code; this is Next.js 16.
- `getDictionary()` and `getLocale()` read the `lang` root param; they work in
  `generateMetadata` and in `[lang]/opengraph-image.tsx`, but not in
  `app/sitemap.ts` or `app/robots.ts`, which sit outside `[lang]` and must loop
  over `LOCALES` instead.
- Keep `lib/seo.ts` free of `next/*` runtime imports where practical
  (`import type { Metadata }` is fine) so Vitest can load it.
- Product text is admin-controlled; render it only through React text or the
  escaped JSON-LD helper, never `dangerouslySetInnerHTML` with raw JSON.
- Do not add a dependency (`schema-dts`, `next-sitemap`, and similar are not
  needed).

## Open questions

None blocking. The production domain is not named (overview Deployment TODO);
set `SITE_URL` when a deployment target is chosen.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":11332,"specSha256":"3e6e29ec487f3af97823c259984b15f230b082214994caf3bf6dcffcd7f3bfae","branch":"refs/heads/feature/seo-social-sharing","head":"7b49bd0d54fbe84211510924ea633f80176f211c","baseRef":"refs/heads/main","baseCommit":"7b49bd0d54fbe84211510924ea633f80176f211c","sourceTree":"b782eceeab4be7d7b7ff240b6004fe9607f94fbe","absentOptional":[]} -->
