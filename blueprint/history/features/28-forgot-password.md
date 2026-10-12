# Feature: Forgot Password

**From build-plan:** feature 28
**Build attempt:** 1
**Branch:** feature/forgot-password
**Status:** verified

## Goal

A customer who forgot their password can reset it by email. The login form gets
a "Forgot password?" link that opens a page where the customer enters their
email. A bilingual email sent through Resend carries a single-use link that
expires after one hour. The link opens `/<lang>/reset-password`, where the
customer sets a new password. The reset signs out every session of that
account, and the customer then signs in with the new password. The request
page responds the same way whether or not an account exists, and requests are
rate-limited.

## Design reference

`prototypes/login.html` puts "Forgot password?" on the right of the Password
label row (`row-between`), shown only in sign-in mode. Both new pages reuse
`AuthPanel`'s layout (breadcrumb, art column, form column) and the `AuthForm`
field styles. Never import from `prototypes/`. Arabic mirrors the layout.

## In scope

Decisions (approved with the plan line, or chosen here as the simplest
repository-native option):

- **Link lifetime:** 1 hour.
- **Neutral response:** after any valid request, the page shows: "If an account
  exists for that email, we've sent a link to reset your password." Unknown
  emails get no different status, message, or redirect.
- **Only the newest link works:** creating a token deletes the user's earlier
  reset tokens.
- **Single use:** a successful reset deletes every reset token of that user.
- **Signs out all sessions,** including one in the same browser. The customer
  then goes to `/<lang>/login?reset=1`, which shows a "Password changed. Sign in
  with your new password." notice. There is no automatic sign-in.
- **Rate limit:** new `passwordReset` action in `RATE_LIMITS`, 5 per hour per
  client (IP header), counted only for valid forms, like `register`.
- **Email language:** the language of the page the request came from (the form's
  `lang`).
- **Email sending** runs in `after()`, so the response does not wait on Resend.
  The request takes the same path whether or not the account exists. With email
  off (no `RESEND_API_KEY`/`EMAIL_FROM`), it logs "Email is off; password reset
  email skipped" and the page still shows the neutral message.
- **Routes:** `/<lang>/forgot-password` (request) and
  `/<lang>/reset-password?token=<token>` (set a new password). Both are
  `noindex` and open to signed-in visitors too.

## Out of scope

- Email verification at registration, magic-link sign-in, and admin-triggered
  resets.
- A per-email throttle beyond "only the newest link works", and a cleanup job
  for expired tokens (expired rows are rejected and deleted when the user's
  next token is created or a reset succeeds).
- Changing the in-memory sign-in limiter.

## Build loop

`workflow.stepReview` is `feature` and `checkpointCommits` is `disabled`: build
all steps, running `pnpm test` (and `pnpm lint` where relevant) after each,
then present one review packet at the end. `/complete` creates the single
feature commit.

## Build steps

- [x] **1. Reset token model and pure helpers.** Add `PasswordResetToken` to
  `prisma/schema.prisma` and create a migration with `pnpm db:migrate --name
  add_password_reset_tokens`. Add `lib/password-reset.ts` (no `next/*`) with
  `RESET_TOKEN_TTL_MS`, `createResetToken()` and `hashResetToken()` (reuse the
  `session-token.ts` approach: 32 random bytes in base64url, SHA-256 hex),
  `resetTokenExpiry(now)`, and `isResetTokenExpired`. Add
  `parseForgotPasswordForm` and `parseResetPasswordForm` to `lib/auth.ts`,
  reusing `normalizeEmail`, `emailError`, and `newPasswordError`. Add
  `passwordReset` to `RATE_LIMITS`.
  *Done when:* the migration applies, `pnpm exec prisma migrate status` is
  clean, and unit tests cover token shape and hash, expiry boundaries, and both
  parsers (valid, missing fields → invalid input, bad email, short/long
  password, mismatch, a token that is missing or longer than 128 characters →
  invalid input).

- [x] **2. Reset email.** In `lib/password-reset-email.ts` (pure), add
  `passwordResetEmail(locale, resetUrl)` returning `BuiltEmail`, built with
  `page`, `button`, and `escapeHtml` from `lib/order-emails.ts`. Add a
  `passwordResetEmail` block to both dictionaries: subject, heading, intro,
  button label, "expires in 1 hour", and "ignore this email if you didn't ask".
  *Done when:* unit tests show English and Arabic subjects and bodies, the
  escaped URL in both the HTML and the text versions, and `dir="rtl"` for
  Arabic.

- [x] **3. Request action and page.** Add `requestPasswordReset` to
  `actions/auth.ts`. It parses the form, reserves the rate limit, and looks up
  the user. For an existing user, one transaction deletes the user's old reset
  tokens and creates the new token hash. Then `after()` calls
  `sendPasswordResetEmail(userId, token, locale)` in
  `lib/password-reset-notifications.ts`, which follows
  `service-notifications.ts`: best effort, never throws, logs never include the
  address or the token, and the idempotency key is
  `password-reset/<tokenRowId>`. The action returns `{ success: true }` whether
  or not the user exists. Add the `/[lang]/forgot-password` page and a small
  client form (email field, submit, alert, neutral success state that replaces
  the form, "Back to sign in" link). Add a "Forgot password?" link in
  `AuthForm` on the password label row in sign-in mode only.
  *Done when:* action unit tests (db, headers, and `after` mocked as in
  `actions/onboarding.test.ts`) show an identical result for a known and an
  unknown email, a token row only for the known user with older rows removed, a
  rate-limited result after the limit, an `invalid_fields` result for a bad
  email, and an `unexpected` result on a database error. The email helper test
  shows email-off skips without throwing.

- [x] **4. Reset action and page.** The `/[lang]/reset-password` page reads
  `token` and checks it read-only. With no token, an unknown token, or an
  expired token, it shows "This link is invalid or has expired" and links to
  `/forgot-password`. Otherwise it shows new password and confirm fields
  (`PasswordInput`, shared show/hide, hint), with the token in a hidden field.
  `resetPassword` re-validates on submit. In one transaction it deletes the
  token by hash where `expiresAt > now` and requires count 1 (single use, safe
  against racing submits). It then sets `passwordHash`, deletes all of the
  user's reset tokens, and deletes all of the user's sessions. It then clears
  the current cookie with `deleteCurrentSession()` and redirects to
  `/<lang>/login?reset=1`. The login page shows the success notice when
  `reset=1` is present.
  *Done when:* unit tests show a valid token changes the hash and removes all
  sessions and tokens. A reused, expired, or unknown token returns
  `invalid_token` and changes nothing. Field errors keep the token. The new
  password signs in and the old one fails (via `verifyPassword`).

- [x] **5. Text, accessibility, and browser test.** Add all new English and
  Arabic strings under `auth` (link, page titles, intros, success, invalid link,
  reset notice, `invalid_token` error). Errors focus the first bad field or the
  alert, as `AuthForm` does. The success message uses `role="status"`. In
  `e2e/auth.spec.ts`, cover these paths. Login → Forgot password → submit
  shows the neutral message (en and ar). Insert a token hash for a test user
  through the support `Pool`, open the reset link, set a new password, land on
  login with the notice, and sign in with the new password. An invalid token
  shows the expired message.
  *Done when:* `pnpm test`, `pnpm lint`, `pnpm build`, and `pnpm test:browser`
  pass.

## Files / areas

- `prisma/schema.prisma`, `prisma/migrations/<timestamp>_add_password_reset_tokens/`
- `lib/password-reset.ts` (+ test), `lib/password-reset-email.ts` (+ test),
  `lib/password-reset-notifications.ts` (+ test)
- `lib/auth.ts` (+ `lib/auth.test.ts`), `lib/rate-limit.ts` (+ test)
- `actions/auth.ts` (+ new `actions/auth.test.ts` cases or file)
- `app/[lang]/forgot-password/page.tsx`, `app/[lang]/reset-password/page.tsx`,
  `app/[lang]/login/page.tsx` (notice)
- `components/auth/AuthForm.tsx` (link), new
  `components/auth/ForgotPasswordForm.tsx` and `ResetPasswordForm.tsx` (client)
- `lib/i18n/dictionaries/en.ts`, `ar.ts`
- `e2e/auth.spec.ts`

## Data / contracts

```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  // SHA-256 hex of the emailed token; the raw token is never stored.
  tokenHash String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
}
```

`User` gains `passwordResetTokens PasswordResetToken[]`.

- Raw token: 32 random bytes in base64url (43 characters), present only in the
  email and the link. The parser rejects tokens over 128 characters before
  hashing.
- Reset URL: `absoluteUrl(localizedPath(locale, "/reset-password"))` +
  `?token=<encodeURIComponent(token)>`. `Referrer-Policy:
  strict-origin-when-cross-origin` keeps the query out of cross-origin
  referrers.
- `requestPasswordReset(prev, formData)` → `{ success: true }` |
  `{ success: false, error: "invalid_input" | "invalid_fields" | "rate_limited"
  | "unexpected", fieldErrors?, values?: { email } }`.
- `resetPassword(prev, formData)` → redirect on success, or `{ success: false,
  error: "invalid_input" | "invalid_fields" | "invalid_token" | "unexpected",
  fieldErrors? }`. Fields: `lang`, `token`, `password`, `confirm`. Passwords
  are never echoed.
- `RATE_LIMITS.passwordReset = { max: 5, windowMs: 60 * 60 * 1000 }`.

## Testing

Vitest unit tests for the helpers, parsers, email builder, notification
sender, and both actions (Prisma, `next/headers`, `next/server` `after`, and
`next/navigation` mocked, following the existing action tests). Playwright
covers the UI flow in English and Arabic, with email off, by inserting a known
token hash directly. No live Resend send is claimed.

## Notes for the AI

- The request action's result and the neutral message must not depend on
  whether the account exists. Run the `after()` scheduling and the DB writes
  only for real users, but return the same shape. Don't add a dummy hash; no
  password is checked here.
- The user comes from the token row, never from a form field.
- Never log the token, its hash, the email address, or the URL.
- Keep `safeNextPath` unchanged; the new pages don't take `next`.
- Read `node_modules/next/dist/docs/` for `after` and `PageProps` if unsure;
  this is Next.js 16.

## Implementation notes

- `sendPasswordResetEmail` takes `{ tokenId, email, token, locale }`: the
  action already has the account's stored address, so the sender needs no
  second lookup.
- The reset page's read-only token check is `isResetTokenUsable` in the
  server-only `lib/password-reset-tokens.ts`, since pages do not import `db`.
- `AuthPanel` now wraps a shared `AuthShell` (breadcrumb, photo column, form
  column) that the two new pages reuse; the sign-in and register output is
  unchanged apart from the new link and optional notice.
- Verification: `pnpm test` (75 files, 1288 tests), `pnpm lint`, `pnpm build`,
  and `pnpm test:browser` (24 passed, including the 4 new auth tests) all pass.
  `prisma migrate status` is up to date.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":11507,"specSha256":"15b4dca3083f5dad104a26b68435b9ba1ffb02defdd946a543b08cadb66f4b84","branch":"refs/heads/feature/forgot-password","head":"d4594e68bfc925448b6eca6b9e8efc10e034e001","baseRef":"refs/heads/main","baseCommit":"e84c5986f7e533516223bb87d6fe23d51bd2a88d","sourceTree":"c76b537df55df9b0a33b838ae66901e6dc9d05df","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** d4594e68bfc925448b6eca6b9e8efc10e034e001
**Base commit:** e84c5986f7e533516223bb87d6fe23d51bd2a88d
**Base ref:** main
**Spec hash:** 15b4dca3083f5dad104a26b68435b9ba1ffb02defdd946a543b08cadb66f4b84
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-12T12:17:56Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-12T12:32:42Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `e84c5986f7e533516223bb87d6fe23d51bd2a88d..d4594e68bfc925448b6eca6b9e8efc10e034e001` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `git status --porcelain`, `sha256sum blueprint/context/current-feature.md`: pass (HEAD, merge base, and spec hash match the request; only `blueprint/context/review.md` differed)
- `pnpm test`: pass (75 files, 1288 tests)
- `pnpm lint`: pass
- `pnpm build`: fail (environmental) - compile succeeded; type check failed only on 87 errors in generated `.next/dev/types/routes.d.ts` and `validator.ts`, which a running dev server on port 3000 had left with a stale truncated tail; no error in project source
- `pnpm exec tsc -p <scratch tsconfig extending tsconfig.json, excluding .next/dev>`: pass (substitute type check of all project source)
- `pnpm test:browser`: not run (reseeds the shared database and needs the dev server stopped)

## Evidence

- Full delta reviewed: 29 files (`actions/auth.ts` + test, `lib/auth.ts` + test, `lib/password-reset*.ts` + tests, `lib/rate-limit.ts`, Prisma schema and migration, both new pages, login page, `AuthForm`, `AuthPanel`/`AuthShell`, both new client forms, both dictionaries, `e2e/auth.spec.ts`, and planning docs), plus callers `lib/session.ts`, `lib/security-headers.ts`, `next.config.ts`, `e2e/support.ts`, `playwright.config.ts`
- Security: user comes from the token row; only the SHA-256 hash is stored; token length capped before hashing; claim-by-delete with `expiresAt > now` inside an interactive transaction makes the token single use under racing submits; all reset tokens and sessions deleted with the new hash; scrypt runs only after a stored, unexpired token is found; known and unknown emails return `{ success: true }`; rate limit reserved only for valid forms; global `Referrer-Policy: strict-origin-when-cross-origin`; notification logs carry the token row id only (tested)
- Tests: action tests cover identical known/unknown results, older-token deletion, `after()` scheduling, hash-of-emailed-token, rate limit, field errors, invalid input, reused/expired/unknown tokens, and DB failure; browser tests use a per-test rate-limit client header, so reruns do not share a window
- Performance: every new query is by unique or indexed column; no unbounded work

## Findings

- F-45 [P3] open - concurrent forgot-password requests can both leave a working link (`actions/auth.ts:182`)
- F-46 [P3] open - new action catch blocks log the raw error object, against the spec's no-email/no-hash logging rule (`actions/auth.ts:199`, `:258`)
- F-13 [P3] open - re-checked; the new reset form reuses `PasswordInput`, so the label/`aria-pressed` issue also occurs there
- No P0 or P1 finding

## Remaining risk

- `pnpm build` could not complete its type check because a running dev server had corrupted the generated `.next/dev/types` files; a substitute `tsc` over all project source passed, but a clean `pnpm build` with the dev server stopped was not observed in this review
- `pnpm test:browser` not run by the reviewer (shared database reseed); the browser flows rely on the builder's reported 24-test pass
- `/check` not run (not required); no live Resend send verified
- The request action does one extra transaction for real accounts, so response time can differ slightly between known and unknown emails; the spec accepts DB writes only for real users, and registration already reveals taken emails
- Production needs `pnpm db:deploy` for the new `PasswordResetToken` migration before this code is deployed
