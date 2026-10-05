# Fix: Test openStoredFile

**Type:** Fix
**Status:** verified
**Branch:** fix/test-openstoredfile
**Fixes:** F-09

## The problem

`openStoredFile` in `lib/downloads.ts:86` is the only code that turns a granted
storage key into file bytes, but no test runs it. `lib/downloads.test.ts` imports
only `findDownload` and `listOrderDownloads`, and
`app/api/downloads/[itemId]/route.test.ts` mocks the whole module. Removing the
reader-side `storagePath` check, the `isFile()` check, or the "other errors
propagate" rule would leave every test passing. The shipped code is correct
today; this is a coverage gap only.

## The fix

Add direct tests for `openStoredFile` in `lib/downloads.test.ts`, using the
committed seed files under `STORAGE_ROOT` (`storage/` at the project root, which
is the Vitest working directory). This is a test-only change: no product code,
dependency, or configuration changes. The existing `@/lib/db` mock stays as is.

To force a non-missing error, mock `node:fs/promises` partially with
`importOriginal` so `stat` calls the real function by default, and let one test
make it reject with an `EACCES` error. Restore the real behavior after that test
so the other cases read real files.

Must not break: the existing `findDownload` and `listOrderDownloads` tests, and
the route tests.

## Build steps

- [x] 1. **Test openStoredFile.** Add a `describe("openStoredFile")` block to
  `lib/downloads.test.ts` covering:
  - `seed/facebook-ads-guide.pdf` returns `size` equal to the file's byte length,
    and reading the whole `stream` yields exactly the bytes of that file (read
    with `fs.promises.readFile` from `STORAGE_ROOT`).
  - `seed/missing.pdf` (absent file) returns `null`.
  - `seed/facebook-ads-guide.pdf/extra` (a path through a file, `ENOTDIR`)
    returns `null`.
  - `seed` (a directory) returns `null`.
  - Unsafe keys `../package.json` and `/etc/passwd` return `null` without
    calling `stat`.
  - `stat` rejecting with an `EACCES` error makes `openStoredFile` reject with
    that same error.
  **Done when:** the new tests pass with `pnpm test`; temporarily removing the
  `if (!filePath) return null` line, the `isFile()` check, or the `throw error`
  in the catch makes at least one new test fail (checked locally, then
  reverted); no file other than `lib/downloads.test.ts` changes.

## Verify

- `pnpm test` passes, including the new `openStoredFile` block.
- `pnpm lint` and `pnpm build` pass.
- `git diff main --stat` shows only `lib/downloads.test.ts` plus the workflow
  files (`blueprint/context/*`).


<!-- blueprint:completion {"schemaVersion":1,"specBytes":2554,"specSha256":"7aefd50262a98207e14e0eb9e13732459cd27986e59e7162f9aa2939e1b63bad","branch":"refs/heads/fix/test-openstoredfile","head":"eba82dd2b29adcc1a7d59e64f24083dbfe540a6c","baseRef":"refs/heads/main","baseCommit":"eba82dd2b29adcc1a7d59e64f24083dbfe540a6c","sourceTree":"e9eb287f5e7ac146af9e37aab12a76c3957bcde4","absentOptional":[]} -->

## Findings

### test-openstoredfile/F-09 [P3] closed - openStoredFile has no test; its null and error branches are only ever mocked

**File:** lib/downloads.ts:85
**Found:** 2026-10-05 by /audit independent (scope: current; lens: tests)
**Why it matters:** `openStoredFile` is the only code that turns a granted storage key into file bytes. It has four behaviors the route relies on: an unsafe key returns `null`, a missing file (`ENOENT`/`ENOTDIR`) returns `null`, a directory returns `null` (`isFile()` check), and any other error propagates so the route answers 500. `lib/downloads.test.ts` imports only `findDownload` and `listOrderDownloads`, and `app/api/downloads/[itemId]/route.test.ts` mocks the whole module, so none of these branches, nor the size/stream pairing that feeds `Content-Length`, runs under `pnpm test`. Dropping the `storagePath` null check (the reader-side validation the spec's storage-key contract requires), or swallowing all errors as `null`, would leave all 236 tests green. The spec's step 3 Done when did not list this, so it is a coverage gap rather than a broken contract; the shipped code reads correctly today.
**Suggested fix:** Add a small `openStoredFile` block to `lib/downloads.test.ts` against the committed seed files (they live under `STORAGE_ROOT`): `seed/facebook-ads-guide.pdf` returns a `size` equal to the bytes read from `stream`; `seed/missing.pdf` and `seed` (a directory) return `null`; `../package.json` returns `null`. Requirement lost: None.
**Resolution:** Fixed 2026-10-05 by fix "Test openStoredFile": `lib/downloads.test.ts` now runs `openStoredFile` against the seed files (exact size and bytes, missing file, path through a file, directory, two unsafe keys with no `stat` call, and an `EACCES` error passed on). Removing the unsafe-key check, the `isFile()` check, or the rethrow each fails at least one new test. Closed 2026-10-05 by /audit (scope: current; lenses: quality, security, performance, tests; base main eba82dd plus uncommitted work): re-examined `lib/downloads.test.ts` and `lib/downloads.ts`. All four behaviors and the size/bytes pairing are now asserted against real seed files; the `node:fs/promises` mock spreads the real module and restores the real `stat` before each case, so only the `EACCES` test is simulated; no product code changed. The original gap is gone and the repair introduced no new defect.
