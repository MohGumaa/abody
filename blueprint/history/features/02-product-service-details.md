# Feature: Product & Service Details

**From build-plan:** feature 2
**Build attempt:** 1
**Status:** verified
**Branch:** feature/product-service-details

## Goal

Give customers a simple, conversion-focused detail page for every published
digital product (`/products/[slug]`) and service (`/services/[slug]`): image,
name, price, descriptions, a "What's Included" list, service duration and
requirements, a "How It Works" section, a Stripe trust line, a small related
items section, and the Add to Cart button in its final position (disabled until
the cart ships in feature 3).

## Design reference

No screenshot or prototype exists (`prototypes/` and `blueprint/reference/` are
absent). The reference is the text sketch in `blueprint/project-plan.md`
section 12 and the UI/UX section of `blueprint/context/project-overview.md`:
modern, minimal, premium, mobile-first, light theme, primary action color
`oklch(59% 0.13 248)` used sparingly (CTA, links, accents).

## In scope

- Three new optional catalog fields with one migration: `included`,
  `durationDays`, `requirements` (see Data / contracts), added to
  `PublicProduct`, the existing JSON endpoints, and the development seed.
- `/products/[slug]` for published `DIGITAL_PRODUCT` items and
  `/services/[slug]` for published `SERVICE` items, rendered on the server per
  request.
- Page content, top to bottom: image or placeholder, type label and category,
  name (`h1`), price, short description, disabled Add to Cart button with a
  visible "Cart is coming soon." note, "Secure payment powered by Stripe" line,
  full description, "What's Included" checkmark list, service-only duration and
  "What we need from you", "How It Works" (three static steps, different copy
  for products and services), related items.
- Related items: up to 3 other published items of the same type, same category
  first, then newest. Section hidden when there are none.
- 404 for an unknown slug, an unpublished item, a malformed slug, or an item
  requested under the other type's route.
- A generic error screen with a retry action when the page fails to load.
- Page title and description metadata from the item's name and short
  description; root layout metadata changed from the scaffold text to Abody.
- Brand theme tokens in `app/globals.css`.

## Out of scope

- Any working cart behavior, `/cart`, or cart state (feature 3). The button
  stays disabled and has no click handler.
- Star ratings and reviews. No rating data exists in either plan (overview open
  question 10).
- Service packages or a "Choose Package" step (feature 13, overview open
  question 8).
- A second "features" highlight list. The user chose one stored list, shown once
  under "What's Included".
- Site header, navigation, footer, home page, and the `/products` and
  `/services` listing pages. No build-plan item covers them yet (overview open
  question 1). `app/page.tsx` is not touched.
- Open Graph images, structured data, sitemap, canonical tags (feature 21).
- Product view tracking (feature 22).
- Admin editing of the new fields and their write-time validation (features 12
  and 13).
- Installing shadcn/ui or any new dependency. Plain Tailwind is enough here.
- A loading skeleton (`loading.tsx`). The pages render fully on the server so an
  invalid URL returns a real HTTP 404; nothing links to these pages client-side
  yet except the related cards.
- Remote image host configuration. File storage is undecided (features 12, 17).

## Build loop

`workflow.stepReview` is `feature` and `workflow.checkpointCommits` is
`disabled`: implement and verify each step in order, check it off here, then
present one feature-level review packet with the complete diff and the done-when
evidence. No checkpoint commits. `/complete` creates the single feature commit.

## Build steps

- [x] **1. Add the three catalog fields, migrate, and extend the public shape.**
  Add `included`, `durationDays`, and `requirements` to `Product` in
  `prisma/schema.prisma` exactly as in Data / contracts and create the migration
  with `pnpm db:migrate`. Add the three fields to `publicProductSelect`,
  `PublicProduct`, and `toPublicProduct` in `lib/catalog.ts`. Update
  `prisma/seed.ts`: give `digital-marketing-template` and `ads-management` a
  few `included` lines, give `ads-management` `durationDays: 30` and a short
  multi-line `requirements` text, set `digital-marketing-template.image` to a
  root-relative path of a small placeholder SVG added under `public/seed/`, and
  leave `facebook-ads-guide` with no image and an empty `included` list so the
  empty states stay observable. Update the existing unit tests for the new
  fields.
  **Done when:** `pnpm exec prisma migrate status` reports the database in sync,
  the migration SQL only adds the three columns, `pnpm db:seed` run twice leaves
  four `Product` rows, `GET /api/products/ads-management` returns the three new
  fields and still no `digitalFile` or `status`, and `pnpm test`, `pnpm build`,
  and `pnpm lint` pass.

- [x] **2. Add the catalog helpers the pages need.**
  In `lib/catalog.ts` add: `isValidSlug(slug)` and use it inside
  `getPublishedProductBySlug` so a malformed slug returns `null` without a
  database query; `productPath(product)` returning `/products/<slug>` or
  `/services/<slug>` from the item's type; `publicImageSrc(image)` implementing
  the image rule in Data / contracts; `formatDurationDays(days)` ("1 day",
  "30 days"); and `listRelatedProducts(product)` implementing the related rule
  with bounded queries (`take`), the same published filter, and the same
  `publicProductSelect`.
  **Done when:** unit tests for each helper pass (cases listed under Testing),
  and `pnpm test`, `pnpm build`, and `pnpm lint` pass.

- [x] **3. Build the detail pages.**
  Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`,
  `.../04-functions/not-found.md`, `.../04-functions/generate-metadata.md`,
  `.../02-components/image.md`, and `01-app/01-getting-started/08-caching.md`
  first and follow them for `params` typing, `notFound()`, metadata, images, and
  per-request rendering. Add the brand tokens to `app/globals.css` (primary
  color, light surface, border, muted text) and remove the scaffold's
  `prefers-color-scheme: dark` override so the light theme tokens have one
  value. Create `app/products/[slug]/page.tsx` and
  `app/services/[slug]/page.tsx` as thin server components that load the item
  once per request (shared between the page and `generateMetadata`), call
  `notFound()` when it is missing or of the other type, and render one shared
  `ProductDetail` component with everything in the In scope content list except
  related items. Render the image with the approach the image guide supports for
  root-relative and arbitrary `https` sources without adding remote host
  configuration; if `next/image` cannot do that, use a plain `img` with a
  one-line reason. Set the root layout metadata to Abody.
  **Done when**, with `pnpm dev` against the seeded database:
  - `/products/digital-marketing-template` shows the image, "Digital product",
    category, name as the only `h1`, "$49.00", both descriptions, the disabled
    Add to Cart button with "Cart is coming soon.", the Stripe line, the
    checkmark list, and the product How It Works steps; no duration or
    requirements appear;
  - `/products/facebook-ads-guide` shows the placeholder instead of an image and
    no "What's Included" section;
  - `/services/ads-management` shows "30 days", "What we need from you" with its
    line breaks preserved, and the service How It Works steps;
  - `/products/ads-management`, `/services/facebook-ads-guide`,
    `/products/social-media-resources-draft`, `/products/nope`, and
    `/products/Bad_Slug` each respond with HTTP status 404;
  - the browser tab title is the item name, and the page source contains no
    `digitalFile` value;
  - the layout is readable with no horizontal scroll at 375px and at 1280px
    (screenshots);
  - `pnpm build` lists both routes as dynamic (not prerendered), and `pnpm test`
    and `pnpm lint` pass.

- [x] **4. Add the related items section.**
  Create a `RelatedProducts` server component that calls `listRelatedProducts`
  and renders up to three cards (image or placeholder, name, short description,
  price), each a link to `productPath(item)`. Render nothing, including no
  heading, when the list is empty.
  **Done when:** `/products/digital-marketing-template` shows exactly one related
  card for Facebook Ads Guide that navigates to `/products/facebook-ads-guide`,
  `/services/ads-management` shows no related section, the unpublished item
  never appears, and `pnpm test`, `pnpm build`, and `pnpm lint` pass.

- [x] **5. Add the error state and run the final checks.**
  Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`
  first. Create `app/error.tsx` with a short generic message ("Something went
  wrong. Please try again.") and a retry button, using the brand tokens. It must
  not render the error message, stack, or digest details.
  **Done when:** with `pnpm build` then `pnpm start` and the database
  unreachable, `/products/digital-marketing-template` shows the generic screen
  and the response contains no connection string, host, or Prisma error text;
  with the database back, the retry button loads the page; all step 3 and 4
  evidence still holds; `pnpm exec prisma migrate status` is in sync; and
  `pnpm test`, `pnpm build`, and `pnpm lint` pass on the final tree.

## Files / areas

- `prisma/schema.prisma`, one new folder under `prisma/migrations/`,
  `prisma/seed.ts`
- `public/seed/` - one small placeholder SVG for the seeded image (new)
- `lib/catalog.ts`, `lib/catalog.test.ts` - new fields and helpers
- `app/api/products/route.test.ts`, `app/api/products/[slug]/route.test.ts` -
  fixture updates only if they build full `PublicProduct` values; the route
  handlers themselves do not change
- `app/products/[slug]/page.tsx`, `app/services/[slug]/page.tsx` - new
- `app/error.tsx` - new (client component)
- `components/catalog/` - new folder: `ProductDetail.tsx`, `ProductImage.tsx`,
  `AddToCartButton.tsx`, `RelatedProducts.tsx`
- `app/globals.css` - brand tokens, dark override removed
- `app/layout.tsx` - metadata title and description only
- `lib/money.ts` - reused as is (`formatPriceCents`)

Not touched: `app/page.tsx`, `next.config.ts`, `package.json` dependencies,
`lib/db.ts`, `lib/api-error.ts`.

## Data / contracts

### New `Product` columns (PostgreSQL)

| Field | Prisma type | Rules |
| --- | --- | --- |
| `included` | `String[] @default([])` | ordered list of short plain-text lines; empty for existing rows |
| `durationDays` | `Int?` | whole days, services only; `null` when not set |
| `requirements` | `String? @db.Text` | plain text, services only; `null` when not set |

No other column changes. Existing rows keep working without a data backfill.
Write-time validation (positive duration, service-only fields, line length)
belongs to the admin features that introduce writes. The display side is
defensive instead: blank `included` lines are skipped, and duration and
requirements render only for `SERVICE` items with a value greater than zero or
non-blank text.

### `PublicProduct` additions (JSON, additive)

```json
{
  "included": ["string"],
  "durationDays": 30,
  "requirements": "string or null"
}
```

`durationDays` is a number or `null`. All existing fields are unchanged.
`digitalFile` and `status` remain excluded by the explicit field selection.

### Routes

| URL | Renders | 404 when |
| --- | --- | --- |
| `/products/[slug]` | published `DIGITAL_PRODUCT` | unknown, unpublished, malformed slug, or the item is a `SERVICE` |
| `/services/[slug]` | published `SERVICE` | unknown, unpublished, malformed slug, or the item is a `DIGITAL_PRODUCT` |

- Each item has exactly one canonical URL, given by `productPath`. The other
  type's route returns 404 and does not redirect.
- An unpublished item is indistinguishable from a missing one.
- Valid slug: `^[a-z0-9]+(?:-[a-z0-9]+)*$` (lowercase letters, digits, single
  hyphens), the format feature 1 defined. Anything else is a 404 with no
  database query. Because the check lives in `getPublishedProductBySlug`, the
  existing `GET /api/products/[slug]` returns its normal 404 `not_found` body
  for a malformed slug as well.
- No authentication: the pages show only public catalog data.
- Pages render per request. A price or status change in the database is visible
  on the next request.

### Related items rule

Up to 3 published items with the same `type` as the current item, excluding the
current item: same `category` first, then other categories, each group ordered
`createdAt` descending then `id`. Never loads an unbounded list.

### Rendering rules

- All catalog text (name, descriptions, category, `included`, `requirements`) is
  rendered as React text. No `dangerouslySetInnerHTML`, no Markdown or HTML
  interpretation. `description` and `requirements` preserve line breaks with CSS.
- Image rule (`publicImageSrc`): use `image` only when it is a root-relative
  path (starts with one `/`, not `//`) or parses as an absolute `https:` URL.
  Anything else (`null`, a storage key, `http:`, `javascript:`, `data:`) shows
  the placeholder. The image `alt` is the item name; the placeholder is
  decorative.
- Price uses `formatPriceCents` (4900 renders as "$49.00").
- Type labels: "Digital product" and "Service".
- How It Works copy. Products: 1. Purchase, 2. Receive access, 3. Download.
  Services: 1. Purchase, 2. Tell us what we need, 3. We get started.
- Add to Cart: a real `button type="button"` with the `disabled` attribute, no
  handler, and `aria-describedby` pointing at the visible "Cart is coming soon."
  text. Feature 3 replaces this component's behavior.
- Semantics: one `main` landmark, one `h1`, section headings as `h2`, lists as
  `ul`/`ol`, related cards as links with the item name as the accessible name,
  visible focus styles, and text contrast that meets WCAG AA on the light theme.

## Testing

- The test gate is on (`pnpm test`, Vitest, Node environment, database client
  mocked with `vi.mock()`). Steps 1 and 2 ship passing tests in the same diff, in
  `lib/catalog.test.ts`:
  - `toPublicProduct`: the three new fields pass through; `digitalFile` and
    `status` are still absent.
  - `isValidSlug`: valid slug; uppercase, underscore, leading, trailing, and
    double hyphen, empty string, and a string containing a NUL byte are invalid.
  - `getPublishedProductBySlug`: a malformed slug returns `null` and the mocked
    client is not called.
  - `productPath`: both types.
  - `publicImageSrc`: `null`, root-relative path, `//host/x`, `https` URL,
    `http` URL, `javascript:` and `data:` values, and a bare storage key.
  - `formatDurationDays`: 1 and 30.
  - `listRelatedProducts`: excludes the current item, filters on published and
    same type, puts same-category items first, and returns at most 3.
- Components, pages, and the error screen are UI and integration surfaces:
  verified with the dev or production server, HTTP status checks, and
  screenshots, not unit tests.
- No `Browser tests` command and no `Verify` command are declared, so no browser
  test coverage is added and the automated gate is `pnpm test`, `pnpm build`,
  and `pnpm lint`.
- Nothing was run while writing this spec. All evidence above is still to be
  produced during `/implement`.

## Notes for the AI

- **Prerequisite:** a reachable PostgreSQL database with `DATABASE_URL` in
  `.env`, as in feature 1. If the migration cannot connect when step 1 starts,
  stop and ask the user; do not create or substitute a database.
- This is Next.js 16 with breaking changes. Read the guides named in each step
  before writing the code; do not rely on remembered conventions. In particular,
  confirm from the docs that the chosen page setup returns a real 404 status and
  is not prerendered or cached across requests; if a documented option is needed
  for that, use it and say so in the review packet.
- Use pnpm. Add no dependencies.
- Keep the public read rule from feature 1: every catalog read goes through
  `lib/catalog.ts` with `publicProductSelect` and the `PUBLISHED` filter in the
  query. Never select `digitalFile`.
- The seed stays development-only and upsert-only; it must not delete rows.
- Use theme tokens for color; do not repeat raw `oklch` values in components.
  Use the primary color for the CTA, links, and small accents only.
- `components/` does not exist yet; this feature creates `components/catalog/`.
  Keep every component a server component except `app/error.tsx`.
- Decisions the user made for this spec: disabled Add to Cart button until
  feature 3; one stored `included` list; `durationDays` as a whole number plus
  `requirements` text; a simple related items section.
- No em dashes in generated docs, comments, or commit messages.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":17009,"specSha256":"10b0a7e9c33d8604a92f8a0b3ec86af3c833c686da318a0cdf023388a4287bfc","branch":"refs/heads/feature/product-service-details","head":"0c9b978e03d9892451d1134c1c608a509172f1ba","baseRef":"refs/heads/main","baseCommit":"1c66eb0ea74d0a5340c460cb011ceedecffcc936","sourceTree":"9a285fbbe51b1fa73ff86eb9a10923621097c39c","absentOptional":[]} -->

## Findings

### 2/F-03 [P3] closed - A slug containing a NUL byte may return 500 instead of 404

**File:** app/api/products/[slug]/route.ts:12
**Found:** 2026-10-02 by /audit (scope: current; lens: security)
**Why it matters:** The route passes the decoded path segment to the database without checking it against the documented slug format (lowercase letters, digits, single hyphens). PostgreSQL rejects a 0x00 byte in a text parameter, so `GET /api/products/%00` would likely throw inside `getPublishedProductBySlug`, be logged as a server error, and return 500 `internal_error` where the contract says an unknown slug is a 404. The response stays generic, so nothing leaks; the impact is a wrong status code and anonymous log noise. Not confirmed: the reviewer may not start a server, and Next.js may reject the segment before the handler runs. Missing validation: one request against a running server with the database reachable.
**Suggested fix:** If confirmed, return the existing 404 `not_found` before querying when the slug does not match `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, and add one unit test for it.
**Resolution:** Repaired in feature 2 (2026-10-02 by /implement). `getPublishedProductBySlug` in `lib/catalog.ts` now returns `null` before querying when the slug fails `isValidSlug`, so the route returns its normal 404. Unit tests cover a malformed slug and a NUL byte without a database call, and `GET /api/products/Bad_Slug` returned 404 against a running production server. Awaiting re-review.
Closed 2026-10-02 by /audit independent (target 0c9b978): the reviewed set included `lib/catalog.ts`, `lib/catalog.test.ts`, and `app/api/products/[slug]/route.ts`. `getPublishedProductBySlug` (`lib/catalog.ts:110`) returns `null` before any query when `isValidSlug` fails, the pattern is anchored with no multiline flag so a NUL byte, newline, or uppercase input cannot match, and the route maps `null` to its existing 404. `pnpm test` passed, including "returns null for a malformed slug without querying" with a NUL-byte case. The repair introduced no new defect. The builder's running-server 404 evidence was not re-run by the reviewer.

## Independent review

# Independent Review

**Status:** passed
**Target commit:** 0c9b978e03d9892451d1134c1c608a509172f1ba
**Base commit:** 1c66eb0ea74d0a5340c460cb011ceedecffcc936
**Base ref:** main
**Spec hash:** 10b0a7e9c33d8604a92f8a0b3ec86af3c833c686da318a0cdf023388a4287bfc
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-02T03:08:20Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-02T03:13:31Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `1c66eb0ea74d0a5340c460cb011ceedecffcc936..0c9b978e03d9892451d1134c1c608a509172f1ba` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`, `git merge-base main <target>`, `sha256sum blueprint/context/current-feature.md`, `git status --short --untracked-files=all`: pass (preflight matched target, base, and spec hash; only the two evidence files differ)
- `pnpm test`: pass (4 files, 30 tests)
- `pnpm lint`: pass (no output)
- `pnpm build`: pass (TypeScript finished; `/products/[slug]` and `/services/[slug]` listed as dynamic)
- `pnpm exec prisma migrate status`: pass (2 migrations found, database schema is up to date)
- `git status --short --untracked-files=all` after the commands: pass (no path changed other than the two evidence files)

## Evidence

- Full `1c66eb0..0c9b978` delta read: 17 files, including `lib/catalog.ts`, `lib/catalog.test.ts`, `lib/product-page.ts`, both page files, `app/error.tsx`, `app/globals.css`, `app/layout.tsx`, the four `components/catalog/` files, the migration SQL, `prisma/schema.prisma`, `prisma/seed.ts`, and the seed SVG. Nearby unchanged code read: `app/api/products/[slug]/route.ts`, `lib/money.ts`, `next.config.ts`, `package.json`.
- Security: every catalog read still goes through `publicProductSelect` with the `PUBLISHED` filter and never selects `digitalFile` or `status`; catalog text renders as React text with no `dangerouslySetInnerHTML`; malformed slugs return `null` before any query; `app/error.tsx` does not render the error, stack, or digest; the wrong-type route returns `notFound()` with no redirect.
- Next.js 16.3.8 conventions checked against the installed docs: `retry` is the stable error-boundary prop; no `loading.tsx`, Suspense boundary, or Cache Components setting exists, so `notFound()` runs before the response streams.
- Performance: one cached item query per request shared by `generateMetadata` and the page (`react` `cache`), plus at most two bounded related queries (`take` 3 and remaining).
- Tests: the cases listed in the spec's Testing section are all present in `lib/catalog.test.ts`; no skipped, focused, or placeholder tests found.
- Migration SQL only adds the three columns; no dependency or `next.config.ts` change; no em dashes in the delta.
- Contrast computed from the theme tokens: white on `primary-strong` 6.52:1, muted on white 7.42:1, muted on surface 6.91:1, white on `primary` 4.09:1 (see F-05).
- F-03 re-examined against the repaired code and closed.

## Findings

- F-04 [P3] open - `publicImageSrc` accepts a tab or newline before a second slash (`lib/catalog.ts:67`)
- F-05 [P3] open - retry button hover state drops below WCAG AA contrast (`app/error.tsx:17`)
- F-02 [P3] open - seed upsert overwrites existing rows with no development-only guard (`prisma/seed.ts:84`), carried forward and still present
- F-01 [P3] open - carried forward; the unused-code half no longer holds, the archived feature 1 spec wording remains
- F-03 [P3] closed this pass
- No P0 or P1 finding is `open` or `fixed`.

## Remaining risk

- No server was started, so the HTTP 404 statuses, the rendered pages at 375px and 1280px, the tab title, the database-unreachable error screen, and the retry behavior were not re-observed by the reviewer; they rest on the builder's evidence and on static reading.
- `pnpm db:seed` was not run by the reviewer (out of bounds for this review), so "seed twice leaves four rows" was not re-verified.
- No `Browser tests` or `Verify` command is declared, and no security or performance scan command exists; none was run. No dependency vulnerability scan was performed.
- The display-side guards in `ProductDetail` (blank `included` lines, service-only duration and requirements) have no unit tests, as the spec assigns components to server and screenshot evidence.
- `lib/product-page.ts` shipped but is not named in the spec's Files / areas list; it implements the spec's "load the item once per request" requirement.
- Dashboard activity state was not written by the reviewer, because this review was limited to writing the findings ledger and this record.
