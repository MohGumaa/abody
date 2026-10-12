# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-01 [P3] open - Unused money helper and test-runner setup ship outside the spec's scope

**File:** lib/money.ts:6
**Found:** 2026-10-02 by /audit (scope: current; lens: quality)
**Why it matters:** `formatPriceCents` has no caller outside `lib/money.test.ts`, and the feature ships no UI that could use it, so it is unused production code under the "no unused code" and "don't add features not in the spec" rules. The same delta adds the Vitest runner (`vitest.config.mts`, `test` scripts, `vitest` dependency) while the spec's Out of scope list still says "A unit test runner (`/tests` owns that)" and its Files / areas list names none of `lib/money.ts`, `lib/api-error.ts`, or `vitest.config.mts`. The spec's own Testing section says the gate is on, so the archived spec will contradict itself and the diff.
**Suggested fix:** User decision, not an automatic repair. Either keep `lib/money.ts` as the `/tests` example helper that feature 2 will use for price display, or delete `lib/money.ts` and `lib/money.test.ts` (requirement lost: None, the other three test files keep the suite non-empty). Separately, correct the spec's Out of scope and Files / areas entries so they match what shipped; a spec change needs a new review request.
**Resolution:** Re-examined 2026-10-02 by /audit independent (target 0c9b978). The unused-code half no longer holds: `formatPriceCents` is now called from `components/catalog/ProductDetail.tsx` and `components/catalog/RelatedProducts.tsx`, and the feature 2 spec lists `lib/money.ts` as reused. The remaining half is documentation only: the archived feature 1 spec (`blueprint/history/features/01-product-service-catalog.md:44`) still lists a unit test runner as out of scope. Status left `open` for the user to decide; nothing in the current delta is affected.

### F-02 [P3] open - Seed upsert overwrites existing rows and has no development-only guard

**File:** prisma/seed.ts:69
**Found:** 2026-10-02 by /audit (scope: current; lens: security, quality)
**Why it matters:** `update: fields` rewrites every column (price, status, `digitalFile`, `createdAt`) of any row whose slug matches a seed slug, and `pnpm db:seed` runs against whatever `DATABASE_URL` points at. The spec says the seed is for development databases only, but nothing enforces that. Once admin editing exists (features 12 and 13), a seed run against a shared or production database would silently revert edited products, republish or unpublish them, and insert published placeholder products with fake file keys. It does not delete rows, so the spec's explicit rule holds; the gap is the overwrite.
**Suggested fix:** Smallest option: exit early from `main()` when `process.env.NODE_ENV === "production"`, with a one-line message. Alternatively change `update: fields` to `update: {}` so the seed only creates missing rows. Both keep "running the seed twice leaves exactly four rows".
**Resolution:** Re-examined 2026-10-02 by /audit independent (target 0c9b978). Still present and unrepaired: `prisma/seed.ts:84` still passes `update: fields` with no environment guard, and the overwrite now also covers the new `image`, `included`, `durationDays`, and `requirements` columns. Status stays `open`. Re-examined 2026-10-02 by /audit independent (target 9954661): still present and unrepaired. The upsert is now at `prisma/seed.ts:107`, still with `update: fields` and no environment guard, and the overwrite now also covers the five Arabic columns for the three seeded rows that set them. Status stays `open`.

### F-05 [P3] open - Retry button hover state drops white text below WCAG AA contrast

**File:** app/error.tsx:17
**Found:** 2026-10-02 by /audit independent (scope: current; lens: quality)
**Why it matters:** The spec requires text contrast that meets WCAG AA on the light theme, and the `--color-primary-strong` token exists (per its comment in `app/globals.css:12`) because filled buttons need AA contrast. The retry button uses `hover:bg-primary`, which puts white 16px semibold text on `oklch(59% 0.13 248)`. Computed contrast is about 4.09:1, under the 4.5:1 AA minimum for normal-size text; the resting state on `primary-strong` is about 6.52:1. Only the hover state of one button on the error screen is affected.
**Suggested fix:** Remove `hover:bg-primary` from the retry button, or replace it with a hover treatment that does not lighten the background (a shadow or a darker shade). Requirement lost: None.
**Resolution:**

### F-06 [P3] open - Blank-Arabic fallback is not tested for name or description, and the "not trimmed" rule has no test

**File:** lib/catalog.test.ts:121
**Found:** 2026-10-02 by /audit independent (scope: current; lens: tests)
**Why it matters:** The spec's Testing section says null, empty, and whitespace-only Arabic text each fall back to English. The fallback test only blanks `shortDescriptionAr` and `requirementsAr`; `nameAr` and `descriptionAr` are always populated in every `ar` assertion that reads them, and no `ar` test asserts `name` or `description` on a row whose Arabic value is null or blank. Replacing `hasText(row.nameAr)` at `lib/catalog.ts:104` (or the `descriptionAr` check at line 111) with a plain null check, or dropping the fallback entirely, would leave all 60 tests green. `name` is the field that feeds the page `<title>`, the image alt text, and the related-card link's accessible name, so a regression there would produce an empty heading and an unnamed link on Arabic pages. The rule "the stored value is returned as is, not trimmed" is also unasserted: every Arabic fixture has no surrounding whitespace. The shipped code is correct today; this is a coverage gap only.
**Suggested fix:** In the "falls back to English per field" test, blank all four text fields in turn (or add `nameAr: blank` and `descriptionAr: blank` to a second loop) and assert `name` and `description` return the English values. Add one assertion that an Arabic value with surrounding whitespace (for example `"  نص  "`) comes back unchanged. Requirement lost: None.
**Resolution:**

### F-08 [P3] open - Missing STRIPE_SECRET_KEY makes the webhook answer 400 invalid_signature instead of the 500 the contract requires

**File:** app/api/stripe/webhook/route.ts:23
**Found:** 2026-10-04 by /audit independent (scope: current; lens: quality, tests)
**Why it matters:** `getStripe()` is called inside the `try` that wraps `constructEvent`, so when `STRIPE_SECRET_KEY` is unset its "STRIPE_SECRET_KEY is not set" error is caught as a verification failure. The route logs "Stripe webhook verification failed" and returns 400 `invalid_signature` for a correctly signed event. The spec's Webhook responses contract reserves 400 for a missing or invalid signature and 500 for missing configuration. Stripe retries any non-2xx, so no event is lost; the impact is a misleading status code and log line that point an operator at the signing secret instead of the API key. No route test covers an unset `STRIPE_SECRET_KEY`.
**Suggested fix:** Call `const stripe = getStripe();` before the `try` (or inside the existing secret check), letting a missing key return `apiError(500, "internal_error", ...)` with its cause logged, and keep only `stripe.webhooks.constructEvent(...)` inside the `try`. Add a route test that stubs `STRIPE_SECRET_KEY` to `""` and expects 500 with no sync. Requirement lost: None.
**Resolution:**

### F-09 [P3] open - Product JSON-LD test cannot tell the category label from the key

**File:** lib/seo.test.ts:29
**Found:** 2026-10-05 by /audit independent (scope: current; lens: tests)
**Why it matters:** The spec requires the product JSON-LD `category` to use the localized label (`lib/seo.ts:106` now reads `product.categoryLabel`). The test fixture sets both `category` and `categoryLabel` to `"Templates"`, so reverting `lib/seo.ts` to `product.category` would leave `pnpm test` green. The shipped code is correct today; this is a coverage gap only.
**Suggested fix:** Give the `lib/seo.test.ts` fixture a distinct `categoryLabel` (for example `"قوالب"`) and expect that value in the `productJsonLd` assertion at line 162. Requirement lost: None.
**Resolution:**

### F-13 [P3] open - Password toggle changes its label and also sets aria-pressed, so screen readers hear "Hide password, pressed" while the password is shown

**File:** components/auth/AuthForm.tsx:250
**Found:** 2026-10-05 by /audit independent (scope: current; lens: quality)
**Why it matters:** The show/hide button swaps `aria-label` between "Show password" and "Hide password" and also sets `aria-pressed={visible}` (lines 250-251). A toggle button's name has to stay fixed when its pressed state changes (WAI-ARIA APG button pattern). Otherwise the two signals contradict each other: when the password is visible, assistive tech announces "Hide password, toggle button, pressed", which suggests that hiding is active. Arabic has the same problem. Mouse and keyboard behavior is correct. The spec's step 10 asks for both the translated Show/Hide label and `aria-pressed`, so the code follows the spec. The contradiction comes from the contract itself.
**Suggested fix:** User decision, and the spec changes with it. Either keep `aria-pressed` with a fixed label ("Show password" / "إظهار كلمة المرور"), or keep the switching label and drop `aria-pressed`. Both are one-line changes in `PasswordInput`. Requirement lost: None, apart from the spec wording.
**Resolution:** Re-checked 2026-10-06 by /audit independent (target 217a620, fresh subagent): `PasswordInput` is unchanged apart from being exported (the label/`aria-pressed` pair is now at `components/auth/AuthForm.tsx:250-251`), and feature 8b reuses it for all four password fields on the settings page, so the same announcement now also occurs there. One fix in `PasswordInput` covers both pages. Status stays `open`. Re-checked 2026-10-12 by /audit independent (target d4594e6, fresh subagent): `PasswordInput` is unchanged; feature 28's `components/auth/ResetPasswordForm.tsx` reuses it for the new-password field, so the same announcement also occurs on `/<lang>/reset-password`. The same one fix covers it. Status stays `open`.

### F-14 [P2] open - The session helper that keeps the current device signed in has no test, so the "current one kept" contract is unproven

**File:** lib/session.ts:66
**Found:** 2026-10-06 by /audit independent (scope: current; lens: tests)
**Why it matters:** The spec's In scope list requires "Unit tests for the new parsers, the session helper, and the actions", and step 2's Done when requires a test that other sessions are deleted with "the current one kept". `otherSessionsWhere` is the only code that excludes the current session (`tokenHash: { not: hashSessionToken(token) }`), but no test loads it: `actions/account.test.ts` mocks `@/lib/session` and returns a hand-written filter, and no `lib/session` test exists. Changing the helper to return `{ userId }` for every request (which would sign the user out on this device too after a password change or "Sign out other devices") would leave all 355 tests green. The shipped helper is correct today; this is a coverage gap on a security-relevant contract.
**Suggested fix:** Add a small Vitest suite for `otherSessionsWhere` that mocks `next/headers` `cookies()` (and `@/lib/db` so the module loads), and asserts that with a session cookie it returns `{ userId, tokenHash: { not: hashSessionToken(token) } }` and without one it returns `{ userId }`. Requirement lost: None.
**Resolution:**

### F-15 [P3] open - Account breadcrumb marks "Account" as the current page on every account subpage

**File:** app/[lang]/account/layout.tsx:38
**Found:** 2026-10-06 by /audit independent (scope: current; lens: quality)
**Why it matters:** The breadcrumb is rendered once by the shared account layout, so its last item ("Account" / "حسابي") always carries `aria-current="page"`. On `/account/orders`, `/account/downloads`, `/account/services`, and `/account/settings`, the current page is the subpage, which the side nav already marks with its own `aria-current="page"`. Screen-reader users therefore hear two different "current page" items, and the breadcrumb's one is wrong on four of the five pages. Visual behavior and the spec's "Home → Account" breadcrumb are otherwise met; this is an accessibility accuracy issue only.
**Suggested fix:** Smallest option: drop `aria-current="page"` from the breadcrumb span (keep the visual styling), leaving the side nav as the single current-page marker. Alternatively render "Account" as a link to `/account` on subpages and keep `aria-current` only on the overview. Requirement lost: None.
**Resolution:**

### F-16 [P3] open - Textarea line breaks count once in the browser's maxLength but twice on the server, so a note within the visible limit can be rejected as too long

**File:** lib/onboarding.ts:56
**Found:** 2026-10-06 by /audit independent (scope: current; lens: quality, tests)
**Why it matters:** `OnboardingForm` sets `maxLength={ONBOARDING_MAX_LENGTH[field]}` on the `campaignGoals` and `notes` textareas (`components/onboarding/OnboardingForm.tsx:157`). Under the HTML standard, a textarea's maxlength counts each line break as one character. On submit, though, the browser sends each break as `\r\n`, and the spec's own evidence notes that stored line breaks arrive that way. `parseOnboardingForm` only trims and then compares `value.length`, so each break counts as two. A customer who writes 2000 visible characters, including line breaks, in "Campaign goals" or "Additional notes" passes the browser limit, then gets "Use 2000 characters or fewer" for text the browser already said fits. They have to delete content without knowing why. This matches the spec's "JavaScript string length after the trim" rule, so nothing is lost or exposed. It is an edge-case usability gap that only appears near the 2000-character limit. Not exercised in a browser in this pass. No test covers a line-break value near the limit.
**Suggested fix:** In `parseOnboardingForm`, normalize `\r\n` to `\n` before trimming and counting (for example `value.replace(/\r\n/g, "\n").trim()`). Add a test where a value of exactly the limit, made of `\r\n`-separated lines, parses as `ok`. This also stores a single line-break form. Requirement lost: None. It is a small rule change, so the spec's "Limits count JavaScript string length" line should say the count is taken after line-break normalization.
**Resolution:**

### F-17 [P3] fixed - The WAITING_FOR_INFORMATION message does not link to the onboarding form itself

**File:** app/[lang]/account/services/[itemId]/page.tsx:88
**Found:** 2026-10-07 by /audit independent (scope: current; lens: quality)
**Why it matters:** The spec's In scope list says that for `WAITING_FOR_INFORMATION` "the message asks the customer to update their details and links to the onboarding form." The page renders the status message as plain text in the Progress section (`<p>{text.messages[...]}</p>`). The only link to `/onboarding/<itemId>` is the "Update your details" link in the separate "Your details" section head (line 104, shown because `canEditOnboarding` includes that status). So the customer can still reach the form from the same page and nothing is broken, but the message the spec ties to the link has none. A screen-reader or mobile user who reads "Please update your details" in the Progress panel has to find the link in the next section. The `none` ("Send your details...") message has the same layout.
**Suggested fix:** When `editable` is true, render the onboarding link right after the status message in the Progress section (reusing `onboardingHref` and the existing `onboarding.add` / `onboarding.edit` labels), or record in the spec that the details-section link meets this requirement. Requirement lost: None.
**Resolution:** Fixed 2026-10-07 by fix "Clean up service tracking status display". When `onboardingState(status)` is `needed` (no record or `WAITING_FOR_INFORMATION`), the detail page renders the add or update link directly under the status message in the Progress section. Verified live in `/en` and `/ar`. Awaiting `/audit` re-review to close.

### F-18 [P3] open - The edit page loads the product twice per request and each load counts order items that nothing reads

**File:** lib/admin.ts:257
**Found:** 2026-10-07 by /audit independent (scope: current; lens: performance, quality)
**Why it matters:** `app/admin/products/[id]/page.tsx` calls `getAdminProduct(id)` in both `generateMetadata` (line 18) and the page (line 29). `getAdminProduct` is a plain async function, not wrapped in React `cache()` the way `getCurrentUser` is in `lib/session.ts:34`, so every edit-page render runs the same `findFirst` twice. Each query also selects `_count: { select: { orderItems: true } }` and returns `orderCount`, which no page or component reads (only `lib/admin.ts` and its test mention it), so each load adds an unused count subquery. Admin-only traffic, so the cost is small; it is wasted work and an unused field rather than a defect.
**Suggested fix:** Wrap `getAdminProduct` in React `cache()` (as `getCurrentUser` already is) so metadata and page share one query, and drop `_count`/`orderCount` from the select, the `AdminProduct` type, and the test unless a planned UI needs it. Requirement lost: None.
**Resolution:** Re-examined 2026-10-07 by /audit independent (target 5048817, fresh subagent): still present. This delta changes `getAdminProduct` to take a type (now `lib/admin.ts:240`) but it is still not wrapped in `cache()` and still selects `_count.orderItems` (line 268) for an `orderCount` that only `lib/admin.test.ts` reads. The new `app/admin/services/[id]/page.tsx` repeats the pattern (`generateMetadata` and the page each call it), so the double query now occurs on both edit pages. Severity stays P3. Status stays `open`.

### F-20 [P3] open - The admin order list copies the dashboard's recent-order query and row mapping

**File:** lib/admin-orders.ts:61
**Found:** 2026-10-07 by /audit independent (scope: current; lens: quality)
**Why it matters:** `listAdminOrders` repeats the dashboard's recent-orders `findMany` (`lib/admin.ts:131-144`) field for field: the same `orderBy`, the same `select` (including `customerEmail` and `user.name`), and the same row mapping with `customerLabel` and the `itemCount` reduce (`lib/admin.ts:155-163`). `AdminOrderRow` (`lib/admin-orders.ts:44`) is also a copy of `AdminRecentOrder` (`lib/admin.ts:59`). The two order tables must show the same customer and item count for the same order, so a later change to one (for example, labelling a deleted account differently, or counting service items separately) can silently diverge from the other. The spec kept `lib/admin.ts` unchanged on purpose, so this is a follow-up cleanup, not a defect.
**Suggested fix:** In a later change that may touch `lib/admin.ts`, export one shared select and row mapper (and one row type) from `lib/admin.ts`, and have `listAdminOrders` use them with its own `skip`/`take`. Requirement lost: None.
**Resolution:**

### F-21 [P3] open - The order detail page loads the same order twice per request

**File:** app/admin/orders/[id]/page.tsx:32
**Found:** 2026-10-07 by /audit independent (scope: current; lens: performance)
**Why it matters:** `generateMetadata` (line 32) and the page (line 53) each call `getAdminOrder(id)`, which is a plain async function rather than a React `cache()` wrapper, so every admin render of `/admin/orders/[id]` runs the same `findUnique` with its items and products join twice. This repeats the pattern already recorded for the product and service edit pages in F-18, as the spec directed ("as the product edit page does"). Admin-only traffic, so the cost is small; it is wasted work, not a defect.
**Suggested fix:** Wrap `getAdminOrder` in React `cache()` (as `getCurrentUser` is in `lib/session.ts`) so metadata and page share one query. This can be done together with F-18. Requirement lost: None.
**Resolution:** Re-checked 2026-10-08 by /audit independent (target 004bbd2, fresh subagent): `app/admin/orders/[id]/page.tsx` is unchanged by this delta and still loads the order twice. The new `app/admin/service-orders/[itemId]/page.tsx` follows it, as its spec directs: `generateMetadata` (line 22) and the page (line 50) each call `getServiceOrder`, which is not wrapped in `cache()`. The same `cache()` fix applies there. Severity stays P3. Status stays `open`. Re-checked 2026-10-08 by /audit independent (target 1170615, fresh subagent): unchanged. `app/admin/service-orders/[itemId]/page.tsx` still calls `getServiceOrder` in `generateMetadata` (line 22) and the page (line 50) without `cache()`. Severity stays P3. Status stays `open`. Re-checked 2026-10-11 by /audit independent (target 0f84d91, fresh subagent): still present. `app/admin/orders/[id]/page.tsx` still calls `getAdminOrder` in `generateMetadata` (line 33) and the page (line 54), and feature 20 adds a `coupon` join to that query (`lib/admin-orders.ts`), so both passes now also read the coupon. The new `app/admin/coupons/[id]/page.tsx` repeats the pattern with `getAdminCoupon` (a single small row). Severity stays P3. Status stays `open`.

### F-22 [P3] open - The success message and focus target are inside the Refund card that the refreshed page removes

**File:** components/admin/OrderRefund.tsx:88
**Found:** 2026-10-07 by /audit independent (scope: current; lens: quality)
**Why it matters:** The spec says the refund result appears in a `role="status"` live region. On success, `refundOrder` calls `revalidatePath`, so the action response carries the refreshed page in which the order is Refunded and `app/admin/orders/[id]/page.tsx:188` no longer renders the Refund card. The "Order refunded." status text and the focused "Confirm refund" button are both inside that card, so they unmount in the same update. A screen-reader user likely hears no confirmation, and keyboard focus drops to the document body. Sighted users still see the Refunded chip and payment status. Failure results are announced and return focus correctly. This comes from code-path reading only; it was not exercised in a browser in this pass.
**Suggested fix:** Confirm it during `/check` with a screen reader or by checking `document.activeElement` after a refund. If confirmed, move focus to a stable element after success (for example, the order heading with `tabIndex={-1}`), or put a page-level status message outside the conditional card. Requirement lost: None.
**Resolution:**

### F-23 [P3] open - The confirm step shows the order total even when a partial dashboard refund means Stripe will refund less

**File:** app/admin/orders/[id]/page.tsx:196
**Found:** 2026-10-07 by /audit independent (scope: current; lens: quality)
**Why it matters:** Under the spec's decision, a partial refund made in the Stripe dashboard leaves the order Paid, so the Refund card is still shown. `refunds.create` without an `amount` then refunds only the remaining balance, but the confirm text says "Refund <order total> to the customer". For example, after a $50 partial refund on a $147 order, the admin confirms "$147.00" and Stripe refunds $97. The money movement is correct, and the spec specifies `formatPriceCents(order.totalCents)`, so the code matches the contract. The gap is in the contract: an admin can confirm an amount that Stripe will not refund.
**Suggested fix:** This is a user decision about the spec wording. The smallest option is to change the confirm copy to "Refund the remaining balance of this payment (order total $X.XX USD)…". Showing the exact remaining amount would need a Stripe read when the page renders, which is beyond what the current requirements call for. Requirement lost: None.
**Resolution:**

### F-24 [P3] open - The no_payment action message drops a clause from the spec's text

**File:** components/admin/OrderRefund.tsx:17
**Found:** 2026-10-07 by /audit independent (scope: current; lens: quality)
**Why it matters:** Spec step 3 says the `no_payment` message is "the no-payment text from In scope": "No Stripe payment is recorded for this order, so it can't be refunded here. Refund it in the Stripe dashboard." The page note (`app/admin/orders/[id]/page.tsx:200-201`) uses that text. The action message leaves out ", so it can't be refunded here". This only shows if the payment intent disappears between page render and submit, so the impact is a small wording drift.
**Suggested fix:** Use the exact In scope sentence in `MESSAGES.no_payment`. Requirement lost: None.
**Resolution:**

### F-25 [P2] open - A save from a stale form silently reverts another admin's status change instead of returning `changed`

**File:** actions/admin-service-work.ts:45
**Found:** 2026-10-08 by /audit independent (scope: current; lens: quality, tests)
**Why it matters:** The action reads the current status in the same request and conditions the `updateMany` on that value, so `changed` only covers a write that lands in the few milliseconds between its own `findFirst` and `updateMany`. It does not cover the realistic stale case: admin A opens a service at `NEW`, admin B moves it to `IN_PROGRESS` (stamping the start date), then A saves a note with `NEW` still selected. A's action reads `IN_PROGRESS`, treats `NEW` as the requested change, and writes `NEW` plus A's notes. B's status and notes are lost, the customer's progress view moves back to "New", and A sees "Saved." The form's `changed` message ("Someone changed this service's status. Reload to see it.") and the code comment ("a concurrent save is never overwritten") both promise more than the code does. The code follows the spec's literal mechanism ("Read the current record, then write once with `updateMany({ where: { id, status: current } })`"), but step 2's "A stale status write updates nothing and returns `changed`" is not met for a form rendered before the change. No test covers a stale form. Admin-only, and dates stay consistent with the written status, so this is a lost-update gap, not a data-integrity break.
**Suggested fix:** User decision, because the spec's mechanism changes. Smallest option: render the status the page read as a hidden `expectedStatus` field in `ServiceWorkForm`, validate it with `isServiceStatus`, and condition both the read and the `updateMany` on it (`status: expectedStatus`), returning `changed` when it does not match. Add an action test where the stored status differs from `expectedStatus`. Alternatively, keep the current behavior and correct the code comment and the spec's Done when wording. Requirement lost: None.
**Resolution:** Re-examined 2026-10-08 by /audit independent (target 1170615, fresh subagent): still present and unrepaired. `saveServiceWork` still reads the status in the same request and conditions `updateMany` on that read (`actions/admin-service-work.ts:46-60`), and `ServiceWorkForm` still posts only `id`, `status`, and `notes` with no expected status. Step 5's `onSubmit` change keeps the radios on the saved value after the admin's own save, but does not help when another admin's change has not reached this form. The comment "a concurrent save is never overwritten" (line 53) still overstates the guarantee. Severity stays P2. Status stays `open`.

### F-26 [P3] open - The unexpected-error log prints the raw error message, which for a Prisma error can repeat the notes being written

**File:** actions/admin-service-work.ts:71
**Found:** 2026-10-08 by /audit independent (scope: current; lens: security, quality)
**Why it matters:** The spec says `unexpected` "is logged without customer data" and "Log errors without onboarding answers or notes." The catch block logs `error.message`. The project already established that this is unsafe for Prisma: `actions/onboarding.ts:36-40` and `:81-83` log only the error name and code because "a Prisma message can repeat the query's data", and `actions/onboarding.test.ts:188-194` tests that rule with a message that embeds the answers. Here the failing call is `db.service.updateMany` with `data.adminNotes`, so a Prisma validation-style error that echoes its arguments would put the internal notes in the server log. The action test only uses `new Error("connection lost")`, so it cannot catch this. Reachability is limited: inputs are validated before the write, so no ordinary input is known to trigger an argument-echoing error, and only admins can reach the action. This is a drift from the spec's logging rule and the existing safe helper, not a demonstrated leak.
**Suggested fix:** Log the error name and code only, as `actions/onboarding.ts` does (move its `errorLabel` to a shared lib module or copy the three-line rule), and change the action test to throw an error whose message contains the notes text and assert the log does not contain it. Requirement lost: None.
**Resolution:**

### F-27 [P3] open - The customer detail page runs all four customer queries twice per request, and the metadata pass only needs the name

**File:** app/admin/customers/[id]/page.tsx:28
**Found:** 2026-10-08 by /audit independent (scope: current; lens: performance)
**Why it matters:** `generateMetadata` (line 28) and the page (line 76) each call `getAdminCustomer`, which is not wrapped in React `cache()`. Each call runs the user lookup plus three unpaged lists (every order with its items, every paid download item, every paid service item), so an admin render does eight queries where four would do, and the metadata pass discards everything except `profile.name` and `profile.email`. This follows the pattern the spec named (`app/admin/orders/[id]/page.tsx`, already recorded as F-21), but the cost here grows with the customer's full order history because the detail lists are deliberately unpaged. Admin-only traffic, so the impact is small; it is wasted work, not a defect.
**Suggested fix:** Wrap `getAdminCustomer` in React `cache()` so metadata and page share one set of queries (the same fix proposed for F-18 and F-21). Requirement lost: None.
**Resolution:**

### F-28 [P3] open - The download, service, and order-item orderings in getAdminCustomer have no assertion

**File:** lib/admin-customers.test.ts:598
**Found:** 2026-10-08 by /audit independent (scope: current; lens: tests)
**Why it matters:** The spec's Data / contracts fix the orderings: downloads and services newest first by `order.createdAt desc, order.number desc, id asc`, and each order's items `id asc`. The test asserts the `where` and selects of both `orderItem.findMany` calls and the order list `orderBy`, but never the `orderBy` of the download or service queries (`NEWEST_ITEM_FIRST`, `lib/admin-customers.ts:17`) or the nested `items.orderBy`. Removing or reversing any of them would leave `pnpm test` green. The shipped code matches the spec today; this is a coverage gap only.
**Suggested fix:** In the "reads the customer's orders, downloads, and services" test, add `expect(downloadQuery.orderBy).toEqual([{ order: { createdAt: "desc" } }, { order: { number: "desc" } }, { id: "asc" }])`, the same for `serviceQuery.orderBy`, and `expect(orderQuery.select.items.orderBy).toEqual({ id: "asc" })`. Requirement lost: None.
**Resolution:**

### F-29 [P3] open - The upload route test does not pin local storage mode, so ambient S3_* variables send it to a real bucket

**File:** app/api/admin/products/[id]/file/route.test.ts:11
**Found:** 2026-10-10 by /audit independent (scope: current; lens: tests)
**Why it matters:** The upload route test imports the real `lib/product-files.ts`, which now calls the real `bucketConfig()` from `lib/object-storage.ts`. The test mocks the session, db, and `STORAGE_ROOT`, but neither mocks `@/lib/object-storage` nor stubs the `S3_*` variables. Vitest does not load `.env`, so `pnpm test` is local-mode today, but in a shell or CI job that exports the bucket variables (for example a deploy pipeline that runs tests with production env), these "local-mode" tests would switch to bucket mode: they would construct a real S3 client, try to `PutObject` test files under `products/<id>/...` in the real bucket, and fail or leave objects behind. The spec says "no test touches the network". The other affected tests (`lib/product-files.test.ts`, `lib/downloads.test.ts`, the download route test, `lib/object-storage.test.ts`) already mock the module or stub every variable.
**Suggested fix:** In the upload route test, add `vi.mock("@/lib/object-storage", () => ({ bucketConfig: () => null, deletePrefix: vi.fn(), putObjectFromFile: vi.fn() }))`, or `vi.stubEnv` each `S3_*` variable to `""` in `beforeEach`. Requirement lost: None.
**Resolution:**

### F-30 [P3] open - objectExists, putObjectFromFile, and deletePrefix's paging and error handling have no direct test

**File:** lib/object-storage.ts:108
**Found:** 2026-10-10 by /audit independent (scope: current; lens: tests)
**Why it matters:** `lib/object-storage.test.ts` covers `bucketConfig`, signing, unsafe keys for `signedDownloadUrl`, and unsafe prefixes for `deletePrefix`. Nothing exercises the logic inside the other functions: `objectExists` mapping a `NotFound`/404 to `false` and rethrowing anything else (this decides whether a missing object is reported as missing or as a storage failure), `deletePrefix` following `NextContinuationToken` across pages and throwing when `DeleteObjects` returns `Errors`, or `putObjectFromFile` and `objectExists` rejecting an unsafe key (Step 1 says "every function rejects an unsafe key"). Callers mock the whole module, so a regression here (for example, a loop that stops after the first page and leaves a deleted product's objects behind) keeps `pnpm test` green. The code reads correctly today; this is a coverage gap, not a live bug.
**Suggested fix:** Add tests that stub `S3Client.prototype.send` with `vi.spyOn` (no network): a two-page listing proving both pages are deleted with the second `ContinuationToken`; a `DeleteObjects` result with `Errors` rejecting; `HeadObject` throwing a `NotFound` error (false) and a 403 error (rethrown); and `putObjectFromFile`/`objectExists` rejecting `"../x.pdf"` before any `send`. Requirement lost: None.
**Resolution:**

### F-31 [P3] open - The webhook waits on two Resend calls that have no timeout before it answers Stripe

**File:** app/api/stripe/webhook/route.ts:69
**Found:** 2026-10-10 by /audit independent (scope: current; lens: performance)
**Why it matters:** After the order write, the route awaits `sendOrderPaidEmails`, which sends the customer and then the admin email in sequence. `sendEmail` (`lib/email.ts:48`) calls `fetch` without an `AbortSignal`, so a slow or hanging Resend API holds the Stripe response open for as long as the connection lasts. If that passes Stripe's webhook timeout, Stripe records the delivery as failed and retries it. The order is already `PAID`, so the retry sends nothing and changes nothing, and no email is duplicated. But the spec says email problems never fail the webhook, and a host that kills the function at its own timeout would also drop the email that was still pending. Without a Resend outage the risk does not show up, so the actual latency effect has not been measured.
**Suggested fix:** Give the Resend `fetch` a bounded `signal: AbortSignal.timeout(...)` (a few seconds) so a hung call becomes a logged send failure. Or answer Stripe first and send the emails in `after()` from `next/server` (see `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`), which keeps the "after the order write" ordering. Requirement lost: None.
**Resolution:**

### F-32 [P3] open - No test covers losing the create race to a delivery that created the order as PAID

**File:** lib/order-sync.test.ts:241
**Found:** 2026-10-10 by /audit independent (scope: current; lens: tests)
**Why it matters:** The spec's exactly-once rule covers two concurrent `checkout.session.completed` deliveries for a paid session. Both find no order. One creates it as `PAID` and returns its id. The other gets `P2002`, reads the order back as `PAID`, and must return `null`. The code is correct today (`canTransition("PAID", "PAID")` is false at `lib/order-sync.ts:107`). The tests cover a lost `updateMany` (`count: 0`) and a lost create followed by a won `PENDING` update, but nothing covers this create-versus-create case. A future change to `canTransition` or to the fall-through after `createOrder` could send the paid emails twice while `pnpm test` stays green.
**Suggested fix:** Add a test in which `order.create` rejects with `P2002`, `order.findUniqueOrThrow` resolves `{ id: "o1", status: "PAID" }`, and `syncCheckoutSession("checkout.session.completed", session())` resolves to `null` without calling `order.updateMany`. Requirement lost: None.
**Resolution:** Re-examined 2026-10-11 by /audit independent (target 0f84d91, fresh subagent): still present, and feature 20 widens it. A paid create with a discount now runs `order.create` and the coupon increment as one batch `$transaction` (`lib/order-sync.ts:87-90`), and the spec's step 4 lists "no increment for ... a lost race". The discount tests cover a lost `updateMany` race but not a lost create race carrying discount metadata, and the test mock resolves batch items with `Promise.all`, so it could not show that the increment rolls back with the failed create. The code reads correctly (Prisma batch transactions are atomic and the `P2002` path returns `null`). Severity stays P3. Status stays `open`. Suggested addition: in the discount block, have `transaction` reject with `P2002` for a paid create with `DISCOUNT` metadata and assert the call resolves to `null` with `updateMany` not called.

### F-33 [P3] open - The status email reads the service's status at send time, not the status the save wrote

**File:** lib/service-notifications.ts:43
**Found:** 2026-10-10 by /audit independent (scope: current; lens: quality)
**Why it matters:** `saveServiceWork` schedules `sendServiceStatusEmail(id, now)` for one specific change, but the sender re-reads `status` from the database when the `after()` callback runs. If a second admin save changes the status again before the first callback reads the row (for example, a quick correction `IN_PROGRESS` -> `NEW`), both emails go out with distinct idempotency keys and both describe the later status, so the customer gets two identical updates and never sees the first. The window is short, because the callback runs right after the response, and the second email is still accurate, so the effect is cosmetic. No test covers it.
**Suggested fix:** Pass the new `status` from `saveServiceWork` (`after(() => sendServiceStatusEmail(id, status, now))`) and build the email from that argument instead of the re-read row. Drop `status` from the `select`. Requirement lost: None.
**Resolution:**

### F-34 [P2] open - Discounted orders list already-discounted line prices and then subtract the discount again, so the rows do not add up on screen

**File:** app/admin/orders/[id]/page.tsx:121
**Found:** 2026-10-11 by /audit independent (scope: current; lens: quality)
**Why it matters:** By the spec's contract, `OrderItem.priceCents` is the unit price paid, so for a discounted order each item row already shows the discounted price and the item totals sum to `totalCents`. The admin order detail then adds a "Subtotal" row of `totalCents + discountCents` (line 125) and a "Discount" row, so the Subtotal is larger than the sum of the item rows directly above it. On the customer account orders page (`app/[lang]/account/orders/page.tsx:83`) the items show "Qty 2 · $9.00 each", then "Discount (CODE) −$2.00", then "Total $18.00", which reads as if the discount was not taken off or the arithmetic is wrong. Subtotal − Discount = Total does hold, so the spec's "subtotal, discount, and total that add up" is met literally and no money is wrong; the problem is that every discounted order presents two inconsistent breakdowns in a financial view, for admins and customers in both languages.
**Suggested fix:** User decision on presentation. Smallest options: label the item price column/line as the price paid (for example "Price paid" / "each, after discount") and phrase the discount row as "Includes discount (CODE) −$X" or "You saved $X" so it is not read as a subtraction from the rows above; or show the list price per line (`priceCents + floor(listPrice × percent / 100)` cannot be recovered exactly, so this would need the list unit price stored on `OrderItem`, which is a schema change). Requirement lost: None for the wording option.
**Resolution:**

### F-35 [P3] unverified - The cart's applied-code live region is display:none until it fills, and focus is lost after a successful Apply

**File:** components/cart/CouponForm.tsx:61
**Found:** 2026-10-11 by /audit independent (scope: current; lens: quality)
**Why it matters:** The spec says the applied state is announced with `role="status"`. The status `div` is kept mounted for that reason (the comment says "Present before any change, so the applied code is announced"), but its `empty:hidden` class sets `display: none` while it has no content, which removes it from the accessibility tree. Several screen reader and browser pairings do not announce content inserted into a live region that was not rendered, so the "CODE · 10% off eligible items" message may be silent. In the same update, the Apply form (input and focused button) unmounts, so keyboard focus drops to the document body after a successful apply. The spec only defines focus for a failed apply and after Remove, so the focus part is not a contract breach. Not exercised in a browser or with a screen reader in this pass.
**Suggested fix:** Confirm during `/check` with a screen reader. If confirmed, keep the `role="status"` wrapper rendered while empty (drop `empty:hidden`, and handle the extra grid gap with a margin on its child instead), and move focus to the Remove button or the status message after a successful apply. Requirement lost: None.
**Resolution:**

### F-36 [P3] open - listHomeProducts has no test, and no test asserts featuredRank stays out of the public select

**File:** lib/catalog.ts:173
**Found:** 2026-10-11 by /audit independent (scope: current; lens: tests)
**Why it matters:** Every other catalog query in `lib/catalog.ts` has a `lib/catalog.test.ts` case asserting its `where`, `orderBy`, and `select`. The new `listHomeProducts` has none. Three feature contracts rest on that query and are unproven by any automated check: only published rows reach the home page (the spec's "giving a position to an unpublished item changes nothing"), rows arrive `createdAt desc, id asc` (the newest-first input order that `selectHomeSections` relies on for ties and for filling open slots), and `featuredRank` is mapped onto the result. The spec also says `featuredRank` must never be added to `publicProductSelect`, but the existing "without private fields" test for `listPublishedProducts` checks only `digitalFile` and `status`, so adding the field there would not fail a test and would expose it through `/api/products` and the listings. The spec's dev-database check for step 3 is manual.
**Suggested fix:** Add a `listHomeProducts` case to `lib/catalog.test.ts` with the existing `findMany` mock that asserts `where: { status: "PUBLISHED" }`, the `orderBy`, `select.featuredRank === true`, and that the result carries `featuredRank` plus localized fields; and add `expect(query.select).not.toHaveProperty("featuredRank")` to the existing `listPublishedProducts` private-fields test. Requirement lost: None.
**Resolution:**

### F-37 [P3] open - A failed site content save drops every edit the admin typed

**File:** actions/admin-site-content.ts:54
**Found:** 2026-10-11 by /audit independent (scope: current; lens: quality)
**Why it matters:** The `unexpected` result carries no `values`, so `SiteContentForm` (`values = failed?.values ?? initial`, line 114) falls back to the last saved row after React resets the form. A transient database error on save therefore wipes up to 24 typed fields and switches with only "Something went wrong. Try again." The pattern matches `actions/admin-coupons.ts`, but this form is much larger, and the spec's "keeps what was typed" promise is only stated for invalid input, so this is a usability gap rather than a contract breach.
**Suggested fix:** Parse before the `try` (or keep `parsed` in scope) and return `values: parsed.values` with the `unexpected` error too, plus one action-test assertion. Requirement lost: None.
**Resolution:**

### F-39 [P3] open - Production with RATE_LIMIT_IP_HEADER unset (or a header the host does not send) silently puts every visitor in one shared bucket

**File:** lib/rate-limit.ts:22
**Found:** 2026-10-11 by /audit independent (scope: current; lens: security)
**Why it matters:** `clientKey` returns `"unknown"` when the setting is unset or the named header is missing, as the spec intends for development. Nothing distinguishes that case in production, so a deploy that forgets the variable, or names a header the host never sets, caps registration at 5 per hour and discount code tries at 10 per 15 minutes for the whole site, and any single anonymous visitor can exhaust them and lock everyone else out; the beacon would drop page views above 120 per minute site-wide. The same applies when `x-forwarded-for` passes through more than one proxy hop (for example a CDN in front of the host), because the rightmost entry is then the CDN's address. The spec deliberately defers the production header choice to `/release`, so this is a deployment-readiness risk rather than a defect in the feature.
**Suggested fix:** Make `/release` (or the deployment checklist) require `RATE_LIMIT_IP_HEADER` and confirm the chosen header is set by the host, cannot be supplied by clients, and identifies the visitor rather than an intermediate proxy. Optionally log one warning when it is unset with `NODE_ENV === "production"`. Requirement lost: None.
**Resolution:**

### F-40 [P3] open - Nothing fails if the browser-test server stops overriding the real email and Stripe keys

**File:** playwright.config.ts:22
**Found:** 2026-10-11 by /audit independent (scope: current; lens: tests)
**Why it matters:** Email-off and fake-Stripe in the test server rest entirely on `APP_ENV` overriding `.env`. `.env` currently holds real Resend values, and Next.js keeps an empty-string process value over `.env` (verified in `@next/env` `processEnv`, and the empty value survives the Windows shell), so the current config is correct and the 20-test run passed. But step 2's Done-when ("no Resend request and no call to `api.stripe.com`") is proved only by reading the code: Playwright ignores the app server's stdout by default, and no test or assertion would fail if `RESEND_API_KEY: ""` or `EMAIL_FROM: ""` were removed. The suite would then send real email for every `@example.test` purchase from the developer's Resend account while still passing. Stripe is safer because the fake checkout page heading would fail the flow, but only after a real test-mode session was created.
**Suggested fix:** Add one cheap guard, for example a check in `playwright.config.ts` (or a small unit test) that `APP_ENV` sets `RESEND_API_KEY`, `EMAIL_FROM`, and every `S3_*` key to `""` and `STRIPE_SECRET_KEY` to an `sk_test_` value with `STRIPE_API_BASE` set. Requirement lost: None.
**Resolution:**

### F-41 [P3] open - The fake Stripe listens on every network interface and can push signed "paid" webhooks into the dev database

**File:** e2e/fake-stripe.ts:252
**Found:** 2026-10-11 by /audit independent (scope: current; lens: security)
**Why it matters:** `listen(PORT)` without a host binds all interfaces. While a browser run is up (or a reused server is left running), anyone on the same network can `POST /v1/checkout/sessions` and then `POST /pay/<id>/complete`, and the fake signs a `checkout.session.completed` event with the test secret and delivers it to the app on 3100, which writes orders to the `DATABASE_URL` database (the developer's dev database). Impact is limited to test-mode data on a developer machine, but binding to loopback costs nothing.
**Suggested fix:** Call `.listen(PORT, "127.0.0.1", ...)` (the health URL and `STRIPE_API_BASE` already use `localhost`; if Node resolves `localhost` to `::1` on some machines, use `127.0.0.1` in those URLs too). Requirement lost: None.
**Resolution:**

### F-44 [P3] open - A network or CORS failure on the bucket PUT shows the connection message, not the spec's "The upload failed. Try again."

**File:** components/admin/ProductFileUpload.tsx:120
**Found:** 2026-10-12 by /audit independent (scope: current; lens: quality)
**Why it matters:** Spec step 3 says "A failed bucket `PUT` (network or CORS) shows 'The upload failed. Try again.'" A CORS rejection or network error makes `fetch(link.url, ...)` reject rather than resolve, so `uploadDirect` never reaches its `if (!put.ok)` branch; the rejection reaches the outer `catch`, which shows "The upload failed. Check your connection and try again." Only a non-2xx bucket answer (for example an expired link or wrong signature) shows the spec's text. The likely launch-day failure, a missing or wrong bucket CORS rule, therefore tells the admin to check their connection, which points away from the real cause. Wording only; no data is affected.
**Suggested fix:** Catch a rejected bucket `fetch` inside `uploadDirect` and return `{ ok: false, code: null }` so it shows "The upload failed. Try again.", or record in the spec that network/CORS failures use the existing connection message. Requirement lost: None.
**Resolution:**

### F-45 [P3] open - Two concurrent forgot-password requests for one account can both leave a working link

**File:** actions/auth.ts:182
**Found:** 2026-10-12 by /audit independent (scope: current; lens: quality, security)
**Why it matters:** The spec says "Only the newest link works: creating a token deletes the user's earlier reset tokens." The action runs `deleteMany({ userId })` and `create` as one batch `$transaction` at Postgres's default READ COMMITTED isolation. When two requests for the same email overlap, each `deleteMany` runs before the other's uncommitted insert is visible, so neither deletes the other's row. Both commit, both emails go out, and both links stay valid for the full hour until one is used (a successful reset then deletes all of the user's tokens). Impact is small: both links go only to the account's own address, the 5-per-hour limit caps how often this can happen, and a reset still revokes every token. It is a gap between the stated contract and the mechanism, not a takeover path. No test covers overlapping requests (the mock runs batch items with `Promise.all`).
**Suggested fix:** Smallest option: accept and record in the spec that "newest only" holds for sequential requests. If the strict rule matters, take a row lock on the user first in an interactive transaction (for example `SELECT ... FROM "User" WHERE id = $1 FOR UPDATE` through `tx.$queryRaw`, then `deleteMany` and `create`), or use `isolationLevel: Serializable` on the transaction and treat a serialization failure like the existing `unexpected` path. Requirement lost: None.
**Resolution:**

### F-46 [P3] open - The two new action catch blocks log the raw error object, which the project already treats as unsafe for Prisma errors

**File:** actions/auth.ts:199
**Found:** 2026-10-12 by /audit independent (scope: current; lens: security)
**Why it matters:** The spec's Notes say "Never log the token, its hash, the email address, or the URL." `requestPasswordReset` (line 199) and `resetPassword` (line 258) both call `console.error(label, error)` with the raw error. The project already recorded that a Prisma error message can repeat the query's arguments (`actions/onboarding.ts:38` `errorLabel`, and finding F-26). The failing calls here carry exactly the forbidden values: `user.findUnique({ where: { email } })` and `passwordResetToken.create({ data: { tokenHash, ... } })` in the request action, and `findUnique`/`deleteMany({ where: { tokenHash } })` plus `user.update({ data: { passwordHash } })` in the reset action. Reachability is low: inputs are validated before every query, so no ordinary input is known to trigger an argument-echoing error, and connection errors (the realistic failure) carry no arguments. Both action tests use `new Error("connection lost")`, so they cannot catch a leak. This follows the existing `register`/`signIn` logging pattern, so it is drift from the spec's explicit rule rather than a demonstrated leak.
**Suggested fix:** Log the error name and Prisma code only in these two catch blocks, as `actions/onboarding.ts` does (move `errorLabel` to a shared lib module or copy its three lines), and change one action test to throw an error whose message contains the email or token hash and assert the log does not contain it. Requirement lost: None.
**Resolution:**
