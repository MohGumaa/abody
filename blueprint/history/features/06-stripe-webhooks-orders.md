# Feature: Stripe Webhooks & Orders

**From build-plan:** feature 6
**Build attempt:** 1
**Branch:** feature/stripe-webhooks-orders
**Status:** verified

## Goal

Receive Stripe's signed webhook events and turn every completed Checkout Session
into an `Order` with its `OrderItem` lines, then move that order to `PAID` or
`CANCELLED` as Stripe confirms or fails the payment. The webhook is the only
thing that writes payment status. Checkout stays anonymous, so each order keeps
the buyer's email from Stripe until accounts arrive in feature 8.

## In scope

- `Order` and `OrderItem` tables, an `OrderStatus` enum, and one migration.
  Order numbers count up from 1001 and display as `#1001`.
- A `POST /api/stripe/webhook` route that verifies the Stripe signature with a new
  `STRIPE_WEBHOOK_SECRET` and handles three events:
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and
  `checkout.session.async_payment_failed`.
- Idempotent order creation and one-way status changes that are safe under
  repeated, concurrent, and out-of-order deliveries.
- The success page's paid state shows the order number once the webhook has
  created the order. Until then it keeps the existing "confirming your order"
  copy, which is now accurate. This resolves finding F-07.

## Out of scope

- `User`, accounts, linking orders to accounts, `stripeCustomerId` (feature 8).
  `userId` is a nullable column with no relation yet.
- The purchased-service `Service` record and onboarding (features 10 and 11),
  download access (feature 7), and emails (feature 19).
- Refunds and the `REFUNDED`, `PROCESSING`, and `COMPLETED` transitions
  (feature 15 and later; overview open question 14). Those values exist in the
  enum but nothing sets them here.
- Order pages for customers or admins (features 9 and 15). The success page is the
  only place an order appears.
- `checkout.session.expired`: an expired session never completed, so it has no
  order. Any other event type is acknowledged and ignored.
- Rate limiting the webhook, seed data for orders, and a stored `paymentStatus`
  string (the order `status` carries it).

## Build loop

`workflow.stepReview` is `feature`: build all steps, running each step's checks
as you go, then present one review packet at the end of the feature. Step
checkpoint commits are disabled. `/complete` creates the single feature commit.

## Build steps

- [x] 1. **Order schema and migration.** In `prisma/schema.prisma` add the
  `OrderStatus` enum, `Order`, `OrderItem`, and `orderItems OrderItem[]` on
  `Product`, exactly as in Data / contracts. Create the migration with
  `pnpm exec prisma migrate dev --create-only --name add_orders`, append
  `ALTER SEQUENCE "Order_number_seq" RESTART WITH 1001;` to the generated SQL
  (confirm the sequence name in that SQL first), then apply it with
  `pnpm db:migrate`.
  **Done when:** `pnpm exec prisma migrate status` reports the database in sync,
  `pnpm exec prisma generate` produces `Order`, `OrderItem`, and `OrderStatus`
  types, the migration SQL contains the sequence restart, and `pnpm build`
  passes.

- [x] 2. **Pure order logic.** `lib/orders.ts`, with no Stripe client, `db`, or
  `next/*` imports, so Vitest can load it:
  - `targetStatus(eventType, session)` returns the status an event asks for:
    `checkout.session.completed` with `payment_status` `paid` or
    `no_payment_required` → `PAID`, with `unpaid` → `PENDING`;
    `async_payment_succeeded` → `PAID`; `async_payment_failed` → `CANCELLED`;
    any other type, or a session whose `mode` is not `payment` → `null` (ignore).
  - `canTransition(from, to)` allows only `PENDING → PAID` and
    `PENDING → CANCELLED`. Same status or anything else → `false`, so a late
    `completed/unpaid` never downgrades a `PAID` order and later-feature
    statuses are never touched.
  - `orderItemsFromLineItems(lineItems)` maps Stripe line items to
    `{ productId, priceCents, quantity }` from
    `price.product.metadata.productId`, `price.unit_amount`, and `quantity`. It
    throws when any line lacks a `productId`, a unit amount, or a positive
    quantity, or when the list is empty.
  - `formatOrderNumber(number)` returns `#1001`. Use Western digits in both
    languages, as for prices.
  **Done when:** `lib/orders.test.ts` covers every `targetStatus` branch
  (including a non-payment mode and an unknown event), the full
  `canTransition` matrix for the two allowed moves plus representative
  rejections (`PAID → PENDING`, `CANCELLED → PAID`, same status), item mapping
  for a product and a service line, each throw case, and the number format.
  `pnpm test` passes.

- [x] 3. **Order sync.** `lib/order-sync.ts` (server only) exports
  `syncCheckoutSession(eventType, session)`:
  - `targetStatus` is `null` → return without any Stripe or database call.
  - Look up the order by `stripeCheckoutSessionId`. Missing → call
    `getStripe().checkout.sessions.listLineItems(session.id, { limit: 100,
    expand: ["data.price.product"] })` and fail if `has_more` is true (the
    cart caps at 50 lines). Map the lines with `orderItemsFromLineItems`, then
    create the order and its items in one nested `db.order.create` with the
    target status, `totalCents` = `amount_total`, `currency`,
    `customerEmail` = `customer_details.email`, and `stripePaymentIntentId`
    (the id when `payment_intent` is a string, otherwise its `.id`, or null).
  - The create fails with Prisma `P2002` on `stripeCheckoutSessionId` (a
    concurrent delivery won) → continue as if the order existed.
  - Order exists → when `canTransition(current, target)`, run
    `db.order.updateMany({ where: { id, status: "PENDING" }, data: { status,
    stripePaymentIntentId } })`, so two racing deliveries cannot both move it.
    Otherwise do nothing.
  - Any other error propagates, so the route returns 500 and Stripe retries.
  **Done when:** `lib/order-sync.test.ts`, with `@/lib/db` and `@/lib/stripe`
  mocked as `app/api/products/route.test.ts` does, shows: an ignored event makes
  no calls; a new paid session creates one order with mapped items, total,
  email, and payment intent; a repeat delivery for an existing `PAID` order
  creates nothing and updates nothing; `PENDING` plus `async_payment_succeeded`
  updates with the `PENDING` guard; a `P2002` create falls through to the
  transition path; `has_more` and a line without `productId` reject.
  `pnpm test` passes.

- [x] 4. **Webhook route.** `app/api/stripe/webhook/route.ts` with `POST` only:
  - `STRIPE_WEBHOOK_SECRET` unset → log the cause and return 500.
  - No `stripe-signature` header → 400.
  - Read the raw body with `await request.text()` (never parse JSON first) and
    call `getStripe().webhooks.constructEvent(body, signature, secret)`. A
    verification error → 400 with a generic message. Log the error message
    only, never the body or headers.
  - Verified event → `syncCheckoutSession(event.type, event.data.object)` for
    the three handled types; anything else is skipped. Success → 200
    `{ received: true }`. A sync error → log the event id and type plus the
    error, then return 500.
  - Error bodies use `apiError` from `lib/api-error.ts`. Add an
    `invalid_signature` code for the 400s and use `internal_error` for the 500s.
    The path is already
    outside the language redirect (`proxy.ts` skips `api/`).
  - `.env.example`: add `STRIPE_WEBHOOK_SECRET="whsec_..."` with a comment
    (from `stripe listen` locally, from the dashboard endpoint in production),
    and drop the "until order webhooks (feature 6) ship" note on the secret key.
  **Done when:** `app/api/stripe/webhook/route.test.ts`, with
  `@/lib/order-sync` mocked and real signatures made with
  `Stripe.webhooks.generateTestHeaderString` (no network), shows: missing
  secret → 500; missing header → 400; wrong signature or tampered body → 400 and
  no sync; a signed `checkout.session.completed` → 200 and sync called with the
  session; a signed unhandled type → 200 and no sync; a sync failure → 500.
  `pnpm test`, `pnpm lint`, and `pnpm build` pass.

- [x] 5. **Order number on the success page.** In
  `app/[lang]/success/page.tsx`, for the `paid` state only, read
  `db.order.findUnique({ where: { stripeCheckoutSessionId }, select: { number:
  true } })` (through a small helper in `lib/order-sync.ts` or a new
  read-only function, not an inline query in the page). When it exists, show
  "Order #1001" with `formatOrderNumber` under the total and change the body to
  a "your order is confirmed" line. When it does not exist yet, keep the
  current "confirming your order" body. Add both strings to `en.ts` and `ar.ts`.
  Show no email or other order fields. Mark F-07 resolved in
  `blueprint/context/findings.md` with a one-line resolution.
  **Done when:** `pnpm build` and `pnpm lint` pass. Live check (needs a Stripe
  test key, the webhook secret, and `stripe listen --forward-to
  localhost:3000/api/stripe/webhook`): paying with `4242 4242 4242 4242` creates
  one `PAID` order numbered from 1001 with one item per cart line at the cart
  prices, the email from Stripe, and the payment intent. The success page shows
  that number in `/en` and `/ar`. `stripe events resend <id>` for the same event
  creates no second order. If the Stripe CLI is unavailable, record that and
  rely on the step 3 and 4 tests.

## Files / areas

- New: `lib/orders.ts`, `lib/orders.test.ts`, `lib/order-sync.ts`,
  `lib/order-sync.test.ts`, `app/api/stripe/webhook/route.ts`,
  `app/api/stripe/webhook/route.test.ts`,
  `prisma/migrations/<timestamp>_add_orders/migration.sql`
- Changed: `prisma/schema.prisma`, `.env.example`, `lib/api-error.ts`,
  `app/[lang]/success/page.tsx`, `lib/i18n/dictionaries/en.ts`,
  `lib/i18n/dictionaries/ar.ts`, `blueprint/context/findings.md` (F-07)
- Reused: `getStripe` (`lib/stripe.ts`), `db` (`lib/db.ts`), `lib/api-error.ts`,
  the session contract from feature 5 (`lib/checkout.ts`)
- Unchanged: `proxy.ts`, `actions/checkout.ts`, the return route, the cart

## Data / contracts

**Schema** (field names follow the existing `priceCents` convention, so the
overview's `total` and `price` become `totalCents` and `priceCents`):

```prisma
enum OrderStatus {
  PENDING
  PAID
  PROCESSING
  COMPLETED
  CANCELLED
  REFUNDED
}

model Order {
  id                      String      @id @default(cuid())
  // Shown as #1001. The migration restarts the sequence at 1001.
  number                  Int         @unique @default(autoincrement())
  // Linked to User in feature 8; null for every order until then.
  userId                  String?
  // From Stripe's customer_details.email; how a guest order reaches an account.
  customerEmail           String?
  status                  OrderStatus @default(PENDING)
  // Whole cents of `currency`, from the session's amount_total.
  totalCents              Int
  currency                String
  stripeCheckoutSessionId String      @unique
  stripePaymentIntentId   String?
  items                   OrderItem[]
  createdAt               DateTime    @default(now())
  updatedAt               DateTime    @updatedAt
}

model OrderItem {
  id         String  @id @default(cuid())
  orderId    String
  order      Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId  String
  product    Product @relation(fields: [productId], references: [id], onDelete: Restrict)
  // Unit price paid, in cents, from the Stripe line item.
  priceCents Int
  quantity   Int

  @@index([orderId])
  @@index([productId])
}
```

- **Trust boundary.** Only a signature-verified event can create or change an
  order. The browser return and success page never write orders. The success
  page reads only `number` for its session id. No card details are stored.
  `customerEmail` is personal data: it is never logged or rendered here.
- **Source of each field:** the signed event's session gives `id`,
  `amount_total`, `currency`, `customer_details.email`, `payment_intent`,
  `payment_status`, and `mode`. Line items come from Stripe's `listLineItems`
  API, mapped through `metadata.productId` set by feature 5 (never by name).
- **Status rules:** create with `targetStatus`. Then allow only
  `PENDING → PAID` and `PENDING → CANCELLED`, applied with a `status: PENDING`
  guard. Repeated or late events are no-ops.
- **Idempotency:** `stripeCheckoutSessionId` is unique. One order per session,
  whatever the delivery count or order. Order and items are written in one
  nested create.
- **Webhook responses:** 200 `{ received: true }` for verified events, including
  ignored types. 400 for a missing or invalid signature. 500 for a missing
  secret or a processing failure, so Stripe retries. Error bodies use
  `lib/api-error.ts`.
- **Environment:** `STRIPE_WEBHOOK_SECRET` (server only, `whsec_...`).
- **Order number display:** `#` plus the integer with Western digits, in both
  languages.

## Testing

- Unit (Vitest, `pnpm test`): `lib/orders.test.ts` (status mapping, transitions,
  item mapping, number format), `lib/order-sync.test.ts` (create, repeat,
  transition guard, `P2002` race, rejects, all with `db` and Stripe mocked), and
  `app/api/stripe/webhook/route.test.ts` (signature handling with real
  test-header signatures, no network).
- Build and lint: `pnpm build`, `pnpm lint`. Migrations:
  `pnpm exec prisma migrate status`.
- Live (Stripe test mode, Stripe CLI forwarding, running app): the step 5 check.
  The `PENDING` and async paths cannot be triggered with a card checkout, so the
  unit tests cover them. Record what was actually run. No browser test command
  exists, so none is added.

## Notes for the AI

- Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
  before writing the route. Confirm that `request.text()` gives the unmodified
  body and that no body parsing or caching applies to a `POST` handler.
- Follow the installed `stripe` 23 types for `webhooks.constructEvent`,
  `generateTestHeaderString`, `Stripe.Checkout.Session`, and `listLineItems`.
  `price.product` is a `string | Product | DeletedProduct` union. Narrow it, and
  treat anything but an expanded `Product` with `metadata.productId` as missing.
- Import Prisma types and enums from `@/lib/generated/prisma/...`. Detect `P2002`
  through `Prisma.PrismaClientKnownRequestError` from the generated client.
- `customerEmail` and Stripe payloads stay out of logs. Log only event ids,
  types, and error messages.
- Do not create `User` or `Service` rows, call Stripe to refund, or add order
  pages.

## Open questions

None blocking. Decided for this spec: guest orders keep `customerEmail` with a
nullable `userId`, and order numbers are a sequence from 1001. Feature 8 still
has to decide how a guest's email-matched orders attach to a new account
(overview open question 7).

## Verification evidence

Recorded at the end of `/implement`.

- `pnpm test`: 16 files, 188 tests passed, including the new
  `lib/orders.test.ts` (13), `lib/order-sync.test.ts` (12), and
  `app/api/stripe/webhook/route.test.ts` (8, real test-header signatures, no
  network).
- `pnpm lint`: clean. `pnpm build`: passes; `/api/stripe/webhook` is dynamic.
- Migration `20261004182722_add_orders` applied to the development database
  with the `Order_number_seq` restart at 1001; `prisma migrate status` reports
  the schema up to date.
- Implementation notes: `isHandledEventType` was dropped in favour of a
  `switch` on `event.type` in the route, which narrows the session type. The
  order sync also rejects a session with no `currency` (alongside no
  `amount_total`) instead of defaulting it, and a transition that carries no
  payment intent keeps the stored one.
- Not live-verified: the step 5 end-to-end check. The Stripe CLI is not
  installed and `.env` has no `STRIPE_WEBHOOK_SECRET`, so no real webhook
  delivery, order row, order number on the success page, or resend
  idempotency was observed. Those paths are covered only by the unit tests.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":16065,"specSha256":"a46d21bd17263aa07661ed6171fc3d9774cdd8ec3f4a587fb1752e5278b3eec5","branch":"refs/heads/feature/stripe-webhooks-orders","head":"1785cd2880acc6b98c6e47b68e35ee0b47adcc82","baseRef":"refs/heads/main","baseCommit":"4ef402ca6d75ae412e77be6e8128d744e6fe4cb1","sourceTree":"95f3bc8520e82d8d0559ba1dd24b95fa7e509c60","absentOptional":[]} -->

## Findings

### 6/F-07 [P3] closed - Paid-state copy says the order is being confirmed, but no order exists until feature 6

**File:** lib/i18n/dictionaries/en.ts:216
**Found:** 2026-10-04 by /audit independent (scope: current; lens: quality)
**Why it matters:** The spec's success page contract asks the `paid` state for "a note that order details arrive with the next update of the store", and its Out of scope section says a paid session creates no order until feature 6 ships. The shipped body reads "Thank you for your purchase. We are confirming your order now." (Arabic at `lib/i18n/dictionaries/ar.ts:205` says the same). Nothing in this feature or the codebase confirms or creates an order, so the copy promises follow-up work that does not happen and drifts from the spec's wording. Impact is low: the spec requires Stripe test mode until feature 6, so no real customer sees it yet.
**Suggested fix:** Change the `paid` body in both dictionaries to the spec's intent, for example "Thank you for your purchase. Your order details will arrive with the next update of the store." and the Arabic equivalent, or update the spec if the current wording is the intended copy for when feature 6 ships. Requirement lost: None.
**Resolution:** Fixed 2026-10-04 by feature 6. The webhook now creates the order, so "We are confirming your order now." is accurate until it arrives; once the order exists the paid state shows "Your order is confirmed." and the order number (`app/[lang]/success/page.tsx`, `confirmedBody` in both dictionaries). Closed 2026-10-04 by /audit independent (target 1785cd2): re-examined `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/ar.ts`, and `app/[lang]/success/page.tsx`. The webhook now creates the order, the "confirming" body shows only while no order exists for the session, and `confirmedBody` plus the order number show once it does, with no email or other order fields. The original drift is gone and the repair introduced no new defect.

## Independent review

# Independent Review

**Status:** passed
**Target commit:** 1785cd2880acc6b98c6e47b68e35ee0b47adcc82
**Base commit:** 4ef402ca6d75ae412e77be6e8128d744e6fe4cb1
**Base ref:** main
**Spec hash:** a46d21bd17263aa07661ed6171fc3d9774cdd8ec3f4a587fb1752e5278b3eec5
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-04T22:39:36+04:00
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-04T22:43:44+04:00
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `4ef402ca6d75ae412e77be6e8128d744e6fe4cb1..1785cd2880acc6b98c6e47b68e35ee0b47adcc82` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`: pass (equals target)
- `git merge-base main HEAD`: pass (equals base)
- `sha256sum blueprint/context/current-feature.md`: pass (equals spec hash)
- `git status --porcelain=v1 --untracked-files=all`: pass (only `blueprint/context/review.md` differs)
- `pnpm test`: pass (188 tests)
- `pnpm lint`: pass
- `pnpm build`: pass (`/api/stripe/webhook` dynamic)

## Evidence

- Reviewed all 15 files in the delta: webhook route and tests, `lib/orders.ts`, `lib/order-sync.ts` and their tests, schema, migration, success page, dictionaries, `lib/api-error.ts`, `.env.example`, findings.
- Signature: raw `request.text()` body passed to `constructEvent` (installed stripe types, default 300 s tolerance); missing header 400; verification failure logs only the error message; route outside `proxy.ts` matcher (`api/` excluded); Next route docs show the same raw-body webhook pattern.
- Idempotency and status: unique `stripeCheckoutSessionId`, nested single create, P2002 fall-through re-reads the order, `updateMany` guarded by `status: PENDING`, `canTransition` allows only PENDING to PAID or CANCELLED; repeated, concurrent, and out-of-order sequences (async before completed, late completed/unpaid after PAID or CANCELLED) traced to no-ops or a single correct move.
- Migration: SERIAL with `Order_number_seq` restart at 1001, unique indexes, cascade and restrict foreign keys match the spec schema.
- Personal data: `customerEmail` is never logged or rendered; logs carry event id, type, and error message only; the success page reads only `number`.
- F-07 re-examined and closed; F-08 [P3] recorded.

## Findings

- F-08 [P3] open: missing `STRIPE_SECRET_KEY` returns 400 `invalid_signature` instead of 500
- F-07 [P3] closed

## Remaining risk

- Live Stripe delivery (step 5 end-to-end check, real webhook, order row, resend idempotency) was not run: no Stripe CLI or webhook secret, and network calls to Stripe were out of scope. Paths are covered only by unit tests with mocked `db` and Stripe.
- The P2002 race path is tested with a constructed Prisma error, not a real concurrent insert through `@prisma/adapter-pg`.
- A completed session whose lines lack `metadata.productId` or reference a missing product (for example a session from another integration on the same Stripe account) fails with 500 on every retry, as the spec requires; it would surface only as a persistently failing event in Stripe.
- `pnpm exec prisma migrate status` was not run (needs a database connection); migration SQL was reviewed statically.
