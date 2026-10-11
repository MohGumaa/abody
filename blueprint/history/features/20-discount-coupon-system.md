# Feature: Discount & Coupon System

**From build-plan:** feature 20
**Build attempt:** 1
**Branch:** feature/discount-coupon-system
**Status:** verified

## Goal

Admins create, edit, activate, and deactivate simple percentage discount codes
that apply to all items, digital products only, or services only. Customers
enter a code on the cart page, see the discounted total before paying, and pay
the discounted amount through Stripe Checkout. The paid order records which code
was used and how much it saved, and the code's use count goes up once per paid
order.

Product decisions approved in the planning chat on 2026-10-10:

- Simple coupons are in v1: one code per order, percentage off only, no
  stacking, loyalty, affiliate, or per-customer codes.
- Eligibility by type: `ALL`, `DIGITAL_PRODUCTS`, or `SERVICES`.
- Optional last valid day and optional maximum total uses. No per-customer
  limit and no minimum order.
- The code is entered and checked on the cart page, not in Stripe's promo field.
- The order stores the coupon and discount amount; a use counts only when the
  verified webhook marks the order paid.

## In scope

- `Coupon` model and `Order.couponId` / `Order.discountCents`, with a migration.
- Pure coupon rules: code normalization and format, validity checks, and the
  per-line discount math, with unit tests.
- Admin `/admin/coupons` list, `/admin/coupons/new`, `/admin/coupons/[id]` edit,
  and activate/deactivate, plus a "Coupons" sidebar link.
- Cart page: apply a code, show the applied code and discount line, remove it,
  and explain when a saved code no longer applies (English and Arabic).
- Checkout sends discounted unit prices and the coupon reference to Stripe; the
  webhook records the discount and counts the use when paid.
- The completed checkout return clears the coupon cookie along with the cart.
- Admin order detail and the customer account orders page show the discount.

## Out of scope

- Fixed-amount discounts, per-product eligibility, per-customer limits,
  minimum order amounts, stacking, automatic (codeless) discounts.
- Deleting coupons (orders reference them) and changing a code after creation.
- Showing the discount in transactional emails (they keep the paid line prices
  and total, which already reflect it).
- Giving a use back when an order is refunded or cancelled.
- Rate limiting code guesses (feature 24 owns hardening).
- Analytics on coupon performance (feature 23).

## Build loop

`workflow.stepReview` is `feature` and `workflow.checkpointCommits` is
`disabled`: implement all steps, run `pnpm test`, `pnpm lint`, and `pnpm build`,
then present one review packet for the whole feature. No checkpoint commits;
`/complete` creates the feature commit.

## Build steps

- [x] 1. **Schema and coupon rules.** Add the `Coupon` model, the `CouponScope`
  enum, and the `Order` fields below; create the migration with
  `pnpm db:migrate --name add_coupons`. Add `lib/coupons.ts` (no `next/*` or db
  imports) with: `normalizeCouponCode`, `isCouponCode`, `couponAppliesTo(scope,
  productType)`, `evaluateCoupon(coupon | null, view: CartView, now: Date)`
  returning either `{ ok: true, couponId, code, percentOff, discountCents,
  totalCents, lines }` (each line with `discountedUnitCents`) or `{ ok: false,
  reason }`, and `couponExpired(expiresOn, now)`. Add `lib/coupons.test.ts`.
  **Done when** the migration applies, `pnpm exec prisma migrate status` is in
  sync, and tests cover format/normalization, each failure reason, rounding,
  mixed eligible and ineligible lines, quantity > 1, the last valid day boundary
  in UTC (fake timers), and the $0.50 floor.

- [x] 2. **Admin coupon management.** Add `lib/admin-coupons.ts` (list, get by
  id, and a hand-written `parseCouponForm` like `lib/admin-products.ts`),
  `actions/admin-coupons.ts` (`createCoupon`, `updateCoupon`,
  `setCouponActive`), `components/admin/CouponForm.tsx`, and the three pages
  under `app/admin/coupons/`. Add a `TagIcon` to `components/icons.tsx`, a
  `tag` entry in `SideNav`'s `ICONS`, and `{ href: "/admin/coupons", label:
  "Coupons", icon: "tag" }` after Customers in `app/admin/layout.tsx`. Every
  page and action calls `requireAdmin()` first; unknown ids are `not_found`.
  **Done when** an admin can create a code (it starts inactive), edit its
  percent, scope, last valid day, and max uses, activate and deactivate it from
  the edit page, and see it in the list; a non-admin gets the 404; tests cover
  `parseCouponForm` (every field error, blank optionals) and the actions
  (admin check, duplicate code, not found, success).

- [x] 3. **Apply and remove on the cart page.** Add `actions/coupon.ts`
  (`applyCoupon`, `removeCoupon`) and the `coupon` cookie; add a
  `components/cart/CouponForm.tsx` client component inside `CartSummary`, a
  discount row, and the discounted total. The cart page reads the cookie, loads
  the coupon by code, and calls `evaluateCoupon` on the same `CartView` it
  renders. Add the English and Arabic strings. **Done when** a valid code shows
  "Discount (CODE) −$X" and the lower total; an invalid code shows its message
  and sets no cookie; a saved code that stops applying (deactivated, expired,
  used up, cart no longer eligible) shows its reason with a Remove button and
  no discount; Remove clears it; tests cover both actions (bad input, each
  reason, cookie set or untouched, empty cart).

- [x] 4. **Checkout and webhook.** `startCheckout` re-evaluates the cookie's
  code: no cookie → unchanged behavior; invalid → returns `coupon_invalid` and
  creates no session; valid → `checkoutLineItems(view, discount)` sends each
  eligible line's `discountedUnitCents` and the session metadata gains
  `couponId` and `discountCents`. In `lib/order-sync.ts`, `createOrder` stores
  `couponId` and `discountCents` from metadata (parsed by a pure
  `orderDiscountFromMetadata` in `lib/orders.ts`), and the use count increments
  in the same transaction as the order becoming `PAID` (created paid, or the
  PENDING→PAID update that wins). The checkout return route deletes the coupon
  cookie when the session is complete. **Done when** tests cover discounted
  line items, metadata parsing (absent, valid, malformed), increment on created
  paid and on PENDING→PAID, no increment for PENDING, CANCELLED, a lost race, or
  a repeated event, and the `coupon_invalid` path.

- [x] 5. **Show the discount on orders.** `getAdminOrder` and
  `listAccountOrders` select `discountCents` and the coupon code. The admin
  order detail adds Subtotal and "Discount (CODE)" rows above Order total when
  `discountCents > 0`; the account orders page adds the same discount line in
  both languages. **Done when** a discounted order shows subtotal, discount, and
  total that add up, an undiscounted order looks unchanged, and `pnpm build`
  passes.

## Files / areas

- `prisma/schema.prisma`, `prisma/migrations/<timestamp>_add_coupons/`
- New: `lib/coupons.ts` (+ test), `lib/admin-coupons.ts` (+ test),
  `actions/admin-coupons.ts` (+ test), `actions/coupon.ts` (+ test),
  `components/admin/CouponForm.tsx`, `components/cart/CouponForm.tsx`,
  `app/admin/coupons/page.tsx`, `app/admin/coupons/new/page.tsx`,
  `app/admin/coupons/[id]/page.tsx`
- Changed: `components/icons.tsx`, `components/admin/SideNav.tsx`,
  `app/admin/layout.tsx`, `app/[lang]/cart/page.tsx`,
  `components/cart/CartSummary.tsx`, `components/cart/CheckoutButton.tsx`,
  `actions/checkout.ts`, `lib/checkout.ts` (+ test), `lib/orders.ts` (+ test),
  `lib/order-sync.ts` (+ test), `app/[lang]/checkout/return/route.ts`,
  `lib/admin-orders.ts`, `app/admin/orders/[id]/page.tsx`, `lib/account.ts`,
  `app/[lang]/account/orders/page.tsx`, `lib/i18n/dictionaries/en.ts`,
  `lib/i18n/dictionaries/ar.ts`

## Data / contracts

### Schema

```prisma
enum CouponScope {
  ALL
  DIGITAL_PRODUCTS
  SERVICES
}

model Coupon {
  id              String      @id @default(cuid())
  // Uppercase A-Z, 0-9, single hyphens; 3-32 chars. Fixed after creation.
  code            String      @unique
  // Whole percent, 1-99.
  percentOff      Int
  appliesTo       CouponScope
  active          Boolean     @default(false)
  // Last valid day, inclusive, in UTC. Null: never expires.
  expiresOn       DateTime?   @db.Date
  // Null: unlimited.
  maxRedemptions  Int?
  // Paid orders that used this code; refunds do not give a use back.
  redemptionCount Int         @default(0)
  orders          Order[]
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}

// On Order:
  couponId      String?
  coupon        Coupon?  @relation(fields: [couponId], references: [id], onDelete: Restrict)
  // Whole cents taken off the list prices; 0 without a coupon.
  discountCents Int      @default(0)
  @@index([couponId])
```

### Coupon rules (`lib/coupons.ts`)

- `normalizeCouponCode(raw)`: trim, uppercase. `isCouponCode` checks
  `/^[A-Z0-9]+(-[A-Z0-9]+)*$/` and length 3-32. Customer input over 64
  characters is rejected before any query.
- Evaluation order and reasons: missing or inactive coupon → `invalid`;
  `now` after the end of `expiresOn` (UTC) → `expired`; `maxRedemptions` set and
  `redemptionCount >= maxRedemptions` → `used_up`; no line matches the scope →
  `not_eligible`; discounted total below 50 cents (`PRICE_MIN_CENTS`) →
  `below_minimum`. An inactive code reads the same as an unknown one.
- Scope: `ALL` matches every line, `DIGITAL_PRODUCTS` matches
  `DIGITAL_PRODUCT`, `SERVICES` matches `SERVICE`.
- Math per eligible line: `unitDiscount = floor(priceCents * percentOff / 100)`,
  `discountedUnitCents = priceCents - unitDiscount`;
  `discountCents = Σ unitDiscount × quantity`; ineligible lines keep their price.
  Rounding down keeps every Stripe line amount a whole cent and the total equal
  to the sum of the lines Stripe charges.

### Admin form (`parseCouponForm`)

- Fields: `code` (create only), `percentOff` (integer 1-99), `appliesTo` (one
  of the three enum values), `expiresOn` (optional `YYYY-MM-DD`, a real date),
  `maxRedemptions` (optional integer 1-1,000,000).
- Field errors: `required`, `invalid_code`, `code_taken`, `invalid_percent`,
  `invalid_scope`, `invalid_date`, `invalid_max`. Values are returned for
  redisplay, like the product form.
- Action results follow `ProductActionResult`: `{ success: true }` or
  `{ success: false, error: "invalid_fields" | "not_found" | "unexpected",
  fieldErrors?, values? }`. A P2002 on create becomes `code_taken`.
- `setCouponActive` takes `id` and `active` (`"true"`/`"false"`) from the form
  and returns `not_found` for an unknown id. Edits apply to future cart views
  and checkouts only; past orders keep their stored `discountCents`.

### Cart cookie and actions (`actions/coupon.ts`)

- Cookie `coupon`: the normalized code only, `httpOnly`, `sameSite: "lax"`,
  same `secure`, `path`, and `maxAge` options as the cart cookie in
  `actions/cart.ts`. Untrusted: re-read and re-evaluated on every cart render
  and at checkout.
- `applyCoupon(prev, formData)` with `code` and `lang`:
  `{ success: true }` | `{ success: false, error: "invalid_input" | "empty_cart"
  | "invalid" | "expired" | "used_up" | "not_eligible" | "below_minimum" |
  "unexpected" }`. Sets the cookie only on success. Empty or malformed code is
  `invalid`.
- `removeCoupon()` deletes the cookie and returns `{ success: true }`.
- Both revalidate the cart page so the summary re-renders.

### Checkout and webhook

- `CheckoutActionError` gains `coupon_invalid`.
- `checkoutLineItems(view, discount?)`: eligible lines use
  `discountedUnitCents` as `unit_amount`; product metadata stays `productId`
  only, so `OrderItem.priceCents` remains "unit price paid".
- Session `metadata`: `{ locale, couponId, discountCents }` with
  `discountCents` as a decimal string; both coupon keys are absent without a
  coupon.
- `orderDiscountFromMetadata(metadata)`: both keys absent → `null`; `couponId`
  a non-empty string ≤ 64 chars and `discountCents` a positive integer string →
  `{ couponId, discountCents }`; anything else throws (the server wrote it and
  the signature was checked, so a bad value is a bug, and the webhook's existing
  error path makes Stripe retry).
- `createOrder` with `status === "PAID"` and a coupon runs
  `db.$transaction([order.create, coupon.update({ redemptionCount: { increment: 1 } })])`.
  The PENDING→PAID path runs the conditional `updateMany` and, when `count === 1`
  and the order has a coupon, the increment, in one interactive transaction.
  A P2002 on create still returns null with no increment.
- Known limit: uses are checked at apply and checkout but counted when paid, so
  checkouts open at the same time can take a code past `maxRedemptions` by the
  number in flight. Accepted for v1.

### Customer copy (en / ar)

Add to the `cart` dictionary: `couponLabel` "Discount code" / "رمز الخصم",
`couponApply` "Apply" / "تطبيق", `couponRemove` "Remove" / "إزالة",
`couponApplied(code, percent)`, `discount(code)` "Discount (CODE)" / "خصم (CODE)",
and messages for `invalid`, `expired`, `used_up`, `not_eligible`,
`below_minimum`, `empty_cart`, `unexpected`, plus `checkoutErrors.coupon_invalid`
("Your discount code no longer applies. Remove it to continue." with an Arabic
equivalent). Codes render as React text inside `dir="ltr"` spans.

## Testing

`pnpm test` is the gate for steps 1-4. New and extended test files:
`lib/coupons.test.ts`, `lib/admin-coupons.test.ts`,
`actions/admin-coupons.test.ts`, `actions/coupon.test.ts`,
`lib/checkout.test.ts`, `lib/orders.test.ts`, `lib/order-sync.test.ts`. Mock the
db, session, and Stripe with `vi.mock()` as the existing tests do; use
`vi.useFakeTimers()` for expiry. Step 5 and the pages ride on `pnpm build` and
`pnpm lint`. No browser test command exists, so the cart flow and a real Stripe
test-mode payment are for `/check`, not claimed here.

## Notes for the AI

- Read `node_modules/next/dist/docs/` for cookies in Server Actions and
  `revalidatePath` before step 3; follow the existing `actions/cart.ts` cookie
  code rather than inventing options.
- Follow `actions/admin-products.ts` and `components/admin/ProductForm.tsx` for
  action shape, `requireAdmin()` placement outside try blocks, field-error
  display (`aria-invalid`, `aria-describedby`), and form value redisplay.
- Coupon form a11y: visible label tied to the input, error in a `role="alert"`
  element referenced by `aria-describedby`, `aria-invalid` while an error shows,
  the error cleared on the next submit; the applied state is announced with
  `role="status"`; focus stays on the input after a failed apply and moves to
  the input after Remove.
- The admin area is English-only (`lib/admin.ts`). Money uses `formatPriceCents`;
  dates use `lib/dates.ts`. Show the last valid day as a date, not a timestamp.
- Prices and eligibility always come from current published products via
  `buildCartView`; never trust a discount amount from the client.
- After completion, the overview's "no data shapes yet for discount codes" TODO
  and the coupons conflict note should be refreshed from this feature.

Implementation notes (recorded during `/implement`):

- Extra files: `lib/cart-coupon.ts` (`checkCartCoupon`, the one code lookup the
  cart page, `applyCoupon`, and `startCheckout` share),
  `components/admin/CouponStatusChip.tsx`, and `actions/checkout.test.ts`.
  `COUPON_SCOPES` and `SCOPE_LABELS` live in `lib/coupons.ts` so the admin
  client form does not import the db module.
- `applyCoupon` takes only `code`; prices and eligibility do not depend on the
  language. Like the cart actions, the coupon actions rely on the cookie write
  to refresh the page instead of calling `revalidatePath`.
- `CartSummary` now passes only `checkout`, `redirecting`, and `errors` to the
  client `CheckoutButton`, because the cart dictionary holds a function
  (`coupon.appliedNote`) that cannot cross to a client component.
- `lib/account.test.ts` gained the new `discountCents` / `couponCode` fields.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":16078,"specSha256":"4eb784613857df25b5a71a408be688d3b348e10c3112edbd688a5ae9129e8747","branch":"refs/heads/feature/discount-coupon-system","head":"0f84d9165e24803e25807f59678a395206537d86","baseRef":"refs/heads/main","baseCommit":"5dbcef47743f4ebba6145e0e2b8cad22c3eec1c5","sourceTree":"e020f7be1c3ab725691bbe887debde788d056a76","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 0f84d9165e24803e25807f59678a395206537d86
**Base commit:** 5dbcef47743f4ebba6145e0e2b8cad22c3eec1c5
**Base ref:** main
**Spec hash:** 4eb784613857df25b5a71a408be688d3b348e10c3112edbd688a5ae9129e8747
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-10T18:40:23Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-11T03:13:18Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `5dbcef47743f4ebba6145e0e2b8cad22c3eec1c5..0f84d9165e24803e25807f59678a395206537d86` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `pnpm test`: pass (55 files, 915 tests)
- `pnpm lint`: pass
- `pnpm build`: pass (type-check included; new `/admin/coupons` routes built)
- `pnpm exec prisma migrate status`: pass (8 migrations, schema up to date)

## Evidence

- Freshness: `HEAD` = target, `git merge-base main HEAD` = base, spec SHA-256 matches, spec is tracked (no snapshot), only `blueprint/context/review.md` dirty before review; tree unchanged after the build.
- Reviewed all 39 files of `5dbcef4..0f84d91` (2725+/34-) against the verified feature 20 spec.
- Security: every admin page and action calls `requireAdmin()` first (outside `try`); edit-page metadata reads the code only for admins; coupon cookie is re-normalized, length-capped (64), and re-evaluated on every cart render and at checkout; prices and eligibility come from `buildCartView`; inactive and unknown codes both read `invalid`; discount metadata is server-written and strictly parsed.
- Data integrity: paid create with a coupon uses a batch `$transaction` with the increment; PENDING to PAID runs the guarded `updateMany` and the increment in one interactive transaction (`@prisma/adapter-pg` supports it); repeat, cancelled, pending, and lost `updateMany` race paths do not increment.
- Math: per-line floor rounding, ineligible lines unchanged, $0.50 floor, UTC last-valid-day boundary, all covered in `lib/coupons.test.ts`.
- Performance: one extra indexed `findUnique` per cart render and checkout; no new unbounded or N+1 work on customer paths.

## Findings

- F-34 [P2] open: discounted orders show already-discounted line prices plus a Subtotal/Discount breakdown that does not match the rows (admin detail and account orders).
- F-35 [P3] unverified: cart applied-code `role="status"` region is `display:none` while empty, and focus drops after a successful Apply.
- F-32 [P3] open (re-examined): lost create race with discount metadata still untested.
- F-21 [P3] open (re-checked): order detail double-load now also joins the coupon.
- No P0 or P1 finding is open or fixed.

## Remaining risk

- Check not required and not run: the cart apply/remove flow, a real Stripe test-mode discounted payment, the webhook increment against a live database, and the screen-reader behavior in F-35 are not exercised.
- No browser test command exists in the project.
- Concurrent checkouts can take a code past `maxRedemptions` (accepted v1 limit in the spec); code-guessing rate limits are deferred to feature 24.
