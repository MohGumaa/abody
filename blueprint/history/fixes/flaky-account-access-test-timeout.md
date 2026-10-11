# Fix: Flaky account access test timeout

**Type:** Fix
**Status:** verified
**Branch:** fix/flaky-account-access-test-timeout

## The problem

`pnpm test` intermittently fails with `Test timed out in 5000ms` in
`app/[lang]/account/access.test.ts`, always on
`../onboarding/[itemId]/page.tsx sends a signed-out visitor to sign in (en)`.
It failed in about half of the full-suite runs on 2026-10-11 (while a dev server
or build was running), and passed every time the file ran alone.

Root cause: each case loads its page module lazily (`await pages[file]()` from
`import.meta.glob`) inside the test body. The cases are sorted, and `../`
sorts before `./`, so the onboarding page is always the first case. It pays
for the cold transform and import of the whole page graph inside Vitest's
default 5000 ms test timeout, and on a busy machine that sometimes takes
longer. The behavior under test, a redirect before any data read, is not slow.

## The fix

Load every page module once in a `beforeAll` hook with its own explicit
timeout (60 000 ms), and keep the loaded modules in a map. Each test then uses
the already-loaded module, so the default 5000 ms test timeout measures only
the redirect check.

Must not break:

- The `vi.mock` setup and the `import.meta.glob` discovery. A new account page
  is still covered without editing the file.
- The case list and names, the expected redirect URL, and the "no database
  access" assertion, which stays per test (`touched` resets in `beforeEach`).
- No global change to `vitest.config.mts` and no raised per-test timeout. Only
  module loading moves.

## Build steps

1. [x] **Preload page modules before the cases.**
   - In `app/[lang]/account/access.test.ts`, add
     `beforeAll(async () => { ... }, 60_000)`. It awaits every loader in
     `pages` and stores the results in a `loaded` record keyed by file.
     `it.each` then reads `loaded[file]` instead of awaiting `pages[file]()`.
   - **Done when:** the file passes alone, and `pnpm test` passes three
     consecutive full runs while the dev server is running (the conditions
     under which it failed before). If any run still times out, report the
     test and its timing instead of raising timeouts.

## Verify

- `pnpm exec vitest run "app/[lang]/account/access.test.ts"` passes 15 of 15.
- `pnpm test` passes three times in a row with `pnpm dev` running.
- `pnpm lint` passes.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":2392,"specSha256":"c003de01313c2579d032ea502d1b7374414712b12567b5a5dc355057a36ae6f7","branch":"refs/heads/fix/flaky-account-access-test-timeout","head":"b18a558211b6b7c64b1aa71b71db12a29363d78d","baseRef":"refs/heads/main","baseCommit":"b18a558211b6b7c64b1aa71b71db12a29363d78d","sourceTree":"6d4d2e5cf2c849bb8e19a10d09f1be0ce5fd6415","absentOptional":[]} -->
