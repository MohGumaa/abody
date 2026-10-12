# Feature: Production Deployment

**From build-plan:** feature 25b
**Build attempt:** 1
**Branch:** feature/production-deployment
**Status:** verified

## Goal

Make Abody ready to ship to Vercel: make the one code path that breaks there
(admin file upload over Vercel's 4.5 MB function body limit) upload straight to
the private bucket, and add a production migration command and a deployment
runbook. The launch itself (provisioning, deploy, smoke test, live Stripe)
follows `/complete` through the runbook and `/release vercel`, with a separate
yes in chat for every external step.

## In scope

- **Direct-to-bucket admin upload** when a bucket is configured, keeping the
  shipped 25 MB PDF/ZIP contract: the server issues a short-lived presigned PUT
  URL, the browser uploads to the bucket, and the server verifies the object
  (size and PDF/ZIP signature) before pointing the product at it.
- Local mode (no `S3_*` variables) keeps the existing
  `PUT /api/admin/products/[id]/file` route unchanged, so development and
  `pnpm test:browser` behave as today.
- `pnpm db:deploy` (`prisma migrate deploy`), run by hand against the Neon
  **direct** (non-pooled) URL before any deploy that adds a migration.
- Deployment runbook in the README's existing "Deploy on Vercel" section, plus
  `.env.example` and `AGENTS.md` Commands updates.
- `/release vercel` readiness run (local checks only).

## Out of scope

- Any schema change, new product behavior, or Content Security Policy.
- Running migrations in the Vercel build; preview deployments with their own
  database (Production env vars only).
- Running `pnpm db:seed` against production (development data only).
- Cleaning up abandoned direct uploads beyond today's per-product prefix delete.
- Writing the final Terms, Privacy, and Returns text (Abody's review; see Notes).
- CI (`/ci`), monitoring, custom error pages, backups beyond Neon defaults.
- The external launch (moved out of this spec by user decision; see "Launch
  after completion"): Neon, bucket and CORS, Resend domain, Vercel project and
  env vars, Stripe webhooks, deploy, smoke test, and the live switch.

## Build loop

`workflow.stepReview` is `feature`: build all steps, then one review packet.
`checkpointCommits` is disabled; `/complete` makes the feature commit. All steps
are local code and docs; never push, deploy, or set remote values from this
spec. The independent-review gate is `when-sensitive`; this feature
changes an admin upload trust boundary and payment configuration, so it is
selected (`/audit independent current`) before `/complete`.

## Build steps

- [x] 1. **Storage helpers for direct upload.**
  - `lib/object-storage.ts`: `signedUploadUrl(key, contentType)` (presigned
    `PutObjectCommand` with `ContentType`, expires in `SIGNED_URL_SECONDS`),
    `objectSize(key)` (HEAD; `null` when missing), and
    `readObjectStart(key, length)` (ranged GET of the first bytes).
  - `lib/admin-products.ts`: `isUploadKeyFor(productId, key)`, the strict key
    shape `products/<productId>/<16 lowercase hex>/<name>` where `<name>` equals
    `uploadFileName(<name>)`, has an allowed extension, and passes
    `isSafeStorageKey`. `isOwnUploadKey` stays as is for deletes.
  - `lib/product-files.ts`: share the existing `SIGNATURES` check as a pure
    function on a byte buffer; add `startDirectUpload(productId, originalName,
    size)` → `{ ok: true, key, url, contentType }` or `UploadError`, and
    `finishDirectUpload(productId, key)` → `SaveResult`, which deletes the
    upload's folder whenever the object is missing, empty, over the limit, or
    has the wrong signature.
  - Done when: Vitest covers key shape (valid, other product, wrong token
    length, traversal, bad extension), signature match/mismatch, size limits,
    and cleanup on each failure with the S3 calls mocked; `pnpm test` passes.

- [x] 2. **Upload URL and completion routes.**
  - `POST /api/admin/products/[id]/file/upload-url` and
    `POST /api/admin/products/[id]/file/complete`, following the existing upload
    route: non-admin or unknown/non-digital product → 404 `not_found`;
    cross-origin → 403 `forbidden`; no bucket configured → 409
    `direct_upload_unavailable`.
  - Completion updates `digitalFile` only after verification, then removes the
    previous own upload (failure logged, not returned). If `key` already equals
    the current `digitalFile`, return success without deleting anything.
  - Errors never log keys, URLs, or file contents.
  - Done when: route tests (pattern of the existing `route.test.ts`) cover
    every status above, the happy path, the same-key guard, and old-file
    removal; `pnpm test` passes.

- [x] 3. **Admin upload form uses the direct path in bucket mode.**
  - `app/admin/products/[id]/page.tsx` passes `direct={bucketConfig() !== null}`
    to `ProductFileUpload`.
  - Direct mode: request URL → `PUT` the file with the returned `Content-Type`
    → complete. Local mode: the current single `PUT`.
  - Same idle/uploading/done/error states, `role="status"` announcement, input
    disabled while uploading, and the same messages. A failed bucket `PUT`
    (network or CORS) shows "The upload failed. Try again."
  - Done when: `pnpm lint` and `pnpm build` pass and `pnpm test:browser` still
    passes (local mode). The bucket path is proven live in the launch smoke test.

- [x] 4. **Migration command, runbook, and readiness.**
  - `package.json`: `"db:deploy": "prisma migrate deploy"`. Add it to the
    `AGENTS.md` Commands section (production only, direct URL).
  - Replace the README's "Deploy on Vercel" boilerplate with the runbook:
    - Neon pooled URL for the app, direct URL for `db:deploy` and
      `admin:promote`.
    - Production env var names (see Data / contracts).
    - Bucket CORS rule and webhook events.
    - Order: migrate, then deploy, then smoke test, then switch to live.
  - `.env.example`: note Neon pooled vs direct, `x-real-ip` on Vercel, and
    that `STRIPE_API_BASE` is never set in production.
  - Run `/release vercel`. No `vercel.json` unless it finds a default that
    does not fit.
  - Done when: `pnpm test`, `pnpm lint`, and `pnpm build` pass and the release
    packet lists no blockers other than the external launch steps.

## Launch after completion

Not build steps (user decision during `/implement`): after `/complete`, push
`main` and run `/release vercel`, following the README's "Deploy on Vercel"
order, with an explicit yes for each external action:

1. Neon database, then `pnpm db:deploy` with the direct URL.
2. Bucket with its CORS rule, and the Resend sender domain.
3. Vercel project from `MohGumaa/abody`, Production env vars with **test** Stripe
   keys, and the test-mode webhook (`*.vercel.app` until a domain exists).
4. Deploy, promote the admin, and run the smoke test. It must include an admin
   ZIP upload over 5 MB, which is the only live proof of the direct path.
5. Switch to live Stripe keys and a live webhook, then redeploy.

## Files / areas

- `lib/object-storage.ts`, `lib/product-files.ts`, `lib/admin-products.ts`
  and their tests
- `app/api/admin/products/[id]/file/upload-url/route.ts` and
  `.../file/complete/route.ts` (new) and their tests; the existing
  `.../file/route.ts` behaves the same, with its origin check and error table
  moved to `lib/upload-route.ts` so all three routes share them
- `app/admin/access.test.ts`: page modules are loaded once up front (same fix
  as `48e945d`), because the full suite timed out loading admin pages
- `components/admin/ProductFileUpload.tsx`, `app/admin/products/[id]/page.tsx`
- `package.json`, `README.md`, `.env.example`, `AGENTS.md` (Commands)

## Data / contracts

- **No schema change.** `Product.digitalFile` stores the verified key.
- **Key:** `products/<productId>/<token>/<uploadFileName(name)>`, where `token`
  is 8 random bytes in lowercase hex (as today). Only keys of that exact shape
  for the route's product are accepted at completion.
- **`POST .../file/upload-url`**
  - Request: JSON `{ "fileName": string, "size": number }`.
  - `size` is an integer from 1 to `PRODUCT_FILE_MAX_BYTES`.
  - The request body is capped at 2 KB.
  - 200 → `{ "url": string, "key": string, "contentType": string }`.
  - The URL expires in 300 s and the client must send exactly that
    `Content-Type`.
- **`POST .../file/complete`**
  - Request: JSON `{ "key": string }`.
  - 200 → `{ "fileName": string }`.
  - The server re-checks the size with HEAD and the first bytes with a ranged
    GET. The size the client declared is never trusted.
- **Errors** use the existing `apiError` shape:

  | Status | Code |
  | --- | --- |
  | 400 | `invalid_request`, `invalid_file_type`, `empty_file` |
  | 413 | `file_too_large` |
  | 403 | `forbidden` |
  | 404 | `not_found` |
  | 409 | `direct_upload_unavailable` |
  | 500 | `internal_error` |

- **Bucket CORS:** allowed origin is the `SITE_URL` origin only, method `PUT`,
  allowed header `content-type`.
- **Production env vars** (names only, never written to files or chat):
  - `DATABASE_URL` (Neon pooled), `SITE_URL`
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL`
  - `RATE_LIMIT_IP_HEADER=x-real-ip`
  - `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
    plus `S3_ENDPOINT` for R2
  - Not set: `STRIPE_API_BASE`.
- **Stripe webhook events:** `checkout.session.completed`,
  `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `charge.refunded`.

## Testing

- **Vitest:** the helpers and both new routes (step 1-2), with S3 and Prisma
  mocked the way existing tests do.
- **Existing checks:** `pnpm test`, `pnpm lint`, `pnpm build`, and
  `pnpm test:browser` (local storage mode; covers the unchanged PUT path).
- **Live evidence:** the bucket upload, CORS, Neon pooling, webhook, emails,
  and `x-real-ip` are proven only by the post-completion smoke test on the
  deployed site. Do not claim them before then.

## Notes for the AI

- Read the route handler and `headers`/config guides in
  `node_modules/next/dist/docs/` before writing routes (Next.js 16).
- Check whether the presigner signs `Content-Length`. Either way, the completion
  check is the only size authority.
- Presigned URLs and keys are sensitive; never log them or put them in errors.
- `bucketConfig()` throws on partial setup, so the admin page failing loudly
  there is intended.
- Prisma 7 with `@prisma/adapter-pg` uses `DATABASE_URL` at runtime (pooled)
  and in `prisma.config.ts` for CLI commands. Pass the direct URL only in the
  shell for `db:deploy` and `admin:promote`, and never commit it.
- Connecting the GitHub repo makes every push to `main` a production deploy;
  say so when asking for the launch yes. Pushing is a separate approval.
- Launch reminder, not a step: the Terms, Privacy, and Returns text is a draft
  for Abody to review, and Privacy predates analytics.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":10979,"specSha256":"e7cfd94cfcb07c9407130f51cca2f5b8e142d71dc96fad8be7fd9b983b251eb4","branch":"refs/heads/feature/production-deployment","head":"c9306da63f3f3167ea60fdb2904c91f351d2b532","baseRef":"refs/heads/main","baseCommit":"26a37d54504b7729361acfc20a888cac4a8630f9","sourceTree":"27a61e382215131d5b8df9d3bfe30df3191bc8b8","absentOptional":[]} -->

## Findings

### 25b/F-42 [P3] closed - The project overview's tech stack does not list Playwright

**File:** blueprint/context/project-overview.md:213
**Found:** 2026-10-11 by /audit independent (scope: current; lens: quality)
**Why it matters:** This delta regenerates the overview and adds `@playwright/test` as a dev dependency with a `pnpm test:browser` command in `AGENTS.md`, but the Tech stack line still names only Vitest for testing. Feature 25 mentions Playwright, so the omission is small, but the overview is the source of truth agents read before changing code.
**Suggested fix:** Add Playwright (Chromium, `pnpm test:browser`, fake Stripe on 12111) to the Tech stack list on the next `/overview` refresh. Requirement lost: None.
**Resolution:** Closed 2026-10-12 by /audit independent (target c9306da, fresh subagent): the Tech stack line in `blueprint/context/project-overview.md:215` now reads "Vitest, Playwright (browser tests with a fake Stripe), ESLint, pnpm". The original gap is gone and the edit introduces nothing new.

## Independent review

**Status:** passed
**Target commit:** c9306da63f3f3167ea60fdb2904c91f351d2b532
**Base commit:** 26a37d54504b7729361acfc20a888cac4a8630f9
**Base ref:** main
**Spec hash:** e7cfd94cfcb07c9407130f51cca2f5b8e142d71dc96fad8be7fd9b983b251eb4
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-12T03:00:59Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-12T03:12:28Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `26a37d54504b7729361acfc20a888cac4a8630f9..c9306da63f3f3167ea60fdb2904c91f351d2b532` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --short`: pass (HEAD equals target, merge base equals base, spec hash matches, only `blueprint/context/review.md` modified)
- `pnpm test`: pass (71 files, 1246 tests)
- `pnpm lint`: pass
- `pnpm build`: pass (both new routes compiled; working tree unchanged afterwards)
- `pnpm test:browser`: unavailable (not run by reviewer; it re-seeds the `DATABASE_URL` database)

## Evidence

- Reviewed all 22 changed paths in the delta: `lib/object-storage.ts`, `lib/product-files.ts`, `lib/admin-products.ts`, `lib/upload-route.ts`, `lib/api-error.ts`, both new routes and their tests, the refactored `app/api/admin/products/[id]/file/route.ts`, `components/admin/ProductFileUpload.tsx`, `app/admin/products/[id]/page.tsx`, `app/admin/access.test.ts`, `package.json`, `README.md`, `.env.example`, `AGENTS.md`, `blueprint/context/project-overview.md`, and the spec.
- Trust boundary: both new routes check admin role (404 otherwise), origin (403), product id shape, bucket presence (409), and a 2 KB JSON cap before any storage call; completion re-validates the key with `isUploadKeyFor`, re-reads size by HEAD and the first bytes by ranged GET, and never trusts the declared size. Presigned PUT signs `content-type` and expires in 300 s; checksum calculation is `WHEN_REQUIRED`, so the presigned URL carries no extra checksum header.
- Logging: new routes log only the error name, never keys, URLs, or storage settings; tests assert the key is not logged.
- Refactored PUT route: origin check, error table, and not-found response moved to `lib/upload-route.ts` verbatim; behavior unchanged.
- Docs: `dotenv/config` does not override a shell `DATABASE_URL`, so the README's direct-URL commands for `db:deploy` and `admin:promote` work as written; no CSP exists that would block the browser's bucket PUT.

## Findings

- F-43 [P3] open: failed completion deletes the client-named token folder, which can be the live file's folder
- F-44 [P3] open: network/CORS failure on the bucket PUT shows the connection message instead of the spec's text
- F-42 closed: overview tech stack now lists Playwright

## Remaining risk

- `pnpm test:browser` was not run by the reviewer (it re-seeds the database), so the unchanged local-mode upload flow was not re-proven in a browser in this pass.
- The direct bucket path (presigned PUT, bucket CORS, R2/S3 compatibility of the signed `content-type`) is proven only by mocked unit tests until the post-completion smoke test's admin ZIP upload over 5 MB, as the spec states.
- Abandoned direct uploads (link issued, never completed) stay in the bucket until the product is deleted; out of scope by the spec.
