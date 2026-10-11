# Feature: End-to-End Browser Tests

**From build-plan:** feature 25a
**Build attempt:** 1
**Branch:** feature/end-to-end-browser-tests
**Status:** verified

## Goal

Add repeatable Playwright tests (`pnpm test:browser`) that go through the main
customer and admin flows in a production build of the real app:

- browse the store
- use the cart
- check out
- receive the order and download the file
- complete service onboarding
- use the customer account
- handle orders and service work as an admin
- get refused when access is not allowed

The tests cover English and Arabic and phone width. Stripe is replaced at the
server boundary by a local fake Stripe API, so no real Stripe call is made and
no real email is sent. The tests run against the `DATABASE_URL` database (the
user's current development database, to be replaced at deployment) and never
delete or reset anything in it. Each run re-runs the safe seed and creates its
own uniquely named users and orders, which stay behind.

## In scope

- An opt-in API host override in `lib/stripe.ts`. When `STRIPE_API_BASE` is
  set, the Stripe SDK talks to that host, but only with a test key
  (`sk_test_...`).
- A fake Stripe server for tests only (`e2e/fake-stripe.ts`). It implements
  the calls the app makes:
  - create a Checkout session
  - retrieve a session
  - list a session's line items
- The fake server also serves a minimal hosted "payment page" with Pay and
  Cancel buttons. Pay sends a signed `checkout.session.completed` webhook to
  the app and follows `success_url`, the same way Stripe Checkout does.
- Before the app server starts, run `pnpm db:seed` (re-runnable, upserts the
  seeded products by slug, deletes nothing).
- Playwright config:
  - two web servers: the fake Stripe and the app on port 3100
  - a test environment: fake Stripe, email off, a test client header for rate
    limits, and `SITE_URL=http://localhost:3100`
  - a `mobile` project that runs the tests tagged `@mobile`
- Shared test helpers: create a customer or admin directly in the test
  database, sign in through the login form, and read UI text from the app's
  dictionaries.
- Specs for these flows:
  - storefront and cart
  - guest and signed-in digital purchase with download
  - checkout cancel
  - service purchase and onboarding
  - account pages
  - registration, sign-in, and sign-out
  - admin order fulfilment and service work
  - access denial
- The existing `e2e/smoke.spec.ts` keeps passing under the new config.

## Out of scope

- Refunds (15b), coupons (20), admin catalog CRUD (13, 14), site content and
  settings (21), analytics (23), and rate limits (24b). They have unit tests and
  are not part of this item's flow list. The fake Stripe implements no refunds.
- Real Stripe test mode, the Stripe CLI, or a payment form filled on
  `checkout.stripe.com`.
- Sending or capturing email. Email is off in the test server.
- The S3 bucket. Tests use local `storage/` with the seeded sample file.
- Adding browser tests to CI or a Verify command.
- Visual or screenshot comparison. Firefox and WebKit.
- Production deployment (25b).

## Build loop

`workflow.stepReview` is `feature`: build every step below in order, running
each step's checks, then present one review packet for the whole feature.
`workflow.checkpointCommits` is `disabled`, so there are no per-step commits.
`/complete` creates the single feature commit.

## Build steps

- [x] 1. **Stripe host override.** In `lib/stripe.ts`, read
  `STRIPE_API_BASE`.
  - Unset or blank keeps today's behavior exactly.
  - When set, it must parse as an `http:` or `https:` URL, and
    `STRIPE_SECRET_KEY` must start with `sk_test_`. Then construct
    `new Stripe(key, { host, port, protocol })` from that URL.
  - A live key or an unparseable value throws with a message that names the
    variable and never contains the key.
  - Keep the pure parsing in an exported function so it can be tested without
    a client.
  - Document the variable as commented out in `.env.example`, with "tests
    only, never set in production".

  **Done when:** `lib/stripe.test.ts` covers unset, blank, valid http with
  port, https without port, a live key (throws), a non-URL value (throws),
  and a thrown message that never contains the key. `pnpm test` and
  `pnpm lint` pass.

- [x] 2. **Fake Stripe and config.**
  - **`e2e/fake-stripe.ts`.** A Node `http` server on port 12111, run with
    `pnpm exec tsx`, holding sessions in memory.
    - It answers only the routes listed in Data / contracts. Anything else
      returns 404 in Stripe's error shape.
  - **`playwright.config.ts`.** Define a `webServer` array:
    - fake Stripe, ready at `http://localhost:12111/health`
    - the app, with the command `pnpm db:seed && pnpm build && pnpm start --port 3100`
  - The app gets the env from Data / contracts. Keep `reuseExistingServer`
    for local runs. Update the config comment: a reused server skips the seed
    and the build.
  - Add a `mobile` project (`devices["Pixel 7"]`, `grep: /@mobile/`) beside
    `chromium`.

  **Done when:**
  - `pnpm test:browser` passes the existing smoke test with both servers
    started by Playwright.
  - The app's logs show no Resend request and no Stripe call to
    `api.stripe.com`.
  - No user, order, or product rows that existed before the run are deleted.

- [x] 3. **Helpers, storefront, and cart.** Add `e2e/support.ts` with:
  - `createUser({ role })`: inserts a user with a unique
    `e2e-<uuid>@example.test` email and a password hashed by
    `lib/password.ts` into the database, and returns the credentials.
  - A per-test unique `x-e2e-client` header (through `extraHTTPHeaders`), so
    each test gets its own rate-limit window.
  - `signIn(page, lang, user)`: uses the login form.
  - Typed access to `lib/i18n/dictionaries/en.ts` and `ar.ts`, so specs never
    hard-code UI text.

  Add `e2e/storefront.spec.ts`:
  - `/en/products` includes the published seeded products and never the seeded
    draft. Other products the user added may also appear, so assert presence
    and absence, never an exact count.
  - The category filter narrows the list.
  - A digital product detail page and a service detail page show name, price,
    and the add-to-cart button.
  - In the cart: add a digital product and a service, raise the digital
    product's quantity, and check the subtotal changes. Removing every line
    shows the empty cart state.
  - `/ar/products` and `/ar/cart` render `dir="rtl"` with Arabic text.
  - Tag one listing-to-cart test `@mobile`, and assert it has no horizontal
    page scroll (`scrollWidth <= clientWidth`).

  **Done when:** `pnpm test:browser` passes all storefront tests in both
  projects. `pnpm lint` passes.

- [x] 4. **Checkout, delivery, and cancel.** Add `e2e/checkout.spec.ts`:
  - **Guest buys the seeded digital product.** The flow goes cart, checkout,
    fake payment page, Pay, then `/en/success`. The success page shows the
    paid order with a download link. Requesting that link returns 200 with
    the seeded file. The cart is empty afterwards.
  - **Signed-in customer buys the same product.** The order then appears in
    `/en/account/orders` as Paid, and the file appears in
    `/en/account/downloads`.
  - **Cancel on the fake payment page.** Returns to `/en/cart` with the
    cancelled notice and the cart unchanged.
  - Tag the guest purchase `@mobile`.

  **Done when:** the three tests pass in their projects. Each paid order
  exists in the database with status `PAID` and the expected `totalCents`.
  `pnpm lint` passes.

- [x] 5. **Service purchase, onboarding, and account.** Add
  `e2e/service.spec.ts`. A signed-in customer works in Arabic (`/ar`) for the
  whole flow:
  - Buy the seeded service, then open its onboarding form from the success
    page or the account.
  - Submit it empty: the required-field errors show.
  - Submit it valid: `/ar/account/services` shows the service as New
    (Arabic label) with the submitted answers.
  - The page is `dir="rtl"` throughout.

  Add `e2e/auth.spec.ts`:
  - Registration through `/en/register` lands signed in on the account page.
  - Sign out returns to signed-out state.
  - Signing back in through `/en/login` works.
  - A wrong password shows the sign-in error.

  **Done when:** both specs pass. `pnpm lint` passes.

- [x] 6. **Admin flows and access denial.** Add `e2e/admin.spec.ts`. It first
  creates a paid order through the step 4 flow, then an admin works on it:
  - On `/admin/orders`, open the order, move it Paid → Processing →
    Completed, and confirm the customer's `/en/account/orders` shows the new
    status.
  - On `/admin/service-orders`, open a service from the step 5 flow, set it
    In Progress with an admin note, and confirm the customer's service page
    shows In Progress.

  Add `e2e/access.spec.ts`:
  - `/admin` and `/admin/orders` show the 404 page for a guest and for a
    signed-in customer.
  - `/en/account` sends a guest to sign in.
  - Customer B opening customer A's `/en/onboarding/[itemId]`,
    `/en/account/services/[itemId]`, and `/api/downloads/[itemId]` is
    refused. Before asserting, read the current refusal behavior (404 page or
    status) from the code and assert exactly that.

  **Done when:** `pnpm test:browser` passes the whole suite in both projects.
  `pnpm test` and `pnpm lint` pass.

## Files / areas

- `lib/stripe.ts`, new `lib/stripe.test.ts`
- `.env.example` (`STRIPE_API_BASE`)
- `playwright.config.ts`
- `e2e/fake-stripe.ts`, `e2e/support.ts` (new)
- `e2e/storefront.spec.ts`, `checkout.spec.ts`, `service.spec.ts`,
  `auth.spec.ts`, `admin.spec.ts`, `access.spec.ts` (new); `e2e/smoke.spec.ts`
  stays
- `AGENTS.md`: update the `Browser tests` line to say it re-seeds the
  `DATABASE_URL` database and leaves test users and orders behind
- Read only, for selectors and flows:
  - `actions/checkout.ts`, `app/[lang]/checkout/return/route.ts`,
    `app/[lang]/success/page.tsx`, `lib/order-sync.ts`, `lib/orders.ts`,
    `lib/checkout.ts`, `app/api/stripe/webhook/route.ts`
  - `prisma/seed.ts`, `lib/password.ts`, `lib/admin-role.ts`
  - the admin order and service-order pages, and the onboarding and account
    pages

## Data / contracts

**`STRIPE_API_BASE`** (tests only): an absolute `http:` or `https:` URL, for
example `http://localhost:12111`. Honored only with an `sk_test_` key, so it
can never redirect live payments. Production leaves it unset.

**Test server env** (set by `playwright.config.ts` on the app web server;
process env wins over `.env` in Next.js):

| Variable | Value |
| --- | --- |
| `SITE_URL` | `http://localhost:3100` |
| `RATE_LIMIT_IP_HEADER` | `x-e2e-client` |
| `STRIPE_SECRET_KEY` | `sk_test_e2e` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_e2e` |
| `STRIPE_API_BASE` | `http://localhost:12111` |
| `RESEND_API_KEY` | `""` |
| `EMAIL_FROM` | `""` |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT` | `""` |

Email treats blank values as unset. Step 2 confirms the S3 code treats blank
the same way. If it doesn't, stop and report rather than changing the storage
code.

**Fake Stripe routes** (port 12111, in-memory, reset on restart; the request
bodies are the SDK's form encoding with bracketed keys):

- `GET /health` returns 200.
- `POST /v1/checkout/sessions` stores the session and returns:
  - `id` (`cs_test_<random>`, matching `isCheckoutSessionId`)
  - `object: "checkout.session"`, `status: "open"`,
    `payment_status: "unpaid"`
  - `amount_total` (the sum of `unit_amount × quantity`), `currency`
  - `metadata`, `client_reference_id`, `customer_email`
  - `url: http://localhost:12111/pay/<id>`
- `GET /v1/checkout/sessions/:id` returns the stored session, or 404
  `{ error: { type: "invalid_request_error", code: "resource_missing" } }`.
- `GET /v1/checkout/sessions/:id/line_items` returns
  `{ object: "list", has_more: false, data: [...] }`. Each line has `id`,
  `quantity`, and `price: { unit_amount, currency, product: { object: "product", metadata: { productId } } }`.
- `GET /pay/:id` returns an HTML page with the total and two forms: Pay
  (`POST /pay/:id/complete`) and Cancel (`POST /pay/:id/cancel`).
- `POST /pay/:id/complete` does these in order:
  1. Sets `status: "complete"`, `payment_status: "paid"`,
     `payment_intent: "pi_test_<random>"`, and
     `customer_details.email = customer_email ?? "guest@example.test"`.
  2. POSTs the event
     `{ id: "evt_test_<random>", type: "checkout.session.completed", data: { object: session } }`
     to `http://localhost:3100/api/stripe/webhook`. The signature header comes
     from `Stripe.webhooks.generateTestHeaderString` with `whsec_e2e`.
  3. Fails with 500 when the webhook does not answer 200.
  4. Answers 303 to `success_url`, with `{CHECKOUT_SESSION_ID}` replaced.
- `POST /pay/:id/cancel` answers 303 to `cancel_url`.

**Test users** are created directly in the `DATABASE_URL` database by
`support.ts`: a unique `e2e-<uuid>@example.test` email, a password hashed with
the app's own `lib/password.ts`, and role `CUSTOMER` or `ADMIN`. Only the auth
spec registers through the UI. Rate limits are kept per test by the unique
`x-e2e-client` header, so repeated runs never hit the registration limit (5
per hour). Test users, orders, services, and analytics events remain after a
run. They are recognizable by the `@example.test` email domain.

**Seed side effect:** `pnpm db:seed` upserts the four seeded products by slug,
so every run restores their seeded fields and overwrites admin edits to those
four products. Other rows are untouched.

## Testing

- `pnpm test` covers the new `STRIPE_API_BASE` parsing (step 1).
- `pnpm test:browser` is the gate for steps 2-6. It uses the `DATABASE_URL`
  database in `.env`.
- `pnpm lint` and `pnpm build` must pass. The build also runs inside the
  browser-test web server.
- These tests prove behavior, not visual fidelity. Phone width proves only the
  `@mobile` tests and their no-horizontal-scroll check.

## Notes for the AI

- Read the Playwright docs for the installed 1.64 (`webServer` arrays, `env`,
  `grep`, tags) and the Next.js 16 env-loading guide in
  `node_modules/next/dist/docs/` before step 2.
- Use role and label locators with dictionary text. Avoid CSS selectors except
  `hreflang`, as in the smoke test.
- Never print `.env` values in logs or test output. Never delete, reset, or
  truncate anything in the database: no `migrate reset`, no `deleteMany`, no
  cleanup hooks. Only insert test rows and update the test's own rows.
- `e2e/` files are test code. Keep them out of the app bundle and out of
  Vitest (Vitest only includes `*.test.ts`; the specs are `*.spec.ts`).
- The fake Stripe implements only the listed fields. If the app reads a field
  it lacks, add that field rather than changing app code.
- Tests must not depend on each other's order. Each test creates its own users
  and orders. Admin and access tests create what they need through helpers or
  the purchase flow.
- If a flow fails because the app is wrong, not the test, stop and report it
  for `/fix` rather than changing product behavior in this feature.
- Added during implementation:
  - **Timeouts.** The config raises the test timeout to 90 s and the assertion
    timeout to 10 s. Purchase and admin flows against the remote database
    went past Playwright's 30 s and 5 s defaults.
  - **Download refusal.** Download access belongs to the checkout session
    link, not the account. The access test therefore asserts the route's
    uniform 404 for requests without the owner's `session_id`, and 200 for
    the owner.
  - **Timing.** No app defect was found. Every failure during the build was a
    selector or timing issue in the tests.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":15734,"specSha256":"60ad6deb91a99413174ebde48b7d2e000b2f1d303cef84559e3f6e29dcdada79","branch":"refs/heads/feature/end-to-end-browser-tests","head":"478d13f735207cd401161ac880c6fc79fa53208f","baseRef":"refs/heads/main","baseCommit":"48e945d39828aacc54cad1dc277daefc08b43f29","sourceTree":"562fec86532286eb574405d9ba4644bfa5b59101","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 478d13f735207cd401161ac880c6fc79fa53208f
**Base commit:** 48e945d39828aacc54cad1dc277daefc08b43f29
**Base ref:** refs/heads/main
**Spec hash:** 60ad6deb91a99413174ebde48b7d2e000b2f1d303cef84559e3f6e29dcdada79
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-11T18:42:03Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-11T19:02:00Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `48e945d39828aacc54cad1dc277daefc08b43f29..478d13f735207cd401161ac880c6fc79fa53208f` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`, `git merge-base refs/heads/main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain`: pass (target, base, and spec hash match; only review.md dirty)
- `pnpm test`: pass (69 files, 1183 tests)
- `pnpm lint`: pass
- `pnpm test:browser`: pass (20 tests, chromium and mobile projects, 2.4 min; includes `pnpm db:seed` and `pnpm build`)

## Evidence

- Reviewed all 20 files in `48e945d..478d13f`: `lib/stripe.ts`, `lib/stripe.test.ts`, `e2e/*.ts`, `playwright.config.ts`, `package.json`, `pnpm-lock.yaml` (adds only `@playwright/test`, `playwright`, `playwright-core` 1.64.0), `.env.example`, `.gitignore`, `AGENTS.md`, `blueprint/build-plan.md`, `blueprint/context/project-overview.md`, and the spec.
- `stripeHostFromEnv` returns null for unset or blank values, checks the `sk_test_` prefix before parsing, and its three error messages are fixed strings that never contain the key; `getStripe` is the only app `new Stripe(key, ...)` call. A live key with `STRIPE_API_BASE` fails closed. Stripe SDK accepts `port: undefined` (falls back to 443).
- Env precedence: `@next/env` `processEnv` keeps any defined process value, including `""`, over `.env`; a spawn-through-shell check on this Windows machine confirmed the empty value reaches grandchild processes. `lib/email.ts` and `lib/object-storage.ts` treat blank as unset.
- `e2e/support.ts`, `prisma/seed.ts`, and the specs contain only INSERT and SELECT statements and upserts; no delete, truncate, or reset. Test users use `e2e-<uuid>@example.test`.
- Vitest includes only `**/*.test.ts`, so `e2e/*.spec.ts` stays out of `pnpm test`.
- Specs cover every step 3-6 Done-when flow, including DB checks of `PAID` and `totalCents`, Arabic `dir="rtl"`, `@mobile` no-horizontal-scroll, admin Paid -> Processing -> Completed, service In progress with the internal note hidden from the customer, and the uniform download 404 for non-owners.
- Webserver stderr showed only "destination stream closed early" RSC aborts from navigation, not test failures. Working tree still matches the target after the browser run.

## Findings

- F-40 [P3] open: no guard fails if the test server stops overriding real email and Stripe keys
- F-41 [P3] open: the fake Stripe binds all interfaces
- F-42 [P3] open: the overview tech stack omits Playwright

## Remaining risk

- Step 2's "no Resend request / no `api.stripe.com` call" is proven by code and env-precedence reading, not by observed app logs (Playwright ignores app stdout by default); see F-40.
- The browser suite writes `@example.test` users and orders to the shared `DATABASE_URL` dev database on every run, and `pnpm db:seed` overwrites admin edits to the four seeded products, as the spec states.
- `reuseExistingServer` locally reuses any server on 3100 or 12111 and skips seed and build; a stale or non-test server there would run the suite against the wrong env.
- Coupons, refunds, email, and the S3 bucket are out of scope for the browser suite and rely on unit tests.
