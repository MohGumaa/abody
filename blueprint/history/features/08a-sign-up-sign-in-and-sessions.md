# Feature: Sign-up, Sign-in, and Sessions

**From build-plan:** feature 8a
**Build attempt:** 1
**Branch:** feature/sign-up-sign-in-and-sessions
**Status:** verified

## Goal

Customers can create an account with name, email, and password, sign in, and
sign out, in English and Arabic. A signed-in customer reaches a protected
`/<lang>/account` page, and orders they place while signed in belong to their
account. Guest browsing and guest checkout keep working unchanged.

## Design reference

`prototypes/login.html` (sign in and create account panel: art column, tabs,
fields, primary button, switch line) and the header "Sign in" ghost button in
`prototypes/index.html`. Reuse tokens already ported to `app/globals.css`; never
import from `prototypes/`. Arabic mirrors the layout. The mockup's "Forgot
password?" link is omitted (reset waits for email, feature 19).

## In scope

Decisions made before this spec (user-approved):

- **Auth approach:** built-in database sessions following the Next.js 16
  authentication guide. No Clerk, no Auth.js, no new runtime dependency.
  Passwords hashed with `node:crypto` scrypt.
- **Guest orders:** checkout stays open to guests. Orders placed while signed
  in get `userId`. Guest orders are never attached by email (unverified email
  would let anyone claim another buyer's downloads).
- **Split:** account settings (edit name/email, change password, sign out other
  sessions) are 8b.

Behavior:

1. **Data.** `User` and `Session` tables, and a foreign key from the existing
   `Order.userId` to `User`.
2. **Register** at `/<lang>/register`: name, email, password, confirm password.
   On success the user is created as `CUSTOMER`, a session starts, and the
   browser goes to the validated `next` path or `/<lang>/account`.
3. **Sign in** at `/<lang>/login`: email and password. Success starts a new
   session and redirects like register. Wrong email or wrong password give one
   generic message ("Email or password is incorrect"). Five failed attempts for
   one email inside 15 minutes block further attempts for that email until the
   window ends ("Too many attempts. Try again in a few minutes.").
4. **Login and register share one panel** with two tabs rendered as links
   (`aria-current="page"` on the active one) between `/<lang>/login` and
   `/<lang>/register`, carrying the `next` parameter. Both pages redirect an
   already signed-in visitor to the validated `next` or `/<lang>/account`.
5. **Sign out** button on `/<lang>/account`: deletes the session row and cookie,
   then redirects to `/<lang>`.
6. **Protected account page** `/<lang>/account`: server-checked. Signed out (no
   cookie, unknown, or expired session) redirects to
   `/<lang>/login?next=/<lang>/account`. Signed in shows a heading, the
   customer's name and email, and the sign out button. Feature 9 replaces the
   body with the dashboard.
7. **Header:** a "Sign in" link (user icon, label hidden below 600px like the
   cart label) to `/<lang>/login` when no session cookie is present, or an
   "Account" link to `/<lang>/account` when one is. This check is optimistic
   (cookie presence only, no database query); the account page does the real
   check.
8. **Checkout link:** when a signed-in customer starts checkout, the Stripe
   session gets `client_reference_id = user.id` and `customer_email = user.email`.
   The webhook sets `Order.userId` from `client_reference_id` only when a `User`
   with that id exists; otherwise `null`. Guests are unchanged.
9. All new text in `en` and `ar` dictionaries. Login, register, and account
   pages are `noindex` and are not added to the sitemap.

## Out of scope

- Forgot-password / reset and email verification (feature 19 brings email).
- Editing name or email, changing password, signing out other sessions (8b).
- Customer dashboard content: orders, downloads, services, profile (feature 9).
- Attaching existing or future guest orders by email.
- Admin role checks, admin pages, creating admins (feature 12). The `role`
  column exists; registration always writes `CUSTOMER`.
- `User.stripeCustomerId` (added when a feature uses it).
- Moving or merging the cart at sign-in: the cart cookie is untouched, so it
  simply persists across sign-in and sign-out.
- Proxy-level route protection, social login, remember-me, sliding session
  renewal, IP-based or distributed rate limiting (feature 24).
- Footer account links (feature 9 pages).

## Build loop

`workflow.stepReview` is `feature`: implement every step below, keeping each
step's Done when true, then present one review packet for the whole feature.
`workflow.checkpointCommits` is `disabled`: no commits per step. `/complete`
creates the feature commit.

## Build steps

- [x] **1. Schema and migration.** Add `Role` enum, `User`, `Session`, and the
  `Order.user` relation (see Data / contracts). Run `pnpm db:migrate --name
  add_users_and_sessions`; update the stale "Linked to User in feature 8"
  comment on `Order.userId`.
  Done when: the migration applies on the dev database,
  `pnpm exec prisma migrate status` is in sync, existing orders keep
  `userId = null`, and `pnpm build` passes.

- [x] **2. Password and session logic.** `lib/password.ts` (scrypt hash and
  verify, constant-time compare, `PASSWORD_MAX_LENGTH`) and `lib/session.ts`
  (`server-only`: create token, hash token, `createSession`,
  `getCurrentUser` wrapped in React `cache`, `deleteCurrentSession`, cookie
  options). Pure helpers live where Vitest can import them without `next/*`
  (for example `lib/session-token.ts`).
  Done when: unit tests cover hash/verify round trip, wrong password, malformed
  stored hash, unique salts, token hashing, and expiry decisions, and
  `pnpm test` is green.

- [x] **3. Validation, next-path, and rate limit.** `lib/auth.ts` with
  `parseRegisterForm`, `parseLoginForm`, `normalizeEmail`, `safeNextPath`, and a
  small in-memory failed-login limiter (`lib/rate-limit.ts` or inside
  `lib/auth.ts`).
  Done when: unit tests cover every field rule and error code, email
  normalization, `safeNextPath` rejecting `//evil.com`, `/\evil`,
  `https://…`, unprefixed and other-language paths, and the limiter blocking
  the 6th failure and resetting after 15 minutes (`vi.useFakeTimers()`);
  `pnpm test` green.

- [x] **4. Server Actions.** `actions/auth.ts`: `register`, `signIn`, `signOut`
  returning `{ success: false, error, fieldErrors?, values? }` on failure and
  redirecting on success (redirect outside try/catch, as in
  `actions/checkout.ts`).
  Done when: `actions/auth.test.ts` (mocked `db`, `next/headers`,
  `next/navigation`) covers register success, duplicate email (including a
  concurrent unique violation), invalid input, sign-in success, unknown email,
  wrong password, rate-limited email, sign out, and that `next` is passed
  through `safeNextPath`; `pnpm test` green.

- [x] **5. Login and register pages.** `app/[lang]/login/page.tsx`,
  `app/[lang]/register/page.tsx`, a shared `components/auth/` panel and client
  form using `useActionState`, dictionary text in `en.ts` and `ar.ts`.
  Done when: both pages render in `/en` and `/ar` (RTL mirrored, Tajawal),
  match the mockup panel, show field and form errors accessibly, redirect a
  signed-in visitor, and `pnpm build` and `pnpm lint` pass. Screenshot evidence
  when a browser is available.

- [x] **6. Account page and header link.** `app/[lang]/account/page.tsx` with
  the server check and sign out form; Sign in/Account link in
  `components/layout/SiteHeader.tsx`.
  Done when: signed out `/en/account` redirects to
  `/en/login?next=/en/account`; after sign in it shows name and email; sign out
  returns to `/en` and the header shows Sign in again; same in `/ar`; build and
  lint pass.

- [x] **7. Link signed-in checkout orders.** Add the customer fields in
  `actions/checkout.ts` (through a tested helper in `lib/checkout.ts`) and map
  `client_reference_id` to `userId` in `lib/order-sync.ts`.
  Done when: tests cover the helper (signed in vs guest) and order sync
  (existing user id → `userId`, missing user or no reference → `null`);
  `pnpm test`, `pnpm build`, and `pnpm lint` pass.

- [x] **8. Repair F-10: reserve sign-in attempts before awaiting.** Replace the
  check-then-record limiter with one synchronous `reserveLoginAttempt(email)` in
  `lib/auth.ts` that refuses when the window is full and otherwise counts the
  attempt; success still clears the email. `signIn` calls it before the first
  `await`.
  Done when: `lib/auth.test.ts` covers reserve and reset, and
  `actions/auth.test.ts` fires six or more parallel `signIn` calls with the
  right password missing and sees at most five lookups and the rest
  `rate_limited`; `pnpm test` green.

- [x] **9. Repair F-11: cap the sign-in password at 128 characters.**
  `parseLoginForm` returns `password_too_long` for a longer password, before
  any lookup or hash.
  Done when: `lib/auth.test.ts` covers a 129-character sign-in password and
  128 still passes; `pnpm test` green.

- [x] **10. Auth panel design update (user request after review).** Replace
  the solid blue art column with a photo of a person shopping online on a
  laptop (`public/auth/shopping-online.jpg`, Unsplash photo
  `photo-1563013544-824ae1b704d3`, Unsplash License, downloaded 2026-10-05),
  covered by a dark gradient so the heading, text, and the three cards stay
  readable on top. The image is decorative (`alt=""`) and still hidden below
  860px. Each input gets a leading icon (name: user, email: mail, password:
  lock; mirrored to the inline start in Arabic). Each password field gets a
  show/hide button (`type="button"`, translated `aria-label` "Show password" /
  "Hide password", `aria-pressed`, `aria-controls` the input) that toggles the
  input between `password` and `text` without submitting or losing the value.
  Done when: login and register render with the photo, icons, and toggles in
  `/en` and `/ar`; the toggle works by mouse and keyboard; `pnpm build` and
  `pnpm lint` pass.

## Files / areas

- `prisma/schema.prisma`, `prisma/migrations/<new>_add_users_and_sessions/`
- `lib/password.ts`, `lib/session.ts`, `lib/session-token.ts` (or equivalent
  pure module), `lib/auth.ts`, optional `lib/rate-limit.ts`, with `*.test.ts`
- `actions/auth.ts`, `actions/auth.test.ts`
- `app/[lang]/login/page.tsx`, `app/[lang]/register/page.tsx`,
  `app/[lang]/account/page.tsx`
- `components/auth/` (panel, form)
- `components/layout/SiteHeader.tsx`, `components/icons.tsx` (user icon if
  missing)
- `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/ar.ts`
- `actions/checkout.ts`, `lib/checkout.ts`, `lib/checkout.test.ts`
- `lib/order-sync.ts`, `lib/order-sync.test.ts`
- `package.json` only if `server-only` is not already resolvable (it ships with
  Next.js; add the package only if the import fails)

## Data / contracts

Prisma (cuid ids, matching existing models):

```prisma
enum Role {
  CUSTOMER
  ADMIN
}

model User {
  id           String    @id @default(cuid())
  name         String
  email        String    @unique // trimmed, lowercased before every write and lookup
  passwordHash String    // "scrypt$<N>$<r>$<p>$<salt b64url>$<hash b64url>"
  role         Role      @default(CUSTOMER)
  sessions     Session[]
  orders       Order[]
  createdAt    DateTime  @default(now())
}

model Session {
  id        String   @id @default(cuid())
  tokenHash String   @unique // SHA-256 hex of the cookie token; the raw token is never stored
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
}

// Order: add
//   user User? @relation(fields: [userId], references: [id], onDelete: SetNull)
```

Passwords: `crypto.scrypt` with a 16-byte random salt, 64-byte key, parameters
recorded in the stored string so they can change later. Verify with
`crypto.timingSafeEqual`. A malformed stored hash verifies as false. When the
email is unknown, still run one verify against a fixed dummy hash so response
time does not reveal whether the account exists.

Sessions: token = 32 random bytes, base64url. Cookie name `session`, value =
raw token, `httpOnly`, `secure` when `NODE_ENV === "production"`,
`sameSite: "lax"`, `path: "/"`, `expires` = session expiry. Lifetime 30 days,
fixed (no renewal). Sign in and register always create a new session. Lookup:
hash the cookie token, find by `tokenHash` with the user's `id`, `name`,
`email`, `role`; an expired row is deleted and treated as signed out. Sign out
deletes the row by `tokenHash` and the cookie. `getCurrentUser()` never returns
`passwordHash`.

Validation (server, on `FormData`; all values must be strings):

| Field | Rule | Error code |
| --- | --- | --- |
| name | trimmed, 1-100 chars | `name_required`, `name_too_long` |
| email | trimmed, lowercased, ≤254 chars, one `@` with non-empty local part and a dotted domain, no spaces | `email_invalid` |
| password (register) | 8-128 chars, not trimmed | `password_too_short`, `password_too_long` |
| confirm (register) | equals password | `password_mismatch` |
| password (login) | non-empty, ≤128 chars | `password_required` / generic |
| lang | `isLocale` | `invalid_input` |

Action results: `{ success: false, error: "invalid_input" | "email_taken" |
"invalid_credentials" | "rate_limited" | "unexpected", fieldErrors?:
Partial<Record<field, code>>, values?: { name?, email? } }`. Success redirects
and returns nothing. Passwords are never echoed back. A Prisma unique violation
on `User.email` maps to `email_taken`.

`next` parameter: accepted only when it is a path starting with `/<lang>` (the
page's language) followed by end or `/`, contains no `//`, `\`, or scheme, and
is at most 512 chars; otherwise `/<lang>/account`. Validated again inside the
action, not trusted from the hidden field.

Rate limit: in-memory map keyed by normalized email, 5 failures per 15-minute
fixed window; success clears the key. Per server process only; documented as
such in a comment. Checked before the password verify.

Checkout: signed in → `client_reference_id: user.id`, `customer_email:
user.email`; guest → neither field. Order sync: `userId` = reference only when
`db.user.findUnique({ where: { id }, select: { id: true } })` finds it.

## Testing

`pnpm test` gates steps 2, 3, 4, and 7 (new `lib/*.test.ts`,
`actions/auth.test.ts`, extended `lib/checkout.test.ts` and
`lib/order-sync.test.ts`; Vitest mocks for `db`, `next/headers`,
`next/navigation`). Steps 1, 5, and 6 ride on `pnpm build`, `pnpm lint`, and a
manual browser pass (no Browser tests command exists). The migration is checked
with `pnpm exec prisma migrate status`. No Verify command exists, so the final
gate is `pnpm test`, `pnpm build`, and `pnpm lint`. A real Stripe checkout
while signed in is manual evidence for step 7 and must not be claimed unless run.

## Implementation notes

- Field validation failures return `error: "invalid_fields"` with
  `fieldErrors`; `invalid_input` stays for a tampered hidden field.
- `Order.userId` also got an index (`Order_userId_idx`) for feature 9's
  per-customer order queries.
- `safeNextPath` also rejects the language's `/login` and `/register` paths,
  which would otherwise redirect a signed-in visitor in a loop, and accepts a
  query directly after the language prefix (`/en?x=1`).
- Step 10 evidence: headless Chrome screenshot of `/en/register` on the dev
  server showed the photo panel, field icons, and both show/hide buttons; the
  user confirmed the pages in their browser on 2026-10-05.
- The sign-in limit counts every attempt when it starts (F-10), not each
  failure after the password check; a success clears the email, so the
  customer-visible rule (five wrong tries per 15 minutes) is unchanged.

## Notes for the AI

- Read `node_modules/next/dist/docs/01-app/02-guides/authentication.md`
  (Database Sessions, Authorization, Server Actions) and the `cookies()` API
  doc before step 2. `cookies()` is async and can only be set in Server Actions
  or route handlers, not during page render; the account page and login page
  therefore only read.
- Every user-owned read uses the user id from `getCurrentUser()`, never from
  form data.
- Form UX: labels tied to inputs, `aria-invalid` and `aria-describedby` on
  fields with errors, a form-level error in a `role="alert"` region, focus moves
  to the first invalid field after a failed submit, entered name and email are
  kept, password fields are cleared, errors clear on the next submit. Inputs use
  `autocomplete` `name`, `email`, `current-password`, `new-password`. Submit
  button shows a pending state and is disabled while pending.
- User-controlled text (name, email) renders only as React text, never HTML.
- Keep the language prefix on every link and redirect (`localizedPath`).
- Do not log passwords, tokens, or token hashes. Log unexpected errors the same
  way `actions/checkout.ts` does.
- Use `noindex` metadata for the three pages, following the existing
  `lib/seo.ts` metadata pattern.
- Update the coding-standards TODO about the auth provider to say built-in
  database sessions were chosen (validation stays hand-written; Zod is not
  installed).
- Overview open question 10 (Clerk or Auth.js) and 7/12 are now answered by
  this spec; `/complete` or a later `/overview` should reflect that in
  `project-plan.md` / the overview.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":17766,"specSha256":"8846679f7e3888f17f23305349842e4ec5ae43674f50f3063e22985359e57180","branch":"refs/heads/feature/sign-up-sign-in-and-sessions","head":"2bc0ef0b39f4eb1ebb323fd7a74a9f3665f84c2b","baseRef":"refs/heads/main","baseCommit":"ff8ca8f44068b035b6c962eb6e0b718cd812e4c0","sourceTree":"57cbf053b411a1abed213c5bf4346936b81e8e59","absentOptional":[]} -->

## Findings

### 8a/F-10 [P1] closed - Concurrent sign-in requests bypass the five-failure limit

**File:** actions/auth.ts:96
**Found:** 2026-10-05 by /audit independent (scope: current; lens: security, tests)
**Why it matters:** The spec says five failed attempts for one email inside 15 minutes block further attempts. `signIn` checks `isLoginBlocked(email)` synchronously, then awaits `db.user.findUnique` and the scrypt `verifyPassword`, and only after both calls `recordLoginFailure(email)` (line 111). Any number of requests for the same email that arrive inside that window (one DB round trip plus one scrypt run, tens of milliseconds) all pass the check before any failure is recorded. The client-side action queue does not help, because a direct POST with the action ID skips it. A burst of N parallel guesses therefore gets N password checks per window instead of 5, which defeats the only brute-force control this feature ships. This is not the per-process or IP-based limit that feature 24 owns. It is the stated per-email limit failing on one process. The rate-limit tests only call `signIn` one after another, so they cannot catch this.
**Suggested fix:** Reserve the attempt before the first `await`. For example, call `recordLoginFailure(email)` right after the `isLoginBlocked` check and keep `clearLoginFailures(email)` on success (or add a single `tryReserveLoginAttempt` helper in `lib/auth.ts` that checks and increments in one call). Add an `actions/auth.test.ts` case that fires six or more `signIn` calls with `Promise.all` and expects at most five `verifyPassword`/`findUnique` runs and the rest `rate_limited`. Requirement lost: None.
**Resolution:** Fixed 2026-10-05 by /implement (spec step 8): `reserveLoginAttempt` in `lib/auth.ts` checks and counts synchronously before the first await in `signIn`; `actions/auth.test.ts` fires eight parallel sign-ins and asserts five lookups and three `rate_limited`. Awaiting /audit re-review. Closed 2026-10-05 by /audit independent (target 078d0d2, fresh subagent). Re-examined `actions/auth.ts:83-97` and `lib/auth.ts:164-177`: `parseLoginForm` and `reserveLoginAttempt` are both synchronous and run before the first `await` (`db.user.findUnique` at line 100), and `reserveLoginAttempt` checks the window and increments the count in the same call, so no interleaving can let a sixth attempt in a window reach the lookup or scrypt verify on one process. Success still clears the email (line 112), so the customer-visible rule is unchanged. The test `actions/auth.test.ts:174` fires eight `signIn` calls through `Promise.all` with a delayed lookup and asserts exactly five lookups, three `rate_limited`, and five `invalid_credentials`; reverting to check-then-record would produce eight lookups and fail it. `lib/auth.test.ts:197-233` covers reserve, refusal, window reset with fake timers, and clear. No new defect introduced. `pnpm test` passed (328 tests).

### 8a/F-11 [P2] closed - Sign-in accepts passwords of any length, against the 128-character contract

**File:** lib/auth.ts:116
**Found:** 2026-10-05 by /audit independent (scope: current; lens: security, quality, tests)
**Why it matters:** The spec's Validation table requires the sign-in password to be "non-empty, ≤128 chars". `lib/password.ts:3` also says longer passwords are rejected before hashing so a request cannot make scrypt do unbounded work. `parseLoginForm` only rejects an empty password, so a sign-in POST can carry a password up to the Server Action body limit. That password is NFKC-normalized and hashed before the generic error comes back. Each request still costs one scrypt run and the body limit caps the size, so the impact is limited. The bug is drift from the contract plus a hashing-cost gap that `maxLength={128}` on the client does not close. No test covers a too-long sign-in password.
**Suggested fix:** In `parseLoginForm`, treat `password.length > PASSWORD_MAX_LENGTH` as a failure before any lookup or hash. Either return `password_too_long` as a field error, or (simplest, since no account can hold such a password) return the generic `invalid_credentials` without recording a failure. Add a `lib/auth.test.ts` case with a 129-character password. Requirement lost: None.
**Resolution:** Fixed 2026-10-05 by /implement (spec step 9): `parseLoginForm` returns `password_too_long` above 128 characters before any lookup or hash; `lib/auth.test.ts` covers 129 and 128. Awaiting /audit re-review. Closed 2026-10-05 by /audit independent (target 078d0d2, fresh subagent). Re-examined `lib/auth.ts:116-120`: a sign-in password longer than `PASSWORD_MAX_LENGTH` (128) now yields the `password_too_long` field error, and `signIn` (`actions/auth.ts:83-93`) returns that result before `reserveLoginAttempt`, the user lookup, or any scrypt run, so the hashing-cost gap and the contract drift are gone. Both dictionaries carry a `password_too_long` message, so the form renders it. `lib/auth.test.ts:141` asserts the 129-character rejection with no other field error and that 128 still parses. No new defect introduced. `pnpm test` passed.

## Independent review

# Independent Review

**Status:** passed
**Target commit:** 2bc0ef0b39f4eb1ebb323fd7a74a9f3665f84c2b
**Base commit:** ff8ca8f44068b035b6c962eb6e0b718cd812e4c0
**Base ref:** main
**Spec hash:** 8846679f7e3888f17f23305349842e4ec5ae43674f50f3063e22985359e57180
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-05T17:22:00Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-05T17:24:59Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `ff8ca8f44068b035b6c962eb6e0b718cd812e4c0..2bc0ef0b39f4eb1ebb323fd7a74a9f3665f84c2b` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `pnpm test`: pass (23 files, 328 tests)
- `pnpm lint`: pass
- `pnpm build`: pass (`/[lang]/login`, `/[lang]/register`, `/[lang]/account` dynamic; only a pre-existing pg `sslmode` warning from the environment)
- `pnpm exec prisma migrate status`: pass (6 migrations, schema up to date)

## Evidence

- Preflight: HEAD = target, `git merge-base main HEAD` = base, raw SHA-256 of `blueprint/context/current-feature.md` matches `Spec hash` (spec tracked), and only `blueprint/context/review.md` and `blueprint/context/findings.md` differ from the target.
- Passwords (`lib/password.ts`): scrypt N=16384/r=8/p=1, 16-byte salt, 64-byte key, parameters stored with each hash, `timingSafeEqual` comparison. A malformed hash, a bad N, or a scrypt error returns false. The dummy hash decodes to a 16-byte salt and a 64-byte key, so verifying an unknown email costs the same work as a real one.
- Sessions (`lib/session.ts`, `lib/session-token.ts`): 32-byte random token, only its SHA-256 is stored, and the cookie is httpOnly, lax, path `/`, and secure in production. Sign-in and register always create a new session. Lookup selects only id/name/email/role (never `passwordHash`), and an expired row is deleted. Sign out deletes the row by hash and removes the cookie.
- Redirects: `safeNextPath` only accepts a value that starts with `/<lang>` followed by end, `/`, or `?`. It rejects `//` and `\`, caps length at 512, and refuses the language's login/register paths. Because of the required prefix, a value can never be protocol-relative or carry a scheme. The actions re-validate the hidden field, and `redirect` sits outside try/catch.
- Rate limit: `reserveLoginAttempt` checks and counts in one synchronous call before the first `await` in `signIn`, so parallel attempts cannot get past it (the parallel test sees 8 calls, 5 lookups, and 3 `rate_limited`). Password length is capped at 128 before any hashing (F-10 and F-11 stay closed).
- Authorization: `/[lang]/account` checks on the server with `getCurrentUser()` and redirects to `/<lang>/login?next=/<lang>/account`. The header only checks whether the cookie exists, which the spec accepts. Login, register, and account pages are `noindex` and absent from `app/sitemap.ts`.
- Checkout → order: `checkoutCustomer` takes the user from the server session only. `orderUserId` sets `userId` only when a `User` with that id exists. The migration adds `User`, `Session`, the `Role` enum, an FK with SET NULL, cascade on sessions, and `Order_userId_idx`. Existing orders keep `userId` null.
- Step 10: the toggle is `type="button"` with a translated `aria-label`, `aria-pressed`, and `aria-controls` pointing at the input id, and it only changes the input `type` (see F-13 for the label/pressed conflict). Icons use `start-3.5` from an rtl-inheriting wrapper, and the `dir="ltr"` email field pads both sides and right-aligns text with `rtl:text-right`. `next/image` uses `fill` with `sizes` inside a `relative` parent and `alt=""`. The asset `public/auth/shopping-online.jpg` (99,136 bytes) can be served because the `proxy.ts` matcher skips paths that contain a dot. Estimated contrast of white text over the 85% ink overlay above the photo's bright areas is at least about 4.8:1 for body text near the top; the cards have solid surfaces.

## Findings

- F-13 [P3] open (new): the password toggle swaps its label and also sets `aria-pressed`, so the two signals contradict each other (components/auth/AuthForm.tsx:250)
- F-12 [P3] open (re-checked, unchanged): no `server-only` import in lib/session.ts:1
- F-10 [P1] and F-11 [P2] remain closed; no P0/P1 finding is open or fixed

## Remaining risk

- Not verified live: no dev server was run and Check was not required. Rendering in a browser, RTL placement, how the toggle behaves with a screen reader, how the photo crops, and overlay contrast were checked only by reading the code and estimating from the image.
- A real Stripe checkout while signed in (`client_reference_id` reaching the webhook) was not run. It is covered only by unit tests with mocked Stripe and database.
- `lib/session.ts` (createSession, getCurrentUser, deleteCurrentSession) has no unit test of its own. Only the pure helpers in `lib/session-token.ts` and the mocked action paths are tested.
- The rate limit lives in process memory only (the spec documents this; feature 24 owns stronger limits). Registration has no rate limit, and each request costs one scrypt run.
- No browser test command, dependency vulnerability scan, or Verify command exists.
