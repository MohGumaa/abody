# Feature: Homepage Sections and Promotion

**From build-plan:** feature 21b
**Build attempt:** 1
**Branch:** feature/homepage-sections-and-promotion
**Status:** verified

## Goal

Admins can change the home page without a code change. They can edit the hero
and call-to-action text in English and Arabic and show or hide the home
sections. They can also run one site-wide announcement bar above the header,
with English and Arabic text, an optional link, and an on/off switch.

## In scope

- A single-row `SiteContent` table and its migration. With no row, the site
  looks exactly as it does today.
- `/admin/content` ("Site content"), a protected admin page with one form and
  one Save button. It has four cards: Hero, Home sections, Call to action, and
  Announcement bar.
- Hero text: eyebrow, title, and lead, in English and Arabic.
- Call-to-action text: title, body, and button label, in English and Arabic.
- Each text field is optional. A blank field shows the built-in dictionary text
  for that language.
- A show/hide switch for each home section below the hero: Shop by category,
  Featured products, Services, Why Abody (the value panels), How it works, and
  Call to action. All are shown by default. The hero is always shown because it
  holds the page's `h1`.
- The announcement bar: an on/off switch, English and Arabic text, and an
  optional link. It renders above the header on every customer page in both
  languages, and never in `/admin`.
- A "Site content" link in the admin side navigation.

## Out of scope

- `/admin/settings` and the footer contact email (21c). These come later and
  may add their own field to `SiteContent`; this feature does not add it.
- The Information Pages (27).
- Editing the hero button labels, the section headings or intros, the value
  panels, the How it works steps, or the header and footer text.
- Reordering home sections, scheduling the announcement, letting visitors
  dismiss it, running more than one bar, and keeping a history of edits.
- Images in the hero or the bar.

## Build loop

The config has `workflow.stepReview: "feature"` and
`workflow.checkpointCommits: "disabled"`. Build all steps in order and run the
step checks as you go. Pause for one review after the last step. No checkpoint
commits; `/complete` creates the feature commit.

## Build steps

1. [x] **Schema and rules.**
   - Add the `SiteContent` model (see Data / contracts) to
     `prisma/schema.prisma` and run
     `pnpm exec prisma migrate dev --name add_site_content`.
   - Add the field limits, section keys, and these pure functions to
     `lib/site-content-rules.ts`, with no `next/*` or db imports:
     - `parseSiteContentForm(formData)`
     - `resolveHomeContent(row, locale, homeDictionary)`, which returns the hero
       text, call-to-action text, and visible sections
     - `resolveAnnouncement(row, locale)`, which returns `null` or
       `{ text, href }`
   - Add `lib/site-content-rules.test.ts`.
   - **Done when:** the tests cover blank-to-default per language, the length
     limits, whitespace trimming, the default visibility for each section, the
     announcement-on rule that both texts are required, the link rules (store
     path gets the language prefix; `https://` is kept as is; `//x`, `http://`,
     `javascript:`, `/en/...`, `/ar/...`, and whitespace are rejected), and a
     `null` row. `pnpm test` passes and `pnpm exec prisma migrate status`
     reports the schema is up to date.
2. [x] **Server read and save action.**
   - Add `getSiteContent()` to `lib/site-content.ts`. It is wrapped in React
     `cache()` so the layout and the home page share one query per request. It
     returns the row or `null`. On a database error it logs with
     `console.error` and returns `null`.
   - Add `saveSiteContent` to `actions/admin-site-content.ts`, following
     `actions/admin-coupons.ts`:
     1. `requireAdmin()` first, outside the try block.
     2. Parse the form.
     3. Upsert the row where `id = 1`.
     4. `revalidatePath("/[lang]", "layout")` and
        `revalidatePath("/admin/content")`.
   - Errors: `invalid_fields` (with field errors and the submitted values) or
     `unexpected`.
   - **Done when:** a unit test for the action, with `requireAdmin`, `db`, and
     `next/cache` mocked (the same pattern as
     `app/api/stripe/webhook/route.test.ts`), shows four things: invalid input
     returns field errors without a write, valid input upserts `id: 1` with
     `null` for blank text, a non-admin call never reaches `db`, and a database
     error returns `unexpected`. `pnpm test` passes.
3. [x] **Admin page.**
   - Build `app/admin/content/page.tsx` and
     `components/admin/SiteContentForm.tsx` with the four cards. Reuse the
     CouponForm field shell, error maps, and focus behavior.
   - Pass the built-in text as each field's placeholder.
   - Add the nav entry in `app/admin/layout.tsx`, plus a new icon in
     `components/icons.tsx` and in the `ICONS` map in
     `components/admin/SideNav.tsx`.
   - **Done when:** an admin can load `/admin/content`, save, reload, and see
     the saved values. Invalid input shows an error on each field and a
     form-level alert, and keeps what was typed. A customer or guest gets the
     admin 404. `pnpm lint` and `pnpm build` pass.
4. [x] **Storefront.**
   - In `app/[lang]/page.tsx`, use `resolveHomeContent` for the hero and
     call-to-action text and render only the visible sections.
   - Add `components/layout/AnnouncementBar.tsx` and render it in
     `app/[lang]/layout.tsx` above `<SiteHeader />`.
   - Add `announcement.label` to both dictionaries ("Announcement" and
     "إعلان").
   - **Done when:**
     - With no row, `/en` and `/ar` look as they do today with no bar.
     - After saving edits, both languages show their own text, and a blank
       Arabic field shows the built-in Arabic text.
     - Hidden sections are gone.
     - The bar shows on `/ar/products` with a right-to-left layout, its store
       link goes to `/ar/...`, and it is absent from `/admin`.
     - `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Files / areas

- `prisma/schema.prisma`, plus a new
  `prisma/migrations/<timestamp>_add_site_content/`
- New files:
  - `lib/site-content-rules.ts` and `lib/site-content-rules.test.ts`
  - `lib/site-content.ts`
  - `actions/admin-site-content.ts` and its test
  - `app/admin/content/page.tsx`
  - `components/admin/SiteContentForm.tsx`
  - `components/layout/AnnouncementBar.tsx`
- Changed files:
  - `app/admin/layout.tsx` (the `NAV_SECTIONS` "Admin" group)
  - `components/admin/SideNav.tsx` and `components/icons.tsx`
  - `app/[lang]/page.tsx` and `app/[lang]/layout.tsx`
  - `lib/i18n/dictionaries/en.ts` and `ar.ts`

## Data / contracts

### `SiteContent` model

There is a single row with `id = 1`. A missing row means all defaults. Only the
save action writes it, using `upsert`, and the last save wins.

| Field | Type | Default / rule |
| --- | --- | --- |
| `id` | `Int @id @default(1)` | always 1 |
| `heroEyebrow`, `heroEyebrowAr` | `String?` | up to 60 characters |
| `heroTitle`, `heroTitleAr` | `String?` | up to 120 |
| `heroLead`, `heroLeadAr` | `String?` | up to 300 |
| `ctaTitle`, `ctaTitleAr` | `String?` | up to 120 |
| `ctaBody`, `ctaBodyAr` | `String?` | up to 300 |
| `ctaAction`, `ctaActionAr` | `String?` | up to 40 |
| `showCategories`, `showFeatured`, `showServices`, `showValues`, `showHowItWorks`, `showCta` | `Boolean @default(true)` | |
| `announcementEnabled` | `Boolean @default(false)` | |
| `announcementText`, `announcementTextAr` | `String?` | up to 160; both required when enabled |
| `announcementLink` | `String?` | up to 200; see link rules |
| `updatedAt` | `DateTime @updatedAt` | |

### Parsing rules

- Text is trimmed. Empty or whitespace-only text is stored as `null`.
- Line breaks are not allowed in single-line fields. Lead and body text are
  textareas whose line breaks are folded to spaces.
- A checkbox that is present means `true`. A missing checkbox means `false`.

### Link rules

- A store path must start with a single `/` and contain no whitespace, `\`, or
  `//`. Its first segment must not be `en` or `ar`. It is rendered as
  `localizedPath(locale, path)`.
- Anything else must parse with `new URL()` as `https:`. It is rendered as is,
  in the same tab.
- Any other value is `invalid_link`.

### Field errors

| Error | Message |
| --- | --- |
| `too_long` | "Use N characters or fewer." |
| `required` | "Add the English and Arabic text to turn the bar on." This shows on the missing text field(s) when enabled. |
| `invalid_link` | "Use a store path such as /products, or a full https:// address." |

### Rendering

- All admin text is rendered as plain React text, never as HTML.
- Arabic inputs in the admin form use `lang="ar" dir="rtl"`.
- The bar is an `<aside aria-label={announcement.label}>` with brand-colored,
  centered small text. With a link, the whole text is one link with a visible
  focus outline.

## Testing

Use Vitest (`pnpm test`) for the rules module and the action. No browser test
command exists. Check the admin page and the storefront by hand in `/en` and
`/ar` during `/check`.

## Notes for the AI

- Read `node_modules/next/dist/docs/` for `revalidatePath` and `cache` before
  writing step 2.
- Customer pages are already rendered per request because `SiteHeader` reads
  cookies, so edits show on the next request. `revalidatePath` matches what the
  Stripe webhook already does.
- `getSiteContent()` must not throw. A layout error has no error boundary under
  `app/[lang]`, so the fallback keeps every customer page up and only drops the
  admin's edits and the bar.
- The admin area stays English-only. Do not add the form's labels to the
  customer dictionaries.
- The admin page reads with `readSiteContent()`, which throws, not the
  store's `getSiteContent()`: an empty form after a failed read would let the
  next save wipe the saved content. (Added during implementation.)
- Keep `lib/home.ts`'s `selectHomeSections` unchanged. A hidden section only
  skips rendering.

## Decisions taken without a question (reversible)

- **Hero always shown.** The hero holds the page's `h1`, so it cannot be hidden.
- **Blank falls back per language.** A blank field shows the built-in text for
  that language. An Arabic page never shows English text that an admin typed.
- **Both texts required for the bar.** The bar can only be turned on with both
  English and Arabic text, because all customer text must exist in both
  languages.
- **Separate page from 21c.** The editor lives at `/admin/content`, kept apart
  from 21c's `/admin/settings`.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":10664,"specSha256":"8a7716014dd3e560afa751b9eb7ba2f71666cb4788a52d7141e51489b41d4f68","branch":"refs/heads/feature/homepage-sections-and-promotion","head":"3c6957c36c2be7fdf3e74dd69301cc67c3fd2bb6","baseRef":"refs/heads/main","baseCommit":"0d55894c67f15cf3d7d50f7d91625bfa53e9b6df","sourceTree":"a5ae6901230b4f022a32370c833705db03a9a2a0","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 3c6957c36c2be7fdf3e74dd69301cc67c3fd2bb6
**Base commit:** 0d55894c67f15cf3d7d50f7d91625bfa53e9b6df
**Base ref:** refs/heads/main
**Spec hash:** 8a7716014dd3e560afa751b9eb7ba2f71666cb4788a52d7141e51489b41d4f68
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-11T09:30:00Z
**Workflow:** regular
**Check required:** no

### Handoff

Review the active spec and the complete `0d55894c67f15cf3d7d50f7d91625bfa53e9b6df..3c6957c36c2be7fdf3e74dd69301cc67c3fd2bb6` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-11T05:40:13Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Commands

- `pnpm test`: pass (963 tests)
- `pnpm lint`: pass
- `pnpm build`: pass (`/admin/content` built as dynamic)

### Evidence

- Freshness: `HEAD` = target, `git merge-base refs/heads/main HEAD` = base, raw SHA-256 of tracked `current-feature.md` = spec hash, only `review.md` and `findings.md` differ from the target.
- Read the full 18-file delta: `lib/site-content-rules.ts` and test, `lib/site-content.ts`, `actions/admin-site-content.ts` and test, `app/admin/content/page.tsx`, `components/admin/SiteContentForm.tsx`, `components/layout/AnnouncementBar.tsx`, `app/[lang]/page.tsx`, `app/[lang]/layout.tsx`, admin nav and icon, both dictionaries, schema and migration.
- Security: `requireAdmin()` (notFound for non-admins) guards the page and runs first in the action outside `try`; the action test proves no `db` write when it throws. All admin text renders as React text. Link rules reject `//`, `\`, whitespace, locale-prefixed paths, `http:`, and `javascript:`; `resolveAnnouncement` re-validates stored links before rendering.
- Data integrity: the admin page reads with the throwing `readSiteContent()`, so a failed read never shows an empty form that a save would persist; the store's `getSiteContent()` is wrapped in React `cache()` and falls back to `null`.
- Performance: one cached `SiteContent` query per customer request, shared by the layout bar and the home page; no new unbounded work.
- Tests cover blank-to-default per language, limits, trimming, line-break folding, default visibility, announcement-on rule, link accept/reject cases, null row, and the four action cases the spec names. `revalidatePath` usage matches existing actions.

### Findings

- F-37 [P3] open - A failed site content save drops every edit the admin typed

### Remaining risk

- Check not required and not run: admin save/reload, `/en` and `/ar` rendering, RTL bar layout, and absence of the bar in `/admin` were not exercised in a browser.
- No browser test command and no Verify command are declared.
