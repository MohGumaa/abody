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
**Resolution:**

### F-02 [P3] open - Seed upsert overwrites existing rows and has no development-only guard

**File:** prisma/seed.ts:69
**Found:** 2026-10-02 by /audit (scope: current; lens: security, quality)
**Why it matters:** `update: fields` rewrites every column (price, status, `digitalFile`, `createdAt`) of any row whose slug matches a seed slug, and `pnpm db:seed` runs against whatever `DATABASE_URL` points at. The spec says the seed is for development databases only, but nothing enforces that. Once admin editing exists (features 12 and 13), a seed run against a shared or production database would silently revert edited products, republish or unpublish them, and insert published placeholder products with fake file keys. It does not delete rows, so the spec's explicit rule holds; the gap is the overwrite.
**Suggested fix:** Smallest option: exit early from `main()` when `process.env.NODE_ENV === "production"`, with a one-line message. Alternatively change `update: fields` to `update: {}` so the seed only creates missing rows. Both keep "running the seed twice leaves exactly four rows".
**Resolution:**

### F-03 [P3] unverified - A slug containing a NUL byte may return 500 instead of 404

**File:** app/api/products/[slug]/route.ts:12
**Found:** 2026-10-02 by /audit (scope: current; lens: security)
**Why it matters:** The route passes the decoded path segment to the database without checking it against the documented slug format (lowercase letters, digits, single hyphens). PostgreSQL rejects a 0x00 byte in a text parameter, so `GET /api/products/%00` would likely throw inside `getPublishedProductBySlug`, be logged as a server error, and return 500 `internal_error` where the contract says an unknown slug is a 404. The response stays generic, so nothing leaks; the impact is a wrong status code and anonymous log noise. Not confirmed: the reviewer may not start a server, and Next.js may reject the segment before the handler runs. Missing validation: one request against a running server with the database reachable.
**Suggested fix:** If confirmed, return the existing 404 `not_found` before querying when the slug does not match `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, and add one unit test for it.
**Resolution:**
