# Fix: Password reset race and error logging

**Type:** Fix
**Status:** verified
**Branch:** fix/password-reset-race-and-error-logging
**Fixes:** F-45, F-46

## The problem

Two gaps the independent review of feature 28 found in `actions/auth.ts`:

- **F-45:** `requestPasswordReset` deletes the user's old reset tokens and
  creates the new one in a batch `$transaction` at Postgres's default READ
  COMMITTED isolation. Two overlapping requests for the same account each run
  their delete before the other's insert commits, so both tokens survive. Both
  links then work for the full hour, which breaks feature 28's rule that only
  the newest link works.
- **F-46:** the `requestPasswordReset` and `resetPassword` catch blocks call
  `console.error(label, error)` with the raw error. A Prisma error message can
  repeat the query's arguments: here the email, the token hash, and the new
  password hash. Feature 28's spec forbids logging those. `register` and
  `signIn` in the same file log the same way, and their queries carry the email
  and the new password hash.

## The fix

- **F-45:** make the request an interactive transaction. It first locks the
  user's row (`SELECT id FROM "User" WHERE id = $1 FOR UPDATE` through
  `tx.$queryRaw`), then deletes old tokens and creates the new one. A second
  request for the same account waits for the first to commit, so its delete
  sees and removes the first token. Requests for different accounts don't
  block each other. Nothing else changes: the response, `after()` email,
  idempotency key, and rate limit stay as they are.
- **F-46:** move `errorLabel` (error name plus Prisma `code`, never the
  message) from `actions/onboarding.ts` into a new pure `lib/error-label.ts`,
  import it back in onboarding, and use it in all four catch blocks in
  `actions/auth.ts` (`register`, `signIn`, `requestPasswordReset`,
  `resetPassword`). The log labels stay the same.
- **Must not break:** the result shapes, the neutral response for unknown
  emails, single-use reset tokens, sign-in limits, onboarding logging and its
  tests, and every existing auth test.

## Build steps

- [x] **1. Lock the user row before replacing reset tokens (F-45).** Rewrite the
  token swap in `requestPasswordReset` as `db.$transaction(async (tx) => …)`:
  lock the row with `FOR UPDATE`, then `deleteMany` and `create`. Update the
  action test's transaction mock so the callback receives a `tx` with
  `$queryRaw`. Assert that the lock comes before the delete and the delete
  before the create, all inside one transaction.
  *Done when:* `pnpm exec vitest run actions/auth.test.ts` passes, including the
  order assertion. The test is a unit test with a mocked database, so it can't
  prove two real requests actually wait on each other; that rests on Postgres's
  row-lock behavior.

- [x] **2. Log only the error name and code in auth actions (F-46).** Add
  `lib/error-label.ts` with tests: a plain `Error` gives its name, a Prisma
  known-request error gives its name and code, a non-error gives
  `"unknown error"`, and the message never appears. Switch
  `actions/onboarding.ts` to import it, and use it in the four
  `actions/auth.ts` catch blocks. In `actions/auth.test.ts`, make one request
  failure and one reset failure throw errors whose messages contain the email
  and the token hash, and assert that neither appears in `console.error`.
  *Done when:* `pnpm test` and `pnpm lint` pass, and the existing onboarding
  logging test still passes unchanged.

## Verify

- `pnpm test`, `pnpm lint`, and `pnpm build` pass (stop the dev server before
  building).
- Optional manual check: request two reset links for one account in quick
  succession. Only the newest link opens the reset form; the older one shows
  "This link is invalid or has expired". With email off, read the token rows
  from the database to compare.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":3871,"specSha256":"6e1a54139236deced9eefb8ca164cdd268fca7ef4858df5f171022ccad835354","branch":"refs/heads/fix/password-reset-race-and-error-logging","head":"b3a8a58c4460ed75f636e3b53e2fc3b89f460f0d","baseRef":"refs/heads/main","baseCommit":"d4d2aa047a879a65319737bf546021e12a70d896","sourceTree":"d4f063678720e21288c6cfa3cd4fdeee5276a9e3","absentOptional":[]} -->

## Findings

### password-reset-race-and-error-logging/F-46 [P3] closed - The two new action catch blocks log the raw error object, which the project already treats as unsafe for Prisma errors

**File:** actions/auth.ts:199
**Found:** 2026-10-12 by /audit independent (scope: current; lens: security)
**Why it matters:** The spec's Notes say "Never log the token, its hash, the email address, or the URL." `requestPasswordReset` (line 199) and `resetPassword` (line 258) both call `console.error(label, error)` with the raw error. The project already recorded that a Prisma error message can repeat the query's arguments (`actions/onboarding.ts:38` `errorLabel`, and finding F-26). The failing calls here carry exactly the forbidden values: `user.findUnique({ where: { email } })` and `passwordResetToken.create({ data: { tokenHash, ... } })` in the request action, and `findUnique`/`deleteMany({ where: { tokenHash } })` plus `user.update({ data: { passwordHash } })` in the reset action. Reachability is low: inputs are validated before every query, so no ordinary input is known to trigger an argument-echoing error, and connection errors (the realistic failure) carry no arguments. Both action tests use `new Error("connection lost")`, so they cannot catch a leak. This follows the existing `register`/`signIn` logging pattern, so it is drift from the spec's explicit rule rather than a demonstrated leak.
**Suggested fix:** Log the error name and Prisma code only in these two catch blocks, as `actions/onboarding.ts` does (move `errorLabel` to a shared lib module or copy its three lines), and change one action test to throw an error whose message contains the email or token hash and assert the log does not contain it. Requirement lost: None.
**Resolution:** Fixed 2026-10-12 by fix/password-reset-race-and-error-logging: `errorLabel` (error name plus Prisma code, never the message) moved from `actions/onboarding.ts` to `lib/error-label.ts` and is used in all four `actions/auth.ts` catch blocks (`register`, `signIn`, `requestPasswordReset`, `resetPassword`). Action tests throw errors whose messages contain the email and the token hash and assert neither is logged. Awaiting re-review. Closed 2026-10-12 by /audit independent (target b3a8a58, fresh subagent): all four `actions/auth.ts` catch blocks (lines 89, 132, 202, 261) now log `errorLabel(error)`, which returns only the error name and `code` (`lib/error-label.ts`), byte-for-byte the rule `actions/onboarding.ts` used before, and onboarding now imports it (line 81). `actions/auth.test.ts` asserts the exact logged string for a Prisma error whose message holds the email and for an error whose message holds the token hash, and `lib/error-label.test.ts` covers plain, Prisma, and non-error inputs. `pnpm test` (1294 passed), `pnpm lint`, and `pnpm build` pass. No new defect introduced.

## Independent review

**Status:** passed
**Target commit:** b3a8a58c4460ed75f636e3b53e2fc3b89f460f0d
**Base commit:** d4d2aa047a879a65319737bf546021e12a70d896
**Base ref:** main
**Spec hash:** 6e1a54139236deced9eefb8ca164cdd268fca7ef4858df5f171022ccad835354
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-12T13:20:19Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-12T13:25:43Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `d4d2aa047a879a65319737bf546021e12a70d896..b3a8a58c4460ed75f636e3b53e2fc3b89f460f0d` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `pnpm test`: pass (76 files, 1294 tests)
- `pnpm lint`: pass
- `pnpm build`: pass
- `pnpm test:browser`: not run (re-seeds the shared database)

## Evidence

- Freshness confirmed before review: `HEAD` equals the target, `git merge-base main HEAD` equals the base, the raw spec SHA-256 matches, and only `blueprint/context/review.md` differed from the target.
- Reviewed the full delta: `actions/auth.ts`, `actions/auth.test.ts`, `actions/onboarding.ts`, `lib/error-label.ts`, `lib/error-label.test.ts`, plus the spec and ledger changes. Nearby code checked: `resetPassword`'s transaction, `lib/db.ts` (PrismaPg adapter supports interactive transactions), the `User` model and migration (`"User"` table, text `id`), and every `console.error` call in `actions/` and `lib/`.
- F-45: the `FOR UPDATE` lock serializes overlapping requests for one account, so the original defect is gone. The new lock order conflicts with `resetPassword` (F-47), so F-45 stays `fixed`.
- F-46: all four `actions/auth.ts` catch blocks log only `errorLabel(error)`, and tests assert the exact log string without the email or token hash. Closed.

## Findings

- F-45 [P3] fixed (re-examined; original defect removed, left `fixed` because the repair introduced F-47)
- F-46 [P3] closed
- F-47 [P3] open: `requestPasswordReset`'s user-row lock can deadlock against a concurrent `resetPassword` for the same account (`actions/auth.ts:185`)

## Remaining risk

- `pnpm test:browser` was not run because it re-seeds the shared database.
- F-47 and the F-45 lock behavior come from reading the code against Postgres row-lock semantics. The unit tests mock the database, and no concurrency test ran against a live database.
- Outside this delta, other actions (for example `actions/account.ts` `changePassword`) still log raw errors whose Prisma messages could repeat query data. This is the existing pattern covered in spirit by F-26, not a regression from this delta.
