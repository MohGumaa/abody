# Feature: Service Purchase & Onboarding

**From build-plan:** feature 10
**Build attempt:** 1
**Branch:** feature/service-purchase-onboarding
**Status:** verified

## Goal

After paying for a service, a customer fills in one onboarding form that gives
Abody what it needs to start the work. The answers are saved as the first
`Service` work record. The form is reachable from the payment success page (for
guests and signed-in customers alike) and from Account → Services. The customer
can update their answers until an admin starts the work.

## In scope

- New `Service` model and `ServiceStatus` enum (migration). One record per
  purchased service order item, created when the customer first submits.
- One shared onboarding form for every service, using the project plan's
  fields: business name (required), website, ad account details, campaign
  goals, monthly budget, and additional notes.
- An onboarding page at `/<lang>/onboarding/[itemId]`. Access is granted in one of
  two ways:
  - the signed-in owner of the order, or
  - a `?session_id=` matching the order's Stripe checkout session, the same
    bearer credential the success page and downloads already use.
- A Server Action that re-checks access on every submit, validates the answers,
  and creates or updates the record, refusing once the record is locked.
- Editing is allowed while the record is `NEW` or `WAITING_FOR_INFORMATION`. Any
  other status shows the saved answers read-only.
- Entry points:
  - the success page lists the order's service items with "Add your details" or
    "Update your details";
  - Account → Services shows each item's onboarding state and the same link.
- English and Arabic text for everything this feature adds.

## Out of scope

- Service status tracking, an update timeline, or a service detail page in the
  account (feature 11).
- Admin views, notes, start and completion dates, or status changes (features 12
  and 16). `adminNotes`, `startDate`, and `completedDate` exist in the schema
  but nothing writes them yet.
- Per-service or admin-configurable form fields, and service packages (feature
  14 and open question 11 in the overview).
- Emails on submission (feature 19).
- Attaching guest orders to accounts, and any change to checkout or the webhook.
- File uploads in the form.

## Build loop

`workflow.stepReview` is `feature`, so build all steps and then hand over one
review packet. There is no pause after each step. `workflow.checkpointCommits`
is `disabled`, so make no commits between steps. `/complete` creates the
feature commit. After every logic step, `pnpm test` must pass. Before the
review handoff, `pnpm lint` and `pnpm build` must also pass.

## Build steps

- [x] **1. Schema and onboarding rules.**
  - Add `ServiceStatus` (`NEW`, `WAITING_FOR_INFORMATION`, `IN_PROGRESS`,
    `COMPLETED`, `CANCELLED`) and `Service` to `prisma/schema.prisma` (see
    Data / contracts).
  - Create the migration with `pnpm db:migrate --name add_services`.
  - Add the pure module `lib/onboarding.ts`. It has no `db` or `next/*` imports,
    matching `lib/delivery.ts`, and holds:
    - the field list and limits;
    - `parseOnboardingForm(formData)`;
    - `readRequirements(json)`, which validates the stored JSON when it is read;
    - `canEditOnboarding(status)`;
    - `onboardingState(status | null)`, which returns `"needed"`, `"received"`,
      or `"locked"`.
  - Add tests in `lib/onboarding.test.ts`.
  - **Done when:** `pnpm exec prisma migrate status` reports in sync, and
    `pnpm test` passes with cases for: trimming; an empty optional field becoming
    `null`; a missing business name; each over-length field; a non-string or
    missing form entry giving `invalidInput`; malformed stored JSON being
    rejected; and each status mapping to its state and editability.

- [x] **2. Access, persistence, and the Server Action.**
  - Add `lib/services.ts` (server only):
    - `findOnboardingItem(itemId, access)` returns the item's name, `nameAr`,
      order number, and any existing `Service`, or `null`. It matches only when
      every condition below holds:
      - the item exists and its product type is `SERVICE`;
      - its order status is in `PAID_ORDER_STATUSES`;
      - and either `order.userId` equals the signed-in user's id, or
        `order.stripeCheckoutSessionId` equals a session id that passed
        `isCheckoutSessionId`.
    - `saveOnboarding(itemId, requirements)` creates the record, or updates it
      only where the status is editable (see Data / contracts), and returns
      `"saved"` or `"locked"`.
    - `listOrderServices(sessionId)` lists the service items of a paid order for
      the success page.
  - Add `actions/onboarding.ts` with
    `submitOnboarding(previous, formData) → OnboardingActionResult`.
  - Add tests in `actions/onboarding.test.ts` and `lib/services.test.ts`, mocking
    `db` and `getCurrentUser`.
  - **Done when:** `pnpm test` passes with cases for each of these:
    - the owner saves;
    - a guest with the matching session id saves;
    - a signed-in user with another user's item and no session id gets
      `not_found`;
    - a wrong or malformed session id gets `not_found`;
    - an unpaid or refunded order gets `not_found`;
    - a digital-product item gets `not_found`;
    - no session id and no user gets `signed_out`;
    - a locked record gets `locked`;
    - a create race (`P2002`) falls back to the guarded update;
    - invalid fields return `fieldErrors` and the values that were typed;
    - a thrown database error gets `unexpected`, and the log does not include
      the form values.

- [x] **3. Onboarding page and form.**
  - Add `app/[lang]/onboarding/[itemId]/page.tsx` (server component, `noindex`)
    and the client component `components/onboarding/OnboardingForm.tsx`.
  - Add an `onboarding` section to `lib/i18n/dictionaries/en.ts` and `ar.ts`.
  - Page behavior:
    - Signed out with no `session_id`: redirect to `/<lang>/login?next=…`, the
      same pattern as the account pages.
    - No match: `notFound()`.
    - Editable: show the form, prefilled with any saved answers.
    - Locked: show the saved answers read-only, with a line saying work has
      started.
  - Show the service name and the order number above the form.
  - **Done when:**
    - `pnpm build` and `pnpm lint` pass;
    - in the running app, in both `/en` and `/ar` (right-to-left), the page
      shows the form for a paid service item;
    - invalid submits show per-field errors and focus moves to the first one;
    - a valid submit shows the saved confirmation and keeps the values;
    - an unknown item shows the 404 page.

- [x] **4. Entry points.**
  - On the success page, below the downloads, add a "Your services" section that
    uses `listOrderServices`. Each row links to
    `/<lang>/onboarding/<itemId>?session_id=<id>` and shows its onboarding state.
  - Extend `listAccountServices` in `lib/account.ts` with the item's `Service`
    status. On `app/[lang]/account/services/page.tsx`, show the onboarding state
    and a link to `/<lang>/onboarding/<itemId>`: "Add your details" when needed,
    "Update your details" when received, and no link when locked. Keep the
    order status chip.
  - Update `lib/account.test.ts`.
  - Replace the comment in the account services page that says onboarding
    arrives later.
  - **Done when:** `pnpm test`, `pnpm lint`, and `pnpm build` pass. In the
    running app:
    - a paid order containing a service shows the onboarding link on the success
      page;
    - after a submit, both the success page and Account → Services show "Details
      received";
    - an order with only digital products shows no services section.

## Files / areas

- `prisma/schema.prisma`, `prisma/migrations/<timestamp>_add_services/`
- `lib/onboarding.ts`, `lib/onboarding.test.ts` (new, pure)
- `lib/services.ts`, `lib/services.test.ts` (new, database)
- `actions/onboarding.ts`, `actions/onboarding.test.ts` (new)
- `components/onboarding/OnboardingForm.tsx` (new, client)
- `app/[lang]/onboarding/[itemId]/page.tsx` (new)
- `app/[lang]/success/page.tsx`
- `app/[lang]/account/services/page.tsx`, `lib/account.ts`, `lib/account.test.ts`
- `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/ar.ts`
- Reused without changes:
  - `PAID_ORDER_STATUSES` (`lib/delivery.ts`)
  - `isCheckoutSessionId` (`lib/checkout.ts`)
  - `getCurrentUser` (`lib/session.ts`)
  - `localizedName` (`lib/catalog.ts`)
  - `localizedPath` (`lib/i18n/config.ts`)
  - `formatOrderNumber` (`lib/orders.ts`)
  - the input classes in `components/auth/AuthForm.tsx`
  - the account parts in `components/account/AccountParts.tsx`

## Data / contracts

**Schema.**

```prisma
enum ServiceStatus {
  NEW
  WAITING_FOR_INFORMATION
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

// A purchased service being delivered. The catalog entry is a Product with
// type SERVICE; this is the work record for one paid order item.
model Service {
  id            String        @id @default(cuid())
  orderItemId   String        @unique
  orderItem     OrderItem     @relation(fields: [orderItemId], references: [id], onDelete: Cascade)
  status        ServiceStatus @default(NEW)
  // Onboarding answers, shape in lib/onboarding.ts.
  requirements  Json
  adminNotes    String?       @db.Text
  startDate     DateTime?
  completedDate DateTime?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}
```

Add `service Service?` to `OrderItem`.

The overview lists `orderId`. This uses `orderItemId` instead, because one order
can contain several services. The order is still reachable through `orderItem`.
`/complete` should update the overview's data model to match.

**`requirements` JSON.** Every key is always present.

```ts
interface OnboardingRequirements {
  businessName: string;          // required, 1-200 chars after trim
  website: string | null;        // ≤ 500
  adAccount: string | null;      // ≤ 500
  campaignGoals: string | null;  // ≤ 2000
  budget: string | null;         // ≤ 100, free text (e.g. "$1,000 / month")
  notes: string | null;          // ≤ 2000
}
```

Parsing rules:

- Fields are trimmed, and an empty optional field is stored as `null`.
- Limits count JavaScript string length after the trim.
- Line breaks are kept in the textarea fields.
- If a form entry is missing or is not a string, the result is `invalidInput`.
  Only the form sends these fields, so this is unexpected.
- `readRequirements` returns `null` for stored JSON that does not match the shape.
  On the page this is treated as an unexpected error, not as empty answers.

**Form fields.** Each `name` matches its key above. The form also sends two
hidden fields:

- `itemId`, a string of at most 64 characters;
- `sessionId`, which is optional and goes through `isCheckoutSessionId` when
  present.

**Statuses.**

- Editable: `NEW` and `WAITING_FOR_INFORMATION`.
- `onboardingState`:
  - no record or `WAITING_FOR_INFORMATION` → `needed`
  - `NEW` → `received`
  - `IN_PROGRESS`, `COMPLETED`, or `CANCELLED` → `locked`

**Action result.**

```ts
type OnboardingActionError =
  "invalid_input" | "invalid_fields" | "not_found" | "locked" | "signed_out" | "unexpected";
type OnboardingActionResult =
  | { success: true }
  | { success: false; error: OnboardingActionError;
      fieldErrors?: Partial<Record<OnboardingField, OnboardingFieldError>>;
      values?: Partial<Record<OnboardingField, string>> }
  | null;
```

Field error codes are `business_name_required` and `too_long`. The message for
`too_long` includes that field's limit.

**Access, the trust boundary.** The user id always comes from
`getCurrentUser()`, never from the form. The session id is a bearer credential,
exactly as for downloads. The action re-runs `findOnboardingItem` on every
submit. An item that doesn't match, belongs to someone else, or is not paid
always returns the same `not_found`, so nothing reveals whether it exists. When
there is no `sessionId` and no signed-in user, the result is `signed_out`, and
the form shows a sign-in link like the settings forms.

**Save atomicity.** `saveOnboarding` runs in this order:

1. `db.service.create({ orderItemId, status: NEW, requirements })`.
2. On `P2002`, meaning the record already exists or a concurrent create won,
   run `db.service.updateMany({ where: { orderItemId, status: { in: EDITABLE } },
   data: { requirements } })`.
3. A count of 0 gives `locked`.

A locked record is never overwritten, even when an admin change races the save.

**Rendering and sensitive data.**

- Saved answers are rendered only as React text, with `dir="auto"` and
  `whitespace-pre-line`. The website is never rendered as a link.
- Under the ad account field, a hint says to enter the account ID or page name
  and never a password. It is linked with `aria-describedby`.
- `console.error` logs only the error, never the form values.
- `revalidatePath` is called for the onboarding page and `/[lang]/account`
  after a save.

## Testing

`pnpm test` (Vitest) is the logic gate. Steps 1, 2, and 4 must ship passing
tests in the same diff, using the cases listed in each step's Done when. Mock
`@/lib/db` and `@/lib/session` with `vi.mock()`, following the pattern of the
existing `actions/account.test.ts`. Steps 3 and 4 are verified on the UI side
with `pnpm build`, `pnpm lint`, and the running dev server in both languages.
No Browser tests command is declared, so there is no Playwright suite. Running
these checks needs a seeded database and a paid order that contains the `ads-management`
service. Create the order through a real test-mode checkout and webhook (`stripe
listen`), or by inserting a `PAID` order directly in development. Name which of
the two was used in the review packet.

**Evidence (2026-10-06).** Automated:

- `pnpm test`: 29 files, 416 tests passed.
- `pnpm lint`: clean.
- `pnpm build`: passed.
- `prisma migrate status`: up to date.

Live, using Playwright against `pnpm dev`:

- **Test order.** A real Stripe sandbox checkout of Ads Management (test card
  4242), placed while signed in, created order #1008 through the webhook.
- **Success page.** It shows "Your services" with "Details needed" and the
  onboarding link carrying `session_id`. After a save it shows "Details
  received".
- **Invalid submit.** An empty business name, plus a 101-character budget set
  past the browser's `maxLength`, produced:
  - the alert and both field errors;
  - `aria-invalid` and `aria-describedby` on the fields, with the budget keeping
    its hint;
  - focus on the business name;
  - the typed values kept.
- **Valid submits.** Each of these produced the confirmation, the values kept,
  and the button switching to "Save changes":
  - a guest with `session_id`;
  - the owner with no `session_id`, reached from Account → Services ("Details
    received" with the update link);
  - an update on `/ar`, which rendered right-to-left in Tajawal with Arabic text.
- **Access.** Signed out:
  - no `session_id` redirects to `/en/login?next=…`;
  - a wrong `session_id` returns 404;
  - the matching `session_id` opens the form.

  An unknown item returns 404 with the localized not-found page.
- **Locked.** With the status set to `IN_PROGRESS` by a development script:
  - a submit from an already open form returned the locked alert, with focus
    moved to it;
  - after a reload, the page shows the read-only answers: no form, line breaks
    kept, and the website not shown as a link.

  The record was reset to `NEW` afterwards.

Not exercised live:

- A success page for an order with only digital products. That section renders
  only when `listOrderServices` returns rows, and the query is unit-tested.
- The Account → Services row for a locked record.
- HTML-like input in the read-only view. The test value was overwritten before
  the record was locked, so this rests on React text rendering.

Stored textarea line breaks arrive as `\r\n` from the browser, so each one counts
as 2 characters toward a limit.

## Notes for the AI

- Read the relevant pages in `node_modules/next/dist/docs/` before writing the
  page and the Server Action, covering dynamic params, `PageProps`,
  `searchParams`, `notFound`, `redirect`, and `revalidatePath`. Follow the
  existing patterns in `app/[lang]/success/page.tsx` and
  `app/[lang]/account/settings/page.tsx`.
- Model the form's messages, focus handling, `aria-invalid` and
  `aria-describedby` wiring, and keep-values-on-failure on
  `components/account/SettingsForms.tsx`. Only extract a shared helper if
  copying would be substantial; otherwise keep the form self-contained.
- Use `<label htmlFor>` on every field and mark the required field visibly and
  with `required`. Use `noValidate` so the server's messages are the only ones.
  A new submit clears the previous result.
- Do not select `digitalFile` in any new query.
- The `[...rest]` catch-all under `app/[lang]` must not swallow the new route.
  Confirm that `/en/onboarding/<id>` resolves to the new page.
- Do not change the webhook, checkout, or the `Order` and `OrderItem` columns.
- Arabic text: translate every new string into natural Arabic, following the
  tone of the existing `ar.ts`. Status words stay in each language's
  dictionary.
- Checks run on `main` while writing this spec:
- No `Verify` command is declared, so none was run.
- Archive path `blueprint/history/features/10-service-purchase-onboarding.md`:
  absent, and it does not appear in Git history.
- Branch `feature/service-purchase-onboarding`: no local branch with that name
  exists. Only `main` exists.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":17625,"specSha256":"cb6b1cd2bbb1a117b96636f01aa079316120579b9b0922ba1e42a8dce1a54a16","branch":"refs/heads/feature/service-purchase-onboarding","head":"d2942e9924d55b6b7ba769806d1eede9a56459f7","baseRef":"refs/heads/main","baseCommit":"c6299e9a88ef385f6f6fcb73929b5e9ef8cbd6e8","sourceTree":"d77f46ba59e2d8b8e96b494f1563d8f8f4acc339","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** d2942e9924d55b6b7ba769806d1eede9a56459f7
**Base commit:** c6299e9a88ef385f6f6fcb73929b5e9ef8cbd6e8
**Base ref:** main
**Spec hash:** cb6b1cd2bbb1a117b96636f01aa079316120579b9b0922ba1e42a8dce1a54a16
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-06T16:29:00Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-06T16:36:39Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (all preconditions matched; only `blueprint/context/review.md` modified; the spec is tracked, so no snapshot applies)
- `pnpm test`: pass (29 files, 416 tests)
- `pnpm lint`: pass (no output)
- `pnpm build`: pass (`/[lang]/onboarding/[itemId]` built as a dynamic route; the only warning is the pre-existing pg SSL-mode notice)
- `pnpm exec prisma migrate status`: pass (7 migrations, database schema up to date; read-only)

### Evidence

- Reviewed the full `c6299e9..d2942e9` delta (19 files): schema and migration, `lib/onboarding.ts`, `lib/services.ts`, `actions/onboarding.ts`, the onboarding page, `OnboardingForm`, `OnboardingStatus`, the success and account-services pages, `lib/account.ts`, both dictionaries, the `INPUT_BASE` export in `AuthForm`, and all new or changed tests.
- Access: `findOnboardingItem` (`lib/services.ts:34`) requires a `SERVICE` product, a paid status, and either `userId` from `getCurrentUser()` or a session id that passes `isCheckoutSessionId`. It caps `itemId` at 64 characters and returns one indistinguishable `null` for every miss. The action re-runs it on every submit (`actions/onboarding.ts:53`), and nothing reads a user id from the form.
- Writes: `saveOnboarding` runs create, then on `P2002` a status-guarded `updateMany` (`lib/services.ts:79`), so a locked record is never overwritten under a race. The migration SQL matches the schema, with a unique `orderItemId` and a cascade FK. No `Order`/`OrderItem` columns, webhook, or checkout code changed.
- Logging and rendering: `console.error` logs only the error name and code (`actions/onboarding.ts:83`). The test asserts that no answers appear in the log. Saved answers render as React text with `dir="auto"` and `whitespace-pre-line`. The website is never a link, and no new query selects `digitalFile`.
- Form accessibility: every field has `<label htmlFor>`, the required marker is visible and has screen-reader text, `noValidate` is set, `aria-invalid`/`aria-describedby` link the hint and the error, focus moves to the first invalid field or the alert, and a pending submit clears the old result. EN and AR `onboarding` sections have the same keys, and the `Dictionary` type enforces parity at build.
- Tests cover every Done-when case listed for steps 1, 2, and 4, and the query-scope assertions check the owner, paid-status, and product-type filters directly.

### Findings

- F-16 [P3] open: textarea line breaks count once in the browser's maxLength but twice on the server (`lib/onboarding.ts:56`).
- No P0 or P1 findings. Existing ledger entries were left unchanged.

### Remaining risk

- Check was not required and was not run: no dev server, browser, or live Stripe flow was exercised in this pass. UI behavior rests on code reading, the build, and the builder's recorded evidence.
- F-16's browser-side line-break counting is inferred from the HTML standard and the spec's recorded CRLF observation. It was not reproduced in a browser here.
- The checkout session id is a bearer credential by design: anyone holding the success-page URL can read and edit that order's onboarding answers until the record is locked. This matches the spec and the existing download model.
- No browser test harness or `Verify` command is declared, and no dependency vulnerability scan was run.
