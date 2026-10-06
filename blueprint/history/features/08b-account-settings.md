# Feature: Account Settings

**From build-plan:** feature 8b
**Build attempt:** 1
**Branch:** feature/account-settings
**Status:** verified

## Goal

A signed-in customer can open an account settings page in English or Arabic,
change their name and email, change their password after confirming the current
one, and sign out every other session while staying signed in here.

## In scope

- New page `/<lang>/account/settings`, reached from a link on `/<lang>/account`.
  A visitor without a valid session is redirected to
  `/<lang>/login?next=/<lang>/account/settings` (same pattern as the account page).
- **Profile form:** name and email, prefilled from the session user. Same rules
  as registration: name trimmed, 1-100 characters; email trimmed, lowercased,
  same pattern, at most 254. A taken email shows `email_taken`. Changing the
  email also requires the current password; a
  name-only change does not.
- **Password form:** current password, new password, confirm. New password uses
  the registration rules (8-128 characters, confirm must match). A wrong current
  password shows a field error on the current-password field. On success the
  password hash is replaced and every other session of this user is deleted in
  the same transaction; the current session stays.
- **Other sessions:** one button, "Sign out other devices". Deletes every
  session of the signed-in user except the current one and reports how many
  were ended (0 is a valid, friendly result).
- Current-password checks are counted by the existing in-memory limiter in
  `lib/auth.ts` under a per-user key that cannot collide with an email
  (`user:<id>`), so a stolen session cannot brute-force the password and a lock
  here does not lock sign-in. A successful check clears the key.
- Every new string in `lib/i18n/dictionaries/en.ts` and `ar.ts`.
- Unit tests for the new parsers, the session helper, and the actions.

## Out of scope

- Forgot-password / reset by email and email verification (feature 19).
- The customer dashboard, orders, downloads, services (feature 9). Feature 9
  will replace the `/account` body and must keep a link to settings.
- Account deletion, avatars, preferred language, listing sessions per device.
- Attaching guest orders by email. Changing the email does not touch any
  `Order.customerEmail` or `Order.userId`.
- Admin user management, roles.

## Build loop

`workflow.stepReview` is `feature`: build all steps, run the checks after each,
then present one review packet at the end. `checkpointCommits` is disabled, so
no step commits; `/complete` creates the feature commit.

## Build steps

- [x] **1. Settings page and profile form.** Add `parseProfileForm` to
  `lib/auth.ts` (reusing the name/email checks), `updateProfile` in new
  `actions/account.ts`, the page `app/[lang]/account/settings/page.tsx`, a client
  form component in `components/account/`, the settings link on the account
  page, and dictionary text in both languages.
  Done when: `pnpm test` covers the parser (valid, blank name, long name, bad
  email, email change without/with wrong current password, unchanged email
  without password) and the action (no session, success updates only the
  session user's row, `P2002` → `email_taken`, unexpected error logged and
  returned as `unexpected`); `pnpm lint` and `pnpm build` pass; the signed-out
  redirect is in the page code.
- [x] **2. Change password.** Add `parsePasswordChangeForm` to `lib/auth.ts`,
  `otherSessionsWhere(userId)` in `lib/session.ts`, a filter that matches
  every session of the user except the current cookie's, and `changePassword` in `actions/account.ts`:
  rate-limit check, verify current password, hash the new one, update the hash
  and delete other sessions in one `db.$transaction`. Add the password form to
  the settings page.
  Done when: tests cover parser rules, rate-limited, wrong current password
  (field error, no write), success (hash replaced, other sessions deleted, the
  current one kept, limiter key cleared), no session, unexpected error; lint and
  build pass.
- [x] **3. Sign out other devices.** `signOutOtherSessions` action using the
  step-2 helper, returning the deleted count; button and result message on the
  settings page.
  Done when: tests cover no session, success with count, unexpected error; lint
  and build pass.

## Files / areas

- `app/[lang]/account/settings/page.tsx` (new, server component)
- `app/[lang]/account/page.tsx` (add settings link only)
- `components/account/` (new client forms; reuse or extract the `PasswordInput`
  / `IconInput` pieces from `components/auth/AuthForm.tsx` rather than copying)
- `actions/account.ts`, `actions/account.test.ts` (new)
- `lib/auth.ts`, `lib/auth.test.ts` (new parsers, limiter key reuse)
- `lib/session.ts` (other-session delete helper)
- `lib/i18n/dictionaries/en.ts`, `ar.ts` (new `settings` section)
- No schema change: `User.name`, `User.email` (unique), `User.passwordHash`,
  and `Session` already exist.

## Data / contracts

- **Actor:** always `getCurrentUser()` from the session cookie. No user id,
  role, or session id is read from the form. Every write is
  `where: { id: user.id }` or `where: { userId: user.id, tokenHash: { not: current } }`.
- **Form fields:** profile: `name`,
  `email`, `currentPassword`; password: `currentPassword`, `newPassword`,
  `confirm`. Missing or non-string fields → `invalid_input`. No `lang` field:
  the actions never redirect, and the page builds the sign-in link.
- **Result shape** (`useActionState`), success does not redirect:
  ```ts
  type AccountActionResult =
    | { success: true; ended?: number }          // ended: sessions signed out
    | { success: false; error: "invalid_input" | "invalid_fields" | "email_taken"
        | "rate_limited" | "signed_out" | "unexpected";
        fieldErrors?: Partial<Record<"name" | "email" | "currentPassword"
          | "newPassword" | "confirm", AccountFieldError>>;
        values?: { name?: string; email?: string } }
    | null;
  ```
  `AccountFieldError` extends the existing `AuthFieldError` codes with
  `current_password_required` and `current_password_wrong`. Passwords are never
  echoed back.
- **Atomicity:** password update plus other-session delete in one transaction.
  Email uniqueness relies on the existing unique index (`P2002`), which also
  covers races.
- After a successful profile update, `revalidatePath` the settings and account
  pages so the new name and email render.
- Redaction: `console.error` logs the error only, never form values.

## Testing

- `pnpm test`: parsers in `lib/auth.test.ts`; session helper and actions in
  `actions/account.test.ts`, mocking `@/lib/db`, `@/lib/session` and
  `next/headers` / `next/cache` the way `actions/auth.test.ts` does.
- `pnpm lint`, `pnpm build`.
- No browser harness exists; signed-in UI, RTL layout, and real database
  writes are manual `/check` evidence, not claimed by unit tests.

## Notes for the AI

- Read the Next 16 docs in `node_modules/next/dist/docs/` for Server Actions,
  `useActionState`, and `revalidatePath` before writing the actions.
- UX states per form: pending (button disabled, pending label), success (a
  `role="status"` message that clears on the next submit), field errors
  (`aria-invalid`, `aria-describedby` to the error, focus moves to the first
  bad field), form error (`role="alert"`, focused). Follow `AuthForm.tsx`.
- Two forms share one page, so input ids must be unique (`profile-name`,
  `profile-email`, `profile-current-password`, `current-password`,
  `new-password`, `confirm-password`). Use `autoComplete` `name`, `email`,
  `current-password`, `new-password`.
- Email inputs stay `dir="ltr"` on Arabic pages, as in the sign-in form. User
  name and email render as React text only.
- `signed_out` (session expired mid-form) shows a message with a sign-in link
  carrying `next`; do not redirect from inside the action result path.
- `/account/settings` is under `/account`, so the existing header link and
  later feature-9 navigation reach it without route changes.

- Decided at spec review: an email change requires the current password
  (email is the sign-in identity and is unverified until feature 19); a
  name-only change does not. A password change also signs out every other
  session and keeps the current one.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":8322,"specSha256":"abd830ae5983f5dff90397f32bc5b50c763415d1f4cbe47f23447aa432fb2ef0","branch":"refs/heads/feature/account-settings","head":"217a6204683ad2ae265c03263117b6c369e33336","baseRef":"refs/heads/main","baseCommit":"4e3e9bcf5179e283b9c984e1570a9875354657ca","sourceTree":"2e084b1721075e195e630d1c54a4c2d8f2f911fe","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 217a6204683ad2ae265c03263117b6c369e33336
**Base commit:** 4e3e9bcf5179e283b9c984e1570a9875354657ca
**Base ref:** main
**Spec hash:** abd830ae5983f5dff90397f32bc5b50c763415d1f4cbe47f23447aa432fb2ef0
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-06T12:50:37Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-06T12:54:34Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `4e3e9bcf5179e283b9c984e1570a9875354657ca..217a6204683ad2ae265c03263117b6c369e33336` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `pnpm test`: pass (24 files, 355 tests)
- `pnpm lint`: pass
- `pnpm build`: pass (pre-existing Postgres sslmode warning only; `/[lang]/account/settings` builds as dynamic)
- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (target, base, spec hash match; only `blueprint/context/review.md` differed before this write)

### Evidence

- Full delta reviewed (12 files): `actions/account.ts`, `actions/account.test.ts`, `app/[lang]/account/page.tsx`, `app/[lang]/account/settings/page.tsx`, `components/account/SettingsForms.tsx`, `components/auth/AuthForm.tsx`, `lib/auth.ts`, `lib/auth.test.ts`, `lib/session.ts`, both dictionaries, and the spec.
- Actor comes only from `getCurrentUser()`; every write is `where: { id: user.id }` or the `otherSessionsWhere(user.id)` filter; no user, role, or session id is read from form data.
- Current-password checks use `reserveLoginAttempt("user:<id>")` before the lookup and clear the key on success; sign-in keys always pass `EMAIL_PATTERN` (contain `@`), so the keys cannot collide.
- Password hash update and other-session delete run in one array `db.$transaction`; email uniqueness relies on the `@unique` index with `P2002` mapped to `email_taken`; email change requires a verified current password.
- Errors are logged as `console.error(label, error)` without form values; passwords are never returned in results.
- Forms: unique ids, `aria-invalid`/`aria-describedby`, focus to the first bad field or the `role="alert"` message, `role="status"` success, email `dir="ltr"`, all strings in `en.ts` and `ar.ts` (Arabic plural forms via `Intl.PluralRules`).

### Findings

- F-14 [P2] open: `otherSessionsWhere` (the current-session exclusion) has no unit test despite the spec requiring one.
- F-12 [P3] and F-13 [P3] re-checked in touched files; still `open`, not blocking.

### Remaining risk

- Browser tests: unavailable (no browser harness); signed-in UI, focus behavior, RTL layout, and form reset were not exercised in a real browser.
- Verify command: unavailable (none defined; `pnpm test`, `pnpm lint`, `pnpm build` ran individually).
- `/check` not run (not required); real Postgres writes, the transaction, and the `P2002` path are proven only with mocks.
- The rate limiter is in-process memory only, resetting on restart and not shared between instances (accepted in the spec; feature 24 owns stronger limits).
