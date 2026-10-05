# Fix: Keep the query string on language switch

**Type:** Fix
**Status:** verified
**Branch:** fix/keep-the-query-string-on-language-switch

## The problem

After a successful payment, the success page
`/<lang>/success?session_id=cs_…` shows the order number and download links.
Switching language makes the page empty (a 404).

- `components/layout/LanguageSwitcher.tsx` builds its link from `usePathname()`
  only, through `switchLocalePath(pathname, target)` in `lib/i18n/config.ts`.
  The query string is dropped.
- `/ar/success` without `session_id` fails `isCheckoutSessionId` and calls
  `notFound()` (`app/[lang]/success/page.tsx`).
- The same bug resets the `?category=` filter when switching language on
  `/products` or `/services`.

## The fix

Carry the current query string across the switch.

- **`lib/i18n/config.ts`:** `switchLocalePath` takes an optional search string
  and appends it as `?<search>` when it is not empty. Existing calls keep their
  current output.
- **`LanguageSwitcher.tsx`:** read `useSearchParams()` and pass
  `searchParams.toString()` to `switchLocalePath`.
- **`SiteHeader.tsx`:** wrap the switcher in `<Suspense>`, as the Next 16
  `useSearchParams` docs recommend, so prerendered routes such as
  `/_not-found` still build. The fallback is the same switcher link without
  the query, so the header never renders an empty slot.

**Must not break:**
- Switching still works without JavaScript (it stays a real link), and still
  saves the `lang` cookie on click.
- Paths with no query switch exactly as before (`/en/cart` -> `/ar/cart`).
- The download links keep working after the switch. They already carry
  `session_id`.

**Out of scope:**
- Storing the session ID anywhere else (cookie, local storage). The URL is
  already the page's only key, and keeping it is enough.
- Hash fragments. No page uses them.

## Build steps

- [x] **1. Keep the query on switch.** Update `switchLocalePath`, the switcher,
  and the header's Suspense boundary.
  **Done when:** unit tests in `lib/i18n/config.test.ts` cover a path with a
  query (`/en/success` + `session_id=cs_test_1` -> `/ar/success?session_id=cs_test_1`),
  an empty query (unchanged output), and an encoded value such as an Arabic
  category. `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Verify

- `pnpm test`, `pnpm lint`, `pnpm build`.
- With `pnpm dev`, complete a test payment (Stripe test card) and land on
  `/en/success?session_id=…`. Switch to Arabic: the URL keeps `session_id`, and
  the same order number and download links show in Arabic. A download link
  still downloads. Switch back to English: the same result.
- On `/en/products?category=Templates`, switching to Arabic keeps the filter.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":2719,"specSha256":"0a9026344f731ef7994b26e015266f57419d041aea8b061b3f46738474fc6e89","branch":"refs/heads/fix/keep-the-query-string-on-language-switch","head":"1ff05472c5a65b4829f3a9754137cccad46f33da","baseRef":"refs/heads/main","baseCommit":"b5ca18e4cc1d9a3a60f931177a50e7a6229a256f","sourceTree":"0a6a2a5196f868c4567053a1cd4cc7abd2f6296d","absentOptional":[]} -->

## Independent review

# Independent Review

**Status:** passed
**Target commit:** 1ff05472c5a65b4829f3a9754137cccad46f33da
**Base commit:** b5ca18e4cc1d9a3a60f931177a50e7a6229a256f
**Base ref:** main
**Spec hash:** 0a9026344f731ef7994b26e015266f57419d041aea8b061b3f46738474fc6e89
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-05T14:56:34Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-05T15:07:30Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (request verified; only `blueprint/context/review.md` differs)
- `pnpm test`: pass (246 tests)
- `pnpm lint`: pass
- `pnpm build`: pass (all `/[lang]/*` routes dynamic; `/_not-found` prerenders with the Suspense boundary)

## Evidence

- Delta reviewed in full: `lib/i18n/config.ts`, `lib/i18n/config.test.ts`, `components/layout/LanguageSwitcher.tsx`, `components/layout/SiteHeader.tsx`, `blueprint/context/current-feature.md`.
- `switchLocalePath` still derives the path only from `usePathname()`; the query comes from `URLSearchParams.toString()` (already encoded) and is appended after `?`, so it cannot alter the path or origin. Calls without `search` keep their previous output (existing tests unchanged and passing).
- Security: the switch link is a same-origin relative href. `session_id` is already in the address bar and in the success page's own download links (`app/[lang]/success/page.tsx`), so carrying it to the other-locale URL adds no new sink or cross-origin exposure. No route under `[lang]` takes auth or reset tokens in the query (`searchParams` readers: cart, checkout/return, products, services, success).
- Next 16 `use-search-params.md`: Suspense around the `useSearchParams` client component matches the documented pattern; on dynamic routes the hook is available during SSR, so the no-JS link includes the query on `/success` and `/products`. The fallback renders the same real link, and the cookie click handler is preserved.
- Tests cover a query, an empty query, and an encoded Arabic value, as the spec's Done-when requires.

## Findings

- None (no new findings; existing ledger entries F-01 to F-09 not re-examined and unchanged)

## Remaining risk

- Manual browser flow (Stripe test payment, switch language on `/success`, download after switch, `/products?category=` filter) was not exercised; Check was not required and no dev server was started.
- No component-level test of `LanguageSwitcher`/Suspense wiring; covered only by the pure-function tests and a passing build.
- Dashboard activity (`run.json`) was not written by this reviewer, per the reviewer's write boundary.
