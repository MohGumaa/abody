# Feature: Admin Product Management

**From build-plan:** feature 13
**Build attempt:** 1
**Branch:** feature/admin-product-management
**Status:** verified

## Goal

Admins can list, create, edit, publish, unpublish, and delete digital products
from `/admin/products`. They manage pricing, the image URL, the English and Arabic
content, and the downloadable file. Customers only ever see published products, and
a product cannot be published until it has a file to deliver.

## In scope

- `/admin/products`: a table of every `DIGITAL_PRODUCT` (published and
  unpublished) with name, slug, category, price, status, file attached yes/no,
  and last updated. Each row links to its edit page. Includes a "New product" link
  and an empty state.
- `/admin/products/new`: a form that creates the product as `UNPUBLISHED`, then
  redirects to its edit page.
- `/admin/products/[id]`: the same form filled with current values, plus the
  downloadable-file panel, the publish/unpublish control, and delete.
- Form fields (English): name, slug, short description, description, price in
  USD, category, image URL, and What's Included (one line per item).
- Form fields (Arabic, optional): `nameAr`, `categoryAr`, `shortDescriptionAr`,
  `descriptionAr`, and `includedAr`. An empty value falls back to English on the
  storefront, which already works this way. The overview TODO requires the admin
  form to edit these.
- Downloadable file upload (PDF or ZIP, at most 25 MB) to the private local
  `storage/` folder, which replaces any previous file.
- Publish, which is refused without a `digitalFile`, and unpublish.
- Delete with an explicit confirmation step. It is refused when any `OrderItem`
  references the product (the FK is `Restrict`), and the message tells the admin
  to unpublish instead.
- A "Products" entry in the admin sidebar's Admin section.

## Out of scope

- Services (`type: SERVICE`): their admin pages are feature 14. Admin product
  routes and actions treat a service id as not found.
- Image upload and image hosting: the user chose an image URL field. Feature 18
  revisits storage.
- Object storage (R2/S3, feature 18), Stripe product/price ids (not stored),
  bulk actions, search, pagination, featured flags (feature 21), and
  audit logs.
- Changing what existing buyers download. Downloads already read the product's
  current `digitalFile`, so a replaced file is what past buyers get next time.
  This is accepted, current behavior.

## Build loop

`workflow.stepReview` is `feature`: implement every step below in order. Run
`pnpm test` and `pnpm lint` after each logic step, then present one review packet
when all steps pass. `workflow.checkpointCommits` is `disabled`, so there are no
per-step commits. `/complete` creates the single feature commit.

## Build steps

- [x] **1. Product form parsing and validation (pure logic).** Add
  `lib/admin-products.ts` (no `next/*`, no `db`). It exports
  `parseProductForm(formData)`, which returns
  `{ ok: true, data } | { ok: false, fieldErrors, values }`. It also exports
  `parsePriceToCents` and the limits as constants. Rules:
  - Trim every text field. Required: `name` (≤ 120), `slug` (`isValidSlug` from
    `lib/catalog.ts`, ≤ 80), `shortDescription` (≤ 300), `description` (≤ 10,000),
    `category` (≤ 60), and price.
  - Price: the admin types dollars (`49`, `49.5`, `49.50`). Accept only
    `^\d{1,5}(\.\d{1,2})?$`, then convert with integer math, never float
    multiplication. The range is 50 to 9,999,999 cents. Stripe's USD minimum
    charge is $0.50.
  - `image`: optional. Empty means `null`. Otherwise it must pass
    `publicImageSrc()` (an https URL or a local `/` path) and be ≤ 500.
  - `included` / `includedAr`: split on newlines, trim, drop empty lines, at most
    20 lines of ≤ 200 each.
  - Arabic text fields: optional, with the same length limits as their English
    field. Empty means `null`.
  - The parser never reads `type`, `status`, or `digitalFile` from the form.
  - Field error codes are short strings such as `required`, `too_long`,
    `invalid_slug`, `invalid_price`, `invalid_image`, and `too_many_lines`. The
    page maps them to English messages.
  - Also add `uploadFileName(originalName)`. It keeps the extension, maps the
    base name to `[A-Za-z0-9._-]`, collapses other runs to `-`, makes the name
    start with a letter or digit, caps it at 100 characters, and falls back to
    `download`. Add `productFileKey(productId, token, fileName)`, which returns
    `products/<id>/<token>/<fileName>`, so the download name stays clean while
    every upload gets a unique key that `storagePath()` accepts. Add
    `isOwnUploadKey(productId, key)`, which is true only for keys under
    `products/<id>/`. Seed keys never match, so they are never deleted.
  - **Done when:** `lib/admin-products.test.ts` covers valid input, each
    required field missing, over-length values, slug format, price edge cases
    (`0.49` rejected, `0.50` → 50, `49.5` → 4950, `1.234`, `-1`, `1e3`, and
    `100000` rejected), image http/`//`/`javascript:` rejected, line splitting
    and limits, Arabic empty → `null`, and file name and key building. Also
    `isOwnUploadKey` with seed keys and a different product's key. `pnpm test` is
    green.

- [x] **2. Admin product data and Server Actions.** Add to `lib/admin.ts` (or
  `lib/admin-products-db.ts` if `lib/admin.ts` grows too large): `listAdminProducts()`
  and `getAdminProduct(id)`, which select only `type: DIGITAL_PRODUCT` and
  return a boolean `hasFile`. Keep the `digitalFile` file name only for the
  admin edit page, as its basename. Add `actions/admin-products.ts` (`"use server"`)
  with `createProduct`, `updateProduct`, `setProductStatus`, and `deleteProduct`.
  Every action:
  - calls `requireAdmin()` first, inside the action;
  - validates `id` (length ≤ 64) and scopes every write with
    `{ id, type: "DIGITAL_PRODUCT" }`, so a service id or an unknown id returns
    `not_found`;
  - wraps its body in try/catch and returns
    `{ success: false, error, fieldErrors?, values? }` or `{ success: true }`,
    following `actions/account.ts`. Unexpected errors log without user content
    and return `unexpected`;
  - after success, calls `revalidatePath` for `/admin/products` and for the
    storefront (`/[lang]/products`, the product's detail path, `/[lang]`), then
    redirects where noted.
  - `createProduct`: insert with `type: DIGITAL_PRODUCT` and
    `status: UNPUBLISHED`. Prisma `P2002` on `slug` becomes the field error
    `slug_taken`. Then redirect to `/admin/products/<id>`.
  - `updateProduct`: same parsing and `slug_taken` handling. `status` and
    `digitalFile` are untouched.
  - `setProductStatus(id, "PUBLISHED" | "UNPUBLISHED")`: the status is
    whitelisted. Publishing uses one conditional `updateMany` with
    `where: { id, type, digitalFile: { not: null } }`. Zero rows means
    `file_required` when the product exists, otherwise `not_found`.
  - `deleteProduct(id)`: refuse with `has_orders` when any order item references
    it, and also map the FK error `P2003` to `has_orders` in case an order
    lands between the check and the delete. After a successful delete, remove
    `storage/products/<id>/` (only that directory, resolved through
    `storagePath`). A failed file cleanup is logged and does not fail the
    delete. Redirect to `/admin/products`.
  - **Done when:** `actions/admin-products.test.ts` mocks `db`, `requireAdmin`,
    `next/cache`, and `next/navigation`. It proves that a non-admin never reaches
    the database, that a service id gives `not_found`, `slug_taken`, publish
    without a file gives `file_required`, delete with orders gives `has_orders`,
    including the P2003 race, and that invalid input returns field errors with
    the values echoed back. `pnpm test` is green.

- [x] **3. Downloadable file upload route.** Add
  `app/api/admin/products/[id]/file/route.ts` with `PUT`. The body is the raw file
  bytes, and the original name is in the `x-file-name` header. This follows the
  standard that file uploads use route handlers, and it avoids raising the
  global Server Action body limit. Behavior:
  - Admin check through `getCurrentUser()`. Anyone else gets the same
    `apiError(404, "not_found", ...)` as an unknown product. Same-origin check:
    reject when the `Origin` header is present and does not match the request
    host (403). The session cookie is already `SameSite=Lax`.
  - Validate the id and load the product scoped to `DIGITAL_PRODUCT`, else 404.
  - The extension must be `.pdf` or `.zip` (400 `invalid_file_type`). Reject a
    `Content-Length` over 25 MB (25 × 1024 × 1024) up front with 413
    `file_too_large`. Stream `request.body` to a temp file inside
    `storage/products/<id>/` while counting bytes, and abort with 413 if the
    stream passes the limit, which covers a missing or false length. An empty
    body is rejected.
  - Check the first bytes: `%PDF-` for `.pdf` and `PK\x03\x04` for `.zip`.
    Otherwise return 400 `invalid_file_type`.
  - Rename the file into `productFileKey(id, randomBytes(8).hex, uploadFileName(name))`
    and update `digitalFile`. Then delete the previous file only when
    `isOwnUploadKey(id, previous)`. On any failure, remove the temp file. Never
    log storage paths or file contents.
  - The JSON success response is `{ fileName }`. Errors use `lib/api-error.ts`
    shapes. Uploads lose no product data on failure: `digitalFile` changes only
    after the new file is fully on disk.
  - **Done when:** `route.test.ts` (mock `db`, `getCurrentUser`, and use a temp
    storage root through an injectable root or `vi.mock` of
    `lib/downloads` `STORAGE_ROOT`) covers non-admin → 404, foreign `Origin` →
    403, a service id → 404, a wrong extension, wrong magic bytes, an oversize
    length, an oversize stream, empty, success (the file is written, the DB is
    updated, a previous own upload is removed, and a previous seed key is
    kept), and a DB failure (the new file is cleaned up). `pnpm test` is green.

- [x] **4. Admin product pages and navigation.** Add
  `app/admin/products/page.tsx`, `app/admin/products/new/page.tsx`, and
  `app/admin/products/[id]/page.tsx`. Each calls `requireAdmin()` and
  `adminMetadata("Products" | "New product" | "Edit <name>")`. An unknown or
  service id calls `notFound()`. Add client components under
  `components/admin/`:
  - `ProductForm.tsx` (`useActionState`): every field has a visible `<label>`,
    and errors connect through `aria-describedby` and `aria-invalid`. A form-level
    error summary sits in an `aria-live="polite"` region and gets focus after a
    failed submit. Submitted values come back on error, and an error clears
    when its field is corrected and resubmitted. Arabic inputs use `dir="rtl"`
    and `lang="ar"`. The submit button shows a pending state. Price shows as
    dollars on edit (cents ÷ 100, two decimals).
  - `ProductFileUpload.tsx`: a file input (`accept=".pdf,.zip"`), a client-side
    pre-check of size and extension (only for convenience; the server is the
    authority), and a `fetch` PUT with the file as the body. It shows uploading,
    success (the new file name, then `router.refresh()`), and error states in a
    live region. It shows the current file name or "No file yet".
  - Status control: Publish/Unpublish buttons bound to `setProductStatus`. Without
    a file, the Publish button explains that a file is required, and the server
    still enforces it. A status chip appears in the page header.
  - `DeleteProduct.tsx`: the first button reveals a confirm panel ("Delete
    permanently" / "Cancel", with focus moving to the confirm button). A
    `has_orders` result shows "This product has orders. Unpublish it instead."
  - The list page uses the dashboard's table styling and `EmptyState`. All
    admin-entered text renders as React text, never as HTML (`dir="auto"` on
    names).
  - Add `{ href: "/admin/products", label: "Products", icon: "grid" }` to the
    layout's Admin section. Active marking in `SideNav` is an exact match, so
    the edit and new pages mark nothing. That is acceptable, and the existing
    behavior stays unchanged.
  - **Done when:** `pnpm build` and `pnpm lint` pass. In the running app as
    admin, you can create a product (it appears unpublished, and the storefront
    returns 404 for its slug), upload a PDF, publish (it appears on
    `/en/products`), edit it, including Arabic (shown on `/ar/products/<slug>`),
    unpublish (gone from the storefront), and delete an unordered product. A
    seeded product with orders refuses delete. As a customer or signed out,
    `/admin/products`, `/admin/products/new`, and the upload route all return
    404.

## Files / areas

- New: `lib/admin-product-rules.ts` (client-safe limits, form types, and the
  extension check), `lib/admin-products.ts`, `lib/admin-products.test.ts`,
  `lib/product-files.ts` (server-only save and remove under `storage/`),
  `actions/admin-products.ts`, `actions/admin-products.test.ts`,
  `app/api/admin/products/[id]/file/route.ts` and `route.test.ts`,
  `app/admin/products/page.tsx`, `app/admin/products/new/page.tsx`,
  `app/admin/products/[id]/page.tsx`, `components/admin/ProductForm.tsx`,
  `components/admin/ProductFileUpload.tsx`, `components/admin/ProductActions.tsx`
  (status control and delete), `components/admin/ProductStatusChip.tsx`.
- Changed: `lib/admin.ts` and `lib/admin.test.ts` (list/get queries),
  `lib/api-error.ts` (upload error codes), `app/admin/layout.tsx` (nav entry).
  `STORAGE_ROOT` is imported from `lib/downloads.ts` unchanged.
- Reused without change: `lib/catalog.ts` (`isValidSlug`, `publicImageSrc`),
  `lib/delivery.ts` (`storagePath`, `contentTypeFor`), `lib/api-error.ts`,
  `lib/money.ts`, `components/account/AccountParts.tsx` (`EmptyState`,
  status chip styling).
- No schema migration: every field already exists on `Product`.
- `proxy.ts` already skips `/api/`. The `app/admin/[...rest]` catch-all stays
  for unknown admin URLs, and the new static routes take priority.

## Data / contracts

- `Product` writes from admin: all fields in step 1 plus `type` (always
  `DIGITAL_PRODUCT` on create) and `status` (`UNPUBLISHED` on create, then only
  through `setProductStatus`). `durationDays` and `requirements*` stay `null` for
  digital products.
- Invariant: a `PUBLISHED` digital product has a non-null `digitalFile`. Upload
  never clears it, and there is no "remove file" action in this feature.
- Storage key format for uploads: `products/<productId>/<16 hex>/<safeName>.<pdf|zip>`.
  The download `Content-Disposition` uses the basename, so customers see
  `safeName.pdf`. Seed keys (`seed/...`) are never deleted by admin actions.
- Upload API: `PUT /api/admin/products/{id}/file`, header `x-file-name`, raw body.
  It returns `200 { fileName }`, or
  `{ error: { code, message } }` (the existing `apiError` shape) with 400
  `invalid_file_type` / `empty_file`, 403 `forbidden`, 404 `not_found`, 413
  `file_too_large`, and 500 `internal_error`.
- Action results: `{ success: true } | { success: false, error: "invalid_fields"
  | "slug_taken" | "file_required" | "has_orders" | "not_found" | "unexpected",
  fieldErrors?, values? }`. `slug_taken` is reported as a field error on `slug`.
- `digitalFile` (the full key) never reaches the client. The edit page receives
  only the basename and `hasFile`.

## Testing

- Unit (Vitest): `lib/admin-products.test.ts` (step 1),
  `actions/admin-products.test.ts` (step 2), and the upload `route.test.ts`
  (step 3). These are the required logic gates.
- No browser harness is configured, so UI (step 4) is verified with `pnpm build`,
  `pnpm lint`, and a manual run through the app during `/check`. This spec claims
  no browser evidence.
- `pnpm test`, `pnpm lint`, and `pnpm build` must all be green before review.

## Notes for the AI

- Read `node_modules/next/dist/docs/` for route handlers (streaming request
  bodies), `useActionState`, `redirect` inside Server Actions (do not catch the
  redirect in try/catch), and `revalidatePath` before writing code.
- The admin area is English-only (feature 12). Do not add dictionary strings.
  Use plain English, like `app/admin/page.tsx`.
- `requireAdmin()` calls `notFound()`, which suits pages and actions. In the route
  handler, use `getCurrentUser()` and return the 404 JSON yourself.
- Only stream to disk. Do not call `request.formData()` or `arrayBuffer()` on the
  upload, so a 25 MB file never sits in memory.
- Do not touch `prototypes/`. Follow the existing admin dashboard's tokens and
  table styling.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":16942,"specSha256":"fc5b3a65841bd651316808013ca01284518b57281a5d651e9800914cc71c4eb3","branch":"refs/heads/feature/admin-product-management","head":"039b19ed8d8dbd859171f389c6347f5ff7b95e28","baseRef":"refs/heads/main","baseCommit":"eade17444df30d6390865f831ecc192b1c0ead3e","sourceTree":"228658348cb68f746d768df3ccbcdc960bb24749","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 039b19ed8d8dbd859171f389c6347f5ff7b95e28
**Base commit:** eade17444df30d6390865f831ecc192b1c0ead3e
**Base ref:** main
**Spec hash:** fc5b3a65841bd651316808013ca01284518b57281a5d651e9800914cc71c4eb3
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-07T17:51:25Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-07T17:55:28Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `eade17444df30d6390865f831ecc192b1c0ead3e..039b19ed8d8dbd859171f389c6347f5ff7b95e28` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD` / `git merge-base main HEAD` / `sha256sum blueprint/context/current-feature.md` / `git status --porcelain --untracked-files=all`: pass (request current; only `blueprint/context/review.md` dirty)
- `pnpm test`: pass (35 files, 566 tests)
- `pnpm lint`: pass
- `pnpm build`: pass (all new admin routes and the upload route compiled and type-checked)

## Evidence

- Reviewed all 20 changed files in `eade174..039b19e` against the verified spec (feature 13, build attempt 1); the spec is tracked, so no snapshot applies.
- Security: every Server Action calls `requireAdmin()` before any DB access and scopes writes to `{ id, type: "DIGITAL_PRODUCT" }`; the parser never reads `type`, `status`, or `digitalFile`; publish is one conditional `updateMany` on `digitalFile: { not: null }`; delete checks order items and maps `P2003`.
- Upload route: non-admin gets 404 before any work; foreign `Origin` gets 403; the custom `x-file-name` header forces a CORS preflight; extension and magic bytes are checked; size is limited by `Content-Length` and by a counting stream; storage paths go through `storagePath`; `digitalFile` changes only after the file is renamed into place; seed keys are never removed; `proxy.ts` matcher excludes `/api/`, so the proxy body limit does not apply.
- Client data: `digitalFile` never leaves the server (list gets `hasFile`, edit page gets the basename); admin text renders as React text.
- Unit tests cover the spec's Done-when lists for steps 1-3; UI step 4 has build/lint evidence only, as the spec states.

## Findings

- F-18 [P3] open (new): edit page loads the product twice and counts unused order items
- F-19 [P3] open (new): `removeProductUploads` has no direct test
- F-04 [P3] open (re-examined): now reachable through the admin image field; severity unchanged
- No P0 or P1 findings

## Remaining risk

- Check was not required and was not run; no browser or running-app evidence of the admin pages, upload flow, or storefront visibility changes was inspected.
- No dedicated typecheck or `Verify` command exists; type safety rests on `pnpm build`.
- No dependency or vulnerability scan was run.
- Concurrent uploads to the same product can leave an orphaned upload folder on disk (admin-only, no data loss); not recorded as a finding.
