# Feature: Analytics & Sales Reporting

**From build-plan:** feature 23
**Build attempt:** 1
**Branch:** feature/analytics-sales-reporting
**Status:** verified

## Goal

Give admins one English report at `/admin/analytics` showing how the store is
used and what sells over a chosen recent period: page views, product views, add
to cart, checkouts started, purchases, revenue, popular products, and top pages.
Store activity is recorded first-party in our own database (no vendor, no
third-party script). It holds counts only, with no visitor, user, IP, or cookie
identity. Purchases and revenue come from existing paid orders.

Decisions taken for this spec (2026-10-11): first-party tracking in the app's
database; counts only, with no unique visitors.

## In scope

- An `AnalyticsEvent` table and migration with three event types: page view,
  add to cart, and checkout started.
- Page views recorded from every customer page under `/en` and `/ar` through a
  small client beacon to a new `POST /api/analytics` route. A view of a
  published product or service detail page also records that product, which is
  what "product views" means.
- Add to cart recorded by the existing `addToCart` Server Action when the cart
  actually changed (outcome `added`).
- Checkout started recorded by `startCheckout` once Stripe returns a session
  URL, just before the redirect.
- Recording is best effort: a failed event write is logged and never changes a
  customer action's result.
- `/admin/analytics` (admin only, 404 for everyone else) with a period selector
  (last 7, 30, or 90 days; default 30), totals, funnel conversion rates, a
  popular products table, a top pages table, and empty states. It renders on
  the server, and errors use the existing `app/admin/error.tsx`.
- An "Analytics" entry in the admin side navigation.

## Out of scope

- Unique visitors, sessions, per-visitor funnels, referrers, devices, or any
  visitor cookie or identifier. These need a visitor cookie or ID, which the
  counts-only decision rules out.
- Third-party analytics scripts, cookie consent, and Privacy page edits.
- Rate limiting or bot filtering of the beacon (feature 24 owns hardening).
- Excluding admin browsing from store counts.
- Event retention or cleanup jobs, CSV export, charts over time, custom date
  ranges, and comparisons with earlier periods ("advanced reporting" is not v1).
- Changes to the existing `/admin` dashboard totals.

## Build loop

`workflow.stepReview` is `feature`: build every step below in order, running
`pnpm test` for each logic step, then present one review packet for the whole
feature. `workflow.checkpointCommits` is `disabled`, so there are no per-step
commits. `/complete` creates the single feature commit.

## Build steps

- [x] 1. **Event table and recording helpers.** Add the `AnalyticsEventType`
  enum and `AnalyticsEvent` model (see Data / contracts) with a migration via
  `pnpm db:migrate` (name it `add_analytics_events`). Add pure rules in
  `lib/analytics-rules.ts`: `parseTrackedPath(value)` validates a beacon path
  and returns `{ path, locale, detail: { type, slug } | null }` or `null`.
  Add server code in `lib/analytics.ts`: `recordPageView(path)` resolves a
  detail-page slug to a published product of the matching type (`/products/` is
  `DIGITAL_PRODUCT`, `/services/` is `SERVICE`) and stores `productId` only when
  one is found. `recordEvent(type, productId?)` handles the other events. Both
  catch and `console.error` failures and never throw.
  **Done when:** `pnpm exec prisma migrate status` reports the migration
  applied, and `lib/analytics-rules.test.ts` and `lib/analytics.test.ts` (db
  mocked) pass under `pnpm test`. They cover valid paths, a missing language,
  an unknown language, a query string, bad characters, an overlong path, too
  many segments, a non-string value, detail-slug extraction, an unknown slug
  stored with no product, and a swallowed database error.

- [x] 2. **Page-view beacon.** Add `app/api/analytics/route.ts` (`POST`). It
  reads the body as text, rejects anything over 1 KB or not JSON
  `{ "path": string }` that passes `parseTrackedPath`, records the page view,
  and returns `204` with no body. Invalid input returns `400` through
  `apiError` with a new `invalid_path` code. An unexpected error returns `500
  internal_error`. Add the client component
  `components/analytics/PageViewTracker.tsx`: on mount and on every
  `usePathname()` change, it sends `fetch("/api/analytics", { method: "POST",
  keepalive: true, headers: JSON, body: { path } })`, ignores every failure, and
  keeps the last sent path in a ref so React Strict Mode's double effect does
  not double count. It renders nothing. Mount it once in
  `app/[lang]/layout.tsx`. The admin layout never mounts it. The proxy matcher
  already skips `/api/`.
  **Done when:** `app/api/analytics/route.test.ts` passes. It covers 204 with a
  record call, 400 for bad JSON, oversize, a missing path, and an invalid path
  with no record call, and 500 when the helper unexpectedly throws. `pnpm
  build` passes. In the running app, visiting `/en`, a product page, and
  `/ar/services` adds three rows, the product row carries its `productId`, and
  `/admin` pages add none. Check the rows in Prisma Studio or with a query.

- [x] 3. **Cart and checkout events.** In `actions/cart.ts`, call
  `recordEvent("ADD_TO_CART", product.id)` after the cookie is saved, only when
  the outcome is `added`. In `actions/checkout.ts`, call
  `recordEvent("CHECKOUT_STARTED")` after a session URL exists and before
  `redirect(url)`. It stays outside the `try`, and its failure cannot block the
  redirect. No other cart action records events.
  **Done when:** `actions/cart.test.ts` and `actions/checkout.test.ts` (with
  `@/lib/analytics` mocked) prove that `added` records once, that
  `already_in_cart`, `max_quantity`, `cart_full`, invalid, and unavailable
  record nothing, that a successful checkout records once, that every checkout
  failure path records nothing, and that a rejected `recordEvent` mock never
  changes either action's result. `pnpm test` passes.

- [x] 4. **Report queries.** Add `getAnalyticsReport(days, now = new Date())`
  to `lib/analytics.ts` and the pure helpers to `lib/analytics-rules.ts`:
  `parseRangeDays(value)` (`"7" | "30" | "90"`, anything else is 30),
  `rangeStart(days, now)` (00:00 UTC on the first day, so 7 means today plus
  the 6 previous UTC days), `conversionRate(part, whole)` (whole-percent number,
  or `null` when `whole` is 0), and `rankPopularProducts(...)` (merge, sort, and
  take 10). The report shape is in Data / contracts.
  **Done when:** rule tests cover every range value including missing and
  junk, the UTC boundary with fake timers, zero and rounding for conversion,
  and popular-product ordering and ties and the limit of 10. A
  `getAnalyticsReport` test with db mocked checks the paid-status filter, the
  `createdAt >= start` filter on every query, and the mapping. `pnpm test`
  passes.

- [x] 5. **Admin analytics page.** Add `app/admin/analytics/page.tsx`. It calls
  `requireAdmin()` first, uses `adminMetadata("Analytics")`, reads
  `searchParams.range` through `parseRangeDays`, and renders:
  - a heading with a period selector of three links (`?range=7|30|90`); the
    current one has `aria-current="page"`
  - six totals in the dashboard's stat-card style: Page views, Product views,
    Added to cart, Checkouts started, Purchases, Revenue
  - three conversion rates: product view to cart, cart to checkout, and
    checkout to purchase, showing "—" when the rate is `null`
  - Popular products, a table of name (link to its admin edit page by type),
    type, views, adds to cart, units sold, and sales
  - Top pages, a table of path and views

  Empty tables use the existing `EmptyState`. With no events and no orders in
  the period, show one short "No store activity in this period yet" message
  above the zero totals. Add `{ href: "/admin/analytics", label: "Analytics",
  icon: "chart" }` after Dashboard in the admin layout's `NAV_SECTIONS`, and
  add `chart: ChartIcon` to `ICONS` in `components/admin/SideNav.tsx`.
  **Done when:** `pnpm build` and `pnpm lint` pass. In the running app as an
  admin, `/admin/analytics` shows the step 2 and 3 events and the seeded paid
  orders, the range links change the numbers, and the empty state shows on a
  database with no events and orders in range. As a customer or signed out,
  `/admin/analytics` is a 404 with the "Page not found" title. It is usable at
  phone width.

## Files / areas

- `prisma/schema.prisma`, `prisma/migrations/<timestamp>_add_analytics_events/`
- `lib/analytics-rules.ts` (+ test) - path parsing, ranges, rates, ranking
- `lib/analytics.ts` (+ test) - recording and report queries (server only)
- `app/api/analytics/route.ts` (+ test)
- `lib/api-error.ts` - add `invalid_path`
- `components/analytics/PageViewTracker.tsx` - client beacon
- `app/[lang]/layout.tsx` - mount the tracker
- `actions/cart.ts`, `actions/checkout.ts` (+ their tests)
- `app/admin/analytics/page.tsx`
- `app/admin/layout.tsx` (nav entry), `components/admin/SideNav.tsx` (icon key)
- Reused: `requireAdmin`, `adminMetadata` (`lib/admin.ts`),
  `PAID_ORDER_STATUSES` (`lib/delivery.ts`), `formatPriceCents`
  (`lib/money.ts`), `EmptyState` (`components/account/AccountParts`), `ChartIcon`

## Data / contracts

```prisma
enum AnalyticsEventType {
  PAGE_VIEW
  ADD_TO_CART
  CHECKOUT_STARTED
}

// Store activity counts (feature 23). Never holds a visitor, user, session,
// IP, or cookie value.
model AnalyticsEvent {
  id        String             @id @default(cuid())
  type      AnalyticsEventType
  // PAGE_VIEW only: the pathname as visited, with its language ("/ar/products/x").
  path      String?
  // Detail-page views and ADD_TO_CART. A deleted product leaves the event as
  // a plain count.
  productId String?
  product   Product?           @relation(fields: [productId], references: [id], onDelete: SetNull)
  createdAt DateTime           @default(now())

  @@index([type, createdAt])
  @@index([productId])
}
```

`Product` gains `analyticsEvents AnalyticsEvent[]`. SetNull keeps admin product
deletion (feature 13) working.

**Beacon path rule** (`parseTrackedPath`): a string of at most 200 characters
that matches `/<en|ar>` optionally followed by 1-6 `/segment` parts, where a
segment is 1-100 characters of `A-Z a-z 0-9 - _`. There is no query, hash,
trailing slash, `.`, or encoded character. A detail page is exactly
`/<lang>/products/<slug>` or `/<lang>/services/<slug>`. The stored path is the
validated input unchanged. Everything else is rejected, which also keeps file
and `_next` paths out.

**`POST /api/analytics`**: request `Content-Type: application/json`, body
`{ "path": "/en/products/x" }`, 1 KB max. Responses: `204` with an empty body;
`400 { error: { code: "invalid_path", message } }`; `500 { error: { code:
"internal_error", message } }`. It is unauthenticated by design: it only adds a
count and returns nothing. Anyone can inflate counts. That is accepted for a
counts-only internal report, and feature 24 may add limits.

**Report** (`getAnalyticsReport` returns):

```ts
interface AnalyticsReport {
  days: 7 | 30 | 90;
  start: Date;                 // 00:00 UTC on the first day
  pageViews: number;           // all PAGE_VIEW
  productViews: number;        // PAGE_VIEW with productId
  addsToCart: number;
  checkoutsStarted: number;
  purchases: number;           // orders in PAID_ORDER_STATUSES created in range
  revenueCents: number;        // sum of those orders' totalCents (USD)
  popularProducts: {           // up to 10
    id: string; name: string; type: ProductType;
    views: number; addsToCart: number;
    unitsSold: number;         // sum of OrderItem.quantity on those orders
    salesCents: number;        // sum of OrderItem.priceCents * quantity
  }[];
  topPages: { path: string; views: number }[]; // up to 10, views desc, path asc
}
```

Purchases and revenue use the same paid statuses as the dashboard (Paid,
Processing, Completed; refunded excluded), filtered by `Order.createdAt`.
`OrderItem.priceCents` is already the discounted unit price, so sales per
product reflect coupons. Popular products are any product with a view, an add,
or a sale in range. They are ordered by units sold desc, then sales desc, then
views desc, then name asc. Names are the English `name` (the admin is
English-only).

## Testing

`pnpm test` gates steps 1-4. The new and updated test files are
`lib/analytics-rules.test.ts`, `lib/analytics.test.ts`,
`app/api/analytics/route.test.ts`, `actions/cart.test.ts`, and
`actions/checkout.test.ts`, with `vi.mock` for `@/lib/db`, `@/lib/analytics`,
and `vi.useFakeTimers()` for ranges. The tracker component and admin page are
UI and are verified with `pnpm build`, `pnpm lint`, and the running app (steps 2
and 5). There is no Browser tests command, so no browser automation is added.
Baseline before this feature: 59 test files, 971 tests passing.

## Notes for the AI

- Read the Next.js 16 guides in `node_modules/next/dist/docs/` for route
  handlers, `usePathname`, and `searchParams` (a Promise in page props) before
  writing those files.
- Customer pages may be statically rendered, so page views must come from the
  client beacon. Never count views in server components.
- Event writes must never break or slow a customer flow beyond one insert. Keep
  every `recordEvent` and `recordPageView` call failure-safe, and await it so
  serverless runtimes don't drop it.
- Never store or log cookies, IPs, user agents, user ids, or request bodies in
  events or error logs.
- Paths and product names render as React text only.
- The admin page follows the existing dashboard markup and tokens (stat-card
  `dl`, `rounded-card`, `shadow-soft`, table styles from `/admin/orders`) and
  its accessible patterns (labelled sections, `sr-only` headings).
- The 7/30/90-day periods and the default of 30 are a reversible UI choice
  made in this spec, not a product rule from the plans.
- The overview's routes and data-model TODOs for analytics are refreshed by a
  later `/overview`, not in this feature.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":14202,"specSha256":"f89d5847347a5edc9b5280949a2694a9ef33d436f040eda1b5c8fbf1720e34ad","branch":"refs/heads/feature/analytics-sales-reporting","head":"80610b03009b83a145fce8dd805b2d77e1ed78bc","baseRef":"refs/heads/main","baseCommit":"953442de5f92b1f1c983b42af0986960789b24ab","sourceTree":"726c2b933852c75e3313c82578ed332f4b04c2a9","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 80610b03009b83a145fce8dd805b2d77e1ed78bc
**Base commit:** 953442de5f92b1f1c983b42af0986960789b24ab
**Base ref:** main
**Spec hash:** f89d5847347a5edc9b5280949a2694a9ef33d436f040eda1b5c8fbf1720e34ad
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-11T09:07:11Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-11T10:20:00Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `953442de5f92b1f1c983b42af0986960789b24ab..80610b03009b83a145fce8dd805b2d77e1ed78bc` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (all preconditions match; only review.md dirty)
- `pnpm test`: pass (62 files, 1017 tests)
- `pnpm lint`: pass
- `pnpm build`: pass (`/api/analytics` and `/admin/analytics` compiled; working tree unchanged afterwards)

### Evidence

- Reviewed all 19 files in the base..target delta: schema and migration (SetNull FK, two indexes), `lib/analytics-rules.ts`, `lib/analytics.ts`, `app/api/analytics/route.ts`, `PageViewTracker`, `[lang]` layout mount, cart and checkout actions, admin analytics page, nav and icon wiring, `api-error.ts`, and all five test files.
- Security: admin page calls `requireAdmin()` (404 via `notFound()` for non-admins) before any query; the beacon stores only a regex-validated path (`/(en|ar)` plus up to 6 `[A-Za-z0-9_-]` segments, 200 chars) and a server-resolved published product id, never request identity; paths and names render as React text only; `proxy.ts` redirects unprefixed paths so client pathnames always carry a locale.
- Failure safety: `recordEvent` and `recordPageView` catch and log; cart records only on outcome `added` after `saveCart`; checkout records after a session URL exists and outside the `try`, before `redirect`; tests run the real recorder against a rejecting db mock for both actions.
- Report: every event query filters `createdAt >= rangeStart`; orders and order items use `PAID_ORDER_STATUSES` plus `createdAt`; ranking, top-page ordering, UTC start, and conversion rounding match the spec and have unit tests.
- No `.only` or `.skip` in the new or changed tests.

### Findings

- F-38 [P3] open - beacon buffers the whole body before the 1 KB limit when Content-Length is absent (non-blocking)

### Remaining risk

- `/check` was not required and was not run; the running-app checks in spec steps 2 and 5 (rows written per page, admin pages add none, phone-width layout, 404 for non-admins in the browser) were not re-verified by this reviewer.
- No browser test command exists; `PageViewTracker` Strict Mode and soft-navigation behavior was reviewed by reading only.
- `getAnalyticsReport` loads every paid order item in the period into memory to compute sales; fine at current scale, unprofiled at larger volumes.
