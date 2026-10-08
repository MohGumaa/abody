# Feature: Customer Management

**From build-plan:** feature 17
**Build attempt:** 1
**Branch:** feature/customer-management
**Status:** verified

## Goal

Give admins a read-only view of customer accounts at `/admin/customers`: a paged
list, and a detail page per customer with their profile, orders, purchased
downloads, and services (active ones counted and marked), linked to the existing
admin order and service-order pages.

## In scope

- `/admin/customers[?page=N]` - paged list of customer accounts, newest first.
- `/admin/customers/[id]` - one customer: profile, orders (with purchased items),
  downloads, and services.
- A "Customers" entry in the admin side navigation.
- Linking the Customer card on `/admin/orders/[id]` and
  `/admin/service-orders/[itemId]` to the customer page when the order belongs to
  a customer account.
- Updating the Routes line in `blueprint/context/project-overview.md` so
  `/admin/customers` is shipped.

## Out of scope

- Editing, deleting, disabling, or promoting customers, resetting passwords, or
  signing out their sessions. Admin promotion stays the `pnpm admin:promote`
  shell command.
- Search, filtering, or sorting options on the list.
- Grouping guest orders by email or attaching them to accounts (8a decision).
  Guest orders stay visible in `/admin/orders`.
- Download counts or download links for the admin (no download tracking exists;
  the download credential stays with the order's owner).
- Linking the dashboard "Customers" stat (dashboard stat cards are not links today).
- Spend totals or other reporting (feature 23).

## Build loop

`workflow.stepReview` is `feature`: build all steps, running the step's checks as
you go, then present one review packet for the whole feature. Checkpoint commits
are disabled; `/complete` creates the feature commit.

## Build steps

1. [x] **Customer data helpers.** Add `lib/admin-customers.ts` with
   `listAdminCustomers(pageParam)` and `getAdminCustomer(id)` per Data /
   contracts, plus `lib/admin-customers.test.ts` (mocked `db`, same style as
   `lib/admin-orders.test.ts`).
   Done when: tests prove the list query filters `role: "CUSTOMER"`, orders by
   `createdAt desc, id asc`, pages with `parsePage`/`ORDERS_PAGE_SIZE`, and never
   selects `passwordHash` or sessions; `getAdminCustomer` returns null without a
   query for a non-string, empty, or over-long id, scopes by `{ id, role:
   "CUSTOMER" }`, maps downloads, services, active flag, and counts correctly;
   `pnpm test` passes.
2. [x] **Customer list page and navigation.** Add `app/admin/customers/page.tsx`
   and the "Customers" nav entry (`users` icon via `UsersIcon` in
   `components/admin/SideNav.tsx`, placed after Orders/Service orders in
   `app/admin/layout.tsx`).
   Done when: an admin sees the table (Customer name and email, Orders, Joined),
   each name links to `/admin/customers/<id>`, the empty state reads "No customers
   yet.", pagination links appear only with more than 50 customers and invalid
   `?page` values fall back to the nearest valid page, a non-admin gets the 404,
   and `pnpm lint` passes.
3. [x] **Customer detail page.** Add `app/admin/customers/[id]/page.tsx`.
   Done when: an admin sees the Profile card (name or "No name", email, joined
   date, counts of orders, downloads, and active services), an Orders table
   (number linking to `/admin/orders/<id>`, item names with quantities, total,
   payment label, status chip, date), a Downloads table (product linking to
   `/admin/products/<productId>`, order link, purchase date), and a Services table
   (service name, order link, status or "Awaiting details" via the existing admin
   service status display, an "Active" marker, link to
   `/admin/service-orders/<itemId>`); each section has its own empty state; an
   unknown id, an admin user's id, or a non-admin request gets the 404 and the
   generic metadata title; `pnpm lint` passes.
4. [x] **Links from orders and service orders, overview route.** Select the
   user's `id` and `role` in `getAdminOrder` and `getServiceOrder`; on both detail
   pages, render the customer name as a link to `/admin/customers/<userId>` only
   when the order's user has role `CUSTOMER` (guest orders and admin buyers stay
   plain text). Update existing tests for the new select fields and the overview
   Routes line.
   Done when: the links appear and resolve for customer orders, guests show no
   link, `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Files / areas

- New: `lib/admin-customers.ts`, `lib/admin-customers.test.ts`,
  `app/admin/customers/page.tsx`, `app/admin/customers/[id]/page.tsx`
- Changed: `app/admin/layout.tsx` (NAV_SECTIONS), `components/admin/SideNav.tsx`
  (ICONS), `lib/admin-orders.ts` (+ test), `app/admin/orders/[id]/page.tsx`,
  `lib/admin-service-work.ts` (+ test), `app/admin/service-orders/[itemId]/page.tsx`,
  `blueprint/context/project-overview.md` (Routes line)
- Reused: `requireAdmin`, `adminMetadata`, `isProductId` (`lib/admin.ts`),
  `ACTIVE_SERVICE_STATUSES` (`lib/admin.ts`), `parsePage`, `ORDERS_PAGE_SIZE`,
  `paymentStatusLabel` (`lib/admin-orders.ts`), `PAID_ORDER_STATUSES`
  (`lib/delivery.ts`), `DOWNLOADABLE_PRODUCT` (`lib/downloads.ts`),
  `PAID_SERVICE_ITEM` (`lib/admin-service-work.ts`), `OrderNumber`/`StatusChip`
  (`components/account/AccountParts`), the admin `ServiceStatus` component,
  `formatDate`, `formatPriceCents`, `components/ui/table`.

## Data / contracts

No schema change and no migration. Read-only: no Server Actions or API routes.

**Who is a customer.** A `User` with `role: "CUSTOMER"`, the same population the
dashboard counts as "registered accounts". Admin users are neither listed nor
viewable here (their id 404s). Guest orders have no account and are not
customers on these pages.

**`listAdminCustomers(pageParam: unknown)`** returns
`{ customers, page, pageCount, total }`:

- `total = db.user.count({ where: { role: "CUSTOMER" } })`; `page =
  parsePage(pageParam, total)`; 50 per page.
- `orderBy: [{ createdAt: "desc" }, { id: "asc" }]`.
- Row: `{ id, name, email, createdAt, orderCount }` where `orderCount` is
  `_count.orders` (all statuses).

**`getAdminCustomer(id: string)`** returns `null` when `!isProductId(id)` (no
query) or when no `User` matches `{ id, role: "CUSTOMER" }`. Otherwise:

- `profile`: `{ id, name, email, createdAt }`. Never select `passwordHash`,
  `sessions`, or `role` beyond the filter.
- `orders`: every order of the user, any status, newest first
  (`createdAt desc, number desc`), each `{ id, number, status, totalCents,
  createdAt, items: { id, name, quantity }[] }` (items `id asc`).
- `downloads`: order items in the user's orders with status in
  `PAID_ORDER_STATUSES` and product matching `DOWNLOADABLE_PRODUCT`, newest first
  (`order.createdAt desc, order.number desc, id asc`), each `{ itemId, productId,
  name, orderId, orderNumber, purchasedAt }`. Never select `digitalFile` or
  `stripeCheckoutSessionId`.
- `services`: order items in the user's paid orders with product type
  `SERVICE` (`PAID_SERVICE_ITEM` plus the user filter), same ordering, each
  `{ itemId, name, orderId, orderNumber, purchasedAt, status: ServiceStatus |
  null, active: boolean }`; `active` is `status === null ||
  ACTIVE_SERVICE_STATUSES.includes(status)` (same rule as the dashboard).
  Never select `adminNotes` or `requirements` here.
- `counts`: `{ orders: orders.length, downloads: downloads.length,
  activeServices: services.filter(active).length }`.

Run the user lookup and the three lists with one `findUnique`/`findFirst` on the
user plus queries scoped by `userId`; no list is paged on the detail page (the
customer account pages list everything too).

**Rendering.** Names, emails, and product names render as React text with
`dir="auto"` and `break-all` where long; never as HTML. Admin area is English
only. Dates via `formatDate(date, "en")`, money via `formatPriceCents`.

**Access.** Every page calls `requireAdmin()` first; `generateMetadata` reads the
customer only when the current user is an admin (pattern from
`app/admin/orders/[id]/page.tsx`), otherwise `adminMetadata` returns the generic
404 title. Detail title: `Customer <name or email> | Abody Admin`.

## Testing

- Unit (Vitest, `pnpm test`): `lib/admin-customers.test.ts` covering the list
  query shape and paging, id guard, role scoping, the not-found result, mapping
  of orders/downloads/services, the active rule for each `ServiceStatus` and
  null, and counts. Update `lib/admin-orders.test.ts` and
  `lib/admin-service-work.test.ts` for the added `user.id`/`user.role` select.
- `pnpm lint` and `pnpm build` at the end.
- No browser harness exists; page rendering, empty states, 404s, and links are
  verified manually with `/check` against seeded data.
- Live check (2026-10-09, curl against the dev server with a temporary admin
  session) passed every observable claim. Three claims had no data to observe
  them: page links with more than 50 customers, the empty "No customers yet."
  list, and no link when an admin bought the order. The user accepted these as
  covered by unit tests and code review on 2026-10-09.

## Notes for the AI

- Next.js 16: read `node_modules/next/dist/docs/` for `PageProps`/`searchParams`
  if anything differs from the existing admin pages; copy their patterns.
- Follow the admin list/detail markup in `app/admin/orders/page.tsx` and
  `app/admin/orders/[id]/page.tsx` (CARD, FOCUS, BACK_LINK, `Detail`, table min
  widths, admin empty state without the shared EmptyState).
- `SideNav.tsx` ships to non-admins; keep its icon key neutral (`users`).
- Do not add `/admin/customers` links anywhere outside the admin area.

## Open questions

None blocking. Recorded decisions the reviewer may overturn: customers are
`CUSTOMER`-role accounts only (admins and guest buyers excluded), the list shows
order count but no spend total, and the detail page shows every order without
paging.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":9947,"specSha256":"a3cfb427e2fd6afc74d5cc3b0c551ee893c56761799c682c5d4928eeca23a4af","branch":"refs/heads/feature/customer-management","head":"4b8857bded6c352038bd6dbed307fe685a9a7a3b","baseRef":"refs/heads/main","baseCommit":"1640b6c8d0fc979cc9cb8fd331c2657632e7afd6","sourceTree":"aaaa257a2b94d2f4dcc4eeca0d81fa71f3c260fe","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 4b8857bded6c352038bd6dbed307fe685a9a7a3b
**Base commit:** 1640b6c8d0fc979cc9cb8fd331c2657632e7afd6
**Base ref:** main
**Spec hash:** a3cfb427e2fd6afc74d5cc3b0c551ee893c56761799c682c5d4928eeca23a4af
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-08T22:06:11Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-08T22:12:00Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `1640b6c8d0fc979cc9cb8fd331c2657632e7afd6..4b8857bded6c352038bd6dbed307fe685a9a7a3b` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (HEAD, merge base, and spec hash match the request; only `blueprint/context/review.md` differed from the target)
- `pnpm test`: pass (738 tests)
- `pnpm lint`: pass
- `pnpm build`: pass (`/admin/customers` and `/admin/customers/[id]` compiled as dynamic routes; type-check included)

## Evidence

- Reviewed the full 14-file delta: `lib/admin-customers.ts` (+ test), `app/admin/customers/page.tsx`, `app/admin/customers/[id]/page.tsx`, `app/admin/layout.tsx`, `components/admin/SideNav.tsx`, `lib/admin-orders.ts` (+ test), `lib/admin-service-work.ts` (+ test), both order detail pages, the spec, and the overview Routes line.
- Access: both pages call `requireAdmin()` first; detail `generateMetadata` reads the customer only for an `ADMIN` user, and `adminMetadata` returns the 404 title otherwise.
- Data scoping: lookup is `findFirst({ id, role: "CUSTOMER" })` behind the `isProductId` length guard, so admin ids and unknown ids 404; the three lists are scoped by `userId`; no select includes `passwordHash`, sessions, `role` beyond the filter, `digitalFile`, `stripeCheckoutSessionId`, `adminNotes`, or `requirements`.
- Rules match existing code: downloads reuse `DOWNLOADABLE_PRODUCT` and `PAID_ORDER_STATUSES`; services reuse `PAID_SERVICE_ITEM`; `isActiveService` matches the dashboard's `service is null OR status in ACTIVE_SERVICE_STATUSES` count (`lib/admin.ts:121-129`).
- Rendering: all names, emails, and product names are React text with `dir="auto"`; no `dangerouslySetInnerHTML`. Customer links on order and service-order pages render only when `order.user.role === "CUSTOMER"`.
- Schema: `OrderItem.product` is required with `onDelete: Restrict`, so `product.name` mappings cannot see a null product.

## Findings

- F-27 [P3] open - customer detail page runs all customer queries twice per request (metadata plus page)
- F-28 [P3] open - download, service, and order-item orderings are unasserted in tests
- No P0 or P1 findings. Existing open P2/P3 findings were treated as context only.

## Remaining risk

- Check was not required and was not run in this pass; no browser harness exists, so page rendering, empty states, and links rely on the spec's recorded live check plus code review.
- Pagination with more than 50 customers, the empty customer list, and the no-link case for admin buyers were not observed against data (accepted by the user per the spec); they were verified here only by code reading and unit tests.
- The detail page lists every order and item without paging (a recorded spec decision); cost grows with a customer's history and was not profiled.
