# Feature: Admin Service Management

**From build-plan:** feature 16
**Build attempt:** 1
**Branch:** feature/admin-service-management
**Status:** verified

## Goal

Give admins a work queue for purchased services: every service bought in a paid
order, the customer, the onboarding details they sent, and controls to move the
work through its statuses and keep internal notes. Start and completion dates are
recorded automatically, so the customer's existing progress view (feature 11)
shows real dates.

Not the service catalog. Feature 14 already owns `/admin/services` (create, edit,
and publish service offerings). This feature manages the work after purchase.

## In scope

- `/admin/service-orders`: a paged list (50 per page, newest purchase first) of
  every service order item in a paid order (`PAID`, `PROCESSING`, `COMPLETED`).
  Each row shows the service name, customer, order number, purchase date, and
  work status. An item without a `Service` record shows "Awaiting details".
- `/admin/service-orders/[itemId]`: the detail page for one service order item:
  - Service name (links to `/admin/services/[id]`) and duration.
  - Order number (links to `/admin/orders/[id]`) and purchase date.
  - Customer name, email, and whether they were signed in or a guest.
  - The onboarding answers the customer sent.
  - Status, start date, and completion date.
  - Internal admin notes.
- One form on the detail page, shown only when a `Service` record exists, that
  saves the status (any of the five) and the admin notes together.
- Dates are stamped automatically when the status changes (see Data /
  contracts).
- A "Service orders" link in the admin sidebar's Admin section.
- After a save, the admin pages and the customer's account pages show the new
  values.

## Out of scope

- The service catalog at `/admin/services` (feature 14). It does not change.
- Creating a work record before the customer sends their onboarding details.
  Until then the detail page shows "Awaiting customer details" and no form.
- Editing the customer's onboarding answers. Customers do that themselves while
  the status is `NEW` or `WAITING_FOR_INFORMATION` (feature 10).
- Showing `adminNotes` to customers. Notes stay internal.
- Emails when a status changes, or for anything else (feature 19).
- Filtering or searching the list, the customer management pages (feature 17),
  and changes to the dashboard's Active services count (feature 12).
- Service items in pending, cancelled, or refunded orders. They are not listed,
  and their detail URL returns 404.
- Editing start and completion dates by hand.

## Build loop

`workflow.stepReview` is `feature` and `workflow.checkpointCommits` is
`disabled`. Build all the steps below, run the checks at the end of each step,
then present one review packet for the whole feature. Make no checkpoint
commits; `/complete` creates the feature commit.

## Build steps

- [x] 1. **Work rules and queries.** Add `lib/admin-service-work.ts` (server code,
  `requireAdmin()` is checked by callers) with:
  - `listServiceOrders(pageParam)`. Reuses `parsePage` and `ORDERS_PAGE_SIZE`
    from `lib/admin-orders.ts`.
  - `getServiceOrder(itemId)`. Uses the `isProductId` length guard, finds only
    service items in paid orders, and returns null otherwise.
  - Pure helpers, kept in a separate file (`lib/service-work-rules.ts`) that
    imports nothing from the db or `next/*`:
    - `isServiceStatus`
    - `parseAdminNotes` (trim, limit 5,000 characters, empty becomes null)
    - `statusChangeData(current, next, dates, now)`, which returns the status and date
      fields to write

  Add Vitest tests for the pure rules and for the query `select` shapes, using
  the db mocking pattern in `lib/admin-orders.test.ts`.
  **Done when:** `pnpm test` passes with tests covering every row of the date
  table below, the notes limit and empty-to-null rule, unknown statuses, and the
  list and detail `where` limiting results to service items in paid orders.

- [x] 2. **Save action.** Add `actions/admin-service-work.ts` with
  `saveServiceWork(previous, formData)`. It calls `requireAdmin()` first,
  outside the `try`, as in `actions/admin-orders.ts`.
  - Validate `id`, `status`, and `notes`.
  - Read the current record, then write once with
    `updateMany({ where: { id, status: current } })`. Revalidate `/admin` and
    `/[lang]` (both `layout`).
  - Results: `success`, `not_found` (no record, or not in a paid order),
    `invalid_status`, `notes_too_long`, `changed` (zero rows: the status
    changed since it was read), or `unexpected`, which is logged without
    customer data.

  Add tests for each result, using a mocked db.
  **Done when:** `pnpm test` passes. A non-admin call ends in the same 404 as
  other admin actions. A stale status write updates nothing and returns
  `changed`.

- [x] 3. **Detail page.** Add `app/admin/service-orders/[itemId]/page.tsx` and a
  client `components/admin/ServiceWorkForm.tsx`. Follow
  `app/admin/orders/[id]/page.tsx` and `OrderStatusControl.tsx`:
  - `generateMetadata` reads the item only for admins (title
    `Service order <service name>`; anyone else gets the 404 title).
  - Render the answers with `OnboardingAnswers` and `en.onboarding`. If the
    stored requirements are malformed (`readRequirements` returns null), show a
    notice instead of throwing.
  - The form has the five statuses as labelled radios, each with a one-line
    hint, and a labelled notes textarea with its limit shown. The submit button
    shows "Saving…" while pending.
  - Results appear in a `role="status"` message. After an error, the admin's
    selected status and typed notes stay in the form.

  **Done when:** `pnpm build` passes. The page shows the details, answers,
  status, dates, and notes for a seeded service item; the saved values show up
  after a reload; and an item without a record shows "Awaiting customer details"
  with no form.

- [x] 4. **List page and navigation.** Add `app/admin/service-orders/page.tsx`
  (table with prev/next paging like `/admin/orders`, an empty state, and each
  row linking to its detail page). Add the sidebar link in
  `app/admin/layout.tsx`, reusing an existing icon from `components/icons` (add
  one only if none fits).
  **Done when:** `pnpm build` and `pnpm lint` pass. The list shows seeded paid
  service items, including one without a record ("Awaiting details"), and no
  items from pending or refunded orders. The sidebar marks the page as current.
  A signed-out visitor or a customer gets the 404 on both routes.

- [x] 5. **Fix: the form shows the saved status after a save.** Found in manual
  testing: saving In progress stored it correctly, but the radios went back to
  New. React resets a form submitted through its `action` prop, which restores
  the status the page first loaded with. A second save would then quietly write
  New again. `ServiceWorkForm` now submits from `onSubmit` with
  `startTransition`, so no reset happens. Its controlled state still picks up
  the refreshed saved values.
  **Done when:** `pnpm build` and `pnpm lint` pass. After saving a new status,
  the form keeps showing it without a reload, and saving again keeps it.

## Files / areas

- New: `lib/service-work-rules.ts`, `lib/service-work-rules.test.ts`
- New: `lib/admin-service-work.ts`, `lib/admin-service-work.test.ts`
- New: `actions/admin-service-work.ts` (and its test file, following existing
  action tests if any; otherwise test through the lib)
- New: `app/admin/service-orders/page.tsx`,
  `app/admin/service-orders/[itemId]/page.tsx`
- New: `components/admin/ServiceWorkForm.tsx`, `components/admin/ServiceStatus.tsx`
  (status chip that shows "Awaiting details" when there is no record)
- Edit: `app/admin/layout.tsx` (sidebar link), `components/admin/SideNav.tsx`
  (adds the existing `ClockIcon` to its icon map)
- Read and reuse, without changing: `lib/admin.ts` (`requireAdmin`, `adminMetadata`,
  `customerLabel`, `isProductId`), `lib/admin-orders.ts` (`parsePage`,
  `ORDERS_PAGE_SIZE`), `lib/delivery.ts` (`PAID_ORDER_STATUSES`),
  `lib/onboarding.ts` (`readRequirements`),
  `components/onboarding/OnboardingAnswers.tsx`,
  `components/account/AccountParts.tsx` (`ServiceStatusChip`, `OrderNumber`),
  `lib/dates.ts`, `lib/i18n/dictionaries/en.ts`
- No schema change or migration. `Service` already has `status`,
  `requirements`, `adminNotes`, `startDate`, and `completedDate`.

## Data / contracts

**Routes** (admin-only, English, never language-prefixed):

- `GET /admin/service-orders?page=N`. Page parsing matches `/admin/orders`.
- `GET /admin/service-orders/[itemId]`. `itemId` is the `OrderItem` id, so an
  item without a `Service` record still has a page.

**Who may see what:** `requireAdmin()` runs first on both pages, in metadata
reads, and in the action. The role comes from the session's user row, never from
input. Anyone else gets the same 404 as the rest of `/admin`.

**List row:**

```ts
{
  itemId: string;
  serviceName: string;
  customer: string; // customerLabel(order)
  orderId: string;
  orderNumber: number;
  purchasedAt: Date; // order.createdAt
  status: ServiceStatus | null; // null = awaiting details
}
```

**Detail:**

```ts
{
  itemId: string;
  product: { id: string; name: string; durationDays: number | null };
  order: {
    id: string;
    number: number;
    createdAt: Date;
    customerEmail: string | null;
    user: { name: string; email: string } | null;
  };
  service: {
    id: string;
    status: ServiceStatus;
    requirements: unknown; // read with readRequirements
    adminNotes: string | null;
    startDate: Date | null;
    completedDate: Date | null;
    updatedAt: Date;
  } | null;
}
```

Neither query selects `digitalFile`, `stripeCheckoutSessionId`, `passwordHash`,
or session data.

**Action input** (`FormData`): `id` (`Service.id`, at most 64 characters),
`status` (one of `NEW`, `WAITING_FOR_INFORMATION`, `IN_PROGRESS`, `COMPLETED`,
`CANCELLED`), and `notes` (string, at most 5,000 characters after trimming;
empty becomes `null`). The action never reads dates, the order, or the customer
from the form.

**Action result:**

```ts
type ServiceWorkResult =
  | { success: true }
  | {
      success: false;
      error: "not_found" | "invalid_status" | "notes_too_long" | "changed" | "unexpected";
    }
  | null;
```

`not_found` also covers a record whose order is no longer paid.

**Date stamping** (`statusChangeData(current, next, dates, now)`). Dates are server
time; the client never sends them.

| Change | `startDate` | `completedDate` |
| --- | --- | --- |
| to `IN_PROGRESS` | set to `now` if null, otherwise kept | cleared |
| to `COMPLETED` | set to `now` if null, otherwise kept | set to `now` unless already `COMPLETED` |
| to `NEW`, `WAITING_FOR_INFORMATION`, or `CANCELLED` | kept | cleared |
| same status (notes-only save) | kept | kept |

**Atomic write:** one `service.updateMany` conditioned on the status that was
read. If zero rows change, return `changed` rather than overwriting.

**Interaction with feature 10:** the customer's `saveOnboarding` changes only
`requirements`, and only while the status is `NEW` or
`WAITING_FOR_INFORMATION`. Setting `WAITING_FOR_INFORMATION` here asks the
customer for more details (their account shows the "action needed" link).
Setting any later status locks their answers. No change to feature 10 code.

**Rendering:** all customer-supplied text appears as plain React text with
`dir="auto"`, never as HTML: answers, names, emails, and notes. Notes keep line
breaks (`whitespace-pre-line`). The website answer is never turned into a link.

## Testing

- `pnpm test`. Unit tests for:
  - `service-work-rules` (every date-table row, notes trimming, the limit and
    empty-to-null rule, the status whitelist)
  - the list and detail query filters and selects
  - every `saveServiceWork` result, using a mocked db and mocked
    `requireAdmin`, following existing test patterns
- `pnpm build` (type-check) and `pnpm lint` at the end of steps 3 and 4.
- Manual or `/check`, against seeded data. Seed or create:
  - a paid order with a service item and no record
  - one with a `NEW` record
  - a refunded order with a service item

  Then confirm the list, the detail page, saving, the dates shown in the
  customer's `/en/account/services/[itemId]` progress, the 404 for non-admins,
  and that the refunded item is not listed. No Browser tests command exists, so
  there is no browser automation.

## Notes for the AI

- Admin UI text is English-only. Reuse `en.account` for the status chip text and
  `en.onboarding` for answer labels instead of adding new dictionary keys.
- Match the card, table, focus, and back-link classes in
  `app/admin/orders/[id]/page.tsx` and `app/admin/orders/page.tsx`.
- `requireAdmin()` throws through `notFound()`. Keep it outside the action's
  `try`.
- Log errors without onboarding answers or notes.
- Keep `lib/service-progress.ts` and the customer pages unchanged. They already
  read `startDate`, `completedDate`, and `updatedAt`.
- The build-plan title duplicates feature 14's. Use "Service orders" for the
  UI and route so the two areas stay distinct.

## Open questions

These are proposed defaults to confirm or change during spec review. None
blocks the build if accepted.

1. **Route and label.** `/admin/service-orders`, with "Service orders" in the
   sidebar.
2. **No record yet.** An admin can't set a status until the customer sends their
   details. The alternative is letting admins create a record with empty
   requirements, which would need a change to the `requirements` contract.
3. **Free status changes.** Any status can be set from any status, including
   reopening a completed or cancelled service, with dates handled by the table
   above.
4. **Refunded or cancelled orders.** Their service items are hidden from this
   queue rather than shown read-only.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":13910,"specSha256":"c404e92f4017242b50e9531ec9f76ac393f3386e58ae559d01448a6027f73504","branch":"refs/heads/feature/admin-service-management","head":"11706155a1cee43ad7acd045236f1c7dcf7e46c3","baseRef":"refs/heads/main","baseCommit":"f87c8910a70be8883679ee5d473963b7eb206d84","sourceTree":"493a19b494f1932f82ec029c8686ef37eb0052b7","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 11706155a1cee43ad7acd045236f1c7dcf7e46c3
**Base commit:** f87c8910a70be8883679ee5d473963b7eb206d84
**Base ref:** main
**Spec hash:** c404e92f4017242b50e9531ec9f76ac393f3386e58ae559d01448a6027f73504
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-08T20:56:57Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-08T21:02:09Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `f87c8910a70be8883679ee5d473963b7eb206d84..11706155a1cee43ad7acd045236f1c7dcf7e46c3` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD` / `git merge-base main HEAD` / `sha256sum blueprint/context/current-feature.md` / `git status --porcelain --untracked-files=all`: pass (HEAD, merge base, and spec hash match the request; only review.md and findings.md differ)
- `pnpm test`: pass (41 files, 726 tests)
- `pnpm lint`: pass
- `pnpm build`: pass (both `/admin/service-orders` routes compiled and type-checked)

## Evidence

- Reviewed all 14 files in `f87c891..1170615`: `lib/service-work-rules.ts`, `lib/admin-service-work.ts`, `actions/admin-service-work.ts`, the two `app/admin/service-orders` pages, `components/admin/ServiceWorkForm.tsx`, `components/admin/ServiceStatus.tsx`, `app/admin/layout.tsx`, `components/admin/SideNav.tsx`, the three new test files, the spec, and `project-overview.md`.
- `requireAdmin()` runs first on both pages and outside the action's `try`; metadata reads the item only for an admin session. Action and both queries limit to service items in `PAID_ORDER_STATUSES` orders; neither query selects `digitalFile`, Stripe ids, or password/session data.
- `statusChangeData` matches every row of the spec's date table, and the tests cover each row, the notes limit, empty-to-null, and the status whitelist. All customer text renders as React text with `dir="auto"`; the website answer is not linked.
- Step 5 form change: `onSubmit` + `startTransition` avoids React's action-form reset, and render-time state sync picks up refreshed saved values.

## Findings

- F-26 [P3] open (new): unexpected-error log prints the raw error message, against the spec's no-notes logging rule and the existing `errorLabel` pattern.
- F-25 [P2] open (re-examined): stale form still reverts another admin's status change; unchanged by this checkpoint.
- F-21 [P3] open (re-checked): service-order detail page still loads the item twice.

## Remaining risk

- Check was not required and was not run; no browser exercise of the list, detail page, save flow, or customer progress dates in this pass.
- No Browser tests command exists, and no component test covers the step 5 `ServiceWorkForm` behavior (radios keep the saved status after a save); it is proven only by the builder's manual testing.
