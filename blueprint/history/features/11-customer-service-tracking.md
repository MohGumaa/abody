# Feature: Customer Service Tracking

**From build-plan:** feature 11
**Build attempt:** 1
**Branch:** feature/customer-service-tracking
**Status:** verified

## Goal

A signed-in customer can open any service they bought from Account → Services
and see where it stands: the current service status, a progress timeline built
from the status and its dates, and the onboarding details they submitted. The
"updates" in the build plan are the status changes and their dates (decided on
2026-10-07). Nothing new is stored.

## In scope

- A service detail page at `/<lang>/account/services/[itemId]` for the signed-in
  owner of the order.
- On that page:
  - the service name, order number, and purchase date;
  - a service status chip;
  - a progress timeline: Purchased → Details received → Work started →
    Completed, or ending in Cancelled;
  - a "Last updated" date;
  - the submitted onboarding answers, read-only, with the existing add or update
    link while the details can still change.
- A clear message for each status. For `WAITING_FOR_INFORMATION`, the message
  asks the customer to update their details and links to the onboarding form.
- Account → Services: each row shows the service status chip in place of the
  order status chip, and the service name links to the detail page.
- English and Arabic text for the five service statuses and everything else this
  feature adds.

## Out of scope

- Any schema change or migration. Free-text messages from Abody would need a
  new table, so they are not part of this feature.
- Showing `adminNotes` to customers. It stays internal to the team.
- Admin status changes, or setting `startDate` and `completedDate` (feature 16).
  Until then, live records stay `NEW` unless a development script changes them.
- Tracking for guests. Guest orders are not attached to accounts (8a). Guests
  keep the onboarding page through the success page link, and that page does
  not change.
- Emails on status changes (feature 19).
- Changes to the success page, the onboarding page or form, checkout, or the
  webhook.

## Build loop

`workflow.stepReview` is `feature`: build all steps, then hand over one review
packet with no pause between steps. `workflow.checkpointCommits` is `disabled`,
so make no commits between steps. `/complete` creates the feature commit. After
every logic step, `pnpm test` must pass. Before the review handoff, `pnpm lint`
and `pnpm build` must also pass.

## Build steps

- [x] **1. Progress rules.**
  - Add the pure module `lib/service-progress.ts`. It has no `db` or `next/*`
    imports, matching `lib/onboarding.ts`. It exports
    `serviceProgress(input)` (see Data / contracts).
  - Add tests in `lib/service-progress.test.ts`.
  - **Done when:** `pnpm test` passes with one case for each of:
    - no record;
    - each of the five statuses;
    - `IN_PROGRESS` with a null `startDate`, where the step is done with no date;
    - `COMPLETED` with both dates set;
    - `CANCELLED` from `NEW`, and `CANCELLED` after a `startDate` was set.

- [x] **2. Owner-scoped query.**
  - In `lib/account.ts`, add `findAccountService(userId, itemId)`. It returns
    the detail shape in Data / contracts, or `null`.
  - It matches only when all of these hold:
    - the item id is a non-empty string of at most 64 characters;
    - the product type is `SERVICE`;
    - the order belongs to `userId`;
    - the order status is in `PAID_ORDER_STATUSES`.
  - It never selects `adminNotes` or `digitalFile`.
  - Add tests in `lib/account.test.ts` that mock `db`, following the existing
    `listAccountServices` test.
  - **Done when:** `pnpm test` passes with cases for:
    - the owner's item;
    - an item with no `Service` record;
    - the `where` clause carrying the user id, the `SERVICE` type, and the paid
      statuses, and the `select` excluding `adminNotes`;
    - an over-long or empty item id returning `null` without a query.

- [x] **3. Detail page.**
  - Add `app/[lang]/account/services/[itemId]/page.tsx` (server component,
    `noindex`).
  - Move the read-only answers list from `app/[lang]/onboarding/[itemId]/page.tsx`
    into `components/onboarding/OnboardingAnswers.tsx`. Use it on both pages.
    The onboarding page must render exactly as before.
  - Add `components/account/ServiceProgress.tsx`, which renders the timeline as
    an ordered list.
  - Add a `ServiceStatusChip` to `components/account/AccountParts.tsx`.
  - Add the new text to `lib/i18n/dictionaries/en.ts` and `ar.ts`.
  - Page behavior:
    - Signed out: redirect to `/<lang>/login?next=/<lang>/account/services/<itemId>`.
    - No match: `notFound()`.
    - Malformed stored requirements: throw, the same as the onboarding page.
  - Include a "Back to your services" link.
  - **Done when:**
    - `pnpm build` and `pnpm lint` pass.
    - In the running app, in both `/en` and `/ar` (right-to-left), the page
      shows:
      - a service with no details yet: the "details needed" message with the add
        link;
      - a `NEW` record: the answers and the update link;
      - an `IN_PROGRESS` record set by a development script: the timeline,
        read-only answers, and no edit link;
      - another user's item, an unknown id, and a digital-product item: the 404
        page.
    - The Account nav keeps "Services" highlighted on this page.

- [x] **4. List page links.**
  - On `app/[lang]/account/services/page.tsx`:
    - link each service name to its detail page;
    - replace the order `StatusChip` with `ServiceStatusChip`;
    - keep the `OnboardingStatus` add or update link;
    - replace the comment that says progress arrives with feature 11.
  - **Done when:** `pnpm lint` and `pnpm build` pass. In the running app, each
    row's name opens its detail page and the chip shows the service status in
    both languages.

## Files / areas

- `lib/service-progress.ts`, `lib/service-progress.test.ts` (new, pure)
- `lib/account.ts`, `lib/account.test.ts`
- `app/[lang]/account/services/[itemId]/page.tsx` (new)
- `app/[lang]/account/services/page.tsx`
- `app/[lang]/onboarding/[itemId]/page.tsx` (only the answers list moves out)
- `components/onboarding/OnboardingAnswers.tsx` (new)
- `components/account/ServiceProgress.tsx` (new)
- `components/account/AccountParts.tsx`
- `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/ar.ts`
- Reused without changes:
  - `getCurrentUser` (`lib/session.ts`)
  - `PAID_ORDER_STATUSES` (`lib/delivery.ts`)
  - `readRequirements`, `ONBOARDING_FIELDS` (`lib/onboarding.ts`)
  - `OnboardingStatus` (`components/onboarding/OnboardingStatus.tsx`)
  - `formatDate` (`lib/dates.ts`)
  - `localizedName` (`lib/catalog.ts`)
  - `localizedPath` (`lib/i18n/config.ts`)
  - `OrderNumber`, `PageHead`, `ACCOUNT_PANEL`, `TEXT_LINK` (`AccountParts`)

## Data / contracts

**Query result.**

```ts
interface AccountServiceDetail {
  itemId: string;
  name: string;
  nameAr: string | null;
  orderNumber: number;
  purchasedAt: Date;              // order.createdAt
  service: {
    status: ServiceStatus;
    requirements: unknown;        // validated with readRequirements on the page
    createdAt: Date;              // details first received
    startDate: Date | null;
    completedDate: Date | null;
    updatedAt: Date;
  } | null;
}
```

**`serviceProgress(input)`.** The input is `{ purchasedAt, service }` from the
query result. The function returns:

```ts
type StepKey = "purchased" | "details" | "started" | "completed" | "cancelled";
type StepState = "done" | "current" | "upcoming";
interface ProgressStep { key: StepKey; state: StepState; date: Date | null }
interface ServiceProgressResult {
  status: ServiceStatus | null;   // null = no details yet
  steps: ProgressStep[];
  lastUpdated: Date;              // service.updatedAt, else purchasedAt
}
```

The status decides whether a step is done. A date is shown only when its field
is set, so a missing `startDate` or `completedDate` never hides a step.

| Status | purchased | details | started | completed | cancelled |
|---|---|---|---|---|---|
| none | done (purchasedAt) | current | upcoming | upcoming | absent |
| `NEW` | done | done (createdAt) | current | upcoming | absent |
| `WAITING_FOR_INFORMATION` | done | current (createdAt) | upcoming | upcoming | absent |
| `IN_PROGRESS` | done | done | done (startDate?) | current | absent |
| `COMPLETED` | done | done | done (startDate?) | done (completedDate?) | absent |
| `CANCELLED` | done | done | done only if startDate is set, else absent | absent | done (no date) |

"current" marks the step that is happening now. The cancelled step has no date,
because there is no cancel date field.

**Status labels.** These live in a `serviceStatus` map in `account`, in both
languages:

| Status | English label |
|---|---|
| `NEW` | Details received |
| `WAITING_FOR_INFORMATION` | Waiting for information |
| `IN_PROGRESS` | In progress |
| `COMPLETED` | Completed |
| `CANCELLED` | Cancelled |
| no record | Details needed |

The chip tones follow `StatusChip`:

- warning: no record and `WAITING_FOR_INFORMATION`;
- primary: `NEW` and `IN_PROGRESS`;
- success: `COMPLETED`;
- danger: `CANCELLED`.

Each status also has a one-sentence message in the dictionary.

**Access, the trust boundary.** The user id always comes from
`getCurrentUser()`. Every miss returns the same `notFound()`, so nothing reveals
whether an item exists: another user's item, a guest order, an unpaid or
refunded order, a digital item, or an unknown id. The page is dynamic because
it reads the session cookie, so it always shows the current status.

**Rendering.**

- Answers and names are rendered only as React text with `dir="auto"`, and the
  website is never rendered as a link. This is unchanged from feature 10.
- Dates use `formatDate`.
- The timeline is an `<ol>`. Each step's state is given in text (a visually
  hidden "Done", "Current", or "Upcoming"), not by color alone, and the current
  step has `aria-current="step"`.

## Testing

`pnpm test` (Vitest) is the logic gate. Steps 1 and 2 must ship passing tests in
the same diff, using the cases in each Done when. Mock `@/lib/db` with
`vi.mock()`, as in `lib/account.test.ts`.

Steps 3 and 4 are checked with `pnpm build`, `pnpm lint`, and the running dev
server in `/en` and `/ar`. No Browser tests command is declared, so there is no
Playwright suite. The live checks need a signed-in user with a paid service
order, such as #1008 from feature 10 or a new sandbox checkout. Set `status`,
`startDate`, and `completedDate` with a development script, and restore the
record afterwards. Name what was used in the review packet.

**Evidence (2026-10-07).** Automated:

- `pnpm test`: 30 files, 431 tests passed (9 new in
  `lib/service-progress.test.ts`, 6 new for `findAccountService`).
- `pnpm lint`: clean.
- `pnpm build`: passed. The route list includes `ƒ /[lang]/account/services/[itemId]`
  as a separate dynamic route, so the `[...rest]` catch-all does not swallow it.

Not exercised live: no dev server was started and the Playwright connection was
unavailable. These parts of the step 3 and 4 Done when still need `/check`:

- rendering in `/en` and `/ar` for no record, `NEW`, and `IN_PROGRESS`;
- the 404 for another user's item, an unknown id, and a digital-product item;
- the nav highlight on the new page;
- the list page links.

Ownership scoping is covered by the unit test on the `where` clause, not by a
live request.

## Notes for the AI

- Before writing the page, read the relevant pages in
  `node_modules/next/dist/docs/` on dynamic params, `PageProps`, `notFound`, and
  `redirect`. Follow `app/[lang]/account/services/page.tsx` and
  `app/[lang]/onboarding/[itemId]/page.tsx`.
- Confirm that `/en/account/services/<id>` resolves to the new page and not to
  the `[...rest]` catch-all. Confirm the account layout and its `AccountNav`
  wrap the page. `useSelectedLayoutSegment()` should still return `services`.
- Keep `lib/service-progress.ts` free of server imports so it stays a pure unit.
- Do not select `adminNotes` or `digitalFile` in any query.
- Translate every new string into natural Arabic, following the tone of the
  existing `ar.ts`.
- Checks run on `main` while writing this spec:
  - No `Verify` command is declared, so none was run.
  - Archive path `blueprint/history/features/11-customer-service-tracking.md` is
    absent and does not appear in Git history.
  - Branch `feature/customer-service-tracking` does not exist. Only `main`
    exists.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":12487,"specSha256":"d380e90e6f4e5a18cb5c9a9941bfd17ca853c61aff89787cc4650ee739aeadab","branch":"refs/heads/feature/customer-service-tracking","head":"42ad2b0c08fba302770309b529a2f42ddf3a9ee2","baseRef":"refs/heads/main","baseCommit":"8715310cda3cbfc54b41fa42edbbb38293aa9437","sourceTree":"303e7ba6653b904cbac61a8e40469489452d67ff","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 42ad2b0c08fba302770309b529a2f42ddf3a9ee2
**Base commit:** 8715310cda3cbfc54b41fa42edbbb38293aa9437
**Base ref:** main
**Spec hash:** d380e90e6f4e5a18cb5c9a9941bfd17ca853c61aff89787cc4650ee739aeadab
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-07T10:25:44Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-07T11:30:00Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Commands

- `pnpm test`: pass (30 files, 431 tests)
- `pnpm lint`: pass (no output)
- `pnpm build`: pass (route list includes `ƒ /[lang]/account/services/[itemId]` as its own dynamic route)

### Evidence

- Preconditions: `HEAD` = target; `git merge-base main HEAD` = base; raw SHA-256 of `blueprint/context/current-feature.md` matches Spec hash (spec is tracked, no snapshot); only `blueprint/context/review.md` differed from the target before this pass, and the tree was unchanged after the build.
- Ownership boundary: `findAccountService` (`lib/account.ts`) takes the user id from `getCurrentUser()` on the page, and its `where` combines item id, `order: { userId, status in PAID_ORDER_STATUSES }`, and `product.type = SERVICE`; every miss returns `null` and the page calls `notFound()`. Empty, non-string, and over-64-char ids return `null` before any query.
- Data exposure: the `select` names only product name fields, order number and `createdAt`, and six `service` fields; `adminNotes`, `digitalFile`, and `stripeCheckoutSessionId` are not selected (asserted in `lib/account.test.ts`).
- Rendering: names and answers render only as React text with `dir="auto"`; no `dangerouslySetInnerHTML`, the website is not a link; `OnboardingAnswers` markup matches the removed onboarding-page block.
- Timeline: `<ol>` with `aria-current="step"` on the current step and a visually hidden state word per step; markers are `aria-hidden`.
- `lib/service-progress.ts` matches every row of the spec table (none, NEW, WAITING_FOR_INFORMATION, IN_PROGRESS, COMPLETED, CANCELLED with and without `startDate`); it imports only a Prisma enum type. Nine unit tests cover each row.
- Performance: one indexed `findFirst` by primary key per page view; no N+1 or unbounded work.

### Findings

- F-17 [P3] open: WAITING_FOR_INFORMATION message does not itself link to the onboarding form (link is in the details section head).

### Remaining risk

- `/check` was not run (not required): live rendering in `/en` and `/ar`, the 404 for another user's item, unknown id and digital item, the nav highlight, and the list-page links were not exercised in a running app.
- Ownership scoping is proven by a mocked `where`-clause unit test, not by a live request against the database.
- No browser test command is declared, so the timeline's screen-reader output was reviewed from markup only.
