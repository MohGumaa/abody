# Feature: Digital Product Delivery

**From build-plan:** feature 7
**Build attempt:** 1
**Branch:** feature/digital-product-delivery
**Status:** verified

## Goal

After a confirmed payment, a buyer can download every digital product in their
order from the success page. Files live in a private server folder that is never
publicly reachable. A download link works only when the server confirms that the
Stripe checkout session in the link owns a paid order containing that product.
Checkout is still anonymous, so the success-page link is how a guest gets back to
their files until accounts arrive (features 8 and 9).

Decisions made at spec review (overview open questions 7, 8, and 10):

- **Storage:** a private local folder, `storage/` at the project root, read
  through one small storage module. Feature 18 replaces that module with R2 or
  S3. This needs a host with a persistent disk; serverless hosts are not
  supported until feature 18.
- **Access:** the checkout session id in the success-page URL is the buyer's
  proof. Anyone holding that URL can download. There is no expiry and no download
  count. Access ends when the order is no longer in a paid status.

## In scope

- A private `storage/` folder with the three seed files that `prisma/seed.ts`
  already names, and Git rules that commit only `storage/seed/`.
- Pure delivery logic: which order statuses grant access, safe storage-key
  resolution, content type, and the `Content-Disposition` header.
- A protected `GET /api/downloads/[itemId]?session_id=cs_...` route that streams
  the file as an attachment.
- A Downloads section on the success page listing each digital product in the
  order with a Download link, in English and Arabic.

## Out of scope

- R2 or S3, signed or expiring URLs, and upload (features 18 and 13).
- Accounts, `/account/downloads`, and linking orders to users (features 8 and 9).
- Download emails (feature 19) and service onboarding (feature 10). Service lines
  in an order show nothing new.
- Download counting, rate limiting, and analytics (features 23 and 24).
- A file snapshot per order. A download serves the product's current
  `digitalFile`, so a later file replacement reaches earlier buyers too.
- Any schema change or migration.
- Refunds or status changes. Nothing here writes order status.

## Build loop

`workflow.stepReview` is `feature`: build all steps, running each step's checks
as you go, then present one review packet at the end of the feature. Step
checkpoint commits are disabled. `/complete` creates the single feature commit.

## Build steps

- [x] 1. **Private storage folder and seed files.** Create `storage/seed/` with
  three small placeholder files matching the seed keys:
  `digital-marketing-template.pdf` and `facebook-ads-guide.pdf` (minimal valid
  one-page PDFs with the product name as text) and `social-media-resources.zip`
  (a valid zip holding one short `README.txt`). In `.gitignore`, add `/storage/*`
  and `!/storage/seed/` with a comment that real product files are never
  committed. `storage/` is outside `public/`, so Next.js never serves it.
  **Done when:** `git status` shows only the three seed files under `storage/`;
  a scratch file at `storage/other.pdf` is ignored (then removed); each PDF opens
  and the zip extracts; `http://localhost:3000/storage/seed/facebook-ads-guide.pdf`
  is not served (404 or the language redirect, never the file); `pnpm build`
  passes.

- [x] 2. **Pure delivery logic.** `lib/delivery.ts`, with no `node:fs`, `db`, or
  `next/*` imports so Vitest loads it:
  - `canDownload(status: OrderStatus)` is `true` for `PAID`, `PROCESSING`, and
    `COMPLETED`; `false` for `PENDING`, `CANCELLED`, and `REFUNDED`.
  - `storagePath(root, key)` returns the absolute path for a storage key, or
    `null` when the key is unsafe. A safe key is 1-255 characters of `/`-separated
    segments, each matching `^[A-Za-z0-9][A-Za-z0-9._-]*$`. That rejects empty,
    absolute, `..`, `.`, backslash, drive-letter, empty-segment, and control
    characters. After `path.resolve(root, key)` it also checks the result stays
    inside `root` (`node:path` only; it is pure).
  - `contentTypeFor(key)` maps `.pdf` to `application/pdf`, `.zip` to
    `application/zip`, case-insensitive, and anything else to
    `application/octet-stream`.
  - `contentDisposition(key)` returns `attachment` with the key's last segment as
    `filename="..."`. Safe keys hold only ASCII letters, digits, `.`, `_`, and
    `-`, so no escaping is needed.
  **Done when:** `lib/delivery.test.ts` covers all six statuses, accepted keys
  (`seed/a.pdf`, nested folders) and each rejected class above, every content
  type branch including uppercase extensions, and the disposition header.
  `pnpm test` passes.

- [x] 3. **Server download lookup and file reader.** `lib/downloads.ts` (server
  only, imports `db`, `node:fs`, and `lib/delivery.ts`):
  - `STORAGE_ROOT = path.join(process.cwd(), "storage")`.
  - `findDownload(sessionId, itemId)` runs one `db.orderItem.findFirst` with
    `where: { id: itemId, order: { stripeCheckoutSessionId: sessionId },
    product: { type: "DIGITAL_PRODUCT", digitalFile: { not: null } } }` and
    selects only the order status and `product.digitalFile`. It returns the
    storage key when `canDownload(status)`, otherwise `null`. Both ids scope the
    query, so a valid item from another order never matches.
  - `listOrderDownloads(sessionId)` returns `null` when no order exists for the
    session, otherwise `{ number, downloads }`. `downloads` holds one entry per
    digital order item with a file, `{ itemId, name, nameAr }`, ordered by
    product name, and is empty when the status fails `canDownload`. It never
    selects `digitalFile`; the filter is in `where` only. This replaces
    `findOrderNumber` in `lib/order-sync.ts`; remove that function and its
    import once the success page uses this.
  - `openStoredFile(key)` resolves with `storagePath`. An unsafe key or a missing
    file (`ENOENT`) returns `null`. Otherwise it returns `{ size, stream }`, with
    the size from `fs.promises.stat` and the stream from
    `Readable.toWeb(fs.createReadStream(path))`. Any other error propagates.
  - In `lib/catalog.ts`, extract the name fallback into an exported
    `localizedName({ name, nameAr }, locale)` and use it in `toPublicProduct`.
  **Done when:** `lib/downloads.test.ts`, with `@/lib/db` mocked as
  `lib/order-sync.test.ts` does, shows the `findDownload` where clause includes
  both ids and the digital-product filter; a `PAID` row returns the key; a
  `PENDING`, `CANCELLED`, or `REFUNDED` row and a missing row return `null`;
  `listOrderDownloads` returns `null` for no order, an empty list for a
  `CANCELLED` order, and never puts `digitalFile` in a `select`. The existing
  catalog tests still pass. `pnpm test` passes.

- [x] 4. **Download route.** `app/api/downloads/[itemId]/route.ts`, `GET` only.
  Read `node_modules/next/dist/docs/` on route handlers and dynamic params first.
  - `session_id` fails `isCheckoutSessionId`, or `itemId` is empty or longer than
    64 characters → 404 `not_found` with no database call.
  - `findDownload` returns `null` → 404 `not_found`. Every denial uses the same
    response, so it never reveals whether an item, order, or file exists.
  - `openStoredFile` returns `null` for a key that `findDownload` granted → log
    the order item id and "stored file missing or invalid" (never the session id
    or the path), then 500 `internal_error`.
  - Success → 200 with the stream as the body and headers `Content-Type`,
    `Content-Length`, `Content-Disposition`, `Cache-Control: private, no-store`,
    and `X-Content-Type-Options: nosniff`.
  - Any thrown error → log the item id and error, 500 `internal_error`. Error
    bodies use `apiError`. `proxy.ts` already skips `api/`, and `app/robots.ts`
    already disallows `/api/`.
  **Done when:** `app/api/downloads/[itemId]/route.test.ts`, with
  `@/lib/downloads` mocked and params passed as
  `app/api/products/[slug]/route.test.ts` does, shows: a bad or missing session
  id → 404 and no lookup; an over-long item id → 404 and no lookup; a denied
  lookup → 404; a missing file → 500; a lookup that throws → 500; success → 200
  with all five headers and the file bytes. `pnpm test` passes.

- [x] 5. **Downloads on the success page.** In `app/[lang]/success/page.tsx`,
  when the state is `paid`, call `listOrderDownloads(session.id)` instead of
  `findOrderNumber`. The order number shows as before. When `downloads` is not
  empty, render a section below the totals with an `h2` "Your downloads" and a
  list: each row shows the product name from `localizedName` (rendered as text,
  never HTML) and a Download link to
  `/api/downloads/<itemId>?session_id=<session.id>` built with
  `URLSearchParams`, with the `download` attribute. Give each link an accessible
  name that includes the product name, for example a visually hidden suffix.
  Under the list, show a note telling the buyer to keep this page's link to
  download again later. When the state is `paid` but no order exists yet, keep
  the "confirming" body and add a line saying downloads appear here shortly and
  to refresh the page. No downloads section when the order has only services or
  is no longer paid. Add the strings to `checkoutResult` in both
  `lib/i18n/dictionaries/en.ts` and `ar.ts`. The layout follows the existing
  panel and link styles and works in RTL at mobile width.
  **Done when:** with the dev server, the Stripe CLI forwarding webhooks, and a
  test-card checkout of one digital product, one service, and a second digital
  product, the English and Arabic success pages list both digital products with
  working Download links and no service row; each file downloads with the right
  name and type; changing `session_id` to another valid-looking id or changing
  the item id returns 404; a services-only order shows no Downloads section.
  `pnpm build`, `pnpm lint`, and `pnpm test` pass.

## Files / areas

- `.gitignore`, `storage/seed/*` (new)
- `lib/delivery.ts`, `lib/delivery.test.ts` (new)
- `lib/downloads.ts`, `lib/downloads.test.ts` (new)
- `lib/catalog.ts` (extract `localizedName`)
- `lib/order-sync.ts` (remove `findOrderNumber`)
- `app/api/downloads/[itemId]/route.ts`, `route.test.ts` (new)
- `lib/api-error.ts` (reused; no new code expected)
- `app/[lang]/success/page.tsx`
- `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/ar.ts`
- Reused unchanged: `lib/checkout.ts` (`isCheckoutSessionId`), `proxy.ts`,
  `app/robots.ts`, `prisma/seed.ts`

## Data / contracts

- **No schema change.** Reads `Order.status`, `Order.stripeCheckoutSessionId`,
  `OrderItem.id`, `Product.type`, `Product.digitalFile`, `name`, `nameAr`.
- **Storage key:** `Product.digitalFile` is a relative key under `storage/`, for
  example `seed/facebook-ads-guide.pdf`. Keys are written only by the seed now and
  by the admin later (feature 13); the reader still validates them.
- **Access rule:** a download is allowed when the order item's order has that
  exact `stripeCheckoutSessionId`, its status is `PAID`, `PROCESSING`, or
  `COMPLETED`, and its product is a `DIGITAL_PRODUCT` with a `digitalFile`. The
  product's publish status does not matter: a buyer keeps access after a product
  is unpublished.
- **Route:** `GET /api/downloads/{orderItemId}?session_id={cs_test_|cs_live_...}`.
  - 200: file stream; headers listed in step 4.
  - 404: `{ "error": { "code": "not_found", "message": "Download not found" } }`
    for every denial.
  - 500: `{ "error": { "code": "internal_error", "message": "..." } }` with a
    generic message.
- **Logging:** never log the session id, storage path, or customer email.

## Testing

`pnpm test` gates steps 2, 3, and 4 with the files named there. Steps 1 and 5 are
UI and integration work, verified with the build, lint, and the manual run in
step 5's Done when. That run needs `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
the Stripe CLI, and a seeded database. No browser test command exists, so no
browser test is added. Nothing in this spec claims live download evidence until
step 5 is run.

## Notes for the AI

- Next.js 16: read the route-handler and dynamic-params guides in
  `node_modules/next/dist/docs/` before step 4. `params` is a Promise.
- Never select `digitalFile` in any query whose result reaches a page or a JSON
  response. Only `findDownload` selects it, and the route never echoes it.
- If `pnpm build` warns that output tracing pulled in the whole project because
  of the `process.cwd()` path, note it in the review packet; do not add tracing
  configuration unless the build fails.
- Use the existing `apiError` codes `not_found` and `internal_error`.
- Western digits for the order number in both languages, as today.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":12829,"specSha256":"0a3beba1eb9fdb19c8b679f13ef286a571c1566a7d16c1fab438e1d72fdd6422","branch":"refs/heads/feature/digital-product-delivery","head":"9801d5ea15fb9a7dbcc8d038b444c9566842dd5d","baseRef":"refs/heads/main","baseCommit":"eb475026e7196c1e21cb5c765351436ac2e67d3b","sourceTree":"e3abee2c65cdad82bdee8f9b0626586b6f1aaf4a","absentOptional":[]} -->

## Independent review

# Independent Review

**Status:** passed
**Target commit:** 9801d5ea15fb9a7dbcc8d038b444c9566842dd5d
**Base commit:** eb475026e7196c1e21cb5c765351436ac2e67d3b
**Base ref:** main
**Spec hash:** 0a3beba1eb9fdb19c8b679f13ef286a571c1566a7d16c1fab438e1d72fdd6422
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-04T20:34:18Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-05T12:53:12Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `git rev-parse HEAD`, `git merge-base main 9801d5e`, raw `sha256sum` of the spec, `git status --porcelain --untracked-files=all`: pass (all match the request; only `blueprint/context/review.md` differed)
- `pnpm test`: pass (19 files, 236 tests)
- `pnpm lint`: pass
- `pnpm build`: pass (type-check included; `/api/downloads/[itemId]` built as a dynamic route)
- `git check-ignore -v storage/other.pdf` and `git ls-files storage`: pass (scratch file ignored by `/storage/*`; only the three seed files tracked)

## Evidence

- Full `eb47502..9801d5e` delta reviewed: `.gitignore`, `storage/seed/*`, `lib/delivery.ts`, `lib/downloads.ts`, `lib/catalog.ts`, `lib/order-sync.ts`, `app/api/downloads/[itemId]/route.ts`, `app/[lang]/success/page.tsx`, both dictionaries, all new and changed tests, and the spec and overview edits.
- Access rule matches the spec: `findDownload` scopes one `findFirst` by item id, checkout session id, and `DIGITAL_PRODUCT` with a file, then gates on `canDownload`; every denial returns the same 404 body before or after lookup.
- Path safety: segment regex rejects `.`/`..`, backslash, drive letters, empty segments, and control characters before `path.resolve`, plus a root-prefix check; `openStoredFile` resolves through `storagePath` and rejects non-files.
- `digitalFile` is selected only in `findDownload`; `listOrderDownloads` filters on it in `where` only, and the route never echoes the key. Log lines carry only the item id.
- Success page builds the link with `encodeURIComponent` and `URLSearchParams`, renders names as text, and gives each link an accessible name with the product name.
- `findOrderNumber` and its test were removed with no remaining callers.

## Findings

- F-09 [P3] open: `openStoredFile` has no test; its null and error branches are only mocked (`lib/downloads.ts:85`)
- No P0 or P1 findings. Earlier P3 entries F-01, F-02, F-04, F-05, F-06, F-08 are outside this delta and unchanged.

## Remaining risk

- Live end-to-end download flow (step 5 Done when: Stripe test checkout, Stripe CLI webhooks, English and Arabic success pages, real file download, tampered ids) was not run: no dev server, network, or Stripe allowed in this review.
- No browser test command exists; RTL and mobile-width layout of the Downloads section were not inspected visually.
- Build output tracing for `/api/downloads/[itemId]` pulls in 60 project files (including `lib/*.test.ts`) because of the `process.cwd()` storage path, and does not include `storage/`; the spec accepts this and requires a persistent-disk host until feature 18.
- No security or performance scanner command is declared, so no dependency or profiling scan was run.
