# Feature: Order Emails

**From build-plan:** feature 19a
**Build attempt:** 1
**Branch:** feature/order-emails
**Status:** verified

## Goal

When the verified Stripe webhook marks an order paid, send the customer one
bilingual order and payment confirmation (in the language they checked out in)
that links to their order page for downloads and service next steps, and send
the Abody team one English new-order email that flags service purchases. Email
goes through Resend's HTTPS API. A failed email never fails the webhook or
changes an order.

## In scope

- A small server-only Resend sender using `fetch` (no SDK), configured by
  `RESEND_API_KEY`, `EMAIL_FROM`, and optional `ADMIN_NOTIFICATION_EMAIL`.
- Email configuration modes:
  - neither `RESEND_API_KEY` nor `EMAIL_FROM` set: email is off (local
    development); each skipped email logs one line with the order number only;
  - both set: email is sent;
  - only one set: a configuration error, logged without values; no email is
    sent and the webhook still succeeds.
  - `ADMIN_NOTIFICATION_EMAIL` unset: the admin email is skipped (customer
    email unaffected).
- Trigger: exactly once per order, by the webhook delivery that moved it to
  `PAID`: a new order created as `PAID`, or a `PENDING` order the conditional
  update moved to `PAID`. Repeated, concurrent, late, `PENDING`, `CANCELLED`,
  and refund events send nothing.
- **Customer email** (plan: order confirmation, payment confirmation, digital
  product available, service purchase confirmation, combined in one message
  because an order is only confirmed once Stripe confirms payment):
  - sent to the order's `customerEmail` (from Stripe); skipped and logged by
    order number when there is none;
  - language from the Checkout session's `metadata.locale` (`en` or `ar`),
    English when missing or invalid; all text from the `en`/`ar` dictionaries;
    Arabic uses `dir="rtl"` and `lang="ar"`;
  - order number (`#1001`), each item's localized name (Arabic falls back to
    English as on the site), quantity, and line price, the total paid, and
    "payment received";
  - when the order has digital products: a "your files are ready" section;
    when it has services: a "next step: send us your business details" section;
  - one "View your order" link to `/<lang>/success?session_id=<id>`, the
    existing order page that lists downloads and service onboarding. No direct
    file links.
- **Admin email** (English; plan: new order and new service purchase in one
  message): order number, total, customer email, each item with its type
  (Digital product / Service) and quantity, a link to `/admin/orders/<id>`, and
  for each service item a link to `/admin/service-orders/<itemId>`. The subject
  says "includes a service" when the order has one.
- Both emails have an HTML body and a plain-text body.
- `.env.example` documents the three variables.

## Out of scope

- 19b: service status update emails and the admin "requirements submitted"
  email.
- Emails for pending, cancelled, failed, or refunded orders; password reset
  (waits on email, not part of 19); marketing email.
- A persisted outbox, retries, or a delivery log. Sending is best effort: a
  send that fails is logged and not retried.
- Storing the order language on `Order` (no schema change in this feature).
- Changing the order page, account pages, checkout, or who may download.

## Build loop

`workflow.stepReview` is `feature`: build all steps, running each step's checks,
then present one review packet. `workflow.checkpointCommits` is `disabled`: no
checkpoint commits; `/complete` creates the single feature commit on
`feature/order-emails`.

## Build steps

1. [x] **Resend sender.** Add server-only `lib/email.ts`: `emailConfig()`
   (off / config / throws `EmailConfigError` naming only missing variable
   names) and `sendEmail({ to, subject, html, text, idempotencyKey })`, a
   `fetch` POST to `https://api.resend.com/emails` with
   `Authorization: Bearer <key>`, JSON `{ from, to: [to], subject, html, text }`,
   and an `Idempotency-Key` header. A non-2xx answer throws an error carrying
   only the status code. Document the variables in `.env.example`.
   **Done when:** unit tests with `fetch` stubbed cover the three config modes,
   the exact request (URL, headers, body), and a non-2xx answer throwing an
   error that contains neither the key, the recipient, nor the body;
   `pnpm test` passes.

2. [x] **Email content.** Add `orderEmail` text to `lib/i18n/dictionaries/en.ts`
   and `ar.ts`, and a pure `lib/order-emails.ts` with
   `customerOrderEmail(order, locale, orderPageUrl)` and
   `adminOrderEmail(order, adminOrderUrl, serviceUrl)` returning
   `{ subject, html, text }`. Every interpolated value is HTML-escaped (product
   names are admin-entered). No db, `next/*`, or `fetch` imports, so Vitest
   loads it directly.
   **Done when:** tests show English and Arabic customer emails (subject, RTL
   attributes, localized names with English fallback, prices, total, order
   number, the order-page link), the downloads section only with digital items,
   the services section only with service items, the admin email's service
   flag and links, and that `<script>` and `&` in a product name are escaped in
   HTML; `pnpm test` passes.

3. [x] **Send on payment.** Make `syncCheckoutSession` in `lib/order-sync.ts`
   return the order id only when this call created the order as `PAID` or its
   conditional update moved it from `PENDING` to `PAID` (`count === 1`), else
   `null`. Add `sendOrderPaidEmails(orderId, session)` in a server-only module
   (`lib/order-notifications.ts`) that loads the order with its items and
   products, builds both emails, and sends them with idempotency keys
   `order-paid-customer/<orderId>` and `order-paid-admin/<orderId>`. It never
   throws: each failure (config, send, or lookup) is logged with the order
   number or id only. The webhook route calls it after a successful sync and
   still answers `{ received: true }`.
   **Done when:** `order-sync` tests show the id returned for create-as-paid and
   a won `PENDING`→`PAID` update, and `null` for pending, cancelled, repeated,
   lost-race, and non-payment events; notification tests (db and `lib/email`
   mocked) show both sends with the right recipients and keys, the customer
   language from `metadata.locale` with English fallback, skipped customer and
   admin emails when their address is missing, email-off mode sending nothing,
   and a failed send logged without addresses while the other email still goes;
   webhook tests show the sender called only for a paid id and a 200 even when
   it fails; `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Files / areas

- `lib/email.ts`, `lib/email.test.ts` (new)
- `lib/order-emails.ts`, `lib/order-emails.test.ts` (new)
- `lib/order-notifications.ts`, `lib/order-notifications.test.ts` (new)
- `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/ar.ts`
- `lib/order-sync.ts`, `lib/order-sync.test.ts`
- `app/api/stripe/webhook/route.ts`, `app/api/stripe/webhook/route.test.ts`
- `.env.example`
- Reused: `formatPriceCents` (`lib/money.ts`), `formatOrderNumber`
  (`lib/orders.ts`), `localizedName` (`lib/catalog.ts`), `absoluteUrl`
  (`lib/seo.ts`), `localizedPath` and `isLocale` (`lib/i18n/config.ts`)

## Data / contracts

- **Environment** (server only, never logged): `RESEND_API_KEY`, `EMAIL_FROM`
  (for example `Abody <orders@your-domain>`; the domain must be verified in
  Resend), `ADMIN_NOTIFICATION_EMAIL` (optional, one address).
- **Resend request:** `POST https://api.resend.com/emails`, headers
  `Authorization: Bearer <RESEND_API_KEY>`, `Content-Type: application/json`,
  `Idempotency-Key: <key>`; body `{ "from", "to": [address], "subject", "html",
  "text" }`. Any 2xx is success.
- **Links:** customer order page
  `absoluteUrl(localizedPath(locale, "/success")) + "?session_id=" +
  encodeURIComponent(sessionId)`; admin `absoluteUrl("/admin/orders/<orderId>")`
  and `absoluteUrl("/admin/service-orders/<orderItemId>")`. All use `SITE_URL`.
- **Money:** amounts are whole US cents formatted with `formatPriceCents`, the
  same in both languages, as on the site.
- **`syncCheckoutSession`** now returns `Promise<string | null>` (the order id
  moved to `PAID` by this call). Its order writes are unchanged.
- **Privacy:** logs carry only the order number or id and the HTTP status;
  never an email address, the API key, the session id, or email content.
  The customer email holds no data beyond the buyer's own order.

## Testing

- Vitest unit tests per step; `fetch`, the db, and `lib/email` are mocked, so no
  test sends real email.
- Not covered automatically: a real Resend send, inbox rendering (including
  Arabic RTL in mail clients), and spam placement. If a Resend key and verified
  domain are available during `/check`, send one test order in each language;
  otherwise say so.
- No browser test command exists; none is added.

## Notes for the AI

- Read the route handler guide in `node_modules/next/dist/docs/` before editing
  the webhook route.
- Keep the email modules server-only by convention (the repo uses comments, not
  the `server-only` package). `lib/order-emails.ts` stays pure.
- Read the dictionaries directly (`en`, `ar` exports) in the email builders;
  `getDictionary()` depends on the request's route params and does not work in
  the webhook.
- Use inline styles and a simple table layout in the HTML; the Tajawal font may
  not load in mail clients, so list a system fallback after it.
- Send the two emails independently (one failure must not stop the other), and
  only after the order write has committed.
- Confirm the Resend request shape against Resend's current API docs before
  finishing step 1; adjust only if the documented contract differs.
- After completion, the overview's "undecided providers" item should record
  Resend; suggest updating the plans and re-running `/overview`.

## Implementation notes

- `sendEmail(config, message)` takes the config from `emailConfig()` rather
  than reading the environment itself, and `adminNotificationEmail()` reads the
  admin inbox; both live in `lib/email.ts`.
- `lib/catalog.ts` and `lib/seo.ts` import the db, so the pure builders in
  `lib/order-emails.ts` take names already localized and links already
  absolute. `lib/order-notifications.ts` localizes names (Arabic with English
  fallback, via `localizedName`) and builds the links; its tests cover both.
- The webhook route also catches a rejected `sendOrderPaidEmails` and logs the
  event and order id, so an email problem can never turn into a 500.

## Verification

- `pnpm test`: 48 files, 812 tests passed.
- `pnpm lint`: clean.
- `pnpm build`: succeeded (includes TypeScript).
- Not run: a real Resend send or inbox rendering (no API key or verified domain
  in this environment).


<!-- blueprint:completion {"schemaVersion":1,"specBytes":10881,"specSha256":"3102cfeedb1697b3b8b49a6cb0da9e3ad6c577f9014c3b777471c6f83f24e709","branch":"refs/heads/feature/order-emails","head":"9c63fd605b22c11fe03aaa597cc81dc05ba00e7d","baseRef":"refs/heads/main","baseCommit":"c4763979b50a88616479d2d82e139d8996e56e36","sourceTree":"4a5bc27aac5fa24103920814f11bc947a4c59b9f","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 9c63fd605b22c11fe03aaa597cc81dc05ba00e7d
**Base commit:** c4763979b50a88616479d2d82e139d8996e56e36
**Base ref:** main
**Spec hash:** 3102cfeedb1697b3b8b49a6cb0da9e3ad6c577f9014c3b777471c6f83f24e709
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** runtime default (exact model not known until reviewer starts)
**Requested execution:** automatic
**Requested at:** 2026-10-10T16:39:20Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-10T16:48:06Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `c4763979b50a88616479d2d82e139d8996e56e36..9c63fd605b22c11fe03aaa597cc81dc05ba00e7d` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`: pass (equals Target commit)
- `git merge-base main HEAD`: pass (equals Base commit)
- `sha256sum blueprint/context/current-feature.md`: pass (equals Spec hash; spec is tracked, so no snapshot is needed)
- `git status --porcelain`: pass (only `blueprint/context/review.md` differs)
- `pnpm test`: pass (48 files, 812 tests)
- `pnpm lint`: pass (clean)
- `pnpm build`: pass (includes TypeScript)

## Evidence

- Exactly-once: `lib/order-sync.ts:96-117` returns the id only for a create as `PAID` or a `PENDING`->`PAID` `updateMany` with `count === 1`. A lost create (`P2002`) against a `PAID` order stops at `canTransition` (false for `PAID`->`PAID`). Repeated, `CANCELLED`, pending-created, and refund paths return `null` or never reach the sender.
- The webhook never fails because of email: `app/api/stripe/webhook/route.ts:67-72` runs after the sync `try`. The 500 path returns before any send. `sendOrderPaidEmails` catches everything internally, and the route adds `.catch`.
- HTML escaping: every interpolated value in `lib/order-emails.ts` (names, labels, the customer address, totals, the `href`s, the title) goes through `escapeHtml`. Subjects contain no product names. Tests cover `<script>` and `&`.
- Logs (`lib/order-notifications.ts`, `lib/email.ts`, route) carry only the order number or id, the HTTP status, or variable names. No address, key, session id, or content is logged. Resend errors keep only the status.
- Config modes: off logs one line per order (the spec says one per skipped email; harmless). Partial config throws `EmailConfigError` naming only the missing variable, which is caught and logged. An unset admin inbox skips only the admin email.
- Arabic: `<html lang="ar" dir="rtl">`, `<bdi>` names, LTR spans for numbers and prices, and amounts aligned to the end of the line. Text comes only from the `en`/`ar` dictionaries.
- The `session_id` link reuses the existing bearer order page (`app/[lang]/success/page.tsx`) and goes only to the Stripe `customerEmail`, as the spec says.

## Findings

- F-31 [P3] open: the webhook waits on two Resend calls that have no timeout (app/api/stripe/webhook/route.ts:69, lib/email.ts:48)
- F-32 [P3] open: no test for losing the create race to a delivery that created the order as PAID (lib/order-sync.test.ts:241)

## Remaining risk

- No real Resend send or mail-client rendering was checked, including Arabic RTL in inboxes (no key or verified domain; real email is out of bounds for this review).
- The emailed `session_id` link is a bearer link: anyone the email is forwarded to can open the order page and its downloads. This is the spec's chosen design and existing behavior.
- If `SITE_URL` is unset in production, the email links fall back to `http://localhost:3000` (existing `siteUrl()` behavior).
- Sending is best effort with no outbox. A send lost after the order write, for example when the process stops, is never retried, as the spec says.
- No browser or integration test command exists. The webhook, db, and email paths are proven only by mocked unit tests.
