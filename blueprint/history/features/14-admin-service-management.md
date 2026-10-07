# Feature: Admin Service Management

**From build-plan:** feature 14
**Build attempt:** 1
**Branch:** feature/admin-service-management
**Status:** verified

## Goal

Admins can list, create, edit, publish, unpublish, and delete service offerings
(`Product` rows with `type: SERVICE`) from `/admin/services`. They manage the
price, duration, requirements, image URL, and the English and Arabic content.
Availability is the existing published or unpublished status: customers only see
published services. Feature 13's product admin code is generalized by type and
reused, so the two admin areas are not duplicated.

**Packages decision (user, this spec):** one service is one package. Each service
has one price and one optional duration. Tiers such as "Basic" and "Pro" are
created as separate services. No package model, and no change to the cart,
checkout, or orders.

## In scope

- `/admin/services`: a table of every `SERVICE` (published and unpublished) with
  name, slug, category, price, duration (`30 days`, or a dash when empty),
  status, and last updated. Each row links to its edit page. Includes a "New
  service" link and an empty state.
- `/admin/services/new`: the form. It creates the service as `UNPUBLISHED`, then
  redirects to `/admin/services/<id>`.
- `/admin/services/[id]`: the same form filled with current values, a "View in
  store" link to `/en/services/<slug>` when published, the publish/unpublish
  control, and delete.
- Form fields: everything the product form has (name, slug, short description,
  description, price, category picker, image URL, What's included, and the
  optional Arabic fields), plus:
  - **Duration (days)**: optional whole number from 1 to 365. Empty means `null`,
    and the storefront then shows no duration, which already works this way.
  - **Requirements**: optional, one item per line (the storefront splits it with
    `checklistLines`). The same line limits as What's included apply.
  - **Requirements (Arabic)**: optional, with the same rules and an English
    fallback on the storefront, which already works this way.
- Publish and unpublish. A service has no downloadable file, so publishing has no
  file requirement.
- Delete with the same confirmation step as products. It is refused with
  `has_orders` when any `OrderItem` references the service (FK `Restrict`, plus
  the `P2003` race mapping), and the message tells the admin to unpublish instead.
- The category picker lists only the categories services already use, because
  the `/services` store filter is per type.
- A "Services" entry in the admin sidebar's Admin section, after Products.

## Out of scope

- Package or pricing tiers, package selection in cart or checkout (the decision
  above).
- Purchased service work: service orders, onboarding answers, admin notes,
  progress, and completion. That is feature 16. The `Service` model is untouched.
- File upload for services. The upload route stays limited to digital products,
  and a service id still returns 404 there.
- Changing what past buyers of a service see. Their account pages read current
  `Product` text, which is existing behavior.
- Image upload (feature 18), Stripe product/price ids, bulk actions, search,
  pagination, featured flags (feature 21), and audit logs.
- The customer onboarding form's questions. `lib/onboarding.ts` is unchanged;
  the `requirements` field here is only the "what we need from you" list on the
  detail page.

## Build loop

`workflow.stepReview` is `feature`: implement every step below in order. Run
`pnpm test` and `pnpm lint` after each logic step, then present one review packet
when all steps pass. `workflow.checkpointCommits` is `disabled`, so there are no
per-step commits. `/complete` creates the single feature commit.

## Build steps

- [x] **1. Form parsing for service fields (pure logic).** In
  `lib/admin-product-rules.ts`, add `"durationDays" | "requirements" |
  "requirementsAr"` to `ProductField`, the error code `invalid_duration`, and the
  constants `DURATION_MIN_DAYS = 1` and `DURATION_MAX_DAYS = 365`. Change
  `parseProductForm(formData)` in `lib/admin-products.ts` to
  `parseProductForm(formData, type: ProductType)`:
  - Shared fields keep feature 13's rules unchanged.
  - For `SERVICE`, also read `durationDays`: empty becomes `null`; otherwise only
    `^\d{1,3}$` within 1 to 365, else `invalid_duration`. This rejects `0`,
    `366`, `1.5`, `-1`, and `1e2`, and accepts ` 30 ` as 30 after trimming.
    `requirements` and `requirementsAr` are split with `checklistLines`, limited to
    `INCLUDED_MAX_LINES` lines of `INCLUDED_LINE_MAX` characters (`too_many_lines`
    / `too_long`), and stored as the cleaned lines joined with `"\n"`, or `null`
    when there are none.
  - For `DIGITAL_PRODUCT`, the service fields are never read, and `data` sets
    `durationDays`, `requirements`, and `requirementsAr` to `null`. This keeps
    feature 13's invariant that digital products have none.
  - `type` comes only from the caller, never from the form. The parser still never
    reads `type`, `status`, or `digitalFile` from the form.
  - **Done when:** `lib/admin-products.test.ts` keeps its existing cases (now
    passing `"DIGITAL_PRODUCT"`) and adds: valid service input, duration empty →
    `null`, duration edge cases above, requirements line splitting, CRLF, limits,
    empty → `null`, Arabic requirements, and a digital product form whose posted
    `durationDays`/`requirements` are ignored and saved as `null`.
    `pnpm test` is green.

- [x] **2. Admin data queries by type.** In `lib/admin.ts`, make
  `listAdminProducts(type)`, `getAdminProduct(id, type)`, and
  `listAdminCategories(type)` take the `ProductType` and scope every query to it.
  Remove `ADMIN_PRODUCT_TYPE`, or keep it only where the upload route needs the
  digital type. `AdminProductRow` gains `durationDays`. `AdminProduct` gains
  `durationDays`, `requirements`, and `requirementsAr`. `digitalFile` handling is
  unchanged: the full key never reaches the client. Update the three product
  pages to pass `"DIGITAL_PRODUCT"`. The upload route stays scoped to
  `DIGITAL_PRODUCT`.
  - **Done when:** `lib/admin.test.ts` proves that each function filters by the
    given type: a service id read as a digital product is `null`, a digital
    product id read as a service is `null`, and the service categories exclude
    product categories. Existing product cases pass. `pnpm test` is green.

- [x] **3. Service Server Actions.** In `actions/admin-products.ts`, move each
  action's body into a private helper that takes the type, such as
  `create(type, formData)`. Keep the exported product actions with the same names
  and results, and add `createService`, `updateService`, `setServiceStatus`, and
  `deleteService`. Each wrapper binds a fixed type, so the client can never choose
  it. All feature 13 rules carry over:
  - `requireAdmin()` first, outside the try; `isProductId` id check; every read
    and write scoped with `{ id, type }`, so the other type's id or an unknown id
    is `not_found`;
  - parse with `parseProductForm(formData, type)`; `P2002` on `slug` becomes the
    `slug_taken` field error, with values echoed back;
  - `createService` inserts `type: SERVICE`, `status: UNPUBLISHED`,
    `digitalFile: null`, then redirects to `/admin/services/<id>`;
  - `updateService` never touches `status` or `digitalFile`;
  - `setServiceStatus` whitelists the status and needs no file condition. The
    product version keeps its `digitalFile: { not: null }` condition and
    `file_required` result;
  - `deleteService` checks order items, maps `P2003` to `has_orders`, does no
    file cleanup, and redirects to `/admin/services`;
  - revalidation stays `revalidatePath("/admin", "layout")` and
    `revalidatePath("/[lang]", "layout")`. Unexpected errors log without user
    content and return `unexpected`.
  - **Done when:** `actions/admin-products.test.ts` keeps its product cases and
    adds service cases: non-admin never reaches the database, a digital product
    id gives `not_found` for each service action (and a service id still gives
    `not_found` for each product action), create writes `type: SERVICE` and
    `UNPUBLISHED` with the parsed duration and requirements, `slug_taken`,
    invalid input echoes values, publish succeeds with no file, delete with
    orders gives `has_orders` including the `P2003` race, and the redirects go to
    `/admin/services...`. `pnpm test` is green.

- [x] **4. Admin service pages and navigation.** Add
  `app/admin/services/page.tsx`, `app/admin/services/new/page.tsx`, and
  `app/admin/services/[id]/page.tsx`. Each calls `requireAdmin()` and
  `adminMetadata("Services" | "New service" | "Edit <name>")`. `generateMetadata`
  reads the service only for an admin, as on the product edit page. An unknown id
  or a digital product id calls `notFound()`.
  - Generalize the existing client components by a `type` prop instead of copying
    them: `ProductForm` chooses the create and update actions, the "Duration
    (days)" input (`inputMode="numeric"`), the "Requirements" textarea (in the
    English card), and "Requirements (Arabic)" (`dir="rtl"`, `lang="ar"`, in the
    Arabic card), the category hint, and wording ("product"/"service") in errors
    such as "This service no longer exists." `ProductStatusControl` and
    `DeleteProduct` choose their actions and wording by type. The file-required
    explanation shows only for digital products. The service edit page has no
    "Downloadable file" panel. Keep feature 13's accessibility rules: visible
    labels, `aria-describedby`/`aria-invalid`, the focused `aria-live` error
    summary, values restored after a failed submit, errors cleared on a corrected
    resubmit, and a pending submit state. The duration error message is "Enter a
    whole number of days from 1 to 365, or leave it empty."
  - The list page follows `app/admin/products/page.tsx` (table styling and
    `EmptyState`). Duration uses `formatDurationDays(days, "en")`. All admin text
    renders as React text, never HTML, with `dir="auto"` on names.
  - Product pages keep their current behavior and markup.
  - Add `{ href: "/admin/services", label: "Services", icon: "megaphone" }` to
    the layout's Admin section after Products. The icon already exists in the
    storefront section.
  - **Done when:** `pnpm test`, `pnpm lint`, and `pnpm build` pass. In the running
    app as admin: create a service (it is unpublished, and `/en/services/<slug>`
    returns 404), edit its duration, requirements, and Arabic fields, publish it
    (it appears on `/en/services` with its duration, and `/ar/services/<slug>`
    shows the Arabic requirements), unpublish it (gone from the storefront), and
    delete an unordered service. A seeded service with orders refuses delete.
    `/admin/services/<digital-product-id>` and `/admin/products/<service-id>`
    return 404. As a customer or signed out, the three service pages return 404.
    The product admin flow from feature 13 still works.

## Files / areas

- Changed: `lib/admin-product-rules.ts` (fields, duration limits, error code),
  `lib/admin-products.ts` and `lib/admin-products.test.ts` (typed parser),
  `lib/admin.ts` and `lib/admin.test.ts` (typed queries),
  `actions/admin-products.ts` and `actions/admin-products.test.ts` (shared helpers
  and service actions), `components/admin/ProductForm.tsx`,
  `components/admin/ProductActions.tsx`, `app/admin/products/page.tsx`,
  `app/admin/products/new/page.tsx`, `app/admin/products/[id]/page.tsx` (pass the
  type), `app/admin/layout.tsx` (nav entry), and
  `app/api/admin/products/[id]/file/route.ts` only if `ADMIN_PRODUCT_TYPE` is
  renamed.
- New: `app/admin/services/page.tsx`, `app/admin/services/new/page.tsx`,
  `app/admin/services/[id]/page.tsx`.
- Reused without change: `lib/catalog.ts` (`checklistLines`,
  `formatDurationDays`, `isValidSlug`, `publicImageSrc`),
  `components/admin/ProductStatusChip.tsx`, `components/account/AccountParts.tsx`
  (`EmptyState`), and the storefront components that already render duration and
  requirements.
- No schema migration: `durationDays`, `requirements`, and `requirementsAr`
  already exist on `Product`. `proxy.ts` and the `app/admin/[...rest]` catch-all
  are unchanged, and the new static routes take priority.

## Data / contracts

- `Product` writes for services: the shared fields from feature 13, plus
  `durationDays` (`Int?`, 1-365 or `null`), `requirements` and `requirementsAr`
  (`String?`: trimmed non-empty lines joined with `"\n"`, or `null`). `type` is
  always `SERVICE` on create and never changes. `status` is `UNPUBLISHED` on create,
  then changes only through `setServiceStatus`. `digitalFile` is always `null` for
  services.
- Digital products keep `durationDays`, `requirements`, and `requirementsAr` at
  `null`. Updating a product writes `null` to them, matching the feature 13
  invariant.
- Action results are unchanged: `{ success: true } | { success: false, error:
  "invalid_fields" | "file_required" | "has_orders" | "not_found" |
  "unexpected", fieldErrors?, values? }`. Services never return `file_required`.
  Field errors add `invalid_duration`.
- Authorization: the trusted actor is `requireAdmin()` in every page and action.
  The type is bound on the server by the exported action, never read from the
  request.
- The storefront contract is unchanged: `lib/catalog.ts` already selects and falls
  back for these fields, and listings and details already filter `PUBLISHED`.

## Testing

- Unit (Vitest): `lib/admin-products.test.ts` (step 1), `lib/admin.test.ts` (step
  2), `actions/admin-products.test.ts` (step 3). These are the required logic
  gates. The existing upload `route.test.ts` must stay green.
- No browser harness is configured. UI (step 4) is verified with `pnpm build`,
  `pnpm lint`, and a manual run through the app during `/check`. This spec claims
  no browser evidence.
- `pnpm test`, `pnpm lint`, and `pnpm build` must all be green before review.
- No Verify command exists, so none was run while writing this spec.

## Notes for the AI

- Read `node_modules/next/dist/docs/` for `useActionState`, `redirect` in Server
  Actions (keep it outside try/catch), and `revalidatePath` before writing code.
- A `"use server"` file may export only async functions. Keep the type-taking
  helpers unexported in `actions/admin-products.ts`.
- The admin area is English-only. Do not add dictionary strings.
- Keep `ProductForm` one component: branch on `type` for the extra fields and
  wording, and do not fork a `ServiceForm` copy.
- `ProductForm` limits textareas with `maxLength` from `FieldSpec.max`. The
  requirements fields use `max: 0` like What's included (line limits are checked
  on the server).
- The packages decision ("one service = one package") answers overview open
  question 10. Suggest to the user at `/complete` that they record it in the plans
  and re-run `/overview`. Do not edit the user-owned plans from this feature.
- Do not touch `prototypes/`. Follow the existing admin tokens and table styling.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":15114,"specSha256":"e61764593c035fa70f607f96c3d4bcb5edecf3bc3f5fb84f5ea72a3a6531576a","branch":"refs/heads/feature/admin-service-management","head":"5048817cc9077d710e0157f1a8efba6f6cb639be","baseRef":"refs/heads/main","baseCommit":"a08b1ddb09a6e8b8220b3ab1d2d75e684c1fe162","sourceTree":"0dac69a3830520f04759149ac2055da98afac2e7","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 5048817cc9077d710e0157f1a8efba6f6cb639be
**Base commit:** a08b1ddb09a6e8b8220b3ab1d2d75e684c1fe162
**Base ref:** main
**Spec hash:** e61764593c035fa70f607f96c3d4bcb5edecf3bc3f5fb84f5ea72a3a6531576a
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-07T20:35:26Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-07T20:38:22Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `a08b1ddb09a6e8b8220b3ab1d2d75e684c1fe162..5048817cc9077d710e0157f1a8efba6f6cb639be` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `pnpm test`: pass (36 files, 607 tests)
- `pnpm lint`: pass (no output, exit 0)
- `pnpm build`: pass (exit 0; `/admin/services`, `/admin/services/new`, and `/admin/services/[id]` compiled and type-checked)

## Evidence

- Freshness: `HEAD` is 5048817, `git merge-base main HEAD` is a08b1dd, the spec SHA-256 matches, and the only dirty path is `blueprint/context/review.md`.
- Reviewed all 18 changed files in the delta, including the three new service pages, the typed parser, typed admin queries, the shared action helpers, `ProductForm`, `ProductActions`, the upload route, and the three test files.
- Security: every exported action binds its `ProductType` on the server and calls `requireAdmin()` before the try; reads and writes are scoped with `{ id, type }`; the parser never reads `type`, `status`, or `digitalFile` from the form; digital product parsing ignores posted service fields and stores `null`; the upload route stays scoped to `DIGITAL_PRODUCT`; service pages call `requireAdmin()` and `generateMetadata` reads only for an admin.
- Data integrity: service delete checks order items and maps `P2003` to `has_orders` (`OrderItem.product` is `onDelete: Restrict`; `Service` cascades from `OrderItem`, not `Product`); file cleanup runs only for digital products; the product publish path keeps its `digitalFile: { not: null }` condition and `file_required` result.
- Tests: parser duration edge cases (`0`, `366`, `1.5`, `-1`, `1e2`, ` 30 `), requirement line splitting, CRLF, limits, null handling, and the digital-product invariant are asserted; action tests cover non-admin, cross-type `not_found` in both directions, create type/status, `slug_taken`, echoed values, file-free publish, delete with orders and the race, and redirects.
- Check was not required by the request and was not run; no browser evidence was inspected.

## Findings

- No new findings.
- F-04 [P3] open: re-examined, still present; the service form reuses the same image parsing.
- F-18 [P3] open: re-examined, still present; the new service edit page repeats the double uncached `getAdminProduct` call.

## Remaining risk

- `/check` and the spec's manual run-through (create, edit, publish, unpublish, delete a service; 404s for cross-type ids and non-admins) were not performed in this review; UI behavior rests on the build and code reading.
- No browser test command is declared, so the form's error summary, value restore, and focus behavior for the new service fields were not exercised in a browser.
- No `Verify` command or dedicated typecheck script exists; type checking relied on `pnpm build`.
