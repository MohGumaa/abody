# Feature: Site Settings

**From build-plan:** feature 21c
**Build attempt:** 1
**Branch:** feature/site-settings
**Status:** verified

## Goal

Admins set the store's public contact email at `/admin/settings`, and the
customer footer shows it in English and Arabic as a `mailto:` link. With no
email saved, the footer looks exactly as it does today.

## In scope

- A nullable `contactEmail` column on the existing single-row `SiteContent`
  table (21b's spec left room for it) and its migration.
- `/admin/settings` ("Settings"), a protected admin page with one card,
  "Contact", holding one optional email field and a Save button.
- Saving a blank field clears the email; the footer then hides the contact line.
- The footer shows a translated "Email us" label and the saved email as a
  `mailto:` link in the brand column under the blurb, on every customer page in
  both languages.
- A "Settings" link in the admin side navigation, after "Site content".

## Out of scope

- The Contact page, its form, and other information pages (27).
- Any other setting (phone, address, social links, store name, currency,
  email sender addresses). `EMAIL_FROM` and `ADMIN_NOTIFICATION_EMAIL` stay
  environment variables.
- Using the contact email in transactional emails.
- A fallback email from code or environment when none is saved.
- Edit history or per-language email addresses.

## Build loop

The config has `workflow.stepReview: "feature"` and
`workflow.checkpointCommits: "disabled"`. Build all steps in order and run the
step checks as you go. Pause for one review after the last step. No checkpoint
commits; `/complete` creates the feature commit.

## Build steps

1. [x] **Schema and rules.**
   - Add `contactEmail String?` to `SiteContent` in `prisma/schema.prisma` and
     run `pnpm exec prisma migrate dev --name add_site_contact_email`.
   - Add `lib/site-settings-rules.ts` (no `next/*` or db imports) with
     `parseSiteSettingsForm(formData)`. It reads `contactEmail`, applies
     `normalizeEmail` (trim, lowercase) from `lib/auth.ts`, and returns
     `{ ok: true, data: { contactEmail: string | null } }` (blank becomes
     `null`) or `{ ok: false, fieldErrors: { contactEmail: "invalid_email" },
     values }` when `isValidEmail` rejects it. A missing or non-string field is
     treated as blank. Confirm `lib/auth.ts` has no `next/*` or db imports that
     would break Vitest; if it does, stop and report rather than duplicating
     the pattern.
   - Add `lib/site-settings-rules.test.ts`.
   - **Done when:** tests cover blank and whitespace-only to `null`, trimming
     and lowercasing, a valid address, invalid addresses (`a@b`, `no-at`,
     `a b@c.com`, a 255-character address), and a missing field. `pnpm test`
     passes and `pnpm exec prisma migrate status` reports the schema is up to
     date.
2. [x] **Server read and save action.**
   - In `lib/site-content.ts`, add `contactEmail` to the select and the row
     type so `readSiteContent()` and the cached `getSiteContent()` return it
     (one query per request stays shared by the bar, the home page, and the
     footer). Keep `SiteContentData` (the 21b form's write shape) unchanged so
     the Site content save never writes or clears `contactEmail`.
   - Add `saveSiteSettings` to `actions/admin-site-settings.ts`, following
     `actions/admin-site-content.ts`: `requireAdmin()` outside the try, parse,
     `db.siteContent.upsert` on `SITE_CONTENT_ID` writing only
     `contactEmail`, then `revalidatePath("/[lang]", "layout")` and
     `revalidatePath("/admin/settings")`. Result type
     `{ success: true } | { success: false, error: "invalid_fields" |
     "unexpected", fieldErrors?, values? } | null`. Unexpected errors log with
     `console.error` and return `unexpected`. Last save wins.
   - **Done when:** `pnpm build` passes, and the 21b Site content save still
     compiles against the unchanged write shape (each action's upsert touches
     only its own columns).
3. [x] **Admin page and navigation.**
   - Add `app/admin/settings/page.tsx`: `requireAdmin()`,
     `adminMetadata("Settings")`, heading "Settings" with a one-line intro,
     and the form seeded from `readSiteContent()` (a read error goes to the
     admin error boundary, never to an empty form that a save could wipe).
   - Add `components/admin/SiteSettingsForm.tsx` matching
     `SiteContentForm.tsx`: `useActionState`, `CARD`/`INPUT`/`SUBMIT` styles,
     one labelled `type="email"` input (`autoComplete="off"`, `maxLength`
     254, "(optional)" marker, hint "Shown in the store footer. Leave blank to
     hide it."). An invalid value shows "Enter a valid email address, such as
     hello@example.com." tied with `aria-describedby` and `aria-invalid`, and
     focus moves to the field. Form-level success ("Settings saved.") and
     errors use the same live region and wording pattern as the 21b form. The
     submit button is disabled with a pending label while saving. After a
     failed save the typed value is kept. Errors clear on the next successful
     save.
   - Add a gear icon (`SettingsIcon`) to `components/icons.tsx` in the
     existing icon style, register it as `settings` in `SideNav.tsx`'s
     `ICONS`, and add `{ href: "/admin/settings", label: "Settings", icon:
     "settings" }` to `NAV_SECTIONS` in `app/admin/layout.tsx`.
   - **Done when:** `pnpm build` and `pnpm lint` pass. A signed-in admin can
     open Settings from the side nav, save an address, see it again after a
     reload, get the inline error for an invalid one, and clear it. A
     non-admin gets the admin 404.
4. [x] **Footer.**
   - Add `footer.contactLabel` to `lib/i18n/dictionaries/en.ts` ("Email us")
     and `ar.ts` ("راسلنا") and keep the dictionary types aligned.
   - In `components/layout/SiteFooter.tsx`, read `getSiteContent()` and, when
     `contactEmail` is set, render under the blurb: `MailIcon`, the label, and
     a link with `href={`mailto:${email}`}` and the email as React text inside
     `dir="ltr"` so it reads correctly in Arabic. Use the existing footer link
     focus and hover classes. No row, a `null` email, or a failed read renders
     no contact line and no empty space.
   - **Done when:** `pnpm build`, `pnpm lint`, and `pnpm test` pass. With an
     email saved, `/en` and `/ar` footers show the label and a working
     `mailto:` link, the Arabic page shows the address left to right; clearing
     it removes the line on both.
5. [x] **Review repairs (F-38, F-39).**
   - Add `actions/admin-site-settings.test.ts` modeled on
     `actions/admin-site-content.test.ts`: `requireAdmin()` throwing stops
     before the upsert; an invalid email returns `invalid_fields` with the typed
     value and no write; a valid email upserts row 1 with only `contactEmail`
     and revalidates both paths; blank saves `null`; a failed upsert returns
     `unexpected`.
   - Parse before the `try` in `saveSiteSettings` and return the typed email as
     `values` with the `unexpected` error, so the form keeps it.
   - **Done when:** the new action tests pass, including the typed value on
     `unexpected`, and `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Files / areas

- `prisma/schema.prisma`, new migration under `prisma/migrations/`
- `lib/site-settings-rules.ts`, `lib/site-settings-rules.test.ts` (new)
- `lib/site-content.ts` (select and row type)
- `actions/admin-site-settings.ts`, `actions/admin-site-settings.test.ts` (new)
- `app/admin/settings/page.tsx`, `components/admin/SiteSettingsForm.tsx` (new)
- `app/admin/layout.tsx`, `components/admin/SideNav.tsx`, `components/icons.tsx`
- `components/layout/SiteFooter.tsx`
- `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/ar.ts`

## Data / contracts

- `SiteContent.contactEmail String?`: `null` means none. Stored normalized
  (trimmed, lowercase), at most 254 characters, matching `isValidEmail` in
  `lib/auth.ts`. No default; existing rows get `null`.
- The row id stays `SITE_CONTENT_ID` (1). The settings save upserts that row,
  so it works whether or not 21b content was ever saved; a create gets the 21b
  defaults from the schema (all sections shown, bar off).
- Each admin action writes only its own columns, so saving Site content never
  changes the email and saving Settings never changes home content.
- Form field name: `contactEmail`. Field error code: `invalid_email`.

## Testing

- Unit: `lib/site-settings-rules.test.ts` via `pnpm test` (step 1).
- Build and lint gates: `pnpm build`, `pnpm lint`.
- No browser harness exists; the admin and footer behavior in steps 3 and 4 is
  checked manually or by `/check` against the running app with a migrated
  database.

## Notes for the AI

- Read the relevant Next.js 16 guide in `node_modules/next/dist/docs/` before
  touching server actions or `revalidatePath`.
- Trust boundary: the action is an admin-only write to shared data;
  `requireAdmin()` runs in both the page and the action. The email is
  re-validated on the server; the input's `type="email"` is only a hint.
- The email renders only as React text and inside a `mailto:` built from the
  validated value; never via `dangerouslySetInnerHTML`.
- The admin area is English-only; only the footer text is bilingual.
- Do not add a `Company` footer column or Contact link; that is feature 27.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":9325,"specSha256":"1358d719885bdf6728e4da9f7d834ec0a20699afafdea49eb71fe39fb9472274","branch":"refs/heads/feature/site-settings","head":"adb8b69896055a23feb8bf478433823e541a1d4a","baseRef":"refs/heads/main","baseCommit":"d5182e8d1349431a0f138368af077fc0ab424dd9","sourceTree":"b14577d24c55297e4280a5b6b6a6a507a87aab09","absentOptional":[]} -->

## Findings

### 21c/F-38 [P2] closed - saveSiteSettings ships without an action test, so its admin guard and own-columns-only write are unproven

**File:** actions/admin-site-settings.ts:30
**Found:** 2026-10-11 by /audit independent (scope: current; lens: tests)
**Why it matters:** `blueprint/context/coding-standards.md` (Testing, lines 154-162) names server actions as in-scope logic and requires a step that adds one to ship a passing test in the same diff. Every other action in `actions/` has a `*.test.ts`, including `actions/admin-site-content.test.ts`, which this action copies. No `actions/admin-site-settings.test.ts` exists. Three contracts rest on this action alone and no automated check covers them: `requireAdmin()` stops the write before any database call (an admin-only write to shared data), the upsert on `SITE_CONTENT_ID` writes only `contactEmail` so a Settings save never resets home content (the spec's "each admin action writes only its own columns"), and a database failure returns `unexpected` after logging. Dropping the `await requireAdmin()` line, or spreading other columns into `update`, would leave `pnpm test` green. The shipped code is correct today; this is a coverage gap on a trust-boundary write.
**Suggested fix:** Add `actions/admin-site-settings.test.ts` modeled on `actions/admin-site-content.test.ts`: requireAdmin throwing stops before `upsert`; an invalid email returns `invalid_fields` with values and no write; a valid email upserts row 1 with `update: { contactEmail }` only and calls both `revalidatePath`s; blank saves `contactEmail: null`; a rejected `upsert` returns `unexpected`. Requirement lost: None.
**Resolution:** Fixed 2026-10-11 by /complete repair step 5: added `actions/admin-site-settings.test.ts` (5 tests: admin guard stops the write, invalid email returns values with no write, valid email upserts row 1 with only `contactEmail` and revalidates both paths, blank saves null, failed upsert returns unexpected). `pnpm test` 59 files / 971 tests pass. Awaiting /audit closure. Closed 2026-10-11 by /audit independent (target adb8b69, fresh subagent): `actions/admin-site-settings.test.ts` exists in the target and its five cases assert that a throwing `requireAdmin()` rejects with no `upsert` call, an invalid email returns `invalid_fields` with values and no write, a valid email upserts `{ where: { id: 1 }, create: { id: 1, contactEmail }, update: { contactEmail } }` (exact `toHaveBeenCalledWith`, so extra columns would fail) and calls both `revalidatePath`s, blank writes `null`, and a rejected `upsert` returns `unexpected` with no revalidation. Dropping the admin guard or widening the write now fails `pnpm test` (59 files / 971 tests pass in this pass). No skipped or focused tests; the repair introduced no new defect.

### 21c/F-39 [P3] closed - An unexpected save failure on Settings drops the typed email despite the spec's "typed value is kept" rule

**File:** actions/admin-site-settings.ts:54
**Found:** 2026-10-11 by /audit independent (scope: current; lens: quality)
**Why it matters:** Spec step 3 says "After a failed save the typed value is kept." The `unexpected` result carries no `values`, so `SiteSettingsForm` (`values = failed?.values ?? initial`, `components/admin/SiteSettingsForm.tsx:30`) falls back to the saved email after React resets the form. A transient database error therefore replaces the admin's typed address with the old one while showing "Something went wrong. Try again." Only one field is lost and only on a database failure, so impact is small. This is the same pattern already recorded for the 21b form as F-37, but here the spec states the rule for any failed save.
**Suggested fix:** Keep the parsed value in scope and return `values: { contactEmail: parsed.data.contactEmail ?? "" }` with the `unexpected` error (or parse before the `try`), and assert it in the action test from F-38. Requirement lost: None.
**Resolution:** Fixed 2026-10-11 by /complete repair step 5: `saveSiteSettings` now parses before the try and returns `values: { contactEmail }` with `unexpected`; asserted in `actions/admin-site-settings.test.ts`. Awaiting /audit closure. Closed 2026-10-11 by /audit independent (target adb8b69, fresh subagent): `saveSiteSettings` (`actions/admin-site-settings.ts:33-61`) runs `requireAdmin()` first, parses before the `try`, and the catch returns `values: { contactEmail: parsed.data.contactEmail ?? "" }`; `SiteSettingsForm` (`components/admin/SiteSettingsForm.tsx:30`) refills from `failed.values`, so a database failure keeps the address (normalized: trimmed and lowercased, the same form the invalid path returns). The "returns unexpected with the typed email" test asserts it. Moving the parse out of the `try` is safe because `parseSiteSettingsForm` is pure and cannot throw on any `FormData` value. No new defect.

## Independent review

**Status:** passed
**Target commit:** adb8b69896055a23feb8bf478433823e541a1d4a
**Base commit:** d5182e8d1349431a0f138368af077fc0ab424dd9
**Base ref:** refs/heads/main
**Spec hash:** 1358d719885bdf6728e4da9f7d834ec0a20699afafdea49eb71fe39fb9472274
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-11T06:52:12Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-11T06:57:04Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `d5182e8d1349431a0f138368af077fc0ab424dd9..adb8b69896055a23feb8bf478433823e541a1d4a` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `git rev-parse HEAD` / `git merge-base refs/heads/main HEAD` / `git status --porcelain`: pass (HEAD equals target, merge base equals base commit, only `blueprint/context/findings.md` and `blueprint/context/review.md` dirty)
- `sha256sum blueprint/context/current-feature.md`: pass (matches Spec hash; spec is tracked in the target)
- `pnpm test`: pass (59 files, 971 tests)
- `pnpm lint`: pass (no output)
- `pnpm build`: pass (TypeScript clean, 42/42 static pages; full log read, no runtime errors during prerendering, only the pre-existing pg sslmode deprecation warning)
- `pnpm exec prisma migrate status`: pass (11 migrations, schema up to date)

### Evidence

- Reviewed the full 16-file delta: schema + migration (nullable `contactEmail TEXT`), `lib/site-settings-rules.ts` (reuses `normalizeEmail`/`isValidEmail` from `lib/auth.ts`, which has no `next/*` or db imports), `lib/site-content.ts` (select and `SiteRow` type widened; `SiteContentData` write shape and `actions/admin-site-content.ts` unchanged), `actions/admin-site-settings.ts` and its test, `app/admin/settings/page.tsx`, `components/admin/SiteSettingsForm.tsx`, nav/icon wiring, `SiteFooter.tsx`, and both dictionaries.
- Security: `requireAdmin()` runs in the page and first in the action; the action writes only `contactEmail` on `SITE_CONTENT_ID`; the email is re-validated server-side (254-char cap, no whitespace) and rendered only as React text and in a `mailto:` href, with no `dangerouslySetInnerHTML`.
- Performance: the footer reuses the request-cached `getSiteContent()` shared with the announcement bar and home page, so no extra query; the `[lang]` routes were already dynamic.
- Read failures: admin page uses throwing `readSiteContent()` (error boundary, never an empty form); footer uses non-throwing `getSiteContent()` and renders nothing when the email is null or the read fails.
- Tests: rules suite covers blank/whitespace/missing, normalization, and the four invalid cases including 255 characters; action suite covers guard, invalid, own-column upsert, blank to null, and failure with values. No skipped or focused tests.
- F-38 and F-39 re-examined against target code and closed with evidence in the ledger.

### Findings

- F-38 [P2] closed
- F-39 [P3] closed
- No new findings

### Remaining risk

- Check was not required and was not run; the admin form flow (save, reload, inline error, clear, non-admin 404) and the `/en` and `/ar` footer `mailto:` rendering are verified only by code reading and build/type checks, not in a running app.
- No automated test covers the footer contact line or that `readSiteContent()` selects `contactEmail` (spec defers these to manual/Check).
- No browser test harness is configured; no Verify command exists.
