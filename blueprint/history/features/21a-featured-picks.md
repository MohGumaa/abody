# Feature: Featured Picks

**From build-plan:** feature 21a
**Build attempt:** 1
**Branch:** feature/featured-picks
**Status:** verified

## Goal

Admins choose which products and services the home page shows. Each product or
service gets an optional featured position (1, 2, 3...). The home hero card, the
Featured products row, and the Services row show published picks in that order.
When nothing is picked, they show the newest items, as they do today.

## In scope

- A nullable `Product.featuredRank` column and its migration.
- A "Featured position" field on the admin product and service forms (create
  and edit), validated on the server.
- A "Featured" column on `/admin/products` and `/admin/services`.
- The home page orders products and services with picks first, by position.
  Open slots fill with the newest items that have no position.

## Out of scope

- Editable hero or call-to-action text, showing or hiding sections, the
  announcement bar (21b).
- `/admin/settings` and the contact email (21c).
- Drag-and-drop or a separate "arrange featured" screen.
- Changing the listing pages, related items, cart suggestions, or
  `/api/products` order or response shape.
- Image upload (overview open question 7).

## Build loop

`workflow.stepReview` is `feature` and `checkpointCommits` is `disabled`.
Implement all steps, run the checks after each step, and present one review
packet at the end. No checkpoint commits. `/complete` makes the feature commit.

## Build steps

1. [x] **Schema and form parsing.** Add `featuredRank Int?` to `Product` with a
   comment, and create the migration with
   `pnpm exec prisma migrate dev --name add_product_featured_rank`. In
   `lib/admin-product-rules.ts`, add `FEATURED_RANK_MIN = 1`,
   `FEATURED_RANK_MAX = 99`, the `featuredRank` field, and the
   `invalid_featured_rank` error. In `lib/admin-products.ts`, read
   `featuredRank` for both types. Blank means `null`. Otherwise it must be a
   1-2 digit whole number from 1 to 99. Return it in `ProductFormData`.
   Because `create` and `update` in `actions/admin-products.ts` spread
   `parsed.data`, they save the value with no further change.
   **Done when:** unit tests in `lib/admin-products.test.ts` cover blank to
   null, `"1"` and `"99"` accepted, and `"0"`, `"100"`, `"1.5"`, `"-1"`, and `"abc"`
   rejected for both types. The `actions/admin-products.test.ts` create and update
   tests show `featuredRank` in the saved data. `pnpm test` passes and the
   migration applies cleanly (`pnpm exec prisma migrate status`).

2. [x] **Admin form field and list column.** In `components/admin/ProductForm.tsx`,
   add an optional number input `featuredRank` labelled "Featured position",
   with `min=1`, `max=99`, `step=1`, and `inputMode="numeric"`. Its hint reads:
   "Shows on the home page in this order (1 first). Leave blank to not
   feature. Only published items appear." Error text for
   `invalid_featured_rank` is "Enter a whole number from 1 to 99." Wire the
   label, hint, and error the same way as the existing fields (association,
   announcement, focus on first error, and cleared on a valid resubmit). Pass
   the initial value from `app/admin/products/[id]/page.tsx` and
   `app/admin/services/[id]/page.tsx` (`""` when null). New pages start blank.
   Add `featuredRank` to `listAdminProducts` and `AdminProduct` / `getAdminProduct`
   in `lib/admin.ts`. Show a "Featured" column in both admin lists: `#n`, or
   "—" with an accessible "Not featured" label.
   **Done when:** an admin can set, change, and clear the position on a product
   and a service, the value persists across reloads, an invalid value shows the
   inline error with the typed value kept, and the lists show the position.
   `pnpm test`, `pnpm lint`, and `pnpm build` pass.

3. [x] **Home page ordering.** In `lib/catalog.ts`, add
   `listHomeProducts(locale)`. It reads published rows with `publicProductSelect`
   plus `featuredRank`, newest first (`createdAt desc, id asc`), and returns
   `PublicProduct & { featuredRank: number | null }`. `listPublishedProducts`
   and `publicProductSelect` stay unchanged, so the public API never exposes
   the field. In `lib/home.ts`, have `selectHomeSections` accept items with
   `featuredRank`. Within each type, it stable-sorts ranked items first by
   position ascending, with equal positions keeping input (newest-first) order,
   then unranked items in input order. Then it slices as today: hero is the
   first product, the Featured row is the first 4 products, and the Services
   row is the first 2 services. Categories stay the same. Update the stale
   "until feature 21" comment. Switch `app/[lang]/page.tsx` to
   `listHomeProducts`.
   **Done when:** `lib/home.test.ts` covers no picks (unchanged newest order),
   picks ordered by position, picks first with newest unranked items filling
   the remaining slots, tied positions keeping newest-first order, the hero
   being the lowest-position product, and services ordered independently of
   products. Existing home tests still pass. `pnpm test`, `pnpm lint`, and
   `pnpm build` pass. With the dev database, giving an older published product
   position 1 makes it the hero card and the first Featured card in `/en` and
   `/ar`. Giving one to an unpublished item changes nothing.

## Files / areas

- `prisma/schema.prisma`, new `prisma/migrations/<timestamp>_add_product_featured_rank/`
- `lib/admin-product-rules.ts`, `lib/admin-products.ts`, `lib/admin-products.test.ts`
- `actions/admin-products.test.ts` (assertions only; the action code needs no change)
- `components/admin/ProductForm.tsx`
- `app/admin/products/[id]/page.tsx`, `app/admin/services/[id]/page.tsx`,
  `app/admin/products/page.tsx`, `app/admin/services/page.tsx`
- `lib/admin.ts` (`listAdminProducts`, `AdminProduct`, `getAdminProduct`)
- `lib/catalog.ts` (`listHomeProducts`), `lib/home.ts`, `lib/home.test.ts`
- `app/[lang]/page.tsx`

## Data / contracts

- `Product.featuredRank Int?`. `null` means not featured. When set, it is a
  whole number from 1 to 99, with no default and no unique constraint. Two
  items may share a position, and the newer one shows first. Admins never get
  a conflict error. It applies to both types, and products and services are
  ordered separately. It is kept when an item is unpublished, ignored while
  unpublished, and deleted with the row.
- Form field name `featuredRank`. Blank means `null`; any other value must
  match `^\d{1,2}$` and fall in 1-99, else the error is `invalid_featured_rank`. The
  type still comes from the bound action, never from the form.
- Writes happen only through the existing `create`/`update` server actions,
  which already call `requireAdmin()` and scope by type. No new route or
  action.
- `PublicProduct` and `/api/products` responses are unchanged.
  `featuredRank` reaches only the home page's server render.
- Revalidation: the existing `revalidateProductPages()` already covers
  `/[lang]`, so a save updates the home page.

## Testing

- Vitest unit tests for parsing (`lib/admin-products.test.ts`), saved data in
  the actions (`actions/admin-products.test.ts`), and home ordering
  (`lib/home.test.ts`).
- `pnpm test`, `pnpm lint`, and `pnpm build` at the end of each step.
- There is no browser test command. Step 3's dev-database check is manual and
  is reported only if it was actually run.

## Notes for the AI

- Fill behaviour (chosen; reversible and stores nothing): picks come first, and
  remaining slots fill with the newest unranked items. So picking 2 of 4
  products still shows 4 cards.
- Keep the home page's empty states unchanged: no products, no services.
- `featuredRank` must never be added to `publicProductSelect`. The listing
  pages and the API share it.
- Admin UI is English-only. No dictionary changes are needed.
- The seed (`prisma/seed.ts`) can stay as is: new rows default to `null`.
- Implementation note: the field is a text input with `inputMode="numeric"`
  and `maxLength=2`, matching the existing duration field, instead of
  `type="number"`. The form is `noValidate` and the server checks the range.
- Read the Next.js 16 docs in `node_modules/next/dist/docs/` before touching
  server actions or caching APIs.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":8225,"specSha256":"201a0c8e5d5ffaad0b12a9078ab71de4e727847e871b6456f7ba36faf6645ebe","branch":"refs/heads/feature/featured-picks","head":"46a0ea2a15ab0cd01e62f68cc2a479ac8fa22c8d","baseRef":"refs/heads/main","baseCommit":"7881430a58a70e9feefe3c375b479581ed37cb36","sourceTree":"0e2c1207a390fbbf00d09be04a75f689a800c14b","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 46a0ea2a15ab0cd01e62f68cc2a479ac8fa22c8d
**Base commit:** 7881430a58a70e9feefe3c375b479581ed37cb36
**Base ref:** refs/heads/main
**Spec hash:** 201a0c8e5d5ffaad0b12a9078ab71de4e727847e871b6456f7ba36faf6645ebe
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-11T04:27:16Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-11T04:34:24Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `7881430a58a70e9feefe3c375b479581ed37cb36..46a0ea2a15ab0cd01e62f68cc2a479ac8fa22c8d` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `git rev-parse HEAD` / `git merge-base refs/heads/main HEAD` / `sha256sum blueprint/context/current-feature.md` / `git status --porcelain --untracked-files=all`: pass (HEAD, merge base, and spec hash match; only `blueprint/context/review.md` dirty; spec is tracked, so no snapshot)
- `pnpm test`: pass (55 files, 928 tests)
- `pnpm lint`: pass (no output)
- `pnpm build`: pass (compiled and type-checked)
- `pnpm exec prisma migrate status`: pass (read-only; 9 migrations, database schema up to date)

### Evidence

- Full 19-file delta read: schema and migration (nullable `featuredRank INTEGER`, no default or unique), parser (`^\d{1,2}$` plus 1-99 range, blank to null, trimmed, typed value kept on error), admin form section, edit-page initial values, admin list columns, `lib/admin.ts` selects, `listHomeProducts`, `selectHomeSections` stable sort, home page switch.
- Security: writes only through the existing `create`/`update` actions (`requireAdmin`, type from the bound action, `parsed.data` spread); `publicProductSelect` and `listPublishedProducts` unchanged, so `/api/products` and listings do not expose `featuredRank`; `ProductCard` is a server component, so the field stays in the server render.
- Performance: the home page still runs one unpaginated published-catalog query, as before this delta; ordering is an in-memory stable sort per type.
- Tests: parser accept/reject cases for both types, action saved-data assertions for create/update/clear, and home ordering cases (no picks, by position, fill, ties, hero, services independent) are present and pass. No skipped or focused tests in the delta.
- Docs: `blueprint/build-plan.md` 21a-21c split and `blueprint/context/project-overview.md` shipped-status updates are consistent with the spec and history; the overview's Product model does not yet list `featuredRank`, which is expected until the feature completes.

### Findings

- F-36 [P3] open - `listHomeProducts` has no test, and no test asserts `featuredRank` stays out of the public select (lib/catalog.ts:173)

### Remaining risk

- Check was not required and was not run; no browser test command exists, so the admin form field, error focus, list column, and `/en` and `/ar` home ordering were not exercised in a running app.
- The spec's step 3 dev-database check (older product at position 1 becomes the hero; unpublished picks change nothing) was not run in this review.
