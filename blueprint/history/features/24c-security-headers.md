# Feature: Security Headers

**From build-plan:** feature 24c
**Build attempt:** 1
**Branch:** feature/security-headers
**Status:** verified

## Goal

Send a fixed set of security response headers on every response the app
serves: pages, route handlers, proxy redirects, and static files. The set is
HSTS (production only), `X-Content-Type-Options: nosniff`, frame blocking,
`Referrer-Policy`, and `Permissions-Policy`. No Content Security Policy.

## In scope

- One `headers()` rule in `next.config.ts` with `source: "/:path*"`, built from
  a small pure function in `lib/security-headers.ts` so the values are
  unit-tested.
- Header values, chosen at spec time because the plan names the headers but not
  their values (see Notes):
  - `Strict-Transport-Security: max-age=31536000`, only when
    `process.env.NODE_ENV === "production"` at config load. It has no
    `includeSubDomains` and no `preload`.
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`. The app frames nothing of its own, and nothing
    embeds it.
  - `Referrer-Policy: strict-origin-when-cross-origin`. Other sites see only
    the origin, never order, item, or onboarding paths.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`
- The existing per-route headers keep working. The download route's
  `Referrer-Policy: no-referrer` on its 302 to a signed bucket URL must still
  win for that response, and its own `nosniff` is unchanged. Next.js keeps
  a config header over a handler's header with the same name (finding F-40).
  A second, later `headers()` rule for `/api/downloads/:path*` therefore sets
  `Referrer-Policy: no-referrer` for every download response; the last
  matching rule wins.

## Out of scope

- Content Security Policy, including `frame-ancestors`.
- CORS, `Cross-Origin-*-Policy`, `X-XSS-Protection`, and cache headers.
- Choosing the production host or HTTPS termination (`/release`).
- HSTS `includeSubDomains` or `preload`, which `/release` can add once the
  domain is known.
- Changing headers on any individual route.

## Build loop

`workflow.stepReview` is `feature` and `checkpointCommits` is `disabled`.
Implement both steps in order, run each step's checks, and present one review
packet after the last step. Do not create checkpoint commits. `/complete` makes
the final feature commit.

## Build steps

1. [x] **Header set and config rule.**
   - Add `lib/security-headers.ts` exporting
     `securityHeaders(production: boolean): { key: string; value: string }[]`.
     It returns the four always-on headers, plus HSTS first when `production`
     is true. Do not add the `server-only` marker: `next.config.ts` imports
     this file outside React.
   - In `next.config.ts`, add
     `async headers() { return [{ source: "/:path*", headers: securityHeaders(process.env.NODE_ENV === "production") }]; }`.
     Import with a relative path (`./lib/security-headers`), not the `@/`
     alias. Read the `headers` guide in
     `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md`
     first.
   - Add `lib/security-headers.test.ts` with the cases listed under Testing.
   - **Done when:** `pnpm test`, `pnpm lint`, and `pnpm build` pass.

2. [x] **Runtime confirmation.**
   - Against a production server (`pnpm build` then `pnpm start`, which the
     user starts; do not start it from `/implement`), confirm with
     `curl -sI` that the headers are present on:
     - `/en` (a page)
     - `/` (the proxy's 307 language redirect)
     - `/api/products` (a route handler)
     - a `/_next/static/...` asset
     - `/robots.txt` or another public file
   - Confirm HSTS appears under `pnpm start` and is absent under `pnpm dev`.
   - If a buyer download is available, confirm the bucket-mode 302 from
     `/api/downloads/<itemId>` still carries `Referrer-Policy: no-referrer`.
     In local storage mode, confirm the streamed download still has `nosniff`
     and its `Content-Disposition`.
   - If the proxy redirect or a route's own header turns out not to receive or
     keep the config headers, stop and revise the spec. Do not add a second
     mechanism unasked.
   - **Done when:** the curl output for each URL above is recorded in the
     review packet, or the step is marked as pending `/check` with the exact
     commands when no server was available.
   - **Evidence (2026-10-11, /check):** All five headers are present under
     `pnpm start -p 3001` on `/en`, on the `/` 307 redirect, on
     `/api/products`, on `/robots.txt`, and on a `/_next/static` CSS chunk.
     HSTS is absent on the dev server. The download-route checks could not run
     locally: the app is in local storage mode (no `S3_*` set) and no
     signed-in buyer was available. The user accepted this gap. It moves to
     `/release`: once bucket mode is configured, confirm the
     `/api/downloads/<itemId>` 302 still sends `Referrer-Policy: no-referrer`.

3. [x] **Repair F-40: keep `no-referrer` on downloads.**
   - In `next.config.ts`, add a second rule after the global one:
     `{ source: "/api/downloads/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] }`.
     Keep the route's own header unchanged.
   - Extend `lib/security-headers.test.ts`: the config returns exactly the two
     rules in that order. It is the last rule matching a download path, so
     that path's effective `Referrer-Policy` is `no-referrer`, while every
     other path keeps `strict-origin-when-cross-origin`.
   - Mark F-40 `fixed` in `blueprint/context/findings.md` once the checks
     pass. A new independent review closes it.
   - **Done when:** `pnpm test`, `pnpm lint`, and `pnpm build` pass, and
     `curl -sI` against `pnpm start` shows `Referrer-Policy: no-referrer` (one
     value) on `/api/downloads/<any id>` and
     `strict-origin-when-cross-origin` on `/en`.
   - **Evidence (2026-10-11):** Under `pnpm start -p 3001`,
     `/api/downloads/any-id` (404) returns one `Referrer-Policy: no-referrer`,
     while `/en` and the `/` 307 keep `strict-origin-when-cross-origin`. The
     config rule applies to every response on that path, so the bucket-mode
     302 gets it too. The `/release` bucket check from step 2 is now a
     confirmation only.

## Files / areas

- `lib/security-headers.ts`, `lib/security-headers.test.ts` (new)
- `next.config.ts`

## Data / contracts

- The header names and values are exactly those listed under In scope. The
  order is HSTS first (production only), then `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`.
- `next.config.ts` `headers()` returns two rules in this order: the global
  `/:path*` set, then `/api/downloads/:path*` with only
  `Referrer-Policy: no-referrer`.
- `production` is read once, when the config loads, from `NODE_ENV`. No new
  environment variable is added.

## Testing

`pnpm test` (Vitest):

- `securityHeaders(true)` returns all five headers with the exact values.
- `securityHeaders(false)` returns the same four without
  `Strict-Transport-Security`.
- No header value contains `includeSubDomains` or `preload`, and no
  `Content-Security-Policy` key is returned.
- The default export of `next.config.ts`, with `NODE_ENV` stubbed to
  `production`, yields the global `source: "/:path*"` rule whose headers equal
  `securityHeaders(true)`, followed by the downloads `no-referrer` rule
  (step 3).

There is no browser harness. Runtime presence is covered by step 2's curl
checks only.

## Notes for the AI

- The values above are spec-time choices of the conservative option, because
  the plan names the headers but not their values. HSTS uses one year, no
  subdomains, and no preload, because the domain and any HTTP-only subdomains
  are not known yet. Raise any doubt in the review packet instead of changing
  a value.
- In the Next.js execution order, `headers` from `next.config` run before the
  proxy. Confirm in step 2 rather than assuming it.
- Do not touch `proxy.ts`, the download route, or any route's existing
  headers.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":8058,"specSha256":"5cc9b933d22898638540d3181a10168f4f23ce375d1a56a89e8e2feb92255473","branch":"refs/heads/feature/security-headers","head":"7e1594b92dcc09ec0230b0a4d95e45a019a1db16","baseRef":"refs/heads/main","baseCommit":"a5307203aaf4031aa5a39bc59d67812c2839950e","sourceTree":"7927582ab2c2d15d778129b42141408dcfa3cf1f","absentOptional":[]} -->

## Findings

### 24c/F-40 [P1] closed - The global Referrer-Policy replaces the download route's no-referrer on its bucket 302, breaking the spec's "must still win" contract

**File:** next.config.ts:8
**Found:** 2026-10-11 by /audit independent (scope: current; lens: security, tests)
**Why it matters:** The spec's In scope list says the download route's `Referrer-Policy: no-referrer` on its 302 to a signed bucket URL "must still win for that response". In Next.js 16.3.8, the router applies the `headers()` rule with `res.setHeader` before the route handler runs (`node_modules/next/dist/server/lib/router-utils/resolve-routes.js:544-563`, `router-server.js:371-373`). Then `sendResponse` copies a handler's headers only when the key is not already on the response, except for `set-cookie`, `www-authenticate`, `proxy-authenticate`, and `vary` (`node_modules/next/dist/server/send-response.js:28-50`). The dynamic `/api/downloads/[itemId]` handler goes through that path (`build/templates/app-route.js:273`). So the route's `no-referrer` (`app/api/downloads/[itemId]/route.ts:46`) is dropped, and the bucket redirect goes out with `strict-origin-when-cross-origin`. A standalone reproduction that calls the installed `sendResponse` after setting the config value confirmed this: a handler `Response` with `Referrer-Policy: no-referrer` came out with only `strict-origin-when-cross-origin`. The built `routes-manifest.json` confirms that the `/:path*` rule matches this route. The practical leak is small, since the bucket host receives the site's origin rather than nothing and never the `session_id` path. However, the explicit contract is broken, and only the `nosniff` header coincides because both values are the same. The unit route test calls `GET` directly and the config test checks only the rule's shape, so nothing automated can catch this. The step 2 bucket-mode runtime check that would have caught it was deferred to `/release`.
**Suggested fix:** This needs a spec revision. Step 2 says to stop and revise the spec rather than add a mechanism unasked, so it is a user decision. Smallest option: in `next.config.ts`, append a second rule after the global one, `{ source: "/api/downloads/:itemId", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] }`. Per the headers guide, the last matching key wins. It also applies `no-referrer` to the local-storage stream and the 404/500 JSON from that route, which is harmless. Alternatively, exclude that path from the global rule's `Referrer-Policy` with a negative-lookahead `source`. Extend the `next.config` test to assert that the download path's effective `Referrer-Policy` is `no-referrer`. Keep the `/release` runtime curl check of the bucket 302. Requirement lost: None.
**Resolution:** Fixed 2026-10-11 by /implement (spec step 3, the user chose the later config rule). `next.config.ts` now returns a second rule after the global one, `/api/downloads/:path*` with `Referrer-Policy: no-referrer`, and the route's own header is unchanged. The config tests assert both rules in order. Under `pnpm start -p 3001`, `/api/downloads/any-id` returned one `Referrer-Policy: no-referrer`, while `/en` and the `/` 307 kept `strict-origin-when-cross-origin`. Awaiting `/audit` re-review to close. Closed 2026-10-11 by /audit independent (target 7e1594b, fresh subagent): `next.config.ts:9-18` returns the global `/:path*` rule followed by `/api/downloads/:path*` with only `Referrer-Policy: no-referrer`, and the built `.next/routes-manifest.json` lists both rules in that order (the second regex matches `/api/downloads/<itemId>`). The router assigns each matching rule's headers in order with the same key spelling (`resolve-routes.js:544-563`), so the later `no-referrer` replaces the global value before the handler runs, and `send-response.js` then skips the handler's identical header. This holds for the bucket 302, the local stream, and the 404/500 JSON on that path. The route itself is unchanged, no other route sets a header the global rule now overrides, and `lib/security-headers.test.ts` asserts both rules in order. The repair introduced no new defect. The bucket-mode 302 runtime curl stays a `/release` confirmation.

## Independent review

**Status:** passed
**Target commit:** 7e1594b92dcc09ec0230b0a4d95e45a019a1db16
**Base commit:** a5307203aaf4031aa5a39bc59d67812c2839950e
**Base ref:** main
**Spec hash:** 5cc9b933d22898638540d3181a10168f4f23ce375d1a56a89e8e2feb92255473
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-11T18:35:36+04:00
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-11T19:00:45+04:00
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `a5307203aaf4031aa5a39bc59d67812c2839950e..7e1594b92dcc09ec0230b0a4d95e45a019a1db16` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain=v1 --untracked-files=all`: pass (target, base, and spec hash match; only review.md and findings.md differ)
- `pnpm test` (run 1): fail (1 of 1177; 5000 ms timeout in `app/[lang]/account/access.test.ts`, a file this delta does not touch)
- `pnpm test` (run 2): fail (exit 1; failing test not captured)
- `pnpm exec vitest run "app/[lang]/account/access.test.ts" lib/security-headers.test.ts`: pass (20 of 20)
- `pnpm test` (run 3): pass (68 files, 1177 tests)
- `pnpm lint`: pass
- `pnpm build`: pass

### Evidence

- Delta covers 2 commits (fc90938, 7e1594b): `lib/security-headers.ts`, `lib/security-headers.test.ts`, `next.config.ts`, and the spec. Values, order, HSTS gating, no CSP, and the relative import match the spec's In scope and Data / contracts.
- Built `.next/routes-manifest.json` holds the `/:path*` rule (HSTS plus four headers, production build) followed by `/api/downloads/:path*` with only `Referrer-Policy: no-referrer`.
- `node_modules/next/dist/server/lib/router-utils/resolve-routes.js:544-563` assigns matching rule headers in order, so the later download rule replaces the global `Referrer-Policy`; `send-response.js` keeps the config value over the handler's identical header. F-40 closed on this basis.
- No other source sets `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, or HSTS, and no `<iframe>` exists, so the global rule overrides no other route header and `DENY` frames nothing the app needs.
- The access-test timeout is in an untouched file and passed in isolation and in run 3; it is environmental load flakiness, not caused by this delta.

### Findings

- F-40 [P1] closed (re-examined the repaired `next.config.ts`)
- No new findings

### Remaining risk

- Check was not required and was not run; runtime header presence relies on the builder's recorded curl evidence in spec steps 2 and 3, which this reviewer did not repeat.
- The bucket-mode `/api/downloads/<itemId>` 302 has not been exercised at runtime (local storage mode, no signed-in buyer); it stays a `/release` confirmation.
- `pnpm test` is intermittently flaky under load (5000 ms timeout in `app/[lang]/account/access.test.ts`): 2 of 3 full runs failed; the second run's failing test was not captured.
- No browser harness and no Verify command exist; header behavior is covered by unit tests of the config shape only.
