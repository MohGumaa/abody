# Fix: Admin redesign, storefront font, and 404 for non-admins

**Type:** Fix
**Status:** verified
**Branch:** fix/admin-redesign-storefront-font-and-404-for-non-admins
**Fixes:** F-20

## The problem

Three issues with the admin area at `/admin`, raised before the next feature:

1. **Wrong font.** The storefront's English pages render Geist, but the admin
   pages render the system font (Segoe UI on Windows). `--font-body` in
   `app/globals.css` is `var(--font-geist-sans), var(--font-tajawal), ...` and
   `app/admin/layout.tsx` never loads Tajawal, so `--font-tajawal` is undefined.
   That makes the whole `--font-body` value invalid, and `font-sans` falls back
   to the browser default. Confirmed in the browser by removing the Tajawal
   variable class on `/en`: the body font switched from Geist to the system stack.
2. **The admin area is revealed to signed-out visitors.** A signed-in non-admin
   already gets a 404, but `requireAdmin()` in `lib/admin.ts` redirects a
   signed-out visitor to `/en/login?next=%2Fadmin`, which shows the area exists.
   The client chunk every `/admin` response loads also still exports the name
   `AdminNav` (F-20).
3. **Dated layout.** The admin chrome is a plain header plus a fixed sidebar
   that turns into a horizontal strip on small screens, with no way to shrink
   or hide it.

## The fix

**Design reference:** `prototypes/admin.html` (approved 2026-10-07; the view
switch at the bottom shows the admin and the 404). It uses the existing tokens
in `app/globals.css`; no new colors.

- **Font:** load Tajawal in the admin layout exactly as `app/[lang]/layout.tsx`
  does (same options), so `--font-body` resolves to Geist like the English
  storefront, and Arabic customer names in admin tables render in Tajawal.
- **404 for everyone but an admin:** `requireAdmin()` calls `notFound()` for a
  signed-out visitor too, and drops its now-unused `path` parameter. Admins sign
  in through the normal store login, then open `/admin` (approved: no automatic
  return to `/admin` after sign-in). `adminMetadata()` already gives non-admins
  the generic "Page not found" title.
- **New shell (prototype layout):**
  - Sidebar: brand mark with "Abody / Admin console", sectioned nav (Admin,
    Storefront) with the active page tinted and an edge indicator, storefront
    links marked as leaving the admin, and the signed-in user plus Sign out at
    the bottom.
  - Top bar (sticky, blurred): a sidebar toggle button, a breadcrumb
    ("Admin > <current page label>", from the nav links), and "View store".
  - Toggle on desktop (960px and up): collapses the sidebar to a 76px icon rail.
    Labels stay as screen-reader-only text so links keep their names; a hover
    tooltip shows the label. The state is saved in a cookie (`path=/admin`, one
    year, `SameSite=Lax`) and read by the server layout, so a reload renders
    collapsed with no flicker.
  - Toggle below 960px: opens and closes an off-canvas drawer with a scrim. The
    drawer always shows labels, closes on scrim click, Escape, or navigation.
  - The toggle has `aria-controls` and `aria-expanded` and a label that matches
    its action (Collapse/Expand sidebar, Open/Close menu). Motion is disabled
    under `prefers-reduced-motion`.
- **Dashboard restyle:** page head with today's date chip; the six stat cards in
  a 1/2/3-column grid as bordered cards with the icon at the top end, Revenue as
  the dark featured card; recent orders in a card with a tinted header row,
  customer initials, right-aligned Items and Total, and the existing status
  chips. Same data, no new queries. Each `dl` group keeps only `dt`/`dd`
  (the F-21 rule).
- **404 page:** the prototype's centered 404 (wordmark, large gradient "404",
  "Page not found", "Go to the store") for non-admins; for an admin on an
  unknown `/admin/...` URL the same content renders as a section inside the shell.
- **F-20:** the client component is renamed to a neutral name
  (`components/admin/SideNav.tsx`, exports `SideNav` / `SideNavSection`), and the
  new client shell component also has a neutral name and carries no admin
  wording; every admin label still comes from the server layout as props.

**Must not break:** every admin page still calls `requireAdmin()` itself (the
layout stays non-authoritative); no admin chrome or labels reach a non-admin;
the storefront and its fonts are unchanged; the dashboard numbers and order
rows are unchanged; no horizontal page scroll at 390px.

No new dependencies. Read the Next.js 16 `cookies()` guide in
`node_modules/next/dist/docs/` before using it in the layout.

## Build steps

- [x] **1. Font and 404 for non-admins.** Load Tajawal in `app/admin/layout.tsx`;
  make `requireAdmin()` 404 when signed out and drop its argument (update callers
  and `lib/admin.test.ts`: signed out and customer both 404, admin resolves,
  `redirect` never called); restyle `app/admin/not-found.tsx` per the prototype.
  Done when: `pnpm test` passes; in the browser, signed out at `/admin` returns
  the 404 page (HTTP 404, URL unchanged, no login redirect) and an admin's body
  font computes to Geist like `/en`.
- [x] **2. Collapsible shell.** Rename `AdminNav` to `SideNav` (F-20), add the
  client shell (sidebar, top bar, toggle, drawer, cookie) and rebuild
  `app/admin/layout.tsx` on it.
  Done when: at 1366px the toggle collapses to the icon rail and back, and a
  reload keeps the state; at 390px it opens and closes the drawer (scrim and
  Escape close it); `aria-expanded` and the label follow the state; after
  `pnpm build`, `grep -rlF Admin .next/static` finds nothing; `pnpm lint` passes.
- [x] **3. Dashboard restyle.** Update `app/admin/page.tsx` to the prototype's
  page head, stat cards, and orders table.
  Done when: the dashboard matches the prototype at 1366px and 390px with no
  horizontal page scroll, `dl > div > :not(dt):not(dd)` matches 0 elements, and
  `pnpm build` passes.

## Verify

- Signed out, open `/admin` and `/admin/anything`: the 404 page, no redirect.
- Signed in as a customer, same URLs: the same 404.
- Signed in as an admin: the new shell and dashboard; the body font is Geist
  (matches `/en`). Collapse the sidebar, reload: still collapsed. At phone width
  the toggle opens a drawer that closes with the scrim, Escape, or a link.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass; `grep -rlF Admin .next/static`
  is empty.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":6404,"specSha256":"aae8f0e40c91d986a6886d68097e33605b4c68533a67e1b4b86528110f1ddfde","branch":"refs/heads/fix/admin-redesign-storefront-font-and-404-for-non-admins","head":"056b7d1d11364cecc2445857367cbbb1d38bf70c","baseRef":"refs/heads/main","baseCommit":"a8144ad85cd5f8f83d564929f22cb2f6fde16c25","sourceTree":"6d7957c57bebf70faabf11faa3c247f2c97023d0","absentOptional":[]} -->

## Findings

### admin-redesign-storefront-font-and-404-for-non-admins/F-20 [P3] closed - The client chunk that a non-admin's /admin 404 loads still exports the name "AdminNav"

**File:** components/admin/AdminNav.tsx:29
**Found:** 2026-10-07 by /audit independent (scope: current; lens: security)
**Why it matters:** Step 7 removed the nav labels from client code, but Turbopack keeps module export names in production chunks. The `app/admin/layout` entry chunk `.next/static/chunks/137hquc5a9w-2.js` (1.3 KB, listed for the layout, page, error, and not-found entries in `.next/server/app/admin/page_client-reference-manifest.js`) registers the export as `e.s(["AdminNav",0,function(...){...}])`. That script loads on every response from the admin root layout, including the 404 a signed-in customer gets at `/admin`. Its only admin-revealing text is that name. Spec step 7's literal Done-when ("Storefront", "Admin navigation", "Dashboard") is met, but the contract intent ("non-admin -> 404, does not reveal that `/admin` exists") is not fully met. The impact is very small: no data or capability is exposed, `/_next/static` chunks are public anyway, and the spec already accepts that a signed-out visitor is redirected to `/en/login?next=%2Fadmin`.
**Suggested fix:** Rename the component and its exported type to a neutral name (for example `SideNav` / `SideNavSection` in `components/admin/SideNav.tsx`, or a neutral folder), rebuild, and confirm `grep -rlF Admin .next/static` finds nothing. Alternatively, record in the spec that a component name in static client code is acceptable (user decision). Requirement lost: None.
**Resolution:** Fixed 2026-10-07 by fix "Admin redesign, storefront font, and 404 for non-admins": `AdminNav` became `components/admin/SideNav.tsx` (`SideNav` / `SideNavSection`), and the new client `SidebarShell` carries only neutral wording, with every admin label passed from the server layout. After `pnpm build`, `grep -rlF Admin .next/static` finds nothing. Awaiting `/audit` closure. Closed 2026-10-07 by /audit independent (scope: current; lenses: quality, security, performance, tests; target 056b7d1, fresh subagent): `components/admin/AdminNav.tsx` no longer exists at the target, and the only callers import `SideNav` / `SideNavSection` from `components/admin/SideNav.tsx`. Both client modules (`SideNav`, `SidebarShell`) hold only neutral labels; every admin label is passed from the server layout, which renders the shell only for an admin. A fresh `pnpm build` followed by `grep -rlF Admin .next/static` found no file. A case-insensitive search found one lowercase `admin`, the cookie attribute `path=/admin` in the shell chunk. That chunk is referenced only by the `/admin` and `/admin/[...rest]` client manifests, so it reaches only someone who already requested an `/admin` URL and reveals nothing beyond it. The repair added no new defect.

### admin-redesign-storefront-font-and-404-for-non-admins/F-21 [P3] closed - Dashboard stat groups put a span inside the dl's div group, which the HTML content model does not allow

**File:** app/admin/page.tsx:95
**Found:** 2026-10-07 by /audit independent (scope: current; lens: quality)
**Why it matters:** Each stat card is a `<div>` inside `<dl>` that holds the icon `<span>` followed by `<dt>` and two `<dd>`s. In HTML, a `div` inside a `dl` may contain only `dt` and `dd` elements (plus script-supporting elements). The span is not `aria-hidden` (only the SVG inside it is), so the markup is invalid, and checkers such as axe's `definition-list`/`dlitem` rules can flag it. Screen readers usually still read the term and value, so the practical impact is small. Other `dl`s in the project (`components/cart/CartSummary.tsx:38`) keep their groups to `dt`/`dd` only.
**Suggested fix:** Move the icon into the `<dt>` (for example `<dt><span ...><Icon /></span>Revenue</dt>`, adjusting the grid), or put the decorative icon box on a wrapper outside the `dt`/`dd` group. Marking the span `aria-hidden="true"` alone hides it from assistive tech but leaves the markup invalid. Requirement lost: None.
**Resolution:** Fixed 2026-10-07 by fix "Valid markup for dashboard stat cards": the icon box moved inside each `<dt>` with `aria-hidden="true"`, positioned absolutely at the card's start edge. Browser check on `/admin`: `dl > div > :not(dt):not(dd)` matched 0 elements across 6 groups, terms read as the bare labels, layout unchanged at 390px and 1366px. Awaiting `/audit` closure. Closed 2026-10-07 by /audit (scope: app/admin/page.tsx; lenses: quality, security, performance, tests) at main a8144ad: each `dl` group now holds only one `dt` and two `dd`, the icon wrapper inside the `dt` is `aria-hidden="true"` so each term's name is the label alone, and the repair added no new defect (lint and 472 tests pass; tree identical to the fix commit that passed `pnpm build`).

## Independent review

# Independent Review

**Status:** passed
**Target commit:** 056b7d1d11364cecc2445857367cbbb1d38bf70c
**Base commit:** a8144ad85cd5f8f83d564929f22cb2f6fde16c25
**Base ref:** main
**Spec hash:** aae8f0e40c91d986a6886d68097e33605b4c68533a67e1b4b86528110f1ddfde
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-07T15:20:22Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-07T15:26:08Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `a8144ad85cd5f8f83d564929f22cb2f6fde16c25..056b7d1d11364cecc2445857367cbbb1d38bf70c` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `pnpm lint`: pass
- `pnpm test`: pass (32 files, 472 tests)
- `pnpm build`: pass
- `grep -rlF Admin .next/static` (after the build): pass (no files)

## Evidence

- Preconditions: `HEAD` = target, `git merge-base main HEAD` = base, raw spec SHA-256 matches, and the only path differing from the target was `blueprint/context/review.md`.
- Reviewed all 13 changed paths in the delta against the spec: `app/admin/layout.tsx`, `app/admin/not-found.tsx`, `app/admin/page.tsx`, `app/globals.css`, `components/admin/SideNav.tsx`, `components/admin/SidebarShell.tsx`, `components/icons.tsx`, `lib/admin.ts`, `lib/admin.test.ts`, `lib/sidebar.ts`, plus the removed `components/admin/AdminNav.tsx`.
- `requireAdmin()` (`lib/admin.ts:20`) now calls `notFound()` for any non-admin user or no user, takes the role only from the session user row, and no longer imports `redirect`. Its only caller (`app/admin/page.tsx:40`) calls it before any data read. `app/admin/[...rest]/page.tsx` 404s unconditionally. Tests cover the signed-out, customer, and admin cases, with `redirect` never called.
- The layout renders `SidebarShell`, the nav labels, the user's name and email, and the sign-out form only when `user.role === "ADMIN"`. Otherwise it renders only the children (the neutral 404). Both client modules carry only neutral strings. The only lowercase `admin` in `.next/static` is the cookie attribute `path=/admin` in a chunk referenced solely by the `/admin` and `/admin/[...rest]` client manifests.
- The sidebar cookie is read server-side only as an equality check against `"collapsed"`, so a tampered value cannot inject markup or change authorization.
- `getCurrentUser` is wrapped in React `cache()`, so the layout, metadata, page, and not-found share one session lookup per request. The dashboard query set (`getAdminOverview`) is unchanged.
- Tajawal loads with the same options as the storefront layout. The one new token (`--color-ink-raised`) is the prototype's exact featured-card color, tokenized per the coding standards.

## Findings

- F-20 [P3] closed this pass (AdminNav rename; no `Admin` in `.next/static`)
- No new findings

## Remaining risk

- Browser behavior (rail collapse and reload persistence at 1366px, the drawer with scrim and Escape at 390px, computed body font, HTTP 404 status) was not exercised in this review. Check was not required, and this review relied on code reading plus the build.
- The dashboard activity state (`blueprint/.state/run.json`) was not updated by this reviewer, because the handoff limited writes to `findings.md` and `review.md`.
