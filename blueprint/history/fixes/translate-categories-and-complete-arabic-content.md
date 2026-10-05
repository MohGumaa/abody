# Fix: Translate categories and complete Arabic content

**Type:** Fix
**Status:** verified
**Branch:** fix/translate-categories-and-complete-arabic-content

## The problem

When the site is switched to Arabic, some text stays in English. The most visible
place is the category tiles on the home page.

- `Product.category` is stored only in English ("Templates", "Guides", "Marketing
  Services"). There is no `categoryAr`, unlike every other content field.
  Feature 3b deferred this on purpose (overview open question 3).
- It shows untranslated in five places: home category tiles
  (`app/[lang]/page.tsx`), the listing filter chips (`StoreListing.tsx`), the
  product card (`ProductCard.tsx`), the detail page (`ProductDetail.tsx`), and the
  cart line (`CartLineItem.tsx`).
- The seed "Facebook Ads Guide" has only `nameAr`, on purpose, to show the
  English fallback. On `/ar`, its short and full descriptions are English.

A sweep of `app/` and `components/` found no other hardcoded UI text. Every
interface string comes from `lib/i18n/dictionaries`, and `ar.ts` has no English
values left. API error messages stay English, as decided in 3b.

## The fix

Follow the existing per-field pattern: an optional Arabic column with a fallback
to English.

- **Schema:** add `categoryAr String?` to `Product` through a migration.
- **Key vs. label:** `category` stays the language-neutral key for the
  `?category=` URL value, filtering, related-item matching, and sort order.
  Rendering uses a new localized field. The product JSON-LD `category` in
  `lib/seo.ts` uses it too, matching its already-localized `name`.
- **`lib/catalog.ts`:** select `categoryAr`. `PublicProduct` gains
  `categoryLabel: string`. On Arabic pages it is `categoryAr` when it has text,
  otherwise `category`. On English pages it is always `category`.
- **`lib/listing.ts`:** `summarizeCategories` also returns `label`, taken from
  the first item in each group, which is the newest item because input arrives
  newest first. Sorting stays by the English key, so the order is the same in
  both languages. `lib/home.ts` passes `label` through.
- **Rendering:** the five places above show the label. Links and filters keep
  using the key, so a URL such as `/ar/products?category=Templates` still works.
- **Seed:** add `categoryAr` to all four seed products. Fill the Facebook Ads
  Guide's `shortDescriptionAr` and `descriptionAr`. The English fallback is
  already covered by unit tests in `lib/catalog.test.ts`, so the seed no longer
  needs to show it. Update that seed comment.
- **Overview:** mark open question 3 as resolved.

**Must not break:**
- English pages look exactly the same.
- Existing category URLs, filters, related items, and their order.
- `digitalFile` and `status` stay out of public selects.

**Out of scope:**
- A `Category` model or a fixed category list. The admin product form (features
  13 and 14) adds the `categoryAr` input.
- Translating API error messages or the slug.

**Decision for review:** the translation is stored per product, not per
category. That matches the other `*Ar` fields and needs no new model. The cost:
two products in the same category could hold different Arabic labels, and then
the newest one's label is shown. If you want one translation per category
instead, say so before `/implement`.

## Build steps

- [x] **1. Localized category data.** Migration, `catalog.ts`,
  `listing.ts` and `home.ts` labels, unit tests, and seed content.
  **Done when:** `pnpm exec prisma migrate status` is clean. Tests cover
  `categoryLabel` (Arabic value, blank-value fallback, English page), and
  `summarizeCategories` carries the first item's label while still sorting by
  key. `pnpm test` passes.
- [x] **2. Render labels.** Switch the five render sites to the label, and
  update the overview's open question.
  **Done when:** `/ar` shows Arabic categories on the home tiles, filter chips,
  cards, detail page, and cart. `/en` is unchanged. `pnpm lint` and `pnpm build`
  pass.

## Verify

- `pnpm db:migrate`, `pnpm db:seed`, `pnpm test`, `pnpm lint`, `pnpm build`.
- With `pnpm dev`, on `/ar`: the home category tiles read "قوالب", "أدلة",
  "خدمات تسويقية". Clicking a tile filters the listing, and the active chip is
  highlighted. "Facebook Ads Guide" shows Arabic descriptions. The card, detail
  page, and cart line show the Arabic category.
- Switch to `/en`: everything reads as before.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":4536,"specSha256":"9bb26c2d58d1b9ce7ffb917c4187154897795c1aa7dc11e43231c68320b5c56c","branch":"refs/heads/fix/translate-categories-and-complete-arabic-content","head":"6fa9f5127bdf682b48b6d2550404858e9105ea0b","baseRef":"refs/heads/main","baseCommit":"c7bc95a53c6efc9d713bd5774bda13920e1fd356","sourceTree":"1f329d80e9b8950696dbd98a4f80f3fe0a763c3f","absentOptional":[]} -->

## Independent review

# Independent Review

**Status:** passed
**Target commit:** 6fa9f5127bdf682b48b6d2550404858e9105ea0b
**Base commit:** c7bc95a53c6efc9d713bd5774bda13920e1fd356
**Base ref:** main
**Spec hash:** 9bb26c2d58d1b9ce7ffb917c4187154897795c1aa7dc11e43231c68320b5c56c
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-05T13:55:48Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-05T13:59:02Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `c7bc95a53c6efc9d713bd5774bda13920e1fd356..6fa9f5127bdf682b48b6d2550404858e9105ea0b` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (request verified; only `blueprint/context/review.md` differed)
- `pnpm test`: pass (19 files, 243 tests)
- `pnpm lint`: pass
- `pnpm exec prisma migrate status`: pass (5 migrations, schema up to date)
- `pnpm build`: pass

## Evidence

- Full delta reviewed: 20 files, covering the migration, `prisma/schema.prisma`, `lib/catalog.ts`, `lib/listing.ts`, `lib/home.ts`, `lib/seo.ts`, the five render sites, the seed, and the tests.
- `publicProductSelect` adds only `categoryAr`. `digitalFile` and `status` stay out of public selects (`lib/catalog.ts:8-29`).
- `categoryLabel` uses `categoryAr` only on Arabic pages and only when it has text (`lib/catalog.ts:141-142`). Tests cover the Arabic value, null, empty, and whitespace fallback, and the English page.
- Filters, `?category=` links, related-item matching (`lib/catalog.ts:225,234`), and sort order (`lib/listing.ts:29-31`) still use the English key. Only labels changed at the five render sites.
- `summarizeCategories` takes the first item's label. The listing test proves this by giving a second Templates item a different label. Input is newest first through `orderBy createdAt desc`.
- The seed upsert `update: fields` carries the new Arabic fields, so `pnpm db:seed` can be re-run safely.
- The migration is additive and nullable (one `ADD COLUMN "categoryAr" TEXT`).

## Findings

- F-09 [P3] open: the product JSON-LD test fixture cannot tell `categoryLabel` from `category`.
- No P0 or P1 findings. The earlier P3 entries (F-01, F-02, F-04, F-05, F-06, F-08) are unaffected by this delta.

## Remaining risk

- Check was not required and did not run. `/ar` and `/en` were not checked in a browser, and no browser test harness is configured.
- `pnpm db:seed` and `pnpm db:migrate` did not run, as the review boundary requires. The seeded Arabic content was not checked against a live database.
- There is no standalone typecheck or `Verify` command. `pnpm build` provided type checking.
- Dashboard activity state was not written, because the reviewer was limited to writing `findings.md` and `review.md`.
