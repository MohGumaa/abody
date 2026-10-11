# Feature: Rate Limiting

**From build-plan:** feature 24b
**Build attempt:** 1
**Branch:** feature/rate-limiting
**Status:** verified

## Goal

Add database-backed limits to the three anonymous public writes: registration,
discount code entry, and the analytics beacon. Each is keyed on the visitor's IP
address, which is read from one header chosen by an environment setting and
stored only as a hash. The beacon also gets a body limit that counts real bytes,
which closes finding F-38. The existing sign-in limiter stays as it is.

## In scope

- One `RateLimit` table and a `lib/rate-limit.ts` module that does an atomic
  fixed-window count in Postgres.
- Client identity from `RATE_LIMIT_IP_HEADER`. With `x-forwarded-for` the app
  takes the rightmost entry; with any other header it takes the whole value.
  When the setting is unset (local dev) or the header is missing, every visitor
  shares one `unknown` bucket.
- Limits, as decided at spec review:
  - Registration: 5 per IP per hour.
  - Discount code apply: 10 per IP per 15 minutes.
  - Analytics beacon: 120 per IP per minute.
- Registration and discount code apply return a `rate_limited` error that is
  shown in English and Arabic. A blocked beacon request gets a 429, which the
  tracker already ignores.
- The beacon reads its body as a stream and stops once it passes 1024 bytes,
  whether or not a `Content-Length` header was sent (F-38).
- Document `RATE_LIMIT_IP_HEADER` in `.env.example`.

## Out of scope

- The sign-in and current-password limiter (`reserveLoginAttempt` in
  `lib/auth.ts`). It stays in memory and unchanged.
- Limits on any other route or action: checkout, downloads, onboarding, admin,
  the catalog API, and the Stripe webhook.
- Security headers (24c), CAPTCHA, bot detection, IP allow or block lists, and
  sliding-window or token-bucket algorithms.
- Picking the deployment host or setting the header value in production.
  `/release` owns that.
- An admin view of limit state.

## Build loop

`workflow.stepReview` is `feature` and `checkpointCommits` is `disabled`.
Implement all steps in order, run each step's checks, and present one review
packet after the last step. Do not create checkpoint commits. `/complete` makes
the final feature commit.

## Build steps

1. [x] **Limiter table and module.**
   - Add a `RateLimit` model to `prisma/schema.prisma` (see Data / contracts)
     and create the migration with `pnpm db:migrate --name add_rate_limits`.
   - Add `lib/rate-limit.ts` with `RATE_LIMITS`, `clientKey(headers)`, and
     `reserveRateLimit(action, client, now?)` exactly as described under
     Data / contracts. If `lib/session.ts` marks itself server-only (the 24a
     guard), use the same marker here.
   - Add `RATE_LIMIT_IP_HEADER` to `.env.example`, commented out, with a short
     note: unset means one shared bucket (development); set it to the header
     your host or proxy sets (for example `x-real-ip`, or `x-forwarded-for`, of
     which only the rightmost entry is used); never pick a header that clients
     can set directly.
   - Add `lib/rate-limit.test.ts` with `@/lib/db` mocked. Cover the
     `clientKey` cases and the `reserveRateLimit` cases listed under Testing.
   - **Done when:** `pnpm test` passes the new tests, `pnpm exec prisma migrate
     status` reports the new migration applied, and `pnpm build` passes.

2. [x] **Registration and discount code limits.**
   - `actions/auth.ts` `register`: once the form parses, inside the existing
     `try` and before `hashPassword` or `db.user.create`, call
     `reserveRateLimit("register", clientKey(await headers()))`. If it is
     blocked, return `{ success: false, error: "rate_limited", values: { name,
     email } }`. Invalid forms do not use up the limit. A limiter failure
     falls through to the existing `unexpected` result. Read the
     `next/headers` guide in `node_modules/next/dist/docs/` before using
     `headers()`.
   - `actions/coupon.ts` `applyCoupon`: after the `typeof raw` check, as the
     first call inside the `try`, call `reserveRateLimit("coupon", ...)`. Every
     apply attempt counts, empty-cart attempts included. Add `"rate_limited"`
     to `CouponApplyError` and return it when blocked, without setting a
     cookie. `removeCoupon` is not limited.
   - Add `cart.coupon.errors.rate_limited` to `lib/i18n/dictionaries/en.ts`
     ("Too many tries. Wait a few minutes and try again.") and `ar.ts`
     ("محاولات كثيرة جدًا. انتظر بضع دقائق ثم حاول مرة أخرى."). Confirm that
     the cart page passes it through to `CouponForm` (its `errors` type now
     requires it), and that the register form already shows the existing
     `auth.errors.rate_limited` text. Add a passthrough only if one is missing.
   - Update `actions/auth.test.ts` and `actions/coupon.test.ts`: mock
     `@/lib/rate-limit` (allowed by default) and `next/headers`, then add the
     cases listed under Testing.
   - **Done when:** `pnpm test` and `pnpm build` pass. Manually, with
     `RATE_LIMIT_IP_HEADER` unset: applying a code an 11th time within 15
     minutes shows the new message in the coupon field's alert, with focus
     back on the field, in `/en/cart` and `/ar/cart`.

3. [x] **Beacon body limit and rate limit (F-38).**
   - In `app/api/analytics/route.ts`, keep the early `Content-Length` reject.
     Replace `request.text()` with a local reader that pulls `request.body`
     chunks, counts bytes, cancels the reader and returns `invalid_path` as
     soon as the total passes 1024, and then decodes the bytes with
     `new TextDecoder("utf-8", { fatal: true })`. Invalid UTF-8 or a missing
     body is `invalid_path`.
   - After `parseTrackedPath` accepts the path and before `recordPageView`,
     call `reserveRateLimit("analytics", clientKey(request.headers))`. If it is
     blocked, return `apiError(429, "rate_limited", "Too many requests.")`.
     Invalid requests never reach the limiter, so they write nothing.
   - Extend `app/api/analytics/route.test.ts` with the cases listed under
     Testing.
   - **Done when:** `pnpm test`, `pnpm build`, and `pnpm lint` pass, and the
     store still records page views in the running app (one row per
     navigation, as before).

## Files / areas

- `prisma/schema.prisma`, `prisma/migrations/<timestamp>_add_rate_limits/`
- `lib/rate-limit.ts`, `lib/rate-limit.test.ts` (new)
- `actions/auth.ts`, `actions/auth.test.ts`
- `actions/coupon.ts`, `actions/coupon.test.ts`
- `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/ar.ts`
- `components/cart/CouponForm.tsx` and the cart page, only if the error
  passthrough needs a change
- `app/api/analytics/route.ts`, `app/api/analytics/route.test.ts`
- `.env.example`

## Data / contracts

**Table:**

```prisma
// Fixed-window counters for anonymous public writes (feature 24b). The key is
// a hash; no IP address or other visitor value is stored.
model RateLimit {
  // SHA-256 hex of "<action>:<client>".
  key     String   @id
  count   Int
  resetAt DateTime

  @@index([resetAt])
}
```

**`RATE_LIMITS`:** `{ register: { max: 5, windowMs: 3_600_000 }, coupon: { max: 10, windowMs: 900_000 }, analytics: { max: 120, windowMs: 60_000 } }`.
`action` is typed as `keyof typeof RATE_LIMITS`.

**`clientKey(headers: Headers): string`:**
- Reads `process.env.RATE_LIMIT_IP_HEADER` at call time, trimmed and
  lowercased. Unset or blank returns `"unknown"`.
- For `x-forwarded-for`, returns the last non-empty comma-separated entry,
  trimmed. For any other header, returns the whole trimmed value.
- A missing or empty header value returns `"unknown"`.

**`reserveRateLimit(action, client, now = new Date()): Promise<boolean>`:**
- `key = sha256hex(`${action}:${client}`)`, and
  `newReset = now + windowMs`.
- One atomic statement through `db.$queryRaw` (a tagged template, so values
  are always parameters):
  `INSERT INTO "RateLimit" (key, count, "resetAt") VALUES (key, 1, newReset)
  ON CONFLICT (key) DO UPDATE SET count = CASE WHEN "RateLimit"."resetAt" <=
  now THEN 1 ELSE "RateLimit".count + 1 END, "resetAt" = CASE WHEN
  "RateLimit"."resetAt" <= now THEN newReset ELSE "RateLimit"."resetAt" END
  RETURNING count`.
  This runs as one row update, so parallel requests cannot all pass the check.
- Returns `count <= max`. Blocked requests still increment the count. The
  window is fixed and does not slide.
- When the returned count is `1` (a new window started), it prunes old rows
  with `db.rateLimit.deleteMany({ where: { resetAt: { lt: now } } })`.
- It throws on database errors, and callers handle that the way they handle
  any other unexpected error.

**Results:**
- `register` returns `{ success: false, error: "rate_limited", values: { name,
  email } }`. The password is never echoed.
- `applyCoupon` returns `{ success: false, error: "rate_limited" }`.
- The beacon returns `429 {"error":{"code":"rate_limited","message":"Too many requests."}}`.
  An oversized body, whether declared or streamed, or a body that is not
  valid UTF-8, returns the existing `400 invalid_path` shape.

## Testing

`pnpm test` (Vitest) with mocked `@/lib/db`. The SQL statement is checked
against the dev database by the step 1 migration and the step 2 manual check,
not by unit tests.

- `clientKey`: unset or blank setting returns `unknown`; `x-real-ip` returns
  its value; `x-forwarded-for: "1.1.1.1, 2.2.2.2"` returns `2.2.2.2`; a setting
  with surrounding spaces or upper case still works; a missing header returns
  `unknown`.
- `reserveRateLimit`: count at `max` is allowed and `max + 1` is blocked for
  each action; the key passed to the query is 64-character hex and no query
  value contains the raw client string; `resetAt` is `now + windowMs`; a count
  of `1` prunes with `lt: now` and a higher count does not; a query rejection
  propagates.
- `register`: blocked returns `rate_limited` with name and email and does not
  call `user.create` or `createSession`; it is called with `"register"` only
  after a valid parse; a limiter rejection returns `unexpected`.
- `applyCoupon`: blocked returns `rate_limited` and sets no cookie; non-string
  input never reaches the limiter.
- Beacon: a blocked request returns 429 with the contract body and does not
  record; invalid bodies never call the limiter; a body of about 600 two-byte
  characters (under 1024 UTF-16 units, over 1024 bytes) returns 400; a streamed
  body with no `Content-Length` that would grow past 1024 bytes returns 400,
  and the test stream shows reading stopped early (pulls are bounded); invalid
  UTF-8 returns 400; all existing cases still pass.

No browser harness exists, so the coupon message check in step 2 is manual.

## Notes for the AI

- Leave `reserveLoginAttempt` and its callers alone.
- Never log or store the raw IP or header value. Only the hash reaches the
  database.
- Do not add a library. Use `node:crypto` `createHash` and the web streams
  `request.body` reader.
- In tests, a `Request` with a `ReadableStream` body needs `duplex: "half"`
  in Node.
- F-38 is fixed by step 3. Leave its resolution for the `/audit` or
  `/complete` bookkeeping; do not edit `findings.md` during implementation.
- Each limit lives as one constant in `RATE_LIMITS`. Do not add an
  environment variable or other config for the numbers.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":11311,"specSha256":"76301da718dfeaa004d7968767b4dd2f0f13038fb7117470cde16d50599cbeb0","branch":"refs/heads/feature/rate-limiting","head":"df9c00ea5c6229c9dd88da49b1e577ce35b52988","baseRef":"refs/heads/main","baseCommit":"5d74ea2e7045e0779eeed3ff4f0bfb0874ae3e32","sourceTree":"7597703497f03eec97e038a35d0f2e972cc99b7d","absentOptional":[]} -->

## Findings

### 24b/F-38 [P3] closed - The analytics beacon buffers the whole request body before enforcing the 1 KB limit when Content-Length is absent

**File:** app/api/analytics/route.ts:20
**Found:** 2026-10-11 by /audit independent (scope: current; lens: security, performance)
**Why it matters:** The unauthenticated `POST /api/analytics` only rejects early when a `Content-Length` header is declared over 1024. A chunked request with no `Content-Length` goes straight to `await request.text()`, which reads the entire body into memory before the `text.length > BODY_MAX_BYTES` check, so the spec's "1 KB max" bound does not limit how much the server reads. `text.length` also counts UTF-16 code units rather than bytes, so a multibyte body can exceed 1 KB of bytes and still pass. Real impact is limited: hosting platforms cap request bodies, any accepted path is still capped at 200 characters by `parseTrackedPath`, and the spec leaves rate limiting and bot filtering to feature 24. Not exercised against a running server in this pass.
**Suggested fix:** Read `request.body` with a reader and stop with `invalid_path` once the received byte count passes 1024 (then decode with `TextDecoder`), or defer to feature 24's hardening and note it there. Requirement lost: None.
**Resolution:** Closed 2026-10-11 by /audit independent (feature 24b, target df9c00e). `readBody` in app/api/analytics/route.ts:14-41 now pulls `request.body` chunks, counts `byteLength`, cancels the reader and returns `invalid_path` as soon as the total passes 1024, then decodes with a fatal `TextDecoder`, so the bound is real bytes and holds with no `Content-Length`. The early `Content-Length` reject is kept. Tests cover a 600-character two-byte body (400), an endless stream without `Content-Length` that stops after fewer than 10 pulls (400), and invalid UTF-8 (400); `pnpm test` passes. No new defect found in the repair.


## Independent review

**Status:** passed
**Target commit:** df9c00ea5c6229c9dd88da49b1e577ce35b52988
**Base commit:** 5d74ea2e7045e0779eeed3ff4f0bfb0874ae3e32
**Base ref:** main
**Spec hash:** 76301da718dfeaa004d7968767b4dd2f0f13038fb7117470cde16d50599cbeb0
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-11T15:55:00+03:00
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-11T16:01:19+04:00
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `5d74ea2e7045e0779eeed3ff4f0bfb0874ae3e32..df9c00ea5c6229c9dd88da49b1e577ce35b52988` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (HEAD, merge base, and spec hash match the request; only review.md differs from the target)
- `pnpm test`: pass (67 files, 1172 tests)
- `pnpm lint`: pass
- `pnpm build`: pass (working tree unchanged afterwards)

### Evidence

- Reviewed all 15 changed paths in the base..target delta (spec, schema, migration, lib/rate-limit.ts and tests, actions/auth.ts and coupon.ts with tests, app/api/analytics/route.ts with tests, api-error, en/ar dictionaries, .env.example).
- lib/rate-limit.ts:46-54: one `INSERT ... ON CONFLICT ("key") DO UPDATE ... RETURNING "count"` through the `$queryRaw` tagged template, so key, resetAt, and now are bound parameters; table and quoted columns match migration 20261011114637_add_rate_limits and the Prisma model. Expired windows (`resetAt <= now`) restart at 1, otherwise count + 1; blocked requests still count; prune only when count is 1.
- @prisma/adapter-pg 7.10.0 `mapArg` formats Date parameters as UTC strings without offset, matching how the ORM writes `TIMESTAMP(3)` and the ORM `deleteMany` prune, so raw and ORM comparisons agree.
- Only the SHA-256 of `<action>:<client>` reaches the database; no raw IP is logged or stored.
- actions/auth.ts:65 limits after a valid parse and before hashing; limiter errors fall to `unexpected` (not `email_taken`, which requires P2002). actions/coupon.ts:35 limits after the `typeof` check, before cookies or lookup; blocked returns `rate_limited` with no cookie. Typed `errors` records force the en/ar passthrough, confirmed by `pnpm build`.
- app/api/analytics/route.ts:14-41 streams the body with a byte count, cancels past 1024 bytes, and decodes with a fatal TextDecoder; the limiter (line 65) runs only after `parseTrackedPath` accepts the path.
- Tests assert the spec's cases, including a bounded-pull stream test (fewer than 10 pulls), byte-versus-character length, a 64-character hex key with no raw client value among the query parameters, and limiter-not-called on invalid input.

### Findings

- F-38 [P3] closed: beacon body limit now counts streamed bytes (repair verified).
- F-39 [P3] open: an unset or wrong `RATE_LIMIT_IP_HEADER` in production puts every visitor in one shared bucket (deployment-readiness; spec defers to `/release`).

### Remaining risk

- The raw upsert SQL is only exercised with a mocked `@/lib/db`; it was not run against Postgres in this review (no database command was run, per the reviewer's allowed commands). `pnpm exec prisma migrate status` and the spec's manual 11th-coupon-attempt check were not re-run here.
- `/check` was not required and was not run; no dev server or browser flow was exercised, so the en/ar coupon message and focus behavior are unverified at runtime.
- Whether Next.js route handlers stream `request.body` unbuffered on the eventual host was not verified at runtime.
- Production client identity depends on the `/release` choice of `RATE_LIMIT_IP_HEADER` (F-39), including trust in that header and multi-proxy `x-forwarded-for` chains.
- The fixed window allows up to twice the limit across a window boundary, as the spec accepts.
- The dashboard activity state was not written, because this reviewer was restricted to the two evidence files.
