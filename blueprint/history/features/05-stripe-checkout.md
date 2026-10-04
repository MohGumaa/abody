# Feature: Stripe Checkout

**From build-plan:** feature 5
**Build attempt:** 1
**Branch:** feature/stripe-checkout
**Status:** verified

## Goal

Let a customer pay for their cart through Stripe Checkout in English or Arabic,
and come back to clear success, processing, not-completed, and cancelled states.
The browser return only drives what the customer sees; it never marks anything as
paid. Orders and payment confirmation come from the webhook in feature 6.

## In scope

- The `stripe` server SDK and a `STRIPE_SECRET_KEY` environment variable.
- A Server Action that re-reads the cart cookie, prices every line from the
  current published products, creates a Stripe Checkout Session in USD, and
  redirects to Stripe's hosted page.
- Enabling the cart's "Continue to checkout" button with pending and error
  states, and removing the "Checkout is coming soon" note.
- A cancelled state on the cart page when the customer backs out of Stripe.
- A return route that clears the cart once Stripe reports the session complete,
  then a `/<lang>/success` page that shows the session's state from Stripe:
  paid, processing, or not completed.
- English and Arabic text for everything this feature adds, with every return URL
  carrying the language prefix.

## Out of scope

- Webhooks, the `Order`/`OrderItem` tables, granting downloads or services
  (features 6 and 7). Until feature 6 ships, a paid session creates no order;
  use Stripe test mode only.
- Accounts, linking a checkout to a user, or a stored `stripeCustomerId`
  (feature 8). Checkout is anonymous; Stripe collects the email.
- A separate `/<lang>/checkout` page. Checkout starts from the cart and goes
  straight to Stripe's hosted page.
- Coupons, tax, shipping, saved payment methods, refunds, receipts or emails,
  rate limiting.
- Stripe product or price objects managed by an admin. Lines use inline
  `price_data` from the database price.

## Build loop

`workflow.stepReview` is `feature`: build all steps, running each step's checks
as you go, then present one review packet at the end of the feature. Step
checkpoint commits are disabled. `/complete` creates the single feature commit.

## Build steps

- [x] 1. **Stripe client and checkout logic.** `pnpm add stripe` (the stack names
  Stripe Checkout; this is the only new dependency). Add `STRIPE_SECRET_KEY` to
  `.env.example` with a comment saying to use a test key (`sk_test_...`) locally.
  - `lib/stripe.ts`: `getStripe()` returns one lazily created `Stripe` client
    and throws a clear error when `STRIPE_SECRET_KEY` is missing. Import it only
    from server code (Server Actions, route handlers, Server Components).
  - `lib/checkout.ts` (pure, no `next/*` imports, unit-tested):
    - `checkoutLineItems(view: CartView)` maps each cart line to
      `{ quantity, price_data: { currency: "usd", unit_amount: priceCents,
      product_data: { name, metadata: { productId } } } }`. `name` is the
      localized product name. Prices come only from `buildCartView`, never from
      the cookie.
    - `checkoutReturnUrls(locale)` returns absolute `success_url`
      (`/<lang>/checkout/return?session_id={CHECKOUT_SESSION_ID}`, the
      placeholder left unencoded for Stripe) and `cancel_url`
      (`/<lang>/cart?checkout=cancelled`) using `absoluteUrl` from `lib/seo.ts`.
    - `isCheckoutSessionId(value)` accepts only `cs_test_` or `cs_live_` followed
      by letters, digits, or underscores, up to 255 characters.
    - `checkoutState(session)` maps a retrieved session to `"paid"`
      (`status: "complete"` and `payment_status` `paid` or
      `no_payment_required`), `"processing"` (`complete` and `unpaid`), or
      `"not_completed"` (`open` or `expired`).
    - `stripeCheckoutLocale(locale)` returns the Stripe Checkout locale for the
      page language: `en` → `"en"`. For `ar`, use `"ar"` only if the installed
      SDK's session-create `locale` type includes it; otherwise use `"auto"` and
      say so in a comment and the review packet.
  **Done when:** `lib/checkout.test.ts` covers line-item mapping (quantity,
  localized name, `productId` metadata, a service fixed at 1), both return URLs in
  both languages (including a `SITE_URL` with a base path), valid and rejected
  session ids (wrong prefix, symbols, empty, too long, non-string), and every
  `checkoutState` branch; `pnpm test` passes.

- [x] 2. **Start checkout from the cart.** Add `actions/checkout.ts`
  (`"use server"`) with `startCheckout(previous, formData)` following
  `actions/cart.ts`:
  - Validate a hidden `lang` field with `isLocale`; anything else is
    `invalid_input`.
  - Load the cart the same way the cart page does (`parseCart` →
    `listPublishedProductsByIds(ids, locale)` → `buildCartView`). No lines left →
    `empty_cart`.
  - Create the session with `mode: "payment"`, `line_items`, the return URLs,
    `locale`, and `metadata: { locale }`. Catch Stripe and configuration errors,
    log them with `console.error`, and return `unexpected`. Call `redirect(url)`
    after the `try` block so Next.js's redirect is not swallowed.
  - Result type: `{ success: false; error: "invalid_input" | "empty_cart" |
    "unexpected" } | null`. Success never returns; it redirects.
  - `CartSummary` becomes a client-safe form: a new client component
    `CheckoutButton` uses `useActionState(startCheckout)`, posts `lang`, and shows
    a pending label ("Redirecting to Stripe…") with the button disabled while
    pending. Errors show under the button with `role="alert"`; the button keeps
    `aria-describedby` pointing at the error when present. An `empty_cart` error
    tells the customer the items are no longer available. `invalid_input` shows
    the unexpected message (no user-typed input).
  - Cart page: read `searchParams.checkout`; when it is exactly `cancelled` and
    the cart has items, show a notice with `role="status"`: "Checkout cancelled.
    Your cart is saved." Any other value is ignored. An empty cart shows the
    normal empty state.
  - Dictionaries (`en.ts`, `ar.ts`): add the pending label, the cancelled notice,
    and the checkout errors; remove `checkoutComingSoon`.
  **Done when:** `pnpm build` and `pnpm lint` pass, and with a test key, clicking
  "Continue to checkout" on `/en/cart` and `/ar/cart` opens Stripe's hosted page
  with the right line names, quantities, and USD totals; cancelling on Stripe
  returns to the cart in the same language with the cancelled notice and the cart
  intact. With `STRIPE_SECRET_KEY` unset, the button shows the unexpected error
  and the server logs the cause.

- [x] 3. **Return route and success page.**
  - `app/[lang]/checkout/return/route.ts` (`GET`): read `session_id`; reject an
    invalid id with a redirect to `/<lang>/cart`. Retrieve the session. When its
    `status` is `complete`, delete the cart cookie (same name, path `/`). Then
    redirect (303) to `/<lang>/success?session_id=<id>`. A Stripe
    `resource_missing` error redirects to `/<lang>/cart`; any other error
    rethrows (500). An unsupported `[lang]` is a 404, as elsewhere.
  - `app/[lang]/success/page.tsx`: validate `session_id` (invalid or missing →
    `notFound()`), retrieve the session (`resource_missing` → `notFound()`, other
    errors reach `error.tsx`), and render `checkoutState`:
    - `paid`: heading "Payment received", the total from `amount_total`
      formatted with `formatPriceCents` (only for `currency === "usd"`; otherwise
      omit the amount), a note that order details arrive with the next update of
      the store, and links to keep shopping.
    - `processing`: "Your payment is processing" with a short explanation.
    - `not_completed`: "Payment not completed. Your cart is still saved." with a
      link back to the cart.
    Show no customer email, name, or other Stripe customer details. Metadata:
    title per state through the dictionary, `robots: { index: false }`, no
    canonical or alternates (the page is per-session).
  - Dictionaries: the success page text for all three states.
  **Done when:** `pnpm build` passes; with a test key, paying with Stripe's
  `4242 4242 4242 4242` card lands on `/en/success` (and `/ar/success` from an
  Arabic checkout) showing "Payment received" and the correct total, the header
  cart count is 0, and the page head has `noindex`; a declined test card keeps the
  customer on Stripe with the cart untouched; an expired or open session id shows
  the not-completed state; a made-up id returns 404.

## Files / areas

- New: `lib/stripe.ts`, `lib/checkout.ts`, `lib/checkout.test.ts`,
  `actions/checkout.ts`, `components/cart/CheckoutButton.tsx`,
  `app/[lang]/checkout/return/route.ts`, `app/[lang]/success/page.tsx`
- Changed: `package.json` and `pnpm-lock.yaml` (`stripe`), `.env.example`,
  `components/cart/CartSummary.tsx`, `app/[lang]/cart/page.tsx`,
  `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/ar.ts`
- Reused: `parseCart`, `buildCartView`, `CART_COOKIE` (`lib/cart.ts`),
  `listPublishedProductsByIds` (`lib/catalog.ts`), `isLocale`, `localizedPath`
  (`lib/i18n/config.ts`), `absoluteUrl` (`lib/seo.ts`), `formatPriceCents`
  (`lib/money.ts`), the cart action result pattern (`actions/cart.ts`)
- Unchanged: `proxy.ts` (all new customer routes are prefixed), `prisma/schema.prisma`

## Data / contracts

- **Trust boundary.** The cart cookie is untrusted. Product ids, availability,
  names, and prices come from the current `PUBLISHED` rows at the moment of
  checkout. The browser return never marks payment; the success page only shows
  the session state read from Stripe on the server. No secret, card, or Stripe
  customer detail is stored or rendered.
- **Checkout Session contract (read by feature 6):** `mode: "payment"`, currency
  `usd`, one line per cart line with `price_data.unit_amount` = `priceCents`,
  `quantity` from the cart view (services always 1), and
  `price_data.product_data.metadata.productId` = the `Product.id`. Session
  `metadata.locale` = `en` | `ar`. Feature 6 maps lines back to products through
  `productId`, not names.
- **Return URLs:** `success_url` = `<SITE_URL>/<lang>/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
  `cancel_url` = `<SITE_URL>/<lang>/cart?checkout=cancelled`.
- **Session id format:** `^cs_(test|live)_[A-Za-z0-9_]+$`, max 255 characters.
- **Cart clearing:** only in the return route, only when Stripe reports
  `status: "complete"`. Cancelling, a declined card, or an open/expired session
  leaves the cart unchanged.
- **Action result:** `{ success: false; error: "invalid_input" | "empty_cart" |
  "unexpected" } | null`; success redirects to `session.url`.
- **Environment:** `STRIPE_SECRET_KEY` (server only, never `NEXT_PUBLIC_`).
  Missing key → checkout shows the unexpected error; the pages still render.
- No database changes.

## Testing

- Unit (Vitest, `pnpm test`): `lib/checkout.test.ts` for line items, return
  URLs, session id validation, state mapping, and locale mapping.
- Build and lint: `pnpm build`, `pnpm lint`.
- Live (needs a Stripe **test** secret key in `.env` and a running app):
  checkout, cancel, pay with `4242 4242 4242 4242`, a declined card
  (`4000 0000 0000 0002`), both languages, an unknown session id, and checkout
  with the key unset. The Stripe network calls are not unit-tested and are not
  mocked; record what was run. No browser test command exists, so none is added.

## Notes for the AI

- Read the Server Actions, `redirect`, route handler, and `cookies` docs under
  `node_modules/next/dist/docs/` before writing code; this is Next.js 16. Confirm
  that `cookies().delete` works in a route handler and that `redirect` must be
  outside `try`.
- Follow the installed `stripe` package's TypeScript types for parameter names
  and the API version; do not pin an `apiVersion` the SDK does not ship with.
- Product names are admin-controlled text; render them only as React text.
- Keep `lib/checkout.ts` free of the Stripe client and `next/*` so Vitest can
  load it; pass plain session fields into `checkoutState`.
- Do not create `Order` rows, a webhook route, or user links here.

## Open questions

None blocking. Two plan gaps to settle before features 6 and 8, not this one:

1. **Guest checkout.** Overview open question 7: checkout ships before accounts.
   This spec makes checkout anonymous, with Stripe collecting the email. Features
   6 and 8 must decide how a guest's paid order reaches an account.
2. **Going live.** A live key before feature 6 would take payments that create no
   order. Keep test keys until feature 6 is complete.

## Verification evidence

Recorded at the end of `/implement`, against Stripe **test** mode and the running
dev server.

- `pnpm test` (155 passed), `pnpm lint` (clean), `pnpm build` (passes).
- Browser: a checkout started with the cart button on `/ar/cart` created a
  session that Stripe reports `complete` / `paid`, $299.00, one line
  "إدارة الإعلانات" x1 at 29900 with `productId` metadata, `metadata.locale: ar`,
  Stripe locale `auto`, and both `/ar` return URLs.
- A session built with the same helpers from real catalog rows (Arabic):
  accepted by Stripe, Arabic names, service quantity capped from 5 to 1, total
  $397.00, `productId` on every line.
- Return route: paid session → 303 to `/ar/success` and `Set-Cookie: cart=`
  expired; open and expired sessions → 303 with no cookie change; invalid,
  missing, or unknown id → 303 to the cart.
- Success page: paid → "Payment received" / "تم استلام الدفع" with the
  total $299.00; open and expired → "Payment not completed" with a cart link;
  `noindex, nofollow`, no canonical; customer email absent; invalid, missing,
  or unknown id → 404.
- Cart: `?checkout=cancelled` with items shows the `role="status"` notice in
  Arabic; another value or an empty cart shows nothing.
- Not live-verified: the English browser checkout (same code path, `en`
  locale), clicking Stripe's back link (the `cancel_url` on the real session and
  the notice were checked separately), a declined card, and the
  unset-`STRIPE_SECRET_KEY` error message (code-reviewed only).

<!-- blueprint:completion {"schemaVersion":1,"specBytes":14148,"specSha256":"2e6e321cf8343277972a04cb0c573c516dd02366f2c8368a679ed9708a28de76","branch":"refs/heads/feature/stripe-checkout","head":"ceff10d8e32d12a3833ee50c12dfd08579793ed8","baseRef":"refs/heads/main","baseCommit":"5c4d838b526533b88be67e057c0b53a90eea38a4","sourceTree":"5830ea2bf62b87be8f1b0810ddd4d9a38d0f96c3","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** ceff10d8e32d12a3833ee50c12dfd08579793ed8
**Base commit:** 5c4d838b526533b88be67e057c0b53a90eea38a4
**Base ref:** main
**Spec hash:** 2e6e321cf8343277972a04cb0c573c516dd02366f2c8368a679ed9708a28de76
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-04T21:46:38+04:00
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-04T22:03:30+04:00
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `pnpm test`: pass (13 files, 155 tests)
- `pnpm lint`: pass (no output)
- `pnpm build`: pass (TypeScript clean; `/[lang]/checkout/return` and `/[lang]/success` dynamic)

## Evidence

- Preflight: `HEAD` = target on `feature/stripe-checkout`; `git merge-base main HEAD` = base; SHA-256 of tracked `blueprint/context/current-feature.md` = spec hash; only `blueprint/context/review.md` differed from the target, before and after the build.
- Reviewed the full `5c4d838..ceff10d` delta: `actions/checkout.ts`, `app/[lang]/checkout/return/route.ts`, `app/[lang]/success/page.tsx`, `app/[lang]/cart/page.tsx`, `components/cart/CartSummary.tsx`, `components/cart/CheckoutButton.tsx`, `lib/checkout.ts`, `lib/checkout.test.ts`, `lib/stripe.ts`, both dictionaries, `.env.example`, `package.json`, plus callers `lib/cart.ts`, `actions/cart.ts`, `lib/money.ts`.
- Trust boundary: line items come only from `buildCartView` over `listPublishedProductsByIds` rows (`priceCents`, localized name, `Product.id`); the cookie is parsed with existing caps (50 lines, quantity 1-99, services forced to 1 in `lib/cart.ts:161`, covered by `lib/cart.test.ts`).
- The browser return never marks payment: the return route only clears the cart cookie on Stripe `status: "complete"` and redirects to a fixed, locale-validated same-origin path; the success page only renders state read server-side from Stripe and shows no customer details. No open redirect: redirect targets are `localizedPath` with a validated locale or Stripe's `session.url`.
- Secrets: `STRIPE_SECRET_KEY` read only in `lib/stripe.ts` (server-only importers), no `NEXT_PUBLIC_` use, `.env` ignored and untracked, `.env.example` holds a placeholder only.
- Framework/SDK: `redirect` after `try` matches `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md` (external URLs allowed); `response.cookies.delete` defaults `Path=/` (`@edge-runtime/cookies` `normalizeCookie`), matching the cart cookie's `path: "/"`; stripe 23.0.0's Checkout `Locale` union has no `ar`, so `"auto"` follows the spec.
- Error classification: invalid/unknown session id → cart redirect (route) or `notFound()` (page); other Stripe errors rethrow; action errors are logged and return `unexpected`.
- Accessibility/i18n: `role="alert"` error under the button with conditional `aria-describedby`, `role="status"` cancelled notice gated on exactly `cancelled` and a non-empty cart, pending label with disabled button, all new strings present in `en` and `ar`, `noindex` and no canonical on the success page.
- Tests: `lib/checkout.test.ts` covers mapping, both return URLs in both languages with a base path, session-id accept/reject including the 255/256 boundary and non-strings, every `checkoutState` branch, and the locale mapping. No skipped, focused, or placeholder tests in the delta.
- Performance: one DB query per checkout, one Stripe retrieve per return and one per success render (shared by `generateMetadata` via React `cache`); no unbounded work.

## Findings

- F-07 [P3] open: paid-state copy says the order is being confirmed, which drifts from the spec's note and no order exists until feature 6.
- No P0 or P1 findings. Existing F-01, F-02, F-04, F-05, F-06 are outside this delta and were not re-examined.

## Remaining risk

- Stripe network paths (session create, retrieve, `resource_missing` handling, real redirects) were not exercised by this reviewer: no network or Stripe calls were permitted. The builder's spec records live test-mode evidence, but leaves the English browser checkout, Stripe's back link, a declined card, and the unset-key error message not live-verified.
- No browser test command exists; UI states (pending label, alert, cancelled notice, RTL layout) were code-reviewed only.
- The return and success URLs accept any complete session id from the account, so a shared link can clear the visitor's cart and show another session's state and total. This is the spec's design (no customer details shown); feature 6 or 8 may want to bind sessions to the visitor.
- Keeping Stripe in test mode until feature 6 is a process rule, not enforced in code.
