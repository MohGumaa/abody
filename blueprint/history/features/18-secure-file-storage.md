# Feature: Secure File Storage

**From build-plan:** feature 18
**Build attempt:** 1
**Branch:** feature/secure-file-storage
**Status:** verified

## Goal

Move private digital product files from the local `storage/` folder to private
S3-compatible object storage (Cloudflare R2 or AWS S3, chosen at deploy time by
environment variables), and serve paid downloads through short-lived signed
URLs issued only after the existing ownership check passes. Without bucket
configuration, the app keeps today's local `storage/` behavior so development,
tests, and seed data need no cloud account.

## In scope

- One S3 client (`@aws-sdk/client-s3`) plus the presigner
  (`@aws-sdk/s3-request-presigner`), configured only by environment variables.
- Storage mode chosen from the environment:
  - no `S3_*` storage variable set: local `storage/` folder, unchanged behavior;
  - all required variables set: the bucket;
  - some but not all set: a configuration error (logged without values, the
    request fails with the generic 500). Never silently falls back to disk.
- `GET /api/downloads/[itemId]` in bucket mode: same `session_id` and paid-order
  check as today, then confirm the object exists and answer `302` to a signed
  GET URL that expires after 5 minutes, carrying the download file name and
  content type. Local mode streams exactly as today.
- Admin file upload (`PUT /api/admin/products/[id]/file`) in bucket mode:
  same size, empty, and PDF/ZIP signature checks, then the file is stored in the
  bucket under the same key shape (`products/<id>/<token>/<name>`). Replacing a
  file and deleting a product remove only that product's own uploaded objects;
  `seed/` objects are never removed.
- A one-off, non-destructive copy command that uploads the existing local
  `storage/seed/` and `storage/products/` files to the bucket under the same
  keys, skipping objects that already exist. Stored `digitalFile` keys stay
  valid, so no database migration is needed.
- `.env.example` and `AGENTS.md` Commands document the new variables and command.

## Out of scope

- Requiring sign-in for downloads, or changing who may download. The
  `session_id` + paid-order rule from features 7 and 9 stays as is (account-level
  hardening belongs to 24).
- Admin image upload (overview open question 7), email links (19), download
  counting or analytics (23), rate limiting (24).
- Choosing or configuring a deployment host, creating the bucket, or bucket
  lifecycle and CORS rules (not needed for a top-level redirect).
- Moving or deleting the local files after copying; the copy never deletes.
- Database schema changes.

## Build loop

`workflow.stepReview` is `feature`: build all steps, running the step's checks
after each, then present one review packet for the whole feature.
`workflow.checkpointCommits` is `disabled`: no checkpoint commits; `/complete`
creates the single feature commit on `feature/secure-file-storage`.

## Build steps

1. [x] **Storage configuration and S3 module.** Add `@aws-sdk/client-s3` and
   `@aws-sdk/s3-request-presigner` with pnpm (pin the current installed
   versions). Add `isSafeStorageKey(key)` to `lib/delivery.ts` and make
   `storagePath` use it, so bucket and disk share one key rule. Add server-only
   `lib/object-storage.ts` with: `bucketConfig()` (null / config / throws on
   partial config, per Data / contracts), a lazily created client, and
   `putObjectFromFile`, `objectExists`, `deletePrefix`, and
   `signedDownloadUrl(key)`. Every function rejects an unsafe key. Document the
   variables in `.env.example`.
   **Done when:** unit tests cover all three config outcomes (and that the error
   message names missing variables, never values), unsafe keys being rejected,
   and a signed URL generated offline with fake credentials containing the key,
   a 300-second expiry, and `attachment` disposition with the file name;
   existing `storagePath` tests still pass; `pnpm test` and `pnpm lint` pass.

2. [x] **Signed downloads.** In `lib/downloads.ts`, add a bucket-aware lookup
   used by `app/api/downloads/[itemId]/route.ts`: in bucket mode, after
   `findDownload` grants the key, `objectExists` must be true, then the route
   returns `302` to `signedDownloadUrl(key)` with `Cache-Control: private,
   no-store` and `Referrer-Policy: no-referrer`; a missing object gives today's
   logged 500. Local mode keeps the current streaming response byte-for-byte.
   The success page and account download links do not change.
   **Done when:** route tests show, in bucket mode, a 302 with the signed URL
   and no-store headers for a granted item, the identical 404 for every denial
   (no storage call made), and a 500 without logging the session id, key, or
   URL for a missing object or config error; existing local-mode route and
   `openStoredFile` tests pass unchanged; `pnpm test` passes.

3. [x] **Bucket uploads and removals.** In `lib/product-files.ts`, bucket mode
   streams the upload to a temp file under `os.tmpdir()` with the same byte
   limit and signature check, uploads it with `putObjectFromFile` (content type
   from `contentTypeFor`, explicit content length), and always removes the temp
   file. `removeOwnUpload` deletes the prefix `products/<id>/<token>/` only
   when `isOwnUploadKey` is true; `removeProductUploads` deletes the prefix
   `products/<id>/`. Local mode is unchanged. The upload route's ordering stays:
   the product points at the new key only after the object is stored, and a
   failed database update removes the new object.
   **Done when:** tests with `lib/object-storage` mocked show bucket-mode upload
   success, too-large, empty, and wrong-signature results with no object
   written and no temp file left; replacement removes only the old own-upload
   prefix and never a `seed/` key; `removeProductUploads("p1")` deletes only
   `products/p1/` (this also covers finding F-19 in both modes); existing
   local-mode upload route tests pass; `pnpm test` passes.

4. [x] **Copy existing files to the bucket.** Add `scripts/upload-storage.ts`
   (its key-collection helper lives in `scripts/storage-keys.ts` so the test can
   import it without running the command) and a `storage:upload` package script (`tsx`, loading `.env` like
   `scripts/promote-admin.ts`). It requires bucket mode, walks
   `storage/seed/` and `storage/products/`, skips `.tmp` files and any path that
   fails `isSafeStorageKey`, skips keys that already exist, uploads the rest,
   and prints counts (uploaded, skipped, rejected) without file contents or
   secrets. It never deletes local or remote files. Add the command and
   variables to `AGENTS.md` Commands.
   **Done when:** a unit test of the key-collection helper shows safe keys
   collected with forward slashes and unsafe or `.tmp` paths rejected; running
   the command without bucket variables exits non-zero with a clear message;
   `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Files / areas

- `package.json`, `pnpm-lock.yaml` - two SDK dependencies, `storage:upload`
- `lib/object-storage.ts` (new) and `lib/object-storage.test.ts` (new)
- `lib/delivery.ts`, `lib/delivery.test.ts` - `isSafeStorageKey`
- `lib/downloads.ts`, `lib/downloads.test.ts`
- `app/api/downloads/[itemId]/route.ts` and its test
- `lib/product-files.ts`, a new `lib/product-files.test.ts`
- `app/api/admin/products/[id]/file/route.ts` (only if a change is needed) and
  its test
- `scripts/upload-storage.ts`, `scripts/storage-keys.ts`, and
  `scripts/storage-keys.test.ts` (new)
- `.env.example`, `AGENTS.md` (Commands)
- Unchanged: `actions/admin-products.ts` (still calls `removeProductUploads`),
  `app/[lang]/success/page.tsx`, `components/account/AccountParts.tsx`,
  `prisma/schema.prisma`, `prisma/seed.ts`

## Data / contracts

- **Environment variables** (server only, never sent to the client, never
  logged):
  - `S3_BUCKET` (required in bucket mode)
  - `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (required)
  - `S3_REGION` (required; `auto` for R2, the bucket region for AWS)
  - `S3_ENDPOINT` (optional; the R2 account endpoint
    `https://<account-id>.r2.cloudflarestorage.com`, omitted for AWS)
  - Mode: none of the five set → local; the four required set → bucket;
    anything else → configuration error naming the missing variable names.
- **Object keys** are the existing `digitalFile` values unchanged:
  `seed/<name>` and `products/<productId>/<token>/<name>`, validated by
  `isSafeStorageKey` (≤ 255 chars; each segment `^[A-Za-z0-9][A-Za-z0-9._-]*$`).
  The bucket is private; no public access or public URL is ever produced.
- **Signed URL:** GET only, expires in 300 seconds, with
  `ResponseContentDisposition` = `contentDisposition(key)` and
  `ResponseContentType` = `contentTypeFor(key)`, so the browser saves the clean
  file name even though the cross-origin `download` attribute is ignored.
- **Download route responses:** granted + bucket → `302 Location: <signed URL>`,
  `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`; granted +
  local → `200` stream as today; any denial → the existing identical `404
  not_found`; missing object, storage, or config failure → the existing `500
  internal_error`. Logs carry only the order item id, never the session id,
  key, signed URL, or credentials.
- **Upload route:** responses and error codes unchanged
  (`{ fileName }`, `file_too_large`, `empty_file`, `invalid_file_type`,
  `not_found`, `forbidden`, `internal_error`).

## Testing

- Vitest unit tests per step as listed; `lib/object-storage` is mocked in route
  and `product-files` tests, so no test touches the network. The presigner test
  runs offline with fake credentials.
- Not covered automatically: a real R2 or S3 bucket. If credentials are
  available during `/check`, verify a live upload, a signed download, URL
  expiry, and the copy command against a test bucket; otherwise say so plainly.
- No browser test command exists; none is added.

## Notes for the AI

- Read the route handler guide in `node_modules/next/dist/docs/` before changing
  route handlers (redirect responses in particular); this Next.js version
  differs from training data.
- Import `@/lib/object-storage` only from server code; it must never enter a
  client bundle. Keep `lib/delivery.ts` free of `node:fs`, db, `next/*`, and the
  SDK, as its header requires.
- Create the S3 client lazily so local mode and tests never construct it.
  Confirm that the default SDK settings work with an R2 endpoint; add
  `forcePathStyle` only if needed and record why.
- Uploads are at most 25 MB, so a single `PutObject` with a file stream and
  explicit `ContentLength` is enough; do not add `@aws-sdk/lib-storage`.
- `deletePrefix` lists with `ListObjectsV2` (paginated) and deletes with
  `DeleteObjects`; the prefix must end in `/` and pass the key rule, so it can
  never match `seed/` or another product.
- After completion, the overview's "undecided providers" item and the
  deployment note about a persistent disk are out of date; suggest updating the
  plans and re-running `/overview`.

## Verification

- `pnpm test`: 45 files, 776 tests passed.
- `pnpm lint`: clean.
- `pnpm build`: succeeded.
- `pnpm storage:upload` without bucket variables: exit code 1 with the
  "No bucket is configured" message.
- Not run: a live R2 or S3 bucket (no credentials in this environment).


<!-- blueprint:completion {"schemaVersion":1,"specBytes":11369,"specSha256":"133207d5b66dd82df7a6374df63497650b3de0468e4b557caffbd53367fd5803","branch":"refs/heads/feature/secure-file-storage","head":"7e8e7f310845a52ee1a30f75f38bde453064c57b","baseRef":"refs/heads/main","baseCommit":"2489170e8a44d68fbcd110c92a87c90844b94976","sourceTree":"154d27d67d761fee104e8419f967bfa707fc525d","absentOptional":[]} -->

## Findings

### 18/F-19 [P3] closed - The recursive delete of a product's upload folder has no direct test

**File:** lib/product-files.ts:131
**Found:** 2026-10-07 by /audit independent (scope: current; lens: tests)
**Why it matters:** `removeProductUploads(productId)` runs `rm -r` on `storage/products/<id>` after a product is deleted. `actions/admin-products.test.ts` mocks the whole module, so no test proves the path it removes is exactly `products/<id>/` and never the storage root, another product's folder, or `seed/`. The upload route test exercises `removeOwnUpload` against a real temp root, but not this function. The current code is correct (the path goes through `storagePath`, and the action only calls it after `deleteMany` matched a real digital product), so this is a coverage gap on a destructive helper, not a live bug.
**Suggested fix:** Add a small test for `lib/product-files.ts` using the same `vi.mock("@/lib/downloads")` temp-root pattern as the route test: create `products/p1/<token>/a.pdf`, `products/p2/<token>/b.pdf`, and `seed/c.pdf`, call `removeProductUploads("p1")`, and assert only `products/p1` is gone. Requirement lost: None.
**Resolution:** Fixed 2026-10-10 on feature/secure-file-storage (feature 18): `lib/product-files.test.ts` creates `products/p1`, `products/p2`, and `seed/` files under a temp root and asserts `removeProductUploads("p1")` removes only `products/p1` (local mode), and that bucket mode deletes only the `products/p1/` prefix. Awaiting `/audit` closure. Closed 2026-10-10 by /audit independent (target 7e8e7f3, fresh subagent): re-examined `lib/product-files.ts:131-139` and `lib/product-files.test.ts:120-138`. The local test proves `removeProductUploads("p1")` removes `products/p1` and leaves `products/p2` and `seed/`; the bucket test proves the only prefix deleted is `products/p1/`, and `deletePrefix` itself rejects a prefix that fails the key rule. The repair introduced no new defect.

## Independent review

**Status:** passed
**Target commit:** 7e8e7f310845a52ee1a30f75f38bde453064c57b
**Base commit:** 2489170e8a44d68fbcd110c92a87c90844b94976
**Base ref:** main
**Spec hash:** 133207d5b66dd82df7a6374df63497650b3de0468e4b557caffbd53367fd5803
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** runtime default (exact model not known until reviewer starts)
**Requested execution:** automatic
**Requested at:** 2026-10-10T15:04:29Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-10T15:14:01Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `2489170e8a44d68fbcd110c92a87c90844b94976..7e8e7f310845a52ee1a30f75f38bde453064c57b` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`: pass (equals Target commit)
- `git merge-base main HEAD`: pass (equals Base commit)
- `sha256sum blueprint/context/current-feature.md`: pass (equals Spec hash; spec is tracked)
- `git status --porcelain --untracked-files=all`: pass (only `blueprint/context/review.md` differs, before and after the build)
- `pnpm test`: pass (45 files, 776 tests)
- `pnpm lint`: pass (clean)
- `pnpm build`: pass

## Evidence

- Reviewed every file in the base..target delta: `lib/object-storage.ts`, `lib/product-files.ts`, `lib/downloads.ts`, `lib/delivery.ts`, `app/api/downloads/[itemId]/route.ts`, `scripts/upload-storage.ts`, `scripts/storage-keys.ts`, all changed and new tests, `package.json`, `.env.example`, `AGENTS.md`; lockfile reviewed only for the two pinned SDK packages. Callers checked: `app/api/admin/products/[id]/file/route.ts`, `actions/admin-products.ts`, `lib/admin-products.ts` key helpers.
- Download authorization: `findDownload` (session id + item id + paid status) runs before any storage call; every denial returns the same 404; bucket mode answers 302 with `Cache-Control: private, no-store` and `Referrer-Policy: no-referrer`; signed URL is GET-only, 300 s, with attachment disposition and content type from the safe key.
- Key/prefix validation: `isSafeStorageKey` shared by disk and bucket; `deletePrefix` requires a trailing slash and a safe key before it, so it cannot match `seed/`, a sibling product (`products/p1/` vs `products/p10/`), or the bucket root; `removeOwnUpload` deletes only when `isOwnUploadKey` holds; `digitalFile` is only written by the upload route.
- Partial config: any `S3_*` set without all four required throws `StorageConfigError` naming only variable names; the download route, upload route, product delete, and copy script all surface it as an error, never a silent disk fallback.
- Secrets/logging: no credential, key, session id, or signed URL is logged by new code; the copy script prints only counts or the error message. `lib/object-storage` is imported only from server modules and scripts.
- Temp files: bucket-mode upload writes `os.tmpdir()/abody-upload-<token>.tmp` with `wx` and removes it on success, empty, bad signature, too-large, and upload failure (tested).
- F-19 re-examined and closed (see ledger).

## Findings

- F-29 [P3] open: upload route test does not pin local storage mode against ambient `S3_*` variables
- F-30 [P3] open: `objectExists`, `putObjectFromFile`, and `deletePrefix` paging/error handling lack direct tests
- F-19 [P3] closed on re-examination

## Remaining risk

- No live R2 or S3 bucket was available: upload, signed download, URL expiry, the default virtual-hosted addressing and `WHEN_REQUIRED` checksum settings against R2 (including `DeleteObjects`), and `pnpm storage:upload` against a bucket are unverified.
- The download route's catch logs the raw SDK error object; HeadObject/sign errors are not known to carry the key or URL, but this was not verified against real provider errors.
- Browser flow not exercised (Check not required; no browser test command exists).
