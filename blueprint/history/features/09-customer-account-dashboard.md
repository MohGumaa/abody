# Feature: Customer Account Dashboard

**From build-plan:** feature 9
**Build attempt:** 1
**Branch:** feature/customer-account-dashboard
**Status:** verified

## Goal

A signed-in customer gets one account area in English or Arabic. It has an
overview, their orders, their purchased downloads (which they can download
again), and their purchased services. Profile editing stays on the existing
settings page, and sign out is available from every account page.

## Design reference

`prototypes/account.html` (untracked; tokens already in `app/globals.css`):
breadcrumb, a profile sidebar (initials avatar, name, email, side nav: Overview,
Orders, Downloads, Services, Profile, Sign out), and a main column with the
welcome panel, three stat tiles, a recent orders table, and a downloads list.
Port the layout with Tailwind and the existing tokens. Do not import from
`prototypes/`. The mockup's "Active service" panel with a progress tracker
and Abody updates belongs to features 10-11 and is **not** built here.

## In scope

- **Shared account shell** `app/[lang]/account/layout.tsx`: breadcrumb (Home →
  Account), sidebar with initials, name, email, and the side nav. The links are
  Overview `/account`, Orders `/account/orders`, Downloads `/account/downloads`,
  Services `/account/services`, Profile `/account/settings`, and the existing
  `signOut` form as a button. The current item gets `aria-current="page"`. Below
  `960px` the sidebar stacks above the content and the nav scrolls horizontally
  or wraps, with no horizontal page scroll. The layout reads the user with
  `getCurrentUser()` (cached per request). When there is no user, it renders
  only `children`, so each page's own redirect still runs.
- **Every account page enforces auth itself** (layouts are not an auth
  boundary). With no valid session it redirects to
  `/<lang>/login?next=/<lang>/account/<page>`, using the existing pattern.
- **Overview** `/<lang>/account` replaces the current body:
  - "Welcome back, <name>".
  - Three stats: orders (all of the user's orders), downloads (downloadable
    items in paid orders), and services (service items in paid orders).
  - Recent orders: the newest 5, with an "All orders" link.
  - Recent downloads: the newest 3, with an "All downloads" link.
  - Each section has its own empty state: "No orders yet" with a link to
    `/products`, and "No downloads yet".
- **Orders** `/<lang>/account/orders`: every order with `userId = user.id`,
  newest first. Each order shows its number (`#1001`, `dir="ltr"`), date,
  translated status chip, total, and items (localized product name ×
  quantity, unit price). When there are no orders, show an empty state with a
  link to products. There is no pagination and no separate order detail route.
- **Downloads** `/<lang>/account/downloads`: one row per order item whose
  product is a `DIGITAL_PRODUCT` with a `digitalFile`, and only for orders in a
  paid status (`PAID`, `PROCESSING`, `COMPLETED`). Rows are newest order first.
  Each row shows the localized name, "Purchased <date>", order number, and a
  Download link. Items in pending, cancelled, or refunded orders do not
  appear. When there are no downloads, show an empty state.
- **Services** `/<lang>/account/services`: one row per order item whose
  product is a `SERVICE`, in a paid order, newest first. Each row shows the
  localized name, order number, purchase date, and order status chip. When
  there are no services, show an empty state with a link to `/services`.
- **Download links reuse the existing protected route**
  `/api/downloads/<itemId>?session_id=<order.stripeCheckoutSessionId>`.
  Ownership is decided on the server: rows come only from orders where
  `userId` is the session user. The route keeps its paid-status and
  item-in-order checks, so it is not changed.
- **Status labels** for all six `OrderStatus` values, in both languages. Chip
  tones: `PENDING` warning, `PAID` and `PROCESSING` primary, `COMPLETED`
  success, `CANCELLED` and `REFUNDED` danger.
- **Dates** use `Intl.DateTimeFormat` with `year: "numeric", month: "short",
  day: "numeric"` and `timeZone: "UTC"` (implementation note: Arabic
  `dateStyle: "medium"` is numeric only, so explicit options give "Sep 20, 2026"
  and "20 سبتمبر 2026"). English uses `en-US`. Arabic uses `ar-u-nu-latn`, which
  gives Latin digits to match prices and order numbers. The fixed time zone
  keeps server output stable.
- `noindex` metadata and translated titles on every new page. All new text is
  added to `lib/i18n/dictionaries/en.ts` and `ar.ts`.
- **Settings page adjustment**: `/account/settings` now renders inside the
  shell, so its "Back to your account" link and its own outer `main` width are
  removed or adapted so the page does not nest two `main` elements. Its forms
  and behavior do not change.

## Out of scope

- The `Service` work record, onboarding forms, service status and progress, and
  Abody updates (features 10 and 11). The Services page lists purchased
  service *items* only.
- Attaching guest orders by email. Orders with `userId = null` never appear,
  even if `customerEmail` matches (8a decision).
- Any change to `/api/downloads`, authenticated download URLs, and object
  storage (features 18 and 24).
- Invoices, refunds, reorder, order detail pages, pagination, search, and
  filters.
- Admin views, emails, and the "Forgot password" flow.
- Footer account links. The footer has none today, and adding them is not part
  of this feature.

## Build loop

`workflow.stepReview` is `feature`: build every step, run the step's checks
after each one, then present one review packet at the end.
`checkpointCommits` is `disabled`, so there are no step commits. `/complete`
creates the feature commit.

## Build steps

- [x] **1. Account data and formatting.**
  - Export the paid status list from `lib/delivery.ts` (for example
    `PAID_ORDER_STATUSES`) and keep `canDownload` built on it.
  - Add `formatDate(date, locale)` to a small pure module (`lib/dates.ts`).
  - Add server-only `lib/account.ts`. Every query is scoped by
    `order.userId = userId` and never selects `digitalFile`:
    - `getAccountCounts(userId)`
    - `listAccountOrders(userId, take?)`
    - `listAccountDownloads(userId, take?)`, which returns `itemId`,
      names, the order number, `createdAt`, and the checkout session id
    - `listAccountServices(userId)`
  - Add `orderStatus` labels and the account text to both dictionaries.

  Done when: `pnpm test` passes the new tests. `lib/dates.test.ts` checks the
  output for both locales, including Latin digits for Arabic. `lib/account.test.ts`
  mocks the db the same way `lib/downloads.test.ts` does. It asserts that every
  query filters by the given `userId`, that downloads and services filter on
  paid statuses and the right product type, that the newest order comes first,
  that `take` is passed through, and that no select tree contains
  `digitalFile`. `pnpm lint` passes.
- [x] **2. Account shell and overview.**
  - Add `app/[lang]/account/layout.tsx` with the sidebar, side nav, and sign
    out. The nav marks the current item with a small client component that
    uses `usePathname`. Before writing it, check the layout and `usePathname`
    guidance in `node_modules/next/dist/docs/01-app`. (Implementation note: it
    uses `useSelectedLayoutSegment`, the documented hook for a layout's
    active child segment.)
  - Replace the overview body in `app/[lang]/account/page.tsx` with the
    welcome text, stats, recent orders, recent downloads, and their empty
    states.
  - Adapt the settings page to sit inside the shell.

  Done when: `pnpm lint` and `pnpm build` pass. The signed-out redirect stays
  in both `page.tsx` files. The overview renders from `lib/account.ts` only.
- [x] **3. Orders, Downloads, and Services pages.**
  - Add `app/[lang]/account/orders/page.tsx`, `downloads/page.tsx`, and
    `services/page.tsx`, each with its own auth redirect, metadata, list, and
    empty state.
  - Download links use the existing route with the order's session id, and
    their accessible name includes the product name (the same pattern as the
    success page).

  Done when: `pnpm test`, `pnpm lint`, and `pnpm build` pass. With seeded
  data and a signed-in user who has a paid order, `/en/account/downloads`
  downloads the file. The same pages render right-to-left with Arabic text at
  `/ar/...`. Live checks belong to `/check`.

## Files / areas

- New: `lib/account.ts`, `lib/account.test.ts`, `lib/dates.ts`,
  `lib/dates.test.ts`, `app/[lang]/account/layout.tsx`, a nav client component
  under `components/account/` (`AccountNav.tsx`), shared pieces in
  `components/account/AccountParts.tsx`, and `app/[lang]/account/{orders,downloads,services}/page.tsx`.
- Changed: `components/icons.tsx` (Grid, Box, Logout icons from the mockup),
  `lib/downloads.ts` (export `DOWNLOADABLE_PRODUCT` for reuse),
  `app/[lang]/account/page.tsx`, `app/[lang]/account/settings/page.tsx`,
  `lib/delivery.ts` (export the paid statuses only), and
  `lib/i18n/dictionaries/en.ts` / `ar.ts`.
- Reused, not changed: `lib/session.ts` (`getCurrentUser`), `actions/auth.ts`
  (`signOut`), `lib/catalog.ts` (`localizedName`), `lib/money.ts`
  (`formatPriceCents`), `lib/orders.ts` (`formatOrderNumber`), and
  `app/api/downloads/[itemId]/route.ts`.

## Data / contracts

- No schema change and no migration.
- The trusted actor is always `getCurrentUser().id`. No page takes a user id,
  order id, or email from the URL or form.
- Totals and prices use `formatPriceCents` (USD). The store's only currency is
  USD, and checkout creates USD orders.
- Rendering rules:
  - Product names and the user's name render as React text with
    `dir="auto"`, never as HTML.
  - The email uses `dir="ltr"`, as it does today.
  - Initials are the first letters of the first two words of `name`,
    uppercased. When there are none, use the first character.
- Download href: `/api/downloads/${encodeURIComponent(itemId)}?session_id=…`,
  built with `URLSearchParams`. Only the owner sees the session id, and it is
  the same credential the success page already issues.

## Testing

- Unit (Vitest): `lib/dates.test.ts` and `lib/account.test.ts` as described
  in step 1. Existing tests keep passing, including the `canDownload` tests
  after the refactor.
- No browser harness exists, so the visual and right-to-left checks and the
  live download are left to `/check`. This spec does not claim them.

## Notes for the AI

- Read the relevant guide in `node_modules/next/dist/docs/01-app` before
  writing the layout and the client nav (Next.js 16 conventions).
- Every customer link uses `localizedPath(locale, ...)`.
- Stat tiles and status chips need visible text, not color alone.
- Order numbers and prices stay `dir="ltr"` inside right-to-left text.
- Do not add a `/account/profile` route. "Profile" links to the existing
  settings page.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":10931,"specSha256":"ec4ecbfa455aaefd7010d39374945f5b2386a0a67ba0c66098f7c2f274efba61","branch":"refs/heads/feature/customer-account-dashboard","head":"13983a5336ac50901ca4f2ab72ed9c51e6cb888c","baseRef":"refs/heads/main","baseCommit":"71dd5be0c6f1f6ae402c24fc74e360d597548323","sourceTree":"1bde9af0f905c1d55360e3e45c9d47438cce8d4d","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 13983a5336ac50901ca4f2ab72ed9c51e6cb888c
**Base commit:** 71dd5be0c6f1f6ae402c24fc74e360d597548323
**Base ref:** main
**Spec hash:** ec4ecbfa455aaefd7010d39374945f5b2386a0a67ba0c66098f7c2f274efba61
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-06T14:51:29Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-06T14:56:45Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `71dd5be0c6f1f6ae402c24fc74e360d597548323..13983a5336ac50901ca4f2ab72ed9c51e6cb888c` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `git rev-parse HEAD`: pass (equals Target commit)
- `git merge-base main HEAD`: pass (equals Base commit)
- `sha256sum blueprint/context/current-feature.md`: pass (equals Spec hash; spec is tracked)
- `git status --porcelain=v1 --untracked-files=all`: pass (only `blueprint/context/review.md` differs, before and after the checks)
- `pnpm test`: pass (26 files, 363 tests)
- `pnpm lint`: pass
- `pnpm build`: pass (compiles and type-checks; all five account routes built as dynamic)

### Evidence

- Full 18-file delta `71dd5be..13983a5` read, plus `app/api/downloads/[itemId]/route.ts`, `lib/session.ts`, `lib/downloads.ts`, `lib/delivery.ts`, `actions/auth.ts` (`signOut`), `actions/account.ts` (`revalidatePath("/[lang]/account", "layout")` keeps the sidebar name fresh after a profile edit), `app/[lang]/layout.tsx`, and the `Order`/`OrderItem` Prisma models.
- Ownership: every query in `lib/account.ts` filters `userId` (orders) or `order: { userId, status in PAID_ORDER_STATUSES }` (items); the user id always comes from `getCurrentUser()`; no page reads ids or email from URL or form. Guest orders (`userId = null`) cannot match.
- No select tree in `lib/account.ts` contains `digitalFile`; `DOWNLOADABLE_PRODUCT` only filters on it. `stripeCheckoutSessionId` is selected only by `listAccountDownloads` and rendered only to the order owner in the download href; it never appears in a page URL. The download route is unchanged and still enforces session-id format, item-in-order, product type, and paid status.
- Auth: overview, orders, downloads, services, and settings each call `getCurrentUser()` and redirect to `/<lang>/login?next=/<lang>/account/...`. The layout returns only `children` when signed out, so it leaks no user data and each page's redirect runs. `useSelectedLayoutSegment` returns `null` for the overview per `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-selected-layout-segment.md`.
- Safe rendering: user name and product names render as React text with `dir="auto"`; the welcome string uses a function replacer so `$` patterns in a name are not expanded; no `dangerouslySetInnerHTML`. Order numbers, prices, and email are `dir="ltr"`; directional icons mirror with `rtl:-scale-x-100`. `ar` is typed as `Dictionary`, so key parity with `en` is enforced by the build.
- Spec coverage: shell, five nav items with `aria-current`, sign out, three stats, recent 5 orders / 3 downloads with empty states and links, orders/downloads/services pages with empty states, six status labels and tones, UTC `formatDate` with `ar-u-nu-latn`, `noindex` metadata on every page, settings page nested without a second `main`, `PAID_ORDER_STATUSES` export with `canDownload` built on it. No schema change.
- Performance: overview runs three counts and two bounded lists in parallel; `Order.userId` and `OrderItem.orderId` are indexed. Orders, downloads, and services lists are unbounded by explicit spec decision (no pagination).
- Tests: `lib/account.test.ts` asserts user scoping, paid-status and product-type filters, newest-first ordering, `take` pass-through, and absence of `digitalFile` in select trees; `lib/dates.test.ts` covers both locales including Latin digits. No skipped or focused tests in the delta.

### Findings

- F-15 [P3] open: account breadcrumb marks "Account" as `aria-current="page"` on every account subpage (`app/[lang]/account/layout.tsx:38`).
- No P0 or P1 findings. Existing open P2/P3 entries were left unchanged and were not used as review scope.

### Remaining risk

- `/check` was not run (not required): live sign-in, the actual file download from `/en/account/downloads`, the signed-out redirects, right-to-left rendering at `/ar/...`, and the below-960px layout were not exercised in a browser.
- No browser test harness exists (`Browser tests` command unavailable), so page and layout components have no automated coverage; only `lib/account.ts` and `lib/dates.ts` are unit-tested.
- No `Verify` command and no standalone typecheck script exist; type-checking was covered by `pnpm build`.
- `lib/account.ts` relies on a "Server code only" comment rather than a `server-only` import, matching the existing project pattern (see F-12); a client import would already fail on `@/lib/db`.
