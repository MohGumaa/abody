# Feature: Service Emails

**From build-plan:** feature 19b
**Build attempt:** 1
**Branch:** feature/service-emails
**Status:** verified

## Goal

When an admin changes the status of a customer's service, email the customer a
short bilingual status update in the language they checked out in. When a
customer sends or updates their service requirements, email the Abody team one
English notice that links to the admin service order. Both reuse the Resend
sender from 19a, are best effort, and never fail or slow the admin save or the
customer's submit.

## In scope

- **Customer status email**, triggered by `saveServiceWork`
  (`actions/admin-service-work.ts`) only when the conditional write succeeded
  (`count === 1`) **and** the status actually changed (`current.status !==
  status`). A notes-only save, a same-status save, a `changed`/`not_found`/
  validation result, or an unexpected error sends nothing. Every real change
  sends, including to `NEW`, `WAITING_FOR_INFORMATION`, and `CANCELLED`.
  - Recipient: the order's `customerEmail` (from Stripe, as in 19a); skipped and
    logged by item id when there is none.
  - Language: the order's checkout language, read from the Stripe Checkout
    session's `metadata.locale` (see Data / contracts); English when the lookup
    fails or the value is missing or invalid.
  - Content: the service's localized name (Arabic falls back to English), the
    order number, the new status label (`account.serviceStatus[status]`), and
    the existing customer message for that status (`account.service.messages[status]`).
    `WAITING_FOR_INFORMATION` is the one status that asks the customer to act;
    its existing message already says so.
  - One link to the order page `/<lang>/success?session_id=<id>`, which already
    lists the order's services with their status and onboarding links for guests
    and signed-in customers alike.
  - Never includes admin notes or the customer's requirements.
- **Admin requirements email**, triggered by `submitOnboarding`
  (`actions/onboarding.ts`) after `saveOnboarding` succeeds:
  - "New service details" when this submit created the `Service` record;
    "Service details updated" when it changed an existing editable record.
  - Sent to `ADMIN_NOTIFICATION_EMAIL`; skipped and logged when unset.
  - English: service name, order number, the customer as the admin pages show
    it (`customerLabel` from `lib/admin.ts`: account name, else
    `customerEmail`, else "Guest"), and a link to
    `/admin/service-orders/<itemId>`.
  - Never includes the requirement answers (they can hold ad-account and
    business details); the admin reads them in the dashboard.
- Both emails have an HTML and a plain-text body; every interpolated value is
  HTML-escaped. Both run after the response with Next's `after()` so a slow
  Stripe or Resend call never delays the admin or the customer.
- Email off / partly configured modes behave as in 19a (`emailConfig()`).

## Out of scope

- Emails for admin notes edits, start/completion dates, or service work on
  unpaid, refunded, or cancelled orders (those records are already unreachable
  through `PAID_SERVICE_ITEM` / `findOnboardingItem`).
- Storing the order or customer language (no schema change).
- An outbox, retries, a delivery log, email preferences, or unsubscribe.
- The F-31 Resend timeout finding (separate `/fix`); `after()` keeps it off the
  request path for these two emails.
- Changing the admin service order page, the onboarding page, the account
  pages, or who may submit or change a service.

## Build loop

`workflow.stepReview` is `feature`: build all steps, running each step's checks,
then present one review packet. `workflow.checkpointCommits` is `disabled`: no
checkpoint commits; `/complete` creates the single feature commit on
`feature/service-emails`.

## Build steps

1. [x] **Email content.** Add a `serviceEmail` block to
   `lib/i18n/dictionaries/en.ts` and `ar.ts` (subject, heading, intro with
   `{name}` and `{number}`, "New status", view link label, footer). Add pure
   `lib/service-emails.ts` with
   `customerServiceStatusEmail(service, locale, orderPageUrl)` and
   `adminServiceRequirementsEmail(service, kind, adminUrl)` returning
   `BuiltEmail`, reusing `escapeHtml`, `BuiltEmail`, and the 19a layout
   conventions from `lib/order-emails.ts` (export a small shared helper from
   there only if it removes real duplication). Status text comes from the
   existing `account.serviceStatus` and `account.service.messages` entries.
   No db, `next/*`, or `fetch` imports.
   **Done when:** tests show the English and Arabic status emails (subject,
   `lang`/`dir`, localized name with English fallback, order number, status
   label and message for each of the five statuses, the order-page link), the
   admin email's two kinds (subject and body), no requirement or notes text in
   either, and `<script>` and `&` in a service name escaped; `pnpm test` passes.

2. [x] **Senders.** Add server-only `lib/service-notifications.ts` with
   `sendServiceStatusEmail(serviceId, changedAt)` and
   `sendServiceRequirementsEmail(itemId, kind)`. Each loads what it needs from
   the db (service, product name/nameAr, order number, `customerEmail`,
   `stripeCheckoutSessionId`), resolves the customer language by retrieving the
   Checkout session with `getStripe()` and reusing `sessionLocale` from
   `lib/order-notifications.ts` (English on any error), builds the email, and
   calls `sendEmail` with the idempotency keys below. Neither ever throws; each
   failure (config, lookup, Stripe, send) is logged with the item or service id
   only.
   **Done when:** tests (db, `lib/stripe`, and `lib/email` mocked) show the
   right recipient, key, and language (Arabic from metadata; English when
   missing, invalid, or the Stripe call throws), a skipped customer email with
   no `customerEmail`, a skipped admin email with no admin address, email-off
   sending nothing, and a failed send logged without addresses or content;
   `pnpm test` passes.

3. [x] **Triggers.** Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`.
   Make `saveOnboarding` in `lib/services.ts` return `"created" | "updated" |
   "locked"` (create path → `"created"`, update with `count > 0` →
   `"updated"`). In `submitOnboarding`, schedule
   `sendServiceRequirementsEmail(item.itemId, result)` with `after()` on success.
   In `saveServiceWork`, use one `now` for the write and, when `count === 1` and
   the status changed, schedule `sendServiceStatusEmail(id, now)` with
   `after()`. Both action results are unchanged.
   **Done when:** `lib/services.test.ts` shows the two save results;
   `actions/onboarding.test.ts` shows the sender scheduled with `created` and
   `updated` and not for locked, invalid, not-found, or signed-out submits;
   `actions/admin-service-work.test.ts` shows it scheduled for a real status
   change and not for a notes-only save, same status, a lost race (`changed`),
   `not_found`, invalid input, or an unexpected error; `pnpm test`,
   `pnpm lint`, and `pnpm build` pass.

## Files / areas

- `lib/service-emails.ts`, `lib/service-emails.test.ts` (new)
- `lib/service-notifications.ts`, `lib/service-notifications.test.ts` (new)
- `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/ar.ts`
- `lib/services.ts`, `lib/services.test.ts`
- `actions/onboarding.ts`, `actions/onboarding.test.ts`
- `actions/admin-service-work.ts`, `actions/admin-service-work.test.ts`
- Reused: `emailConfig`, `adminNotificationEmail`, `sendEmail` (`lib/email.ts`);
  `escapeHtml`, `BuiltEmail` (`lib/order-emails.ts`); `sessionLocale`
  (`lib/order-notifications.ts`); `getStripe` (`lib/stripe.ts`);
  `localizedName` (`lib/catalog.ts`); `formatOrderNumber` (`lib/orders.ts`);
  `absoluteUrl` (`lib/seo.ts`); `localizedPath` (`lib/i18n/config.ts`)

## Data / contracts

- **No schema or environment changes.** Uses `RESEND_API_KEY`, `EMAIL_FROM`,
  and `ADMIN_NOTIFICATION_EMAIL` from 19a.
- **Customer language:** `getStripe().checkout.sessions.retrieve(order.stripeCheckoutSessionId)`
  then `sessionLocale(session)`; one Stripe read per status email, after the
  response. Any Stripe error means English.
- **Idempotency keys:** `service-status/<serviceId>/<changedAt ISO>` (the same
  `now` stamped by the status write) and
  `service-requirements/<itemId>/<send time ISO>`. Unique per event; Resend
  drops a repeat of the same key.
- **Links:** customer `absoluteUrl(localizedPath(locale, "/success")) +
  "?session_id=" + encodeURIComponent(sessionId)` (the 19a order page, a bearer
  link to the buyer's own order); admin
  `absoluteUrl("/admin/service-orders/<itemId>")`.
- **`saveOnboarding`** now returns `Promise<"created" | "updated" | "locked">`;
  its writes are unchanged.
- **Privacy:** logs carry only item or service ids and HTTP status; never an
  address, the session id, the key, notes, requirements, or email content.

## Testing

- Vitest unit tests per step; db, Stripe, `lib/email`, and `after` mocked, so no
  test sends email or calls Stripe.
- Not covered automatically: a real Resend send, Stripe session lookup, and
  inbox rendering (including Arabic RTL). If a Resend key, verified domain, and
  Stripe test key are available during `/check`, change one service's status
  for an English and an Arabic order and submit one onboarding form; otherwise
  say so.
- No browser test command exists; none is added.

## Notes for the AI

- Read the `after` and Server Actions guides in `node_modules/next/dist/docs/`
  before step 3. Mock `after` in the action tests to capture the callback.
- `requireAdmin()` stays outside the `try` in `saveServiceWork`; schedule the
  email only on the success path, after the write.
- Keep the email builders pure and the senders server-only by convention (as
  in 19a). Read the `en`/`ar` dictionaries directly; `getDictionary()` does not
  work outside a request's route params.
- Inline styles, simple table layout, Tajawal with a system fallback, `<bdi>`
  for names and LTR spans for order numbers, as in 19a.
- The sender computes the admin email's customer line with `customerLabel`
  (selecting `user.name` and `customerEmail`) and passes the string to the pure
  builder; `lib/service-emails.ts` must not import `lib/admin.ts`.

## Implementation notes

- `lib/order-emails.ts` now exports its `DICTIONARIES`, `ltr`, `button`, and
  `page` helpers so the service emails share the 19a layout.
- Names go into the dictionary templates through replacer functions, so a `$&`
  in an admin-entered name stays literal (tested).
- The status sender checks the email config and the customer address before
  the Stripe lookup, so email-off mode and guest orders without an address make
  no Stripe call.
- A failed Stripe language lookup logs only the error's name and the service
  id, because Stripe's messages can repeat the session id.

## Verification

- `pnpm test`: 50 files, 852 tests passed.
- `pnpm lint`: clean.
- `pnpm build`: succeeded (includes TypeScript).
- Not run: a real Resend send, a real Stripe session lookup, or inbox rendering
  (no API keys or verified domain in this environment).

## Open questions

- **Customer email language (default chosen, confirm at review).** No order or
  customer language is stored. This spec reads the checkout language from the
  Stripe session (no schema change, works for existing orders, one Stripe read
  per status email). Alternatives: store `locale` on `Order` at checkout (schema
  change; existing orders fall back to English), or send every status email in
  both languages.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":11617,"specSha256":"5c7b2c7bc20e83db5fe4e6d93f411b1a3610da8735a19b0cf1197736d952a0bf","branch":"refs/heads/feature/service-emails","head":"71b401534fa6a5f79b868cc488dbc019613e362c","baseRef":"refs/heads/main","baseCommit":"b17447dd41c55ffda76d13b5c1628961233be90f","sourceTree":"73b6d059eb7fc9830ec894c583e143558c020b97","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 71b401534fa6a5f79b868cc488dbc019613e362c
**Base commit:** b17447dd41c55ffda76d13b5c1628961233be90f
**Base ref:** main
**Spec hash:** 5c7b2c7bc20e83db5fe4e6d93f411b1a3610da8735a19b0cf1197736d952a0bf
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** runtime default (exact model not known until reviewer starts)
**Requested execution:** automatic
**Requested at:** 2026-10-10T17:26:03Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-10T17:28:30Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `b17447dd41c55ffda76d13b5c1628961233be90f..71b401534fa6a5f79b868cc488dbc019613e362c` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain`: pass (target, base, and spec hash match; only `blueprint/context/review.md` modified)
- `pnpm test`: pass (50 files, 852 tests)
- `pnpm lint`: pass (no output)
- `pnpm build`: pass (compiled and type-checked; `/admin/service-orders/[itemId]` and `/[lang]/success` routes present)

## Evidence

- Reviewed all 14 changed paths in the delta: `actions/admin-service-work.ts`, `actions/onboarding.ts`, `lib/service-emails.ts`, `lib/service-notifications.ts`, `lib/services.ts`, `lib/order-emails.ts`, both dictionaries, the five test files, and the spec. Followed into `lib/email.ts`, `lib/order-notifications.ts` (`sessionLocale`), `lib/admin.ts` (`customerLabel`), and `lib/catalog.ts` (`localizedName`).
- Triggers: the status email is scheduled with `after()` only after `count === 1` and `current.status !== status`, inside the try after `requireAdmin()`. The requirements email is scheduled only when `saveOnboarding` returns `created` or `updated`. Action results are unchanged.
- Security: every interpolated value in both HTML bodies goes through `escapeHtml`, including the `<bdi>` name, order number, customer label, and button href. Names use replacer functions, so `$&` stays literal. Neither builder accepts notes or requirements. The customer link uses `encodeURIComponent` on the session id. Logs carry only service or item ids, the Stripe error name, and Resend HTTP status (`lib/email.ts` throws `Resend answered <status>`).
- Performance: each sender makes one indexed db read and at most one Stripe read, all after the response. The email-off and no-address paths make no Stripe call.
- Tests: the senders' tests mock db, Stripe, and `lib/email`; the action tests mock `after`. They cover both kinds, the five statuses, Arabic and English fallback (missing, invalid, Stripe throws), the skip paths, a partial config, and log redaction. No `.only`, `.skip`, or `todo` in the changed tests.

## Findings

- F-33 [P3] open: the status email re-reads the status at send time instead of using the status that was written.
- No P0 or P1 findings.

## Remaining risk

- `/check` was not required and was not run. No real Resend send, Stripe session lookup, or inbox rendering (including Arabic RTL) was exercised, as the spec says.
- No browser test command exists. `after()` scheduling is proven only through mocks, not in a running Next server.
- Each customer onboarding update sends one admin email with a unique key and no throttling. This follows the spec's per-submit design and is noted here only.
- The F-31 Resend fetch timeout is still open. It is out of scope for this spec and kept off the request path by `after()`.
