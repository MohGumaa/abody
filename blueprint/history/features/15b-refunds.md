# Feature: Refunds

**From build-plan:** feature 15b
**Build attempt:** 1
**Branch:** feature/refunds
**Status:** verified

## Goal

An admin can fully refund a paid order from `/admin/orders/[id]`. The app asks
Stripe to refund the order's payment intent through the Refunds API, then marks
the order Refunded. The verified Stripe webhook also handles `charge.refunded`,
so a full refund made in the Stripe dashboard marks the order Refunded too. A
Refunded order loses its downloads, because `canDownload` only allows Paid,
Processing, and Completed.

**Decisions in this spec:**

- Only a **full** refund marks an order Refunded: the charge's `refunded` flag
  is `true`. A partial refund made in the Stripe dashboard leaves the order's
  status and the customer's access unchanged. The admin can only issue full
  refunds. See Open questions.
- The admin action marks the order Refunded as soon as Stripe accepts the
  refund. It doesn't wait for the webhook, so the admin sees the result right
  away and a local setup without webhook forwarding still works. The webhook
  makes the same conditional write, so whichever runs second changes nothing.

## In scope

- **Refund panel** on `/admin/orders/[id]`, in the right column below
  Fulfilment. It appears only when the order is in Paid, Processing, or
  Completed **and** has a `stripePaymentIntentId`.
  - It starts with a "Refund order" button. Pressing it opens a confirm step
    that says: "Refund $X.XX USD to the customer through Stripe? The order
    becomes Refunded and download access ends. This cannot be undone." The step
    has "Confirm refund" (danger style) and "Cancel" buttons. It follows
    `DeleteProduct`'s confirm pattern in `components/admin/ProductActions.tsx`:
    focus moves into the confirm step and returns to the start button when it
    closes, and a failed result closes the step.
  - While the refund runs, the button reads "Refunding…" and is disabled. The
    result appears in a `role="status"` live region. On success the page
    refreshes through revalidation: the status chip and payment status show
    Refunded, and the existing Fulfilment note ("Status follows Stripe…")
    replaces the status control.
  - A paid order with no recorded payment intent shows: "No Stripe payment is
    recorded for this order, so it can't be refunded here. Refund it in the
    Stripe dashboard."
  - For Pending, Cancelled, and Refunded orders, the panel isn't shown.
- **`refundOrder` Server Action:** issues a Stripe refund for a paid order and
  marks it Refunded. Details under Data / contracts.
- **Webhook:** `charge.refunded` events go to a new `syncChargeRefund(charge)`.
  When `charge.refunded` is `true` and `charge.payment_intent` is set, it moves
  orders with that payment intent from Paid, Processing, or Completed to
  Refunded. Anything else is acknowledged with 200 and changes nothing: a
  partial refund, no payment intent, no matching order, or an order already
  Refunded, Pending, or Cancelled.
- After a refund, existing behavior already applies, and this feature only
  checks it: customer account order pages show "Refunded" in both languages,
  downloads return the not-allowed response, the order drops out of the
  customer's downloads and services lists (`PAID_ORDER_STATUSES` filters), and
  the admin list and dashboard show payment status "Refunded".

## Out of scope

- Partial refunds from the admin, refund amounts, and refund reasons.
- `refund.failed` and `refund.updated` events, and reversing a refund. A refund
  that Stripe later fails, which is rare for cards, leaves the order Refunded.
  The admin fixes it in Stripe.
- Changing `Service` work records on a refunded service order. Feature 16 owns
  service work.
- Refund emails to customers or admins (feature 19).
- Disputes and chargebacks (`charge.dispute.*`).
- A schema migration. No refund table and no new fields: Stripe is the source
  of truth for refund details.
- Links into the Stripe dashboard.

## Build loop

`workflow.stepReview` is `feature`: implement every step below in order. Run
`pnpm test` and `pnpm lint` after each logic step, then present one review packet
once all steps pass. `workflow.checkpointCommits` is `disabled`, so there are no
per-step commits. `/complete` creates the single feature commit.

## Build steps

- [x] **1. Refund sync from the webhook.** In `lib/order-sync.ts`, add
  `syncChargeRefund(charge: Stripe.Charge): Promise<number>`:
  - It returns 0 without a query when `charge.refunded !== true` or the charge
    has no payment intent. Read the id the way `paymentIntentId` does: the
    value is a string or an expanded object.
  - Otherwise it runs one `db.order.updateMany({ where: { stripePaymentIntentId,
    status: { in: [...FULFILMENT_STATUSES] } }, data: { status: "REFUNDED" } })`
    and returns the count. Import `FULFILMENT_STATUSES` from
    `lib/admin-orders.ts`, or move the constant to a shared module if that
    import pulls server-only admin code into places it shouldn't be. Record the
    choice. **Chosen:** `PAID_ORDER_STATUSES` from `lib/delivery.ts` (the same
    three statuses), because `lib/admin-orders.ts` imports `lib/admin.ts`, which
    pulls session and `next/navigation` code into the webhook.
  - In `app/api/stripe/webhook/route.ts`, add `case "charge.refunded": await
    syncChargeRefund(event.data.object); break;`. When the count is above 0,
    call `revalidatePath("/admin", "layout")` and
    `revalidatePath("/[lang]", "layout")`. Database errors keep the existing
    500 path, so Stripe retries. Logs carry only the event id and type, never
    the charge.
  - **Done when:** `lib/order-sync.test.ts` covers these cases:
    - a fully refunded charge with a string payment intent and with an
      expanded one, each writing the conditional `where` above;
    - a partial refund (`refunded: false`) and a charge without a payment
      intent, each making no query;
    - a 0 count returned when nothing matches.

    `app/api/stripe/webhook/route.test.ts` covers these cases:
    - a signed `charge.refunded` event calls `syncChargeRefund` with the
      charge;
    - an unsigned one doesn't;
    - a sync error returns 500;
    - checkout events still go to `syncCheckoutSession`.

    `pnpm test` is green.

- [x] **2. Refund Server Action.** In `actions/admin-orders.ts`, add
  `refundOrder(previous, formData)`:
  - `requireAdmin()` comes first, outside the try. `id` must pass
    `isProductId`, else `not_found`.
  - Load the order's `status` and `stripePaymentIntentId`. If there's no order,
    return `not_found`. If the status isn't Paid, Processing, or Completed,
    return `not_refundable`. If there's no payment intent, return
    `no_payment`.
  - Call `getStripe().refunds.create({ payment_intent }, { idempotencyKey:
    \`refund-order-${id}\` })` with no `amount`, which makes it a full refund.
    If the returned refund has status `failed` or `canceled`, return
    `stripe_error` and don't change the order.
  - A `StripeInvalidRequestError` with code `charge_already_refunded` counts as
    success, because the payment is already fully refunded in Stripe. Any other
    Stripe error returns `stripe_error`. Log only the error message and the
    order id.
  - On success, run one conditional write: `updateMany({ where: { id, status:
    { in: FULFILMENT_STATUSES } }, data: { status: "REFUNDED" } })`. If it
    changes 0 rows, the webhook already marked the order or Stripe moved it, so
    still return success. Then revalidate `/admin` and `/[lang]` as
    `setOrderStatus` does.
  - Result type:

    ```ts
    { success: true }
    | { success: false; error: "not_found" | "not_refundable" | "no_payment" | "stripe_error" | "unexpected" }
    | null
    ```

    Unexpected errors are logged without customer data.
  - **Done when:** `actions/admin-orders.test.ts` mocks `db`, `getStripe`,
    `requireAdmin`, and `next/cache`, and proves these cases:
    - a non-admin never reaches the database or Stripe;
    - a bad or unknown id returns `not_found` without calling Stripe;
    - Pending, Cancelled, and Refunded orders return `not_refundable`, and a
      missing payment intent returns `no_payment`, all without calling Stripe;
    - a paid order calls `refunds.create` with the payment intent, no amount,
      and the idempotency key, then makes the conditional write;
    - `charge_already_refunded` marks the order Refunded;
    - other Stripe errors, and a `failed` refund status, return `stripe_error`
      with no write;
    - a 0-row write still returns success;
    - a database error returns `unexpected`.

    The existing `setOrderStatus` cases still pass. `pnpm test` is green.

- [x] **3. Refund panel on the order detail page.** Add
  `components/admin/OrderRefund.tsx` (`"use client"`, `useActionState`), as
  described under In scope. It takes `orderId` and the preformatted amount
  label. Messages:
  - `stripe_error`: "Stripe could not refund this payment. Check the order in
    the Stripe dashboard."
  - `not_refundable`: "This order can no longer be refunded. Reload to see its
    status."
  - `not_found`: "This order no longer exists."
  - `no_payment`: the no-payment text from In scope.
  - `unexpected`: "Something went wrong. Try again."

  On `app/admin/orders/[id]/page.tsx`, add a "Refund" card below Fulfilment:
  - Paid, Processing, or Completed with a payment intent: render
    `OrderRefund`.
  - Paid, Processing, or Completed without a payment intent: render the note.
  - Any other status: render no card.

  The amount is `formatPriceCents(order.totalCents)` plus the uppercase
  currency.
  - **Done when:** `pnpm test`, `pnpm lint`, and `pnpm build` pass. In the
    running app, as admin with Stripe test keys and `stripe listen` forwarding
    `charge.refunded`:
    - refunding a paid test order shows Refunded on the admin detail, list, and
      dashboard, and on the customer's `/en/account/orders` and
      `/ar/account/orders`;
    - its download link is refused;
    - the Refund card is gone.

    A full refund made in the Stripe dashboard marks another paid order
    Refunded through the webhook. A partial dashboard refund leaves the order
    Paid. Pending and Cancelled orders show no Refund card. As a customer or
    signed out, the page still returns 404.

## Files / areas

- Changed:
  - `lib/order-sync.ts` and `lib/order-sync.test.ts`: `syncChargeRefund`.
  - `app/api/stripe/webhook/route.ts` and `route.test.ts`: the new case and
    revalidation.
  - `actions/admin-orders.ts` and `actions/admin-orders.test.ts`:
    `refundOrder`.
  - `app/admin/orders/[id]/page.tsx`: the Refund card.
- New: `components/admin/OrderRefund.tsx`.
- Reused without change:
  - `lib/stripe.ts` (`getStripe`)
  - `lib/admin.ts` (`requireAdmin`, `isProductId`)
  - `lib/admin-orders.ts` (`FULFILMENT_STATUSES`, `paymentStatusLabel`, which
    already maps Refunded)
  - `lib/delivery.ts` (`canDownload`, `PAID_ORDER_STATUSES`)
  - `lib/money.ts`
  - the danger and confirm styling in `components/admin/ProductActions.tsx`
- No schema migration. `Order.stripePaymentIntentId` isn't indexed. At the
  current store size the webhook's `updateMany` doesn't need an index. Add one
  only if order volume makes it slow.

## Data / contracts

- **Order writes:** `status` is set to `REFUNDED` only from `PAID`,
  `PROCESSING`, or `COMPLETED`, in one conditional `updateMany`, by both the
  action (`where id`) and the webhook (`where stripePaymentIntentId`). No other
  field is written. Refunded is final: `setOrderStatus` and `syncCheckoutSession`
  already never move an order out of it.
- **Stripe call:** `refunds.create({ payment_intent })` with no amount, so it's
  a full refund of the remaining balance. The idempotency key is
  `refund-order-<order id>`, so a double submit or retry inside Stripe's
  idempotency window creates no second refund. After that window, a second call
  on a fully refunded charge returns `charge_already_refunded`, which the
  action treats as success.
- **Webhook input:** a verified `charge.refunded` event only. A refund counts
  as full only when `charge.refunded === true`. The payment intent id comes from
  the charge, never from the request.
- **Trusted actor:** `requireAdmin()` runs in the page and in the action. The
  order id from the form is only a lookup key. Status and payment intent are
  re-read from the database, never taken from the client.
- **Redaction:** the charge, the refund object, and customer emails are never
  logged. Logs carry the order id, the event id and type, and the error message.
- **Action result:** the result type in step 2.
- **Deployment note:** the Stripe webhook endpoint must also subscribe to
  `charge.refunded`. Locally, `stripe listen` forwards all events by default.

## Testing

- Unit (Vitest): `lib/order-sync.test.ts` and `route.test.ts` (step 1), and
  `actions/admin-orders.test.ts` (step 2). These are the required logic gates.
  They mock Stripe and make no network calls.
- No browser harness is configured. The UI (step 3) is checked with
  `pnpm build`, `pnpm lint`, and a manual run through the app during `/check`,
  which needs Stripe test keys and `stripe listen`. This spec claims no browser
  or live Stripe evidence.
- `pnpm test`, `pnpm lint`, and `pnpm build` must all be green before review.
  No Verify command exists, so none was run while writing this spec.

## Notes for the AI

- Read `node_modules/next/dist/docs/` for `useActionState` and for
  `revalidatePath` in route handlers before writing code.
- Check Stripe v23 types in `node_modules/stripe/types/` for `Stripe.Charge`
  (`refunded`, `payment_intent`), `refunds.create`, `Refund.status`, and the
  idempotency key request option.
- `lib/order-sync.ts` says it is the only writer of payment status. Update that
  comment to mention the admin refund action.
- The admin area is English-only. Don't add dictionary strings.
- Several admin files use CRLF line endings. Edit them with Edit/Write, not
  shell heredocs.
- Don't touch `prototypes/`. Follow the existing admin tokens and card styling.

## Open questions

1. **Partial refunds made in the Stripe dashboard.** This spec leaves the order
   Paid and keeps downloads when a charge is only partly refunded. The
   alternative is to mark any refund as Refunded. Please confirm, or change it
   before implementing.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":14414,"specSha256":"c84759d86a4701242b3e5fa91e7320421a4c6a94ec382910a1d473cb22d60878","branch":"refs/heads/feature/refunds","head":"199ea0b6d46b97dbc07b0413420c3e5825f4a2bd","baseRef":"refs/heads/main","baseCommit":"1b6374c63594dc3dc5dc125819bb348deceb56b5","sourceTree":"e3a78151ebb70d54fbbf6e29ca90272a316fc0bd","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 199ea0b6d46b97dbc07b0413420c3e5825f4a2bd
**Base commit:** 1b6374c63594dc3dc5dc125819bb348deceb56b5
**Base ref:** main
**Spec hash:** c84759d86a4701242b3e5fa91e7320421a4c6a94ec382910a1d473cb22d60878
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-07T21:12:25Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-07T21:14:17Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `1b6374c63594dc3dc5dc125819bb348deceb56b5..199ea0b6d46b97dbc07b0413420c3e5825f4a2bd` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `pnpm test`: pass (38 files, 679 tests)
- `pnpm lint`: pass
- `pnpm build`: pass (compiled and type-checked; working tree unchanged afterwards)

## Evidence

- Preconditions verified: HEAD is 199ea0b6d46b97dbc07b0413420c3e5825f4a2bd, `git merge-base main HEAD` is 1b6374c63594dc3dc5dc125819bb348deceb56b5, the raw SHA-256 of `blueprint/context/current-feature.md` matches the Spec hash (the spec is tracked, so no snapshot is needed), and only `blueprint/context/review.md` differed from the target.
- Reviewed the full `1b6374c..199ea0b` delta: `lib/order-sync.ts`, `app/api/stripe/webhook/route.ts`, `actions/admin-orders.ts`, `components/admin/OrderRefund.tsx`, `app/admin/orders/[id]/page.tsx`, their three test files, and the spec and overview docs.
- Authorization: `requireAdmin()` runs before the try in `refundOrder` and in the page. The order id goes through `isProductId`. Status and payment intent are re-read from the database, and the client supplies only the id.
- Money and idempotency: `refunds.create` is called with only `payment_intent` (a full refund of the remaining balance) and the key `refund-order-<id>`. A `failed` or `canceled` refund and other Stripe errors cause no write. `charge_already_refunded` (`StripeInvalidRequestError`) counts as success. Both writers use the same conditional `updateMany` from Paid, Processing, or Completed, so the action and the webhook cannot race into a wrong state, and `syncCheckoutSession` only moves orders out of PENDING.
- Webhook: `charge.refunded` is handled only after signature verification. `syncChargeRefund` requires `refunded === true` and a payment intent id (string or expanded). Revalidation runs only when the count is above 0. Errors keep the existing 500 path. Logs carry only the event id, type, error message, and order id; the charge and refund objects are never logged.
- Client/server boundary: the `"use server"` module exports only async functions and types. `isAlreadyRefunded` is a non-exported helper. The client component imports the action and its type only, and the build passes.
- Tests: every step 1 and step 2 "Done when" case has a matching assertion in `lib/order-sync.test.ts`, `app/api/stripe/webhook/route.test.ts`, and `actions/admin-orders.test.ts`. There are no skipped or focused tests in the delta.

## Findings

- F-22 [P3] open: the success status text and focus target are inside the Refund card that revalidation removes.
- F-23 [P3] open: the confirm amount shows the order total, not the remaining balance after a partial dashboard refund.
- F-24 [P3] open: the `no_payment` action message drops a clause from the spec text.
- No P0 or P1 findings.

## Remaining risk

- Check was not required and was not run, so the step 3 UI (confirm flow, focus, live region, Refunded display on admin and customer pages, refused download) and the live Stripe and `stripe listen` path have no runtime evidence in this review.
- No browser harness and no Verify command are configured. `OrderRefund.tsx` has no automated test.
- Stripe does not guarantee event order. If a dashboard refund's `charge.refunded` is processed before the order's `checkout.session.completed` creates or pays the order, the refund sync matches nothing and the order later becomes Paid. This is unlikely in practice and was not tested.
- The deployed Stripe webhook endpoint must subscribe to `charge.refunded`. This is a remote configuration step that cannot be verified locally.
