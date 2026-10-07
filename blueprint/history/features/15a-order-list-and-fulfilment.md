# Feature: Order List and Fulfilment

**From build-plan:** feature 15a
**Build attempt:** 1
**Branch:** feature/order-list-and-fulfilment
**Status:** verified

## Goal

Admins can see every order at `/admin/orders` and open one at
`/admin/orders/[id]`. The detail shows the customer, purchased items, amount,
payment status, order status, date, and Stripe payment reference. Admins can move
a paid order between Paid, Processing, and Completed to track fulfilment.
Pending, Cancelled, and Refunded stay set only by Stripe events (and the refund
action in 15b), so a manual change never contradicts the payment.

**Decisions (user, this spec):** refunds are issued from the admin through Stripe
and are feature 15b. Admins may set only the fulfilment statuses Paid,
Processing, and Completed, and only on an order already in one of them.

## In scope

- `/admin/orders`: a table of all orders, newest first (`createdAt` desc, then
  `number` desc). Columns: order number (links to the detail), customer, items
  (total quantity), total, payment status, order status, and date. Pages of 50
  through `?page=N` with Previous/Next links and "Page N of M". A missing,
  non-numeric, or out-of-range page shows the nearest valid page; there is no
  error page. Empty state: "No orders yet."
- `/admin/orders/[id]`: the order header (number, order status chip, date), then:
  - **Customer:** the account name and email when the order has a `userId`, else
    "Guest" with the `customerEmail` Stripe collected, else "Guest".
  - **Items:** product name, type (Digital product or Service), unit price,
    quantity, and line total, plus the order total. Each product name links to its
    admin edit page (`/admin/products/<id>` or `/admin/services/<id>`).
  - **Payment:** payment status, total, currency (uppercase), the Stripe payment
    intent id (or "Not recorded"), and the Checkout session id.
  - **Fulfilment:** the status control below.
- **Payment status** is derived from the order status, not stored: `PENDING` →
  "Awaiting payment", `PAID`/`PROCESSING`/`COMPLETED` → "Paid", `CANCELLED` →
  "Not paid", `REFUNDED` → "Refunded". The plan lists payment and order status
  separately; the schema has one `status`, and this mapping shows both without a
  migration.
- **Fulfilment control:** for an order in Paid, Processing, or Completed, the
  admin picks one of those three (a labelled radio group with the current one
  checked) and saves. For any other status the control is replaced by a note:
  "Status follows Stripe. Pending, Cancelled, and Refunded orders cannot be
  changed here." Customers see the new status on their account order pages,
  which already show all six statuses in both languages. Downloads stay
  available, because all three statuses are paid statuses.
- Dashboard: each recent-order number links to its detail page, and the Recent
  orders section gets a "View all orders" link.
- An "Orders" entry in the admin sidebar's Admin section, after Services.

## Out of scope

- Refunds and the `charge.refunded` webhook (15b).
- Service work, onboarding answers, notes, and progress (feature 16). The detail
  shows no service work status.
- Customer pages and links to them (feature 17).
- Search, status filters, sorting, CSV export, editing items or amounts,
  cancelling orders, and deleting orders.
- Email notifications about status changes (feature 19).
- Links into the Stripe dashboard (the app does not know test vs live mode).

## Build loop

`workflow.stepReview` is `feature`: implement every step below in order. Run
`pnpm test` and `pnpm lint` after each logic step, then present one review packet
when all steps pass. `workflow.checkpointCommits` is `disabled`, so there are no
per-step commits. `/complete` creates the single feature commit.

## Build steps

- [x] **1. Order rules and queries.** Add `lib/admin-orders.ts` (server code, no
  `next/*` imports):
  - `FULFILMENT_STATUSES = ["PAID", "PROCESSING", "COMPLETED"]` and
    `isFulfilmentStatus(value: unknown)`.
  - `paymentStatusLabel(status)` with the mapping above.
  - `ORDERS_PAGE_SIZE = 50` and `parsePage(value, totalCount)`: returns the
    1-based page, clamping a missing, non-integer (`"2.5"`, `"abc"`, `"-1"`,
    `"1e2"`), zero, or too-large value into `1..max(1, pageCount)`. Accepts only
    `^\d{1,6}$`.
  - `listAdminOrders(pageParam)`: one `count` plus one `findMany` with `skip`/
    `take`, newest first. It returns `{ orders, page, pageCount, total }`, where
    each order has `id`, `number`, `status`, `totalCents`, `createdAt`,
    `customer` (via `customerLabel` from `lib/admin.ts`), and `itemCount`.
  - `getAdminOrder(id)`: `null` for an id that fails `isProductId` (the shared
    ≤ 64 character id check) or matches nothing. Selects the order fields above,
    `currency`, `customerEmail`, `stripePaymentIntentId`,
    `stripeCheckoutSessionId`, `user { name, email }`, and items (ordered by
    `id`) with `priceCents`, `quantity`, and `product { id, name, type }`.
  - **Done when:** `lib/admin-orders.test.ts` (mocking `db`) covers each payment
    label, `isFulfilmentStatus` for all six statuses plus junk, `parsePage` edge
    cases (missing, `"0"`, `"-1"`, `"2.5"`, `"abc"`, `"1e2"`, past the last page,
    zero orders → page 1), the list query's `skip`/`take`/order, customer labels
    for a signed-in, guest-with-email, and guest-without-email order, and
    `getAdminOrder` returning `null` for an oversized id without a query.
    `pnpm test` is green.

- [x] **2. Fulfilment Server Action.** Add `actions/admin-orders.ts`
  (`"use server"`) with `setOrderStatus(previous, formData)`:
  - `requireAdmin()` first, outside the try. `id` must pass `isProductId`, and
    `status` must pass `isFulfilmentStatus`, else `not_found` / `invalid_status`.
  - One conditional write:
    `updateMany({ where: { id, status: { in: FULFILMENT_STATUSES } }, data: { status } })`.
    When the order was moved to Pending, Cancelled, or Refunded by Stripe in the
    meantime, nothing changes. Zero rows → `locked` when the order exists, else
    `not_found`.
  - On success: `revalidatePath("/admin", "layout")` and
    `revalidatePath("/[lang]", "layout")` (customer account pages), then return
    `{ success: true }`. Setting the current status again is a successful no-op.
  - Result shape: `{ success: true } | { success: false, error: "not_found" |
    "invalid_status" | "locked" | "unexpected" } | null`. Unexpected errors log
    without customer data and return `unexpected`.
  - **Done when:** `actions/admin-orders.test.ts` (mocking `db`, `requireAdmin`,
    `next/cache`) proves that a non-admin never reaches the database, each of the
    three statuses saves with the conditional `where`, `PENDING`/`CANCELLED`/
    `REFUNDED`/junk give `invalid_status` without a query, a locked order gives
    `locked`, a missing order `not_found`, and a database error `unexpected`.
    `pnpm test` is green.

- [x] **3. Admin order pages, navigation, and dashboard links.** Add
  `app/admin/orders/page.tsx` and `app/admin/orders/[id]/page.tsx`. Each calls
  `requireAdmin()` and `adminMetadata("Orders" | "Order #1001")`. The detail
  page's `generateMetadata` reads the order only for an admin, as the product
  edit page does. An unknown id calls `notFound()`.
  - The list follows the product list's table styling. Order and payment status
    use the existing `StatusChip` with `en.account` for the order status, and a
    small text label for payment status. `searchParams` is read through the page
    props (check `node_modules/next/dist/docs/` for the async `searchParams`
    shape).
  - Add `components/admin/OrderStatusControl.tsx` (`useActionState`): a
    `<fieldset>` with a `<legend>` "Order status" and three radio inputs with
    visible labels, a submit button with a pending state ("Saving…"), and a
    result line in a live region: "Status saved." on success, or the error
    message (`locked`: "This order's status changed in Stripe. Reload to see it.";
    `not_found`: "This order no longer exists."; others: "Something went wrong.
    Try again."). After a failed save, the radios show the status the admin
    picked.
  - All customer names, emails, and product names render as React text with
    `dir="auto"`, never as HTML. Long emails and ids wrap (`break-all`).
  - Add `box: BoxIcon` to `SideNav`'s icon map, and
    `{ href: "/admin/orders", label: "Orders", icon: "box" }` to the layout's
    Admin section after Services.
  - On `app/admin/page.tsx`, wrap each recent order number in a link to
    `/admin/orders/<id>` and add a "View all orders" link in the section header.
  - **Done when:** `pnpm test`, `pnpm lint`, and `pnpm build` pass. In the running
    app as admin: `/admin/orders` lists the seeded orders with the right payment
    labels and paging, a detail page shows customer, items, payment references,
    and totals, changing a paid order to Processing then Completed shows the new
    status on the customer's `/en/account/orders` (and `/ar/...`), and the
    downloads still work. A pending or cancelled order shows the note instead of
    the control. As a customer or signed out, both order pages return 404.

## Files / areas

- New: `lib/admin-orders.ts`, `lib/admin-orders.test.ts`,
  `actions/admin-orders.ts`, `actions/admin-orders.test.ts`,
  `app/admin/orders/page.tsx`, `app/admin/orders/[id]/page.tsx`,
  `components/admin/OrderStatusControl.tsx`.
- Changed: `app/admin/layout.tsx` (nav entry), `components/admin/SideNav.tsx`
  (icon map), `app/admin/page.tsx` (order links).
- Reused without change: `lib/admin.ts` (`requireAdmin`, `adminMetadata`,
  `customerLabel`, `isProductId`), `components/account/AccountParts.tsx`
  (`StatusChip`, `OrderNumber`, `EmptyState`), `lib/orders.ts`
  (`formatOrderNumber`), `lib/money.ts`, `lib/dates.ts`,
  `lib/i18n/dictionaries/en.ts` (status labels), `components/ui/table`.
- No schema migration. `lib/order-sync.ts` and the webhook are unchanged: they
  only move orders out of `PENDING`, so they never race a fulfilment change.

## Data / contracts

- Order status writes from the admin: only to `PAID`, `PROCESSING`, or
  `COMPLETED`, and only from one of those, in one conditional `updateMany`. No
  other `Order` field is written.
- Trusted actor: `requireAdmin()` on every page and the action. The status value
  is whitelisted on the server; the client's radio list is not trusted.
- Action result:
  `{ success: true } | { success: false, error: "not_found" | "invalid_status" | "locked" | "unexpected" } | null`.
- URLs: `/admin/orders?page=N` (1-based) and `/admin/orders/<order id>` (the
  cuid, as the dashboard already uses). 15b adds its refund control to the same
  detail page.
- Amounts are whole cents shown with `formatPriceCents` (all orders are USD, per
  the overview). Stripe ids are shown as plain text and never logged.

## Testing

- Unit (Vitest): `lib/admin-orders.test.ts` (step 1) and
  `actions/admin-orders.test.ts` (step 2) are the required logic gates.
- No browser harness is configured. UI (step 3) is verified with `pnpm build`,
  `pnpm lint`, and a manual run through the app during `/check`. This spec claims
  no browser evidence.
- `pnpm test`, `pnpm lint`, and `pnpm build` must all be green before review.
- No Verify command exists, so none was run while writing this spec.

## Notes for the AI

- Read `node_modules/next/dist/docs/` for page `searchParams`, `useActionState`,
  and `revalidatePath` before writing code.
- The admin area is English-only. Reuse `en.account.status` for order status
  labels as the dashboard does; do not add dictionary strings.
- Keep `lib/admin.ts` unchanged; new order code lives in `lib/admin-orders.ts`.
- Several admin files use CRLF line endings; edit with the Edit/Write tools rather
  than shell heredocs, which mangle backslash escapes on this machine.
- Do not touch `prototypes/`. Follow the existing admin tokens and table styling.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":11981,"specSha256":"42c5f68411de3032089e4f8733b36d6943455fea7ba573375de7eeec562170b5","branch":"refs/heads/feature/order-list-and-fulfilment","head":"fcaf602c0e1f8f18b0f4328fffd9b5bc49a93159","baseRef":"refs/heads/main","baseCommit":"32c738fc56d27994a34025727625005fe5c73d9b","sourceTree":"98babe468305e2419eab6ddbaaaad4a619b805cd","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** fcaf602c0e1f8f18b0f4328fffd9b5bc49a93159
**Base commit:** 32c738fc56d27994a34025727625005fe5c73d9b
**Base ref:** main
**Spec hash:** 42c5f68411de3032089e4f8733b36d6943455fea7ba573375de7eeec562170b5
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-07T20:52:34Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-07T20:58:00Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `pnpm test`: pass (38 files, 654 tests)
- `pnpm lint`: pass
- `pnpm build`: pass (`/admin/orders` and `/admin/orders/[id]` compiled; working tree unchanged afterwards)
- `/check`: not run (not required by the request)

## Evidence

- Preconditions verified: `HEAD` = target, `git merge-base main HEAD` = base, `current-feature.md` SHA-256 matches, only `blueprint/context/review.md` differed from the target before review.
- Full delta reviewed: `actions/admin-orders.ts` and test, `lib/admin-orders.ts` and test, `app/admin/orders/page.tsx`, `app/admin/orders/[id]/page.tsx`, `components/admin/OrderStatusControl.tsx`, `app/admin/page.tsx`, `app/admin/layout.tsx`, `components/admin/SideNav.tsx`, plus the spec and build-plan changes.
- Security: `requireAdmin()` runs first in both pages and outside the action's `try`; detail `generateMetadata` reads the order only for an admin; status is whitelisted server-side by `isFulfilmentStatus`; the single `updateMany` is guarded by `status in [PAID, PROCESSING, COMPLETED]`, and the only other writer (`lib/order-sync.ts:100`) is guarded by `status: "PENDING"`, so the two never overwrite each other. User-supplied text renders as React text; the client component imports only types from `lib/admin-orders`.
- Contract: fulfilment statuses equal `PAID_ORDER_STATUSES` (`lib/delivery.ts:9`), so downloads stay available; `revalidatePath` calls match the existing `actions/admin-products.ts` pattern and the Next 16 docs.
- Performance: list uses one `count` plus one paged `findMany` (take 50); detail is one `findUnique` per call (double call recorded as F-21).
- Tests: every step 1 and step 2 "Done when" case is asserted, including non-admin short-circuit, conditional `where`, locked vs not_found, and no query for oversized ids. No skipped or focused tests in the delta.

## Findings

- F-20 [P3] open: admin order list duplicates the dashboard's recent-order query and mapping
- F-21 [P3] open: order detail page loads the same order twice per request
- No P0 or P1 findings. Existing ledger entries were not touched by this delta and were not re-examined.

## Remaining risk

- `/check` was not run (not required): the running-app flows in step 3 (paging, status change reflected on `/en` and `/ar` account pages, downloads after a status change, 404 for non-admins) were not exercised live in this review.
- No browser harness is configured, so `OrderStatusControl` behavior (pending state, live-region message, keeping the admin's pick after a failed save) is verified by code reading only.
- No standalone typecheck or Verify command exists; type checking relied on `pnpm build`.
