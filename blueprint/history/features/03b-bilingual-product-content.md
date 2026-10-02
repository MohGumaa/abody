# Feature: Bilingual Product Content

**From build-plan:** feature 3b
**Build attempt:** 1
**Branch:** feature/bilingual-product-content
**Status:** verified

## Goal

Store product and service name, short description, description, what's
included, and requirements in English and Arabic, and show the content that
matches the page language. After this feature, `/ar/products/<slug>` and
`/ar/services/<slug>` read in Arabic end to end wherever Arabic content exists,
and fall back to the English content field by field where it does not.

Decisions made at spec time (the plans leave them open):

- **Storage shape:** nullable Arabic columns next to the existing columns on
  `Product`. The plan fixes the languages at exactly two, so a translation table
  or JSON column has no current requirement.
- **Existing columns stay as they are** and hold the English content. English is
  the default language and the fallback.
- **Arabic is optional per field.** A missing or blank Arabic value shows the
  English value for that field only. An item is never hidden for lacking Arabic.
- **API:** the two catalog endpoints gain an optional `lang` parameter. The
  response shape does not change.

## In scope

- A migration that adds the Arabic columns to `Product`.
- Catalog reads that take a language and return content in that language with
  the per-field English fallback.
- Product and service detail pages, their page title and description metadata,
  the image alt text, and the related-items cards show content in the page
  language.
- `GET /api/products` and `GET /api/products/[slug]` accept `lang=en|ar`.
- Arabic content for the development seed data.

## Out of scope

- **Category.** It is not in the build-plan line, it is free text repeated on
  every product, and related items match on it. It keeps rendering as stored
  with `dir="auto"`. See Open questions.
- Translating `slug`. One slug serves both languages.
- The admin product form and any rule that requires Arabic before publishing
  (features 13 and 14).
- Renaming the existing columns (for example to `nameEn`).
- A translation table, JSON content column, or any i18n or validation
  dependency.
- Translating API error messages. They stay English, as shipped.
- `hreflang`, sitemap, and structured data (feature 22).
- Changes to price, duration, or interface text formatting (done in 3a).
- Listing pages and the home page. They do not exist yet.

## Build loop

`workflow.stepReview` is `feature` and `workflow.checkpointCommits` is
`disabled`: implement every step below in order, run each step's check as you
go, then present one review packet after the last step. No per-step approval
pauses and no checkpoint commits. `/complete` creates the final feature commit.

## Build steps

- [x] **1. Arabic columns and seed content.** Add `nameAr`,
  `shortDescriptionAr`, `descriptionAr`, `includedAr`, and `requirementsAr` to
  `Product` in `prisma/schema.prisma` as specified under Data / contracts.
  Create the migration with `pnpm db:migrate` (name it
  `add_product_arabic_content`); do not use `db push`. Add Arabic content to
  `prisma/seed.ts` as specified under Seed data.
  Check: read the generated SQL before applying it. It must only add columns.
  If Prisma proposes dropping or altering an existing column, stop.
  **Done when:** the migration SQL contains only `ADD COLUMN` statements,
  `pnpm exec prisma migrate status` reports the database in sync, `pnpm db:seed`
  succeeds and can be re-run, the English values of the seeded rows are
  unchanged, and `pnpm test` and `pnpm build` pass.

- [x] **2. Localized catalog reads and pages.** In `lib/catalog.ts`, select the
  Arabic columns and make `toPublicProduct`, `listPublishedProducts`,
  `getPublishedProductBySlug`, and `listRelatedProducts` take a required locale
  and apply the fallback rule. `PublicProduct` keeps its exact current fields.
  Update `lib/product-page.ts`, both detail pages (including
  `generateMetadata`), and `RelatedProducts` to pass the page locale. The two
  API routes pass `DEFAULT_LOCALE` for now. Replace the stale comment above
  `ProductDetail` that says content is one language; keep `dir="auto"` on stored
  content because a fallback value can still be English on an Arabic page.
  Check: confirm `getLocale()` (the `next/root-params` getter) works inside
  `generateMetadata` and inside the `cache`-wrapped loader. If it does not, read
  `lang` from the page `params` and validate it with `isLocale`.
  **Done when:** on the dev server `/ar/products/digital-marketing-template`
  shows the Arabic name, short description, description, and included lines,
  and its `<title>` is the Arabic name; `/ar/services/ads-management` also
  shows Arabic requirements; `/ar/products/facebook-ads-guide` shows the Arabic
  name with the English description (fallback) and no layout break; related
  cards on an Arabic page show Arabic names; every `/en/...` page reads exactly
  as before; and `pnpm test` (with the new tests under Testing) and
  `pnpm build` pass.

- [x] **3. API language parameter and final checks.** Add the optional `lang`
  query parameter to `GET /api/products` and `GET /api/products/[slug]` as
  specified under Data / contracts, validated before any query runs.
  **Done when:** `/api/products` and `/api/products?lang=en` return the same
  body as before this feature; `/api/products?lang=ar` returns Arabic values
  with English fallback in the same field names; `?lang=fr` and `?lang=AR`
  return 400 `invalid_lang`; `?type=SERVICE&lang=ar` applies both; no response
  contains a key ending in `Ar`, `digitalFile`, or `status`; and `pnpm test`,
  `pnpm build`, and `pnpm lint` all pass.

## Files / areas

- `prisma/schema.prisma` - five new `Product` fields.
- `prisma/migrations/<timestamp>_add_product_arabic_content/` (new, generated).
- `prisma/seed.ts` - Arabic content.
- `lib/catalog.ts`, `lib/catalog.test.ts` - select, locale parameter, fallback.
- `lib/product-page.ts` - passes the locale to the cached loader.
- `app/[lang]/products/[slug]/page.tsx`,
  `app/[lang]/services/[slug]/page.tsx` - only if the locale has to come from
  `params` (see the check in step 2).
- `components/catalog/RelatedProducts.tsx` - passes the locale it already reads.
- `components/catalog/ProductDetail.tsx` - comment only; no markup change is
  expected.
- `app/api/products/route.ts`, `app/api/products/[slug]/route.ts` and their
  test files - `lang` parameter.
- `lib/generated/prisma` is regenerated, not edited, and not committed.

## Data / contracts

**New `Product` columns.** All additive; no existing column changes.

| Field | Prisma type | Database | Meaning |
| --- | --- | --- | --- |
| `nameAr` | `String?` | `TEXT` null | Arabic name |
| `shortDescriptionAr` | `String?` | `TEXT` null | Arabic short description |
| `descriptionAr` | `String?` `@db.Text` | `TEXT` null | Arabic description |
| `includedAr` | `String[]` `@default([])` | `TEXT[]` default empty | Arabic "What's Included" lines |
| `requirementsAr` | `String?` `@db.Text` | `TEXT` null | Arabic requirements, services only |

Existing rows get `NULL` (and an empty array) and keep working through the
fallback. No backfill.

**Fallback rule**, applied per field when the locale is `ar`:

- Text fields: use the Arabic value when it is not null and not blank after
  trimming; otherwise the English value. The stored value is returned as is,
  not trimmed.
- `included`: use `includedAr` when it has at least one non-blank line;
  otherwise `included`. The two lists are never merged.
- `requirements`: Arabic when present; otherwise the English value, which may
  itself be null.

When the locale is `en`, the Arabic columns are ignored entirely.

**`PublicProduct`.** Unchanged field names and types. `name`,
`shortDescription`, `description`, `included`, and `requirements` carry the
localized values. `category`, `slug`, prices, dates, and everything else are
language-neutral. The Arabic columns are read by the query but never appear as
their own keys in a `PublicProduct` or any response. `digitalFile` and `status`
stay out of the select.

**Catalog functions.** The locale is a required argument (no default), so a new
caller cannot silently get English:

- `toPublicProduct(row, locale)`
- `listPublishedProducts({ type?, locale })`
- `getPublishedProductBySlug(slug, locale)`
- `listRelatedProducts(product, locale)` - still matches on `type` and
  `category`; category is language-neutral, so matching is the same in both
  languages.

**API.**

| Request | Success | Errors |
| --- | --- | --- |
| `GET /api/products[?type=][&lang=]` | 200 `{ "products": PublicProduct[] }` | 400 `invalid_type`, 400 `invalid_lang`, 500 `internal_error` |
| `GET /api/products/[slug][?lang=]` | 200 `{ "product": PublicProduct }` | 400 `invalid_lang`, 404 `not_found`, 500 `internal_error` |

- `lang` accepts exactly `en` or `ar` (lowercase), checked with the existing
  `isLocale`. Absent means `en`, so today's responses are unchanged.
- Any other value, including an empty `lang=`, returns 400 with code
  `invalid_lang` and message `lang must be en or ar.` through the existing
  `apiError` helper, before any database query. When both `type` and `lang` are
  invalid, `invalid_type` is reported (it is checked first).
- The API does not read the `lang` cookie or `Accept-Language`.

**Pages.** The page locale comes from the URL only, as in 3a. Product content
still renders as escaped React text, never as HTML, with `dir="auto"`.

**Seed data.** Development data only.

- `digital-marketing-template` and `ads-management`: Arabic for every
  translatable field.
- `facebook-ads-guide`: `nameAr` only, so the per-field fallback is visible.
- `social-media-resources-draft` (unpublished): no Arabic.
- Reuse the approved wording in `prototypes/i18n.js` wherever a string matches
  (both product names, the template's short description and description,
  "Campaign planning template", "Ads Management"). `prototypes/` is untracked
  reference material: copy the strings, never import from it.

## Testing

`pnpm test` is a gate for the logic in steps 2 and 3. Tests live next to the
source and keep mocking `@/lib/db`.

- `toPublicProduct`: `en` returns the English values even when Arabic exists;
  `ar` returns Arabic for each of the five fields when present; null, empty,
  and whitespace-only Arabic text each fall back to English; an empty
  `includedAr` and one holding only blank lines fall back to `included`; null
  `requirementsAr` with null `requirements` stays null; the result has no
  `nameAr`, `shortDescriptionAr`, `descriptionAr`, `includedAr`,
  `requirementsAr`, `digitalFile`, or `status` key.
- `listPublishedProducts`, `getPublishedProductBySlug`, `listRelatedProducts`:
  the existing query assertions still hold (where, order, limits, no private
  fields in the select) and the locale reaches the mapping.
- `GET /api/products`: no `lang` calls the catalog with `en`; `lang=ar` passes
  `ar`; `lang=fr`, `lang=AR`, and `lang=` return 400 `invalid_lang` without
  querying; `type` and `lang` combine.
- `GET /api/products/[slug]`: `lang=ar` passes `ar`; an invalid `lang` returns
  400 without querying; the existing 404 and 500 cases still pass.

Not unit tested: the migration, the seed, the pages, and the visual result. No
`Browser tests` command is declared, so no browser harness is added. Those are
verified against the dev server and the database in the step checks and by
`pnpm build` and `pnpm lint`. There is no `Verify` command. Nothing in this spec
has been run yet.

## Notes for the AI

- Read the relevant Next.js 16 docs in `node_modules/next/dist/docs/` before
  touching the pages or route handlers. `next/root-params` does not work in
  route handlers; the API reads `lang` from the query string.
- Step 1 needs `DATABASE_URL` in `.env` and a reachable database. If it is not
  available, stop and say so; do not hand-write the migration or skip it.
- Keep one `publicProductSelect`. Do not build a second select per language.
- Do not add a `category` translation, a `Category` model, or a `nameEn`
  rename. Do not make the Arabic columns required.
- New Arabic seed strings that are not in `prototypes/i18n.js` are first
  drafts. List them in the review packet so a native speaker can approve them.
- Arabic text has no letter-spacing and uses Tajawal already (3a). Do not add
  per-element font or direction classes for content.
- No em dashes, en dashes, or ellipsis characters in code comments or copy.

## Open questions

Neither blocks this feature.

- **Category language.** Categories stay as stored (English today) on Arabic
  pages. Translating them well means one translation per category, not one per
  product, which belongs with the feature that defines categories (store
  listing or admin product management). The plans have no item for it yet.
- **Is Arabic required to publish?** This spec makes it optional with an
  English fallback. Features 13 and 14 (admin forms) decide whether to enforce
  it.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":13049,"specSha256":"4851545901bab8d38d1df99ab7746858fcabb330f7292eaeb4f3281566437064","branch":"refs/heads/feature/bilingual-product-content","head":"99546610c2122cd67be1a7c8a87fcb10873e0010","baseRef":"refs/heads/main","baseCommit":"59e4ca68d61986912039fd759f9bb93894e28da1","sourceTree":"53df9f0bfd15bbe7adb3123cad44a8f6f8c8f463","absentOptional":[]} -->

## Independent review

# Independent Review

**Status:** passed
**Target commit:** 99546610c2122cd67be1a7c8a87fcb10873e0010
**Base commit:** 59e4ca68d61986912039fd759f9bb93894e28da1
**Base ref:** main
**Spec hash:** 4851545901bab8d38d1df99ab7746858fcabb330f7292eaeb4f3281566437064
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-02T07:33:13Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-02T07:36:16Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `59e4ca68d61986912039fd759f9bb93894e28da1..99546610c2122cd67be1a7c8a87fcb10873e0010` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --short --untracked-files=all`: pass (preflight matched target, base, and spec hash; only `blueprint/context/review.md` differed)
- `git diff 59e4ca68..99546610`: pass (14 files, 561 insertions, 59 deletions, all read)
- `pnpm test`: pass (5 files, 60 tests)
- `pnpm lint`: pass (no output)
- `pnpm build`: pass (compiled, TypeScript finished, both detail routes and both API routes built as dynamic)
- `pnpm exec prisma migrate status`: pass (3 migrations found, database schema up to date)
- Search for em dash, en dash, and ellipsis characters in the delta: pass (none)
- Search for skipped, focused, or todo tests under `app` and `lib`: pass (none)

## Evidence

- Migration `prisma/migrations/20261002065942_add_product_arabic_content/migration.sql` contains only five `ADD COLUMN` clauses, matching the types in the spec's Data / contracts table and the `included` precedent from the previous migration.
- `lib/catalog.ts:92-129` applies the per-field fallback exactly as specified: text fields use Arabic only when non-null and non-blank after trimming and return the stored value untrimmed, `includedAr` is used only when at least one line has text and is never merged, and the Arabic columns are ignored for `en`.
- `PublicProduct` (`lib/catalog.ts:34-50`) is unchanged. The Arabic columns are selected but never copied to the result under their own keys, and `digitalFile` and `status` remain out of `publicProductSelect`.
- Both route handlers validate `lang` with `isLocale` before any catalog call, return 400 `invalid_lang` for `fr`, `AR`, and an empty value, default to `DEFAULT_LOCALE` when absent, and check `type` first. They read only the query string, not the cookie or `Accept-Language`.
- Every caller of the four catalog functions passes a locale; the locale is a required argument, confirmed by the passing type check in `pnpm build`.
- `lib/product-page.ts:8-15` keeps the React `cache` wrapper with `(slug, locale)` as the key, so `generateMetadata` and the page still share one query per request. The Next.js 16.3 `next/root-params` reference documents the getter as callable from server components and shared server utilities and unsupported only in client components, server actions, route handlers, and `unstable_cache`, none of which this delta uses.
- Product content still renders as escaped React text with `dir="auto"`; no `dangerouslySetInnerHTML` or inline style was added.
- Seed Arabic strings for both product names, the template short description and description, "Campaign planning template", and "Ads Management" match `prototypes/i18n.js` character for character. `facebook-ads-guide` sets `nameAr` only and the unpublished draft sets no Arabic.
- No new dependency, query, or abstraction was added. Related-item matching and query counts are unchanged.

## Findings

- F-06 [P3] open (new): blank-Arabic fallback is untested for `name` and `description`, and the "not trimmed" rule has no test.
- F-02 [P3] open (re-examined, still present): seed upsert overwrite, now also covering the Arabic columns.
- F-04 [P3] open (re-examined, still present): `publicImageSrc` tab or newline case, now at `lib/catalog.ts:73`.
- F-01 and F-05 are outside this delta and were not re-examined.
- No P0 or P1 finding is `open` or `fixed`.

## Remaining risk

- No dev server was started, so the browser done-whens in steps 2 and 3 (Arabic name, `<title>`, per-field fallback, related cards, unchanged English pages, live API bodies) were not observed by this reviewer. Check was not required by the request.
- `getLocale()` inside `generateMetadata` is confirmed only by the build and the Next.js reference, not by a rendered `<title>`.
- `pnpm db:seed` was not run (it writes to the database), so seed re-run behaviour and the unchanged English values of seeded rows are unverified here.
- No `Browser tests` command and no `Verify` command are declared, so there is no automated browser or combined gate.
- No security scanner or dependency audit command is declared; none was run and no network-backed tool was used.
- A field that falls back to English on an Arabic page carries `dir="auto"` but no `lang="en"`, so a screen reader will read it with the Arabic voice. The spec chose direction-only handling; this is a decision for the admin content features, not a defect in this delta.
- The nine Arabic seed strings that are not in `prototypes/i18n.js` (the ads-management short description, description, included lines, and requirements, plus two template included lines) are first drafts awaiting native-speaker approval, as the spec notes.
- The dashboard activity record was not written from the reviewer context because the reviewer was limited to the two evidence files.
