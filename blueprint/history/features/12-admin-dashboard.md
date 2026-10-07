# Feature: Admin Dashboard

**From build-plan:** feature 12
**Build attempt:** 1
**Branch:** feature/admin-dashboard
**Status:** verified

## Goal

Give Abody admins a protected `/admin` area whose first page is an overview of
the store: revenue, orders, registered customers, products, services, active
service work, and the most recent orders. Establish the admin shell, the
server-side admin check, and the way an account becomes an admin, so features
13-21 only add pages to it.

Decisions made at spec time (resolve overview open question 2):

- **Admin is English-only at unprefixed `/admin`.** It is excluded from the
  language redirect and has its own root layout (`lang="en"`, `dir="ltr"`).
  Later admin features add English text only, no Arabic dictionary entries.
- **Admins are created by a promote script**, `pnpm admin:promote <email>`, run
  from a shell with `DATABASE_URL`. It sets an existing registered user's
  `role` to `ADMIN`. No web request can grant the role.

## In scope

- `/admin` route outside `app/[lang]`, with its own root layout, error
  boundary, and not-found page.
- `proxy.ts` leaves `/admin` and `/admin/...` unprefixed (but `/administrator`
  still redirects like any other customer path).
- Admin check on the server: signed out -> sign-in page that returns to the
  admin page after sign-in; signed in but not an admin -> 404; admin -> page.
- `safeNextPath` also accepts in-site admin paths so sign-in can return there.
- Dashboard stat cards and a recent-orders table, including the empty state.
- `pnpm admin:promote <email>` script.

## Out of scope

- Admin pages for products, services, orders, customers, settings (features
  13-17, 21) and nav links to them. The sidebar shows only what exists now.
- Links from stat cards or order rows to detail pages (no target exists yet).
- An "Admin" link in the customer header or account area; admins open `/admin`
  directly.
- Demoting admins, a web UI for roles, multiple admin roles or permissions.
- Date-range filters, charts, analytics (feature 23), refunds (feature 15).
- Arabic or right-to-left admin UI.
- Stronger route/API hardening beyond this feature's own pages (feature 24).

## Build loop

Config: `workflow.stepReview: "feature"`, `workflow.checkpointCommits:
"disabled"`. Implement all steps in order, running `pnpm test` (and `pnpm lint`
where code changed) after each step to keep the project working, then present
one review packet for the whole feature. No checkpoint commits; `/complete`
creates the feature commit. This feature touches the auth/authorization
boundary, so the configured `when-sensitive` independent review is expected to
be selected.

## Build steps

- [x] **1. Promote script.** Add `lib/admin-role.ts` (no `next/*` imports) with
  `promoteToAdmin(email)` (uses `lib/db`; tests mock it) that validates and normalizes the email with
  the existing `normalizeEmail` (and the same email check sign-up uses), looks
  the user up, and sets `role: "ADMIN"`. It returns `"promoted"`,
  `"already-admin"`, `"not-found"`, or `"invalid-email"` and never creates a
  user. Add `scripts/promote-admin.ts` (`import "dotenv/config"`, uses
  `lib/db`, reads `process.argv[2]`, prints one line, exits 1 on not-found,
  invalid, or missing argument, disconnects the client) and the package script
  `"admin:promote": "tsx scripts/promote-admin.ts"`.
  Done when: `lib/admin-role.test.ts` covers all four results and that the
  update is never called for not-found or invalid input; `pnpm test` passes.

- [x] **2. Routing and access helpers.** Add `isAdminPath(pathname)` to
  `lib/i18n/config.ts`: true for exactly `/admin` and paths starting with
  `/admin/` or `/admin?`. In `proxy.ts`, return early for admin paths. Extend
  `safeNextPath` to also accept an admin path (same `//` and `\` rejection and
  length limit). Add `lib/admin.ts` (server only) with `requireAdmin()`:
  `requireAdmin(path)` -> `getCurrentUser()`; null ->
  `redirect("/en/login?next=<path>")`; role not
  `ADMIN` -> `notFound()`; otherwise return the user. The role always comes from
  the session's database row, never from input.
  Done when: tests cover `isAdminPath` (`/admin`, `/admin/x`, `/admin?x=1` true;
  `/administrator`, `/en/admin`, `/` false), `safeNextPath` accepting `/admin`
  and rejecting `//admin`, `/admin\\x`, `/administrator`, and `requireAdmin`'s
  three outcomes with mocked session and `next/navigation`; `pnpm test` passes.

- [x] **3. Admin shell.** Before writing it, read the Next.js 16 docs in
  `node_modules/next/dist/docs/` on multiple root layouts, `not-found`, and
  `error`. Add `app/admin/layout.tsx` as a root layout (`<html lang="en"
  dir="ltr">`, `globals.css`, Geist fonts, `robots: noindex, nofollow`, title
  template `%s | Abody Admin`). Like the account layout, it is not the auth
  boundary: when `getCurrentUser()` is not an admin it renders only `children`
  (so no admin chrome reaches a non-admin); for an admin it renders the shell
  with a sidebar ("Dashboard" link marked `aria-current="page"`, "View store"
  -> `/en`, and a sign-out form posting `lang=en` to the existing `signOut`
  action) and the admin's name and email as React text. Add
  `app/admin/error.tsx` (client, English, retry button) and
  `app/admin/not-found.tsx` (English, link to `/en`). Mobile-first, using the
  existing tokens (`rounded-panel`, `bg-panel`, `shadow-soft`, primary color).
  Done when: `pnpm build` passes, and with the dev server `/admin` signed out
  redirects to `/en/login?next=%2Fadmin`, a customer gets the 404 without admin
  chrome, and an admin sees the shell. `/en`, `/ar`, and an unprefixed customer
  path such as `/products` still behave as before.

- [x] **4. Dashboard data and page.** In `lib/admin.ts`, add
  `getAdminOverview()` returning, in parallel queries:
  - `revenueCents`: sum of `totalCents` of orders in `PAID_ORDER_STATUSES`
    (PAID, PROCESSING, COMPLETED), all time, 0 when there are none.
  - `paidOrders`: count of those orders.
  - `pendingOrders`: count of `PENDING` orders.
  - `customers`: count of users with role `CUSTOMER`.
  - `products`: published and total counts of `DIGITAL_PRODUCT`.
  - `services`: published and total counts of `SERVICE` catalog entries.
  - `activeServices`: paid-order items whose product is a `SERVICE` and whose
    work record is missing (awaiting onboarding) or in `NEW`,
    `WAITING_FOR_INFORMATION`, or `IN_PROGRESS`.
  - `recentOrders`: the 10 newest orders of any status with number, created
    date, status, total, item count, and customer label = user name, else
    `customerEmail`, else "Guest". Selects only those fields.
  Add `app/admin/page.tsx` (calls `requireAdmin()` first, then the data):
  heading "Dashboard", stat cards (Revenue formatted with `formatPriceCents`
  plus "from N paid orders", Orders with pending count, Customers, Products "N
  published of M", Services "N published of M", Active services), and a
  "Recent orders" table (order number via `formatOrderNumber`, customer, items,
  total, status chip with the English order-status labels, date via the
  existing date helper). No orders -> "No orders yet." empty state.
  Done when: `lib/admin.test.ts` asserts the paid-status filter for revenue,
  the role filter for customers, the active-services where clause, the
  customer-label fallback chain, and that no unexpected fields are selected
  (follow the `selectedKeys` pattern in `lib/account.test.ts`); `pnpm test`,
  `pnpm lint`, and `pnpm build` pass; with seed data and a promoted admin the
  page shows the numbers and the table, and the empty state appears with no
  orders.

Revision requested 2026-10-07 after the browser check:

- [x] **5. Neutral titles for non-admins.** The browser tab showed "Dashboard"
  and "Abody Admin" on the 404 a non-admin gets, revealing the area. Add
  `adminMetadata(title?)` to `lib/admin.ts`: for an admin it returns the admin
  title (`"<title> | Abody Admin"`, or `"Abody Admin"` without one); for anyone
  else `{ title: "Page not found" }`, always with `robots: noindex, nofollow`.
  The admin layout and every admin page export `generateMetadata` built on it.
  Done when: tests cover both branches; in the browser a signed-out or customer
  visit to `/admin` and `/admin/x` never shows an admin title.

- [x] **6. Admin header, sidebar, and site navigation.** Replace the single
  card shell with: a full-width top header (Abody logo linking to `/admin`, an
  "Admin" badge, "View store" link to `/en`, and the admin's name, email, and
  sign out); a sidebar with an "Admin" section (Dashboard) and a "Storefront"
  section linking to the store's Home, Products, and Services (`/en/...`). The
  current page is derived from the path in a small client nav component, so
  `aria-current` is only on the link for the current page (repairs F-18). On
  narrow screens the sidebar becomes a horizontally scrolling nav under the
  header. English only, existing tokens.
  Done when: `pnpm lint` and `pnpm build` pass; in the browser at 390px and
  1366px the header, sidebar, and links work, Dashboard is marked current on
  `/admin` and not on the admin 404, and non-admins still see no admin chrome.

- [x] **7. Keep admin labels out of shared client code (repairs F-19).** Next
  loads a layout's client chunks on every response that uses the layout, even
  the 404 a non-admin gets. Move the nav's label, section, and link data into
  the server layout and pass it to `AdminNav` as props; icons are chosen by
  neutral keys (`chart`, `globe`, `grid`, `megaphone`). The client component
  keeps only generic rendering and `usePathname()`.
  Done when: `pnpm lint` and `pnpm build` pass; no built client chunk contains
  "Storefront", "Admin navigation", or "Dashboard"; in the browser the nav still
  renders and marks Dashboard current on `/admin` only.

## Files / areas

- New: `lib/admin-role.ts`, `lib/admin-role.test.ts`, `scripts/promote-admin.ts`,
  `lib/admin.ts`, `lib/admin.test.ts`, `app/admin/layout.tsx`,
  `app/admin/page.tsx`, `app/admin/error.tsx`, `app/admin/not-found.tsx`,
  `components/admin/AdminNav.tsx` (client nav, step 6).
- Changed: `package.json` (script), `proxy.ts`, `lib/i18n/config.ts` (+ test),
  `lib/auth.ts` (`safeNextPath`, + test).
- Reused: `lib/session.ts` `getCurrentUser`, `actions/auth.ts` `signOut`,
  `lib/delivery.ts` `PAID_ORDER_STATUSES`, `lib/money.ts`, `lib/orders.ts`
  `formatOrderNumber`, `lib/dates.ts`, `lib/auth.ts` `normalizeEmail`, status
  chip tones from `components/account/AccountParts.tsx` (reuse or share them;
  the account chip takes a dictionary, so the admin passes the English labels).

## Data / contracts

- No schema change or migration. `User.role` (`CUSTOMER` | `ADMIN`, default
  `CUSTOMER`) already exists.
- Admin = `getCurrentUser()?.role === "ADMIN"`, read from the database on every
  request (the session lookup is cached per request only), so a promotion or
  later demotion applies on the next request.
- Denied states: signed out -> 307 to `/en/login?next=<admin path>`; signed-in
  non-admin -> 404 (does not reveal that `/admin` exists). Sign-in with
  `next=/admin` returns to `/admin`; a non-admin who signs in that way lands on
  the 404.
- Money: all orders are USD (checkout always uses `usd`), so revenue is a plain
  sum of `totalCents` formatted with `formatPriceCents`. Refunded, cancelled,
  and pending orders are excluded from revenue.
- `admin:promote` exit codes: 0 for promoted or already admin, 1 otherwise.
  Output never includes the password hash or other user fields beyond the email.

## Testing

- Unit (Vitest, `pnpm test`): `lib/admin-role.test.ts`, `lib/admin.test.ts`,
  additions to `lib/i18n/config.test.ts` and `lib/auth.test.ts`, mocking `db`,
  `@/lib/session`, and `next/navigation` as existing tests do.
- `pnpm lint` and `pnpm build` after the shell and page steps.
- Manual (no browser harness configured): signed out, customer, and admin
  visits to `/admin`; empty and populated dashboard; customer routes and the
  language redirect unchanged; `pnpm admin:promote` with a known, unknown,
  and malformed email.

## Notes for the AI

- A static `app/admin` segment takes precedence over the dynamic `app/[lang]`
  segment; confirm `/admin` never renders the customer layout.
- Every admin page in this and later features must call `requireAdmin()`
  itself. The layout check only hides chrome.
- Render user names and emails as React text only.
- Keep `lib/admin-role.ts` and `lib/i18n/config.ts` free of `next/*` imports
  (the script and `proxy.ts` load them).
- After this ships, suggest recording the admin language and promote decisions
  in `project-plan.md` and re-running `/overview` to close open question 2.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":12736,"specSha256":"2f3a0e24b9edd0e0ee988655125e3b6484282462848fd2fb0b6477cb5c4e65d8","branch":"refs/heads/feature/admin-dashboard","head":"e7046a8113831d9f1d6f685dae9ecd2f524eb87a","baseRef":"refs/heads/main","baseCommit":"c1d6d5446c02cf89eaaafc23d280c92036e47311","sourceTree":"d6865024ad0b2a7ffcf9467e8b27d59096fc3538","absentOptional":[]} -->

## Findings

### 12/F-18 [P3] closed - Admin sidebar marks "Dashboard" as the current page on every admin URL, including the admin 404

**File:** app/admin/layout.tsx:73
**Found:** 2026-10-07 by /audit independent (scope: current; lens: quality)
**Why it matters:** The admin root layout hard-codes `aria-current="page"` on the "Dashboard" link. Today the only other admin URL an admin can reach is an unknown `/admin/...` path, which `app/admin/[...rest]/page.tsx` turns into the admin not-found page inside the same shell. There, screen-reader users hear "Dashboard, current page" next to a "Page not found" heading. This is the same class of issue as F-15. Features 13-21 add pages to this shared layout, so leaving the attribute fixed would make it wrong on every later admin page. The spec asks for the Dashboard link to be marked current, and on `/admin` itself it is correct.
**Suggested fix:** Smallest option for now: keep the attribute but derive it from the current path, for example by moving the nav into a small client component that compares `usePathname()` with each link's `href`. Later admin features can extend that component. Alternatively drop `aria-current` until a second admin page exists. Requirement lost: None.
**Resolution:** Fixed 2026-10-07 in spec step 6: the nav moved to the client component `components/admin/AdminNav.tsx`, which sets `aria-current` only when `usePathname()` equals the link; browser check showed Dashboard marked on `/admin` and nothing marked on `/admin/x`. Awaiting `/audit` closure. Closed 2026-10-07 by /audit independent (target 07a92ce, fresh subagent): `app/admin/layout.tsx` no longer sets `aria-current`; `components/admin/AdminNav.tsx:424-429` sets it only when `usePathname()` equals the link's `href`, so on `/admin` only Dashboard is marked and on an admin 404 (`/admin/x`) or any later admin page nothing is falsely marked. The storefront links (`/en/...`) can never match a path inside this layout. The repair introduced no new accessibility defect in the nav (labels are visible text, icons decorative, focus styles present); the separate client-chunk exposure is recorded as F-19.

### 12/F-19 [P3] closed - Non-admins who get the /admin 404 also download the admin nav's client chunk, which contains the admin labels

**File:** components/admin/AdminNav.tsx:392
**Found:** 2026-10-07 by /audit independent (scope: current; lens: security)
**Why it matters:** Next emits each layout's client entry chunks as `<script async>` tags whatever that layout renders (`node_modules/next/dist/server/app-render/get-layer-assets.js`). In the built manifest, `app/admin/layout` has entry chunks `1drtljmpe2wqv.js` and `2wf7j952bdw34.js`. The first contains the hard-coded `SECTIONS` array: "Admin navigation", "Dashboard", "Storefront", and `/admin`. So a signed-in customer's 404 at `/admin` does not show admin chrome, but it does load a script that names the admin nav. That partly defeats the spec's "non-admin -> 404 (does not reveal that `/admin` exists)" intent. The impact is small: no data or capability is exposed, chunks under `/_next/static` are public anyway, and the spec's signed-out redirect to `/en/login?next=%2Fadmin`, plus the proxy not redirecting `/admin`, already shows that the path is special.
**Suggested fix:** Define the section and link data in the server layout and pass it to `AdminNav` as props, so the client chunk holds only generic link rendering and `usePathname()`. Strings then reach the browser only in the RSC payload of an admin render. Alternatively, record in the spec that admin route names in static client code are acceptable (user decision). Requirement lost: None.
**Resolution:** Fixed 2026-10-07 in spec step 7: the nav labels, sections, and links moved into the server layout (`NAV_SECTIONS` in `app/admin/layout.tsx`) and reach `AdminNav` as props; icons use neutral keys. After `pnpm build`, no file under `.next/static` contains "Storefront" or "Admin navigation" (control string from `app/admin/error.tsx` found), and in the browser a customer's `/admin` 404 loaded 18 scripts with no match. Awaiting `/audit` closure. Closed 2026-10-07 by /audit independent (target e7046a8, fresh subagent): `components/admin/AdminNav.tsx` now holds only neutral icon keys and generic rendering, and `NAV_SECTIONS` lives in the server layout (`app/admin/layout.tsx:30-43`), rendered only inside the `isAdmin` branch. A fresh `pnpm build` produced no file under `.next/static` containing "Storefront", "Admin navigation", "Dashboard", "Abody Admin", "Store home", or "/admin", while the control string "This page could not be loaded" (`app/admin/error.tsx`) was found in one chunk. The `app/admin/layout` entry chunks in `.next/server/app/admin/page_client-reference-manifest.js` are now `137hquc5a9w-2.js` and `2wf7j952bdw34.js`, and neither holds the labels. The repair introduced no new defect. The component's export name "AdminNav" was already in that chunk before the repair and is recorded separately as F-20.

## Independent review

**Status:** passed
**Target commit:** e7046a8113831d9f1d6f685dae9ecd2f524eb87a
**Base commit:** c1d6d5446c02cf89eaaafc23d280c92036e47311
**Base ref:** main
**Spec hash:** 2f3a0e24b9edd0e0ee988655125e3b6484282462848fd2fb0b6477cb5c4e65d8
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** runtime default (exact model not known until reviewer starts)
**Requested execution:** automatic
**Requested at:** 2026-10-07T13:54:24Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-07T14:00:19Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Commands

- `git rev-parse HEAD` / `git merge-base main HEAD` / `sha256sum blueprint/context/current-feature.md` / `git status --porcelain --untracked-files=all`: pass (HEAD, merge base, and spec hash match the request; only review.md and findings.md differ)
- `pnpm build`: pass (routes `/admin` and `/admin/[...rest]` built)
- `pnpm test`: pass (32 files, 472 tests)
- `pnpm lint`: pass
- `grep -rlF` over `.next/static` for "Storefront", "Admin navigation", "Dashboard", "Abody Admin", "Store home", "/admin": pass (no matches; control string from `app/admin/error.tsx` found in one chunk)

### Evidence

- Full delta `c1d6d54..e7046a8` reviewed: 18 files (`app/admin/*`, `components/admin/AdminNav.tsx`, `lib/admin.ts`, `lib/admin-role.ts`, `lib/auth.ts`, `lib/i18n/config.ts`, `proxy.ts`, `scripts/promote-admin.ts`, `package.json`, tests, spec).
- Authorization: `requireAdmin` reads the role from `getCurrentUser()` (per-request `cache`) and redirects signed-out visitors to `/en/login?next=%2Fadmin` or calls `notFound()` for non-admins; `app/admin/page.tsx:38` calls it before any data read. The layout renders chrome and the nav data only when `role === "ADMIN"`.
- `safeNextPath`: an admin path must start with `/admin`, and values containing `//` or `\` or longer than 512 characters are rejected, so a protocol-relative or off-origin redirect cannot be built.
- Head metadata: `adminMetadata` returns "Page not found" with noindex for non-admins; tests cover both branches.
- Built client manifest: the `app/admin/layout` entry chunks hold no admin labels; the only remaining admin-identifying literal is the export name "AdminNav" (F-20).
- Data: the recent-orders query selects only the shown fields (asserted in `lib/admin.test.ts`); six aggregate/count queries run in parallel with a bounded `take: 10`.

### Findings

- F-19 closed (labels no longer in client chunks, verified in built output)
- F-20 [P3] open: "AdminNav" export name remains in the client chunk loaded on a non-admin's /admin 404
- F-21 [P3] open: dashboard stat groups put a span inside a dl div group

### Remaining risk

- Check not required and not run: browser behavior (signed-out redirect, customer 404 without admin chrome, admin shell at 390px and 1366px, nav current-page marking) was not observed in this pass.
- `pnpm admin:promote` was not executed against a database; its behavior is covered by `lib/admin-role.test.ts` and source review only.
- No standalone typecheck or Verify command exists; type checking relied on `pnpm build`.
