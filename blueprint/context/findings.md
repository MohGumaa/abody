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

### F-04 [P3] open - publicImageSrc accepts a tab or newline before a second slash, which browsers resolve as protocol-relative

**File:** lib/catalog.ts:67
**Found:** 2026-10-02 by /audit independent (scope: current; lens: security, tests)
**Why it matters:** The spec's image rule allows a root-relative path that "starts with one `/`, not `//`". The check `/^\/[/\\]/` only inspects the second character, but URL parsers strip ASCII tab, LF, and CR before resolving, so a stored value such as `"/\t/host.example/a.png"` passes as local and the browser loads it from `host.example`. Confirmed with Node's WHATWG `URL`: both the tab and the newline form resolve to the external host. Impact is low: the same rule already permits any absolute `https:` host, the value is only used as an `img` `src`, and nothing but the seed writes `image` today, so this is a rule and test gap rather than a new exposure. It becomes reachable when admin editing ships (features 12 and 13).
**Suggested fix:** In `publicImageSrc`, return `null` when the value contains an ASCII tab, LF, or CR (for example `/[\t\n\r]/.test(image)`) before the prefix checks, and add `"/\t/evil.example.com/a.png"` and `"/\n/evil.example.com/a.png"` to the "returns null for anything else" test list in `lib/catalog.test.ts`.
**Resolution:** Re-examined 2026-10-02 by /audit independent (target 9954661). Still present and unrepaired: `publicImageSrc` is unchanged by this delta and the check now sits at `lib/catalog.ts:73`. Status stays `open`.

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

### F-12 [P3] open - lib/session.ts does not carry the server-only guard the spec names

**File:** lib/session.ts:1
**Found:** 2026-10-05 by /audit independent (scope: current; lens: quality)
**Why it matters:** Spec step 2 defines `lib/session.ts` as `server-only`, and Files / areas says to add the `server-only` package only if its import fails. The module has no `import "server-only"`; it relies on a "Server code only" comment (line 14). The practical exposure is low today: the module imports `next/headers` and `@/lib/db`, so a client import would already fail the build. The gap is contract drift: the guard the spec asked for, which gives a clear error if a later client component imports session helpers, is missing.
**Suggested fix:** Add `import "server-only";` as the first line of `lib/session.ts` and confirm `pnpm build` and `pnpm test` still pass (the Vitest suites mock `@/lib/session`, so they do not load it). Add the `server-only` package with pnpm only if the import does not resolve. Requirement lost: None.
**Resolution:** Re-examined 2026-10-05 by /audit independent (target 2bc0ef0, fresh subagent). Still present and unrepaired: `lib/session.ts` starts with `import { cookies } from "next/headers";` and has no `server-only` import (the comment is at line 14). The file is unchanged since this finding was raised. Status stays `open`. Re-checked 2026-10-05 by a second /audit independent pass (target 2bc0ef0, fresh subagent): `lib/session.ts:1` is still `import { cookies } from "next/headers";` with no `server-only` import; unchanged. Status stays `open`.

### F-13 [P3] open - Password toggle changes its label and also sets aria-pressed, so screen readers hear "Hide password, pressed" while the password is shown

**File:** components/auth/AuthForm.tsx:250
**Found:** 2026-10-05 by /audit independent (scope: current; lens: quality)
**Why it matters:** The show/hide button swaps `aria-label` between "Show password" and "Hide password" and also sets `aria-pressed={visible}` (lines 250-251). A toggle button's name has to stay fixed when its pressed state changes (WAI-ARIA APG button pattern). Otherwise the two signals contradict each other: when the password is visible, assistive tech announces "Hide password, toggle button, pressed", which suggests that hiding is active. Arabic has the same problem. Mouse and keyboard behavior is correct. The spec's step 10 asks for both the translated Show/Hide label and `aria-pressed`, so the code follows the spec. The contradiction comes from the contract itself.
**Suggested fix:** User decision, and the spec changes with it. Either keep `aria-pressed` with a fixed label ("Show password" / "إظهار كلمة المرور"), or keep the switching label and drop `aria-pressed`. Both are one-line changes in `PasswordInput`. Requirement lost: None, apart from the spec wording.
**Resolution:**

