# Feature: Access Control Sweep

**From build-plan:** feature 24a
**Build attempt:** 1
**Branch:** feature/access-control-sweep
**Status:** verified

## Goal

Prove, with automated tests that cover new code automatically, that the access
rules the store already follows hold everywhere. Every admin page, admin Server
Action, and admin API route refuses anyone but an admin before it reads or
writes data. Every customer account page sends signed-out visitors to sign in
before it reads data. Close the two small known gaps from the findings ledger:
the server-only guard on session code (F-12) and the image path check that a tab
or newline can slip past (F-04).

Decisions behind the split (2026-10-11): feature 24 is split into 24a (this),
24b database-backed rate limiting, and 24c security headers without a CSP.

## In scope

- **Admin sweep tests** that discover their targets with Vitest's
  `import.meta.glob`, so a new admin page, action, or route is covered without
  editing the test:
  - every `app/admin/**/page.tsx` default export, for a signed-out visitor and a
    signed-in customer: it ends in `notFound()` and the database is never
    touched. Where a page exports `generateMetadata`, it returns the
    `Page not found` title for both.
  - every exported function in `actions/admin-*.ts` (test files excluded), for
    both actors: it rejects with `notFound()` and the database, Stripe, and
    storage are never touched
  - every exported HTTP method in `app/api/admin/**/route.ts`, for both actors:
    it returns `404` and the database and storage are never touched
- **Customer sweep test** for every `app/[lang]/account/**/page.tsx` and
  `app/[lang]/onboarding/[itemId]/page.tsx` (onboarding without a `session_id`):
  a signed-out visitor is redirected to `/<lang>/login?next=<that page>` and the
  database is never touched.
- **Ownership scope check:** confirm that `lib/account.test.ts` asserts the
  signed-in user's id in the `where` of every query in `lib/account.ts`, and add
  the missing assertions. Every page passes `user.id` from `getCurrentUser()`
  and never a URL value.
- **F-12:** `import "server-only";` as the first line of `lib/session.ts`.
- **F-04:** `publicImageSrc` rejects a value that contains an ASCII tab, LF, or
  CR, with tests.
- Any page, action, or route the sweep shows is unprotected or checks too late
  is fixed in this feature by calling the existing guard first.

## Out of scope

- Rate limiting (24b) and security headers (24c).
- New roles, permissions, or auth mechanisms. `requireAdmin()` and
  `getCurrentUser()` stay the only guards.
- Changing the guest models that are protected by design: downloads and guest
  onboarding authorize by the Stripe checkout session id (existing tests in
  `lib/downloads.test.ts`, `app/api/downloads/[itemId]/route.test.ts`, and
  `actions/onboarding.test.ts`). The public catalog API, the analytics beacon,
  and the Stripe webhook (signature verified, tested) are public by design.
- Other open findings.

## Build loop

`workflow.stepReview` is `feature`: build every step in order, running
`pnpm test` for each step, then present one review packet for the whole
feature. `workflow.checkpointCommits` is `disabled`. `/complete` creates the
single feature commit.

## Build steps

- [x] 1. **Small known gaps (F-12, F-04).** Add `import "server-only";` as the
  first line of `lib/session.ts`. Next.js resolves it without the package
  (`node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`).
  If `pnpm build` or `pnpm test` then fails to resolve it, add the `server-only`
  package with `pnpm add server-only`. Its default entry throws outside React
  Server Components, so `vitest.config.mts` also aliases `server-only` to the
  package's `empty.js`, the module Next.js resolves for server code.
  (Implemented this way: Vitest could not resolve the bare import.) In `publicImageSrc`
  (`lib/catalog.ts`), return `null` when the value matches `/[\t\n\r]/`, before
  the prefix checks. Add `"/\t/evil.example.com/a.png"`,
  `"/\n/evil.example.com/a.png"`, and `"https://ok.example/\r"` to the
  rejected list in `lib/catalog.test.ts`.
  **Done when:** `pnpm test` and `pnpm build` pass, and the new
  `publicImageSrc` cases return `null` while the existing accepted cases still
  pass.

- [x] 2. **Admin page sweep.** Add `app/admin/access.test.ts`. It loads every
  `./**/page.tsx` with `import.meta.glob`. It mocks `@/lib/session`
  (`getCurrentUser` returns `null`, then a `CUSTOMER` user), `next/navigation`
  (`notFound` and `redirect` throw marker errors), and `@/lib/db` with a Proxy
  that records any property access. The real `@/lib/admin` stays, so the real
  `requireAdmin()` and `adminMetadata()` run. It calls each default export with
  promise `params` (every dynamic key such as `id`, `itemId`, and `rest` gets a
  valid-looking value) and empty `searchParams`. Each must reject with the
  `notFound` marker and record no database access. Each `generateMetadata` must
  resolve to `{ title: { absolute: "Page not found" } }` plus the no-index
  robots. The test fails if the glob finds fewer than the 20 admin pages that
  exist today, so a broken glob cannot pass silently. Any page that fails is
  fixed by moving `await requireAdmin()` to its first line.
  **Done when:** the sweep passes for all admin pages and both actors under
  `pnpm test`. As a negative check, temporarily removing `requireAdmin()` from
  one page makes it fail (revert before committing).

- [x] 3. **Admin action and route sweep.** Add `actions/admin-access.test.ts`.
  It globs `./admin-*.ts`, skips `*.test.ts`, and calls every exported function
  with `(null, new FormData())`. With `@/lib/session` and `@/lib/db` mocked as
  in step 2, and `@/lib/stripe`, `@/lib/object-storage`, `next/cache`, and
  `@/lib/service-notifications` mocked to record calls, each must reject with
  the `notFound` marker for both actors and touch none of them. Add
  `app/api/admin/access.test.ts` the same way for every method exported from
  `./**/route.ts`, called with a `Request` and promise `params`. Each must
  return status `404` for both actors, with no database or storage access.
  Both tests fail if they find fewer targets than exist today: 16 admin actions
  across 6 files, and 1 admin route method. Any export that fails is fixed by
  calling the guard first, outside any `try` that would swallow `notFound()`.
  **Done when:** both sweeps pass under `pnpm test`. The same negative check
  passes for one action.

- [x] 4. **Customer sweep and ownership scope.** Add
  `app/[lang]/account/access.test.ts`. It globs `./**/page.tsx` plus
  `../onboarding/[itemId]/page.tsx` and calls each with `getCurrentUser`
  returning `null`, `params` `{ lang: "en" | "ar", itemId: "x" }`, and empty
  `searchParams`. Each must reject with the `redirect` marker to
  `/<lang>/login?next=` plus that page's own localized path, URL-encoded as the
  pages build it today, with no database access. It fails if it finds fewer
  than the 7 pages that exist today. In `lib/account.test.ts`, make sure every
  exported query asserts its `where` carries the given `userId`, either
  directly or through the paid-orders filter. Add assertions where missing.
  **Done when:** `pnpm test` passes. The account sweep covers all 7 pages in
  both languages. Every `lib/account.ts` export has a userId-scope assertion.

## Files / areas

- `lib/session.ts` (F-12), `lib/catalog.ts` and `lib/catalog.test.ts` (F-04)
- `app/admin/access.test.ts`, `actions/admin-access.test.ts`,
  `app/api/admin/access.test.ts`, `app/[lang]/account/access.test.ts` (new)
- `lib/account.test.ts`
- Only if a sweep fails: the failing page, action, or route
- `package.json`, `pnpm-lock.yaml`, and `vitest.config.mts` (the `server-only`
  package and its test alias)
- Reused: `requireAdmin`, `adminMetadata` (`lib/admin.ts`), `getCurrentUser`
  (`lib/session.ts`), the upload route's local `notFound()` 404 response

## Data / contracts

No schema, route, or response changes. The contracts these tests pin down,
already true in the code:

- **Admin pages and actions:** `requireAdmin()` reads the role from the session
  user row only, and anyone else gets `notFound()` (a 404 that does not reveal
  the area). Admin metadata for a non-admin is
  `{ title: { absolute: "Page not found" }, robots: { index: false, follow: false } }`.
- **Admin API routes:** non-admins get `404` with no body detail, before any
  input parsing.
- **Account pages:** a signed-out visitor gets a redirect to
  `/<lang>/login?next=<current localized path>`. Signed-in queries are scoped by
  `user.id` from the session.
- **`publicImageSrc`:** returns `null` for any value with `\t`, `\n`, or `\r`;
  otherwise unchanged.

## Testing

All four sweeps and the F-04 cases run under `pnpm test`, with no new tooling.
`import.meta.glob` is built into Vitest, and the config already includes
`**/*.test.ts`. The `.tsx` pages import fine because `tsconfig.json` uses
`"jsx": "react-jsx"`. Each sweep asserts a minimum target count so an empty
glob fails. `pnpm build` and `pnpm lint` are run at the end. Baseline: 62 test
files, 1017 tests passing. There is no Browser tests command. This feature
changes no UI, so it needs no browser evidence.

## Notes for the AI

- Read the `server-only` passage in the Next.js docs named in step 1 before
  adding the import.
- A sweep must test the real guard: never mock `@/lib/admin` or
  `requireAdmin`. Mock only the session source, the database, and external
  side effects.
- Make the database Proxy fail loudly on use, but stay safe for Vitest's own
  inspection (for example, ignore symbol keys and `then`).
- If importing a page pulls in a module with load-time side effects, such as
  reading an env var or creating a client, mock that module in the sweep. Do
  not change product code just to make it importable.
- Keep each sweep data-driven, with one `it.each` row per target and actor, so
  a failure names the exact file.
- Mark F-04 and F-12 `fixed` in `blueprint/context/findings.md` once step 1
  passes. Only a later `/audit` closes them.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":10165,"specSha256":"ce177e656b4a42b6d6a229ee07741183fb0ce55ef93ab7c56f7104858a6f2b7d","branch":"refs/heads/feature/access-control-sweep","head":"fea21ca3411cae4b3c952d88ae624e0061c83a90","baseRef":"refs/heads/main","baseCommit":"153dd05ccd5fcf0afa2e7a26fdbde1d0913708ce","sourceTree":"baefcf0b1083849d4732a2f3a2e57c1d80e8b828","absentOptional":[]} -->

## Findings

### 24a/F-04 [P3] closed - publicImageSrc accepts a tab or newline before a second slash, which browsers resolve as protocol-relative

**File:** lib/catalog.ts:67
**Found:** 2026-10-02 by /audit independent (scope: current; lens: security, tests)
**Why it matters:** The spec's image rule allows a root-relative path that "starts with one `/`, not `//`". The check `/^\/[/\\]/` only inspects the second character, but URL parsers strip ASCII tab, LF, and CR before resolving, so a stored value such as `"/\t/host.example/a.png"` passes as local and the browser loads it from `host.example`. Confirmed with Node's WHATWG `URL`: both the tab and the newline form resolve to the external host. Impact is low: the same rule already permits any absolute `https:` host, the value is only used as an `img` `src`, and nothing but the seed writes `image` today, so this is a rule and test gap rather than a new exposure. It becomes reachable when admin editing ships (features 12 and 13).
**Suggested fix:** In `publicImageSrc`, return `null` when the value contains an ASCII tab, LF, or CR (for example `/[\t\n\r]/.test(image)`) before the prefix checks, and add `"/\t/evil.example.com/a.png"` and `"/\n/evil.example.com/a.png"` to the "returns null for anything else" test list in `lib/catalog.test.ts`.
**Resolution:** Re-examined 2026-10-02 by /audit independent (target 9954661). Still present and unrepaired: `publicImageSrc` is unchanged by this delta and the check now sits at `lib/catalog.ts:73`. Status stays `open`. Re-examined 2026-10-07 by /audit independent (target 039b19e): still present and unrepaired, and now reachable as the spec predicted. The admin product form's `image` field (`lib/admin-products.ts:126`) validates only through `publicImageSrc`, and its `text()` helper trims the ends but keeps an interior tab, so an admin can save `"/\t/host.example/a.png"`. Severity stays P3: only admins can write it and any absolute `https:` host is already allowed. Status stays `open`. Re-examined 2026-10-07 by /audit independent (target 5048817, fresh subagent): still present and unrepaired. `publicImageSrc` is unchanged, and feature 14 reuses the same `image` parsing (`lib/admin-products.ts:147-150`) for services, so the service form has the same admin-only gap. Severity stays P3. Status stays `open`. Fixed 2026-10-11 by /implement (feature 24a step 1): `publicImageSrc` (`lib/catalog.ts`) now returns `null` for any value containing a tab, LF, or CR before the prefix checks; `lib/catalog.test.ts` adds `"/\t/evil.example.com/a.png"`, `"/\n/evil.example.com/a.png"`, and `"https://ok.example/\r"` to the rejected list. Awaiting /audit closure. Closed 2026-10-11 by /audit independent (target fea21ca, fresh subagent): `lib/catalog.ts:79` rejects any value matching `/[\t\n\r]/` before the prefix checks, and the three new cases sit in the rejected list in `lib/catalog.test.ts:329-331`, with the existing accepted cases still passing under `pnpm test`. A WHATWG `URL` probe confirmed tab, LF, and CR are the only characters the parser strips from the interior of `"/<c>/evil.example.com/a.png"` (form feed, vertical tab, NUL, space, NBSP, and U+2028 all stay on the page's own host), so the guard covers the full bypass class. No new defect introduced.

### 24a/F-12 [P3] closed - lib/session.ts does not carry the server-only guard the spec names

**File:** lib/session.ts:1
**Found:** 2026-10-05 by /audit independent (scope: current; lens: quality)
**Why it matters:** Spec step 2 defines `lib/session.ts` as `server-only`, and Files / areas says to add the `server-only` package only if its import fails. The module has no `import "server-only"`; it relies on a "Server code only" comment (line 14). The practical exposure is low today: the module imports `next/headers` and `@/lib/db`, so a client import would already fail the build. The gap is contract drift: the guard the spec asked for, which gives a clear error if a later client component imports session helpers, is missing.
**Suggested fix:** Add `import "server-only";` as the first line of `lib/session.ts` and confirm `pnpm build` and `pnpm test` still pass (the Vitest suites mock `@/lib/session`, so they do not load it). Add the `server-only` package with pnpm only if the import does not resolve. Requirement lost: None.
**Resolution:** Re-examined 2026-10-05 by /audit independent (target 2bc0ef0, fresh subagent). Still present and unrepaired: `lib/session.ts` starts with `import { cookies } from "next/headers";` and has no `server-only` import (the comment is at line 14). The file is unchanged since this finding was raised. Status stays `open`. Re-checked 2026-10-05 by a second /audit independent pass (target 2bc0ef0, fresh subagent): `lib/session.ts:1` is still `import { cookies } from "next/headers";` with no `server-only` import; unchanged. Status stays `open`. Re-checked 2026-10-06 by /audit independent (target 217a620, fresh subagent): this delta adds `otherSessionsWhere` to `lib/session.ts` but line 1 is still `import { cookies } from "next/headers";` with no `server-only` import. Status stays `open`. Fixed 2026-10-11 by /implement (feature 24a step 1): `lib/session.ts` now starts with `import "server-only";`. The import did not resolve under Vitest, so the `server-only` package was added and `vitest.config.mts` aliases it to the package's `empty.js` (the module Next.js resolves for server code; the default entry throws). Awaiting /audit closure. Closed 2026-10-11 by /audit independent (target fea21ca, fresh subagent): `lib/session.ts:1` is `import "server-only";`, `server-only@0.0.1` is a runtime dependency in `package.json` and `pnpm-lock.yaml`, and the `vitest.config.mts` alias points at the existing `node_modules/server-only/empty.js`. `pnpm build` (exit 0), `pnpm test` (66 files, 1149 tests), and `pnpm lint` all pass, and no component imports `@/lib/session` (the header uses `@/lib/session-token`). No new defect introduced.

## Independent review

**Status:** passed
**Target commit:** fea21ca3411cae4b3c952d88ae624e0061c83a90
**Base commit:** 153dd05ccd5fcf0afa2e7a26fdbde1d0913708ce
**Base ref:** main
**Spec hash:** ce177e656b4a42b6d6a229ee07741183fb0ce55ef93ab7c56f7104858a6f2b7d
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-11T10:50:56Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-11T11:07:04Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `153dd05ccd5fcf0afa2e7a26fdbde1d0913708ce..fea21ca3411cae4b3c952d88ae624e0061c83a90` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (all preconditions match; only review.md and findings.md dirty; spec is tracked)
- `pnpm test`: pass (66 files, 1149 tests)
- `pnpm lint`: pass (no output)
- `pnpm build`: pass (exit 0)

### Evidence

- Reviewed all 12 changed files in the delta: the four sweep tests, `lib/catalog.ts`, `lib/catalog.test.ts`, `lib/session.ts`, `package.json`, `pnpm-lock.yaml`, `vitest.config.mts`, `blueprint/build-plan.md`, and the spec.
- Sweep coverage matches the tree: 20 `app/admin/**/page.tsx`, 16 exported actions across 6 `actions/admin-*.ts` files, 1 admin route method (`PUT app/api/admin/products/[id]/file/route.ts`), and 7 customer pages including onboarding. No admin role check exists outside these swept areas and `lib/admin*`.
- Sweeps exercise the real `requireAdmin()`/`adminMetadata()`; the database Proxy records access even if a caller swallows the throw. The params used (`cm1abc`) pass `isProductId`/`isCouponId`, empty FormData makes guard-less actions resolve rather than reject, and the route request is cross-origin without the guard (403), so removing any guard fails its sweep.
- Every `lib/account.ts` query already asserts the `userId` scope in `lib/account.test.ts` (lines 49-58, 103, 159, 208, 248), so step 4 needed no additions.
- F-04 repair verified with a WHATWG `URL` probe: only tab, LF, and CR are stripped from the path interior, and all three are now rejected. F-12 repair verified by build, test, and import graph.

### Findings

- None new. F-04 closed, F-12 closed.

### Remaining risk

- No browser or dev-server evidence (not required; the feature changes no UI).
- The new build-plan 24a line says customer-owned actions and routes, and other customers, are covered. The approved spec sweeps only signed-out access to customer pages. Customer actions keep their existing per-file signed-out tests (`actions/account.test.ts`, `actions/onboarding.test.ts`), and cross-customer access relies on the `lib/account.test.ts` userId-scope assertions, not on a glob sweep.
- The admin route sweep mocks `@/lib/product-files` but not `@/lib/object-storage`, so a future route that called the bucket directly would not be recorded as a storage touch.
