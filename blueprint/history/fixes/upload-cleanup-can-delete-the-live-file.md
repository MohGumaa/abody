# Fix: Upload cleanup can delete the live file

**Type:** Fix
**Status:** verified
**Branch:** fix/upload-cleanup-can-delete-the-live-file
**Fixes:** F-43

## The problem

The direct-to-bucket completion route (feature 25b) cleans up a rejected upload
by deleting the **whole token folder** named in the key the client sent:

- `finishDirectUpload` calls `deletePrefix("<folder>/")` when the object is
  missing, empty, too large, or the wrong type (`lib/product-files.ts:170`).
- The route's own cleanups call `removeOwnUpload(id, key)`, which also deletes
  the folder (`app/api/admin/products/[id]/file/complete/route.ts:52`, `:72`,
  and the `catch` at `:92`).

`isUploadKeyFor` accepts any clean PDF/ZIP name in any 16-hex token folder of
the product. The route only refuses the exact current key. So:

- **Hand-crafted request.** A completion for
  `products/<id>/<token of the live file>/other.pdf` finds no object, fails
  with `empty_file`, and deletes the live file's folder.
- **Retry race.** A retried completion of the key another request has just made
  live can throw, and its `catch` then deletes the live file.

Either way the product points at a missing object and every buyer's download
fails. Only admins can reach the route, and the browser always sends a freshly
minted key, so this is a missing guard on a destructive cleanup, not an
authorization break.

## The fix

Clean up only the exact object a direct upload created, and never the key the
product currently points at.

- **`lib/object-storage.ts`:** add `deleteObject(key)`, a single
  `DeleteObjectCommand` through `safeKey()`. It succeeds when the object is
  already gone (S3 semantics).
- **`lib/product-files.ts`:** add `removeDirectUpload(productId, key)`. It
  deletes exactly `key`, and only when `isUploadKeyFor(productId, key)` holds.
  Direct uploads exist only in bucket mode, so there is no local branch.
  `finishDirectUpload` uses it instead of `deletePrefix` on every failure.
- **`complete` route:**
  - Replace its three `removeOwnUpload(id, key)` cleanups with
    `removeDirectUpload`.
  - In the `catch` path, re-read the product first and skip the delete when
    `digitalFile === key`, so a retry never removes a file another request has
    just made live.
- **Must not break:**
  - The successful path still removes the **previous** upload's folder through
    `removeOwnUpload(id, product.digitalFile)`. That is intended and unchanged.
  - The local-mode `PUT` route, `removeOwnUpload`, and `removeProductUploads`
    are unchanged.
  - Status codes and error codes are unchanged.
  - Abandoned upload folders are still cleaned up only when the product is
    deleted (already out of scope).

## Build steps

- [x] 1. **Exact-key cleanup with a live-file guard.**
  - Add `deleteObject`, `removeDirectUpload`, and the `finishDirectUpload` and
    route changes above.
  - Tests:
    - `lib/object-storage.test.ts`: `deleteObject` refuses an unsafe key.
    - `lib/product-files.test.ts`: each `finishDirectUpload` failure deletes
      exactly the key, never a prefix. `removeDirectUpload` ignores a foreign
      or seed key.
    - `complete/route.test.ts`, existing cleanup cases: they now expect
      `removeDirectUpload` with the exact key.
    - New route case: a key in the live file's folder with another name fails
      and leaves the live key untouched.
    - New route case: when the `catch` path runs and the product now points at
      the key, nothing is deleted.
  - Done when: those tests pass, and `pnpm test`, `pnpm lint`, and
    `pnpm build` pass.

## Verify

- `pnpm test` covers both failure paths from the finding: the hand-crafted key
  in the live folder, and the retry that throws after the key went live.
- `pnpm test:browser` still passes (local mode; the `PUT` route is untouched).
- Live bucket behavior is proven by the launch smoke test (the admin ZIP upload
  over 5 MB). To try it by hand there: upload a file, then send a completion for
  `<same folder>/other.pdf`. It should fail with 400 `empty_file`, and the
  product's download should still work.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":4094,"specSha256":"863a048aa26cffa4ae3670874ee019f4b9cccc306c6a7b845c898eaa473e6840","branch":"refs/heads/fix/upload-cleanup-can-delete-the-live-file","head":"51b97aa27ebc7301949f4383a8a162d4b428a2dd","baseRef":"refs/heads/main","baseCommit":"54d841ce3c3533bfe5a4d1d7cfb5c2cf8e0c7eb2","sourceTree":"1ecce1623c8f2c1cf7fef887995441c5de6cf40a","absentOptional":[]} -->

## Findings

### upload-cleanup-can-delete-the-live-file/F-43 [P3] closed - A failed completion deletes the whole token folder named by the client key, which can be the live file's folder

**File:** lib/product-files.ts:170
**Found:** 2026-10-12 by /audit independent (scope: current; lens: security, quality)
**Why it matters:** `isUploadKeyFor` accepts any clean PDF/ZIP name inside any 16-hex token folder of the product, and the complete route only guards the exact key `product.digitalFile === key` (`app/api/admin/products/[id]/file/complete/route.ts:57`). A completion request for `products/<id>/<token of the current file>/other.pdf` finds no object, so `finishDirectUpload` returns `empty_file` after `deletePrefix("products/<id>/<token>/")`, which also deletes the product's live file. The product keeps pointing at a missing object and every buyer's download fails. The route's `catch` path does the same through `removeOwnUpload(id, pending)` if a check throws after another completion of the same key already committed (for example a retried request racing a transient storage error). The browser only ever sends the key the upload-url route minted with a fresh random token, so the normal flow cannot reach this; it needs a hand-crafted admin request or that rare race. Only admins can call the route, so this is a missing guard on a destructive cleanup, not an authorization break.
**Suggested fix:** In the complete route, return `invalid_request` (and delete nothing) when `path.posix.dirname(key) === path.posix.dirname(product.digitalFile ?? "")`, or have the failure and `catch` cleanups delete only the exact key instead of its folder. Add one route or helper test for a key in the current file's folder. Requirement lost: None.
**Resolution:** Fixed 2026-10-12 by /implement (fix/upload-cleanup-can-delete-the-live-file): failed direct-upload cleanups delete only the exact key through `removeDirectUpload`, never its folder, and the complete route's error-path cleanup re-reads the product and skips a key it now points at. Covered by new tests in `lib/product-files.test.ts` and `complete/route.test.ts`. Awaiting /audit re-review.
Closed 2026-10-12 by /audit independent (scope: current; lenses: quality, security, performance, tests; 54d841c..51b97aa): every failure cleanup in `finishDirectUpload` and the complete route now goes through `removeDirectUpload` (`lib/product-files.ts:180`), which deletes exactly the key and only for this product's upload-key shape; no `deletePrefix` remains on a client-supplied key. A sibling key in the live folder now deletes only that (absent) object, and the route's `catch` re-reads the product and skips a key it now points at (`route.ts:29`). The success path's `removeOwnUpload(id, product.digitalFile)` still deletes the previous folder, but every write path (`saveProductUpload`, `startDirectUpload`) mints a fresh random token, so no other object can share that folder. No new defect introduced; `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Independent review

**Status:** passed
**Target commit:** 51b97aa27ebc7301949f4383a8a162d4b428a2dd
**Base commit:** 54d841ce3c3533bfe5a4d1d7cfb5c2cf8e0c7eb2
**Base ref:** main
**Spec hash:** 863a048aa26cffa4ae3670874ee019f4b9cccc306c6a7b845c898eaa473e6840
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-12T03:41:07Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-12T03:45:00Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `54d841ce3c3533bfe5a4d1d7cfb5c2cf8e0c7eb2..51b97aa27ebc7301949f4383a8a162d4b428a2dd` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `pnpm test`: pass (71 files, 1252 tests)
- `pnpm lint`: pass
- `pnpm build`: pass
- `pnpm test:browser`: unavailable (not run; it re-seeds the `DATABASE_URL` database)

## Evidence

- Preflight: `HEAD` = target, `git merge-base main HEAD` = base, spec SHA-256 matches, only `blueprint/context/review.md` and `blueprint/context/findings.md` differ from the target.
- Reviewed the full delta: `lib/object-storage.ts` (`deleteObject` through `safeKey`), `lib/product-files.ts` (`removeDirectUpload`, `finishDirectUpload`), `app/api/admin/products/[id]/file/complete/route.ts` (`discardUnlessLive` and the three cleanups), their tests, and the fix spec.
- No `deletePrefix` call remains on a client-supplied key; `removeOwnUpload` is reached only with the product's previous `digitalFile` on success. Every object write mints a fresh random token (`lib/product-files.ts:94`, `:151`), so a previous folder holds no other object.
- Status and error codes, the local-mode `PUT` route, `removeOwnUpload`, and `removeProductUploads` are unchanged, matching the spec's must-not-break list.
- Tests assert exact-key deletion, never a prefix; foreign, seed, and folder keys are ignored; the sibling-key and catch-race route cases leave the live key untouched.

## Findings

- F-43 closed (repair verified against the new code)
- No new findings

## Remaining risk

- `pnpm test:browser` not run (re-seeds the database); the local `PUT` path is untouched by this delta.
- Live bucket behavior (real `DeleteObjectCommand`) is proven only by mocks; the spec defers it to the launch smoke test.
- `discardUnlessLive` re-reads then deletes, so a same-key completion that commits between that read and the delete could still lose the file; it needs two concurrent admin completions of one key plus a thrown error, and was judged not worth a ledger entry.
