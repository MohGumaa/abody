# Feature: Product & Service Catalog

**From build-plan:** feature 1
**Build attempt:** 1
**Status:** verified
**Branch:** feature/product-service-catalog
**Archive path:** blueprint/history/features/01-product-service-catalog.md

## Goal

Give the store its catalog foundation: a PostgreSQL database with one `Product`
model that covers both digital products and services, read-only server functions
that return published items, and public read-only JSON endpoints for the list and
for a single item by slug. Later features (detail pages, cart, checkout, admin)
build on this shape.

## In scope

- Prisma and PostgreSQL added to the project, with the first migration.
- `Product` model with `ProductType` and `ProductStatus` enums (see Data /
  contracts).
- A shared database client module.
- An idempotent development seed with a few sample items.
- Read-only catalog query functions that return published items only.
- `GET /api/products` and `GET /api/products/[slug]`.
- `.env.example`, the matching `.gitignore` exception, and updated Commands in
  `AGENTS.md` and the Database section of `coding-standards.md`.

## Out of scope

- Create, update, delete, publish, or unpublish. There is no auth or admin role
  yet (features 7, 12, 13), so no write endpoint or Server Action ships here.
- Any page or UI. Detail pages are feature 2; store listing pages have no
  build-plan item yet.
- File uploads and private storage (features 12, 17). `image` and `digitalFile`
  hold references only.
- Fields the plan mentions outside its data list: "what's included" features,
  service duration, service requirements, service packages, and Stripe product or
  price ids. The feature that first uses each one adds it with its own migration.
- `User`, `Order`, `OrderItem`, and `Service` models.
- A separate category model, multiple images or files, per-product currency.
- Pagination, search, sorting options, rate limiting, CORS headers, caching
  tuning. No current requirement.
- A unit test runner (`/tests` owns that).

## Build loop

`workflow.stepReview` is `feature` and `workflow.checkpointCommits` is
`disabled`: implement and verify each step in order, check it off here, then
present one feature-level review packet with the complete diff and the done-when
evidence. No checkpoint commits. `/complete` creates the single feature commit.

## Build steps

- [x] **1. Add Prisma, the schema, and the first migration.**
  Install the current stable `prisma` and `@prisma/client` with pnpm (not a
  release candidate), plus only what that version's own documentation requires
  for PostgreSQL. Read that version's setup guide before configuring; do not rely
  on remembered conventions. Define `Product`, `ProductType`, and `ProductStatus`
  exactly as in Data / contracts and create the migration with
  `prisma migrate dev`. Add `.env.example` with a placeholder `DATABASE_URL` and
  a `!.env.example` exception to `.gitignore`. Make the Prisma client generate on
  install so a fresh clone can build; check whether pnpm 10 needs any Prisma
  package approved to run its build script (`pnpm-workspace.yaml` currently
  ignores some), and keep generated client output out of Git and out of lint if
  it lands inside the repo.
  **Done when:** `prisma migrate status` reports the database in sync, the
  migration SQL shows the table, both enums, and the unique index on `slug`, and
  `pnpm build` and `pnpm lint` pass.

- [x] **2. Add the database client and the development seed.**
  Create `lib/db.ts` exporting one shared Prisma client that is reused across
  dev hot reloads. Create `prisma/seed.ts` that upserts by `slug`: two published
  digital products, one published service, and one unpublished digital product,
  using examples from the project plan (for instance a marketing template at
  4900 and Ads Management). Give the digital products a placeholder
  `digitalFile` key so the exclusion rule can be observed. Wire the seed to
  Prisma's seed command. Prefer running TypeScript with what Node 22 already
  provides; add a runner dependency only if that does not work.
  **Done when:** running the seed twice in a row succeeds and leaves exactly four
  `Product` rows, shown by a row count from the database.

- [x] **3. Add the catalog query functions.**
  Create `lib/catalog.ts` with the `PublicProduct` type,
  `listPublishedProducts({ type? })`, and `getPublishedProductBySlug(slug)`.
  Both filter on `status = PUBLISHED` in the database query and use an explicit
  field selection that leaves out `digitalFile` and `status`. Map `priceCents`
  through unchanged and add the constant `currency: "USD"`.
  **Done when:** `pnpm build` and `pnpm lint` pass, and the functions are the only
  code that reads `Product` for public use.

- [x] **4. Add the read-only route handlers.**
  Read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
  first and follow its conventions for handler signatures and route params.
  Create `app/api/products/route.ts` and `app/api/products/[slug]/route.ts`,
  exporting `GET` only, implementing the contract in Data / contracts. Both must
  run per request, not be prerendered at build time. Catch database failures,
  log them on the server, and return the generic `internal_error` body.
  **Done when**, with the dev server running against the seeded database:
  - `GET /api/products` returns 200 with exactly the three published items,
    newest first, and no item contains `digitalFile` or `status`;
  - `GET /api/products?type=SERVICE` returns only the service, and
    `?type=DIGITAL_PRODUCT` only the two published digital products;
  - `GET /api/products?type=nope` returns 400 `invalid_type`;
  - `GET /api/products/<published-slug>` returns 200 with that item;
  - `GET /api/products/<unpublished-slug>` and an unknown slug both return 404
    `not_found` with identical bodies;
  - `POST /api/products` returns 405;
  - with the database unreachable, a request returns 500 `internal_error` and the
    body contains no connection details.

- [x] **5. Update project docs and run the final checks.**
  Add the real database commands (migrate, generate, seed) to the Commands
  section of `AGENTS.md`. In `blueprint/context/coding-standards.md`, replace the
  Database `> TODO` with the installed setup and record that prices are integer
  cents in USD. Leave the other TODOs.
  **Done when:** `pnpm build` and `pnpm lint` pass on the final tree, the step 4
  evidence still holds, and `git status` shows no `.env` file or generated client
  staged or untracked-but-unignored.

## Files / areas

- `package.json`, `pnpm-lock.yaml`, possibly `pnpm-workspace.yaml` - dependencies
  and scripts
- `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts` - plus any
  config file the installed Prisma version requires
- `lib/db.ts`, `lib/catalog.ts` - new (`lib/` does not exist yet; `@/*` resolves
  to the repo root)
- `app/api/products/route.ts`, `app/api/products/[slug]/route.ts` - new
- `.env.example` (new), `.gitignore` (`.env*` is already ignored; add the
  exception), `eslint.config.mjs` only if generated code needs ignoring
- `AGENTS.md`, `blueprint/context/coding-standards.md`

Not touched: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`.

## Data / contracts

### `Product` (PostgreSQL)

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | primary key, generated by the database client (cuid) |
| `name` | string | required |
| `slug` | string | required, unique across both types; lowercase letters, digits, and single hyphens |
| `shortDescription` | string | required |
| `description` | text | required |
| `priceCents` | integer | required; whole US cents (4900 = $49.00) |
| `type` | `ProductType` | required; `DIGITAL_PRODUCT` or `SERVICE` |
| `category` | string | required; plain category name |
| `image` | string | optional; URL or storage reference |
| `digitalFile` | string | optional; private storage reference, digital products only |
| `status` | `ProductStatus` | required, no database default; `PUBLISHED` or `UNPUBLISHED` |
| `createdAt` | datetime | set on create |
| `updatedAt` | datetime | updated on every write |

The plan's `price` field is stored as `priceCents` so the unit is unambiguous.
The store has one currency, USD; no currency column. Write-time validation
(slug format, non-negative price, file only on digital products) belongs to the
admin features that introduce writes.

### `PublicProduct` (JSON)

```json
{
  "id": "string",
  "name": "string",
  "slug": "string",
  "shortDescription": "string",
  "description": "string",
  "priceCents": 4900,
  "currency": "USD",
  "type": "DIGITAL_PRODUCT",
  "category": "string",
  "image": "string or null",
  "createdAt": "ISO 8601 UTC",
  "updatedAt": "ISO 8601 UTC"
}
```

Never includes `digitalFile` or `status`.

### Endpoints

| Request | Success | Errors |
| --- | --- | --- |
| `GET /api/products` | 200 `{ "products": PublicProduct[] }`, published only, ordered `createdAt` descending then `id`; empty array when none | 400 `invalid_type`, 500 `internal_error` |
| `GET /api/products?type=DIGITAL_PRODUCT\|SERVICE` | same, filtered by type | same |
| `GET /api/products/[slug]` | 200 `{ "product": PublicProduct }` | 404 `not_found`, 500 `internal_error` |

Error body, same shape everywhere:

```json
{ "error": { "code": "not_found", "message": "Product not found." } }
```

- An unpublished item is indistinguishable from a missing one (404, same body).
- A `type` value other than the two enum names is a 400; it is compared against
  the two literals, never passed to the database.
- Other methods are not exported, so the framework answers 405.
- No authentication: these endpoints expose only data that the public store will
  show.

### Environment

- `DATABASE_URL` - PostgreSQL connection string, in `.env` (ignored by Git).

## Testing

- The test gate is on (`pnpm test`, Vitest). Steps 3 and 4 ship passing unit
  tests in the same diff, placed next to the source: the `type` parameter
  parsing (both valid values, absent, and invalid) and the `PublicProduct`
  mapping (cents passed through, `currency` constant, ISO dates, and no
  `digitalFile` or `status`). Mock the database client; unit tests must not need
  a database.
- `pnpm test` must be green alongside `pnpm build` and `pnpm lint` in every
  done-when that names them.
- Integration evidence stays as listed: the HTTP responses in step 4, the seed
  row count, and `prisma migrate status`.
- No browser tests command exists and there is no UI, so no browser coverage.

## Notes for the AI

- **Prerequisite:** a reachable PostgreSQL database and its connection string in
  `.env` as `DATABASE_URL`. No PostgreSQL or Docker was found on this machine.
  If it is missing when step 1 starts, stop and ask the user; do not install a
  database server, create a hosted database, or substitute another engine.
- This is Next.js 16 with breaking changes. Read the relevant guide in
  `node_modules/next/dist/docs/` before writing route handlers or data access.
- Use pnpm for every install and script.
- The `digitalFile` exclusion is a security rule from the project plan (digital
  files are never publicly reachable). Enforce it with an explicit field
  selection in the query, not by deleting the key afterward.
- Never print or commit the connection string. Error responses and logs sent to
  the client must not contain it.
- The seed is for development databases only; it must not delete rows.
- No em dashes in generated docs, comments, or commit messages.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":11559,"specSha256":"1ffc30c86f1e02648aec7a7e7c1bbb98b0583789dc111f3043a5d9313871f019","branch":"refs/heads/feature/product-service-catalog","head":"4f0aff7cedf473be819f74c1ae133e4b046e7b23","baseRef":"refs/heads/main","baseCommit":"8d22c82456afb8bc9e6d3753fe7a62ae5730e59e","sourceTree":"eff3c5e25c4a3444450944bf5386085c466ca841","absentOptional":[]} -->

## Independent review

# Independent Review

**Status:** passed
**Target commit:** 4f0aff7cedf473be819f74c1ae133e4b046e7b23
**Base commit:** 8d22c82456afb8bc9e6d3753fe7a62ae5730e59e
**Base ref:** main
**Spec hash:** 1ffc30c86f1e02648aec7a7e7c1bbb98b0583789dc111f3043a5d9313871f019
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-02T02:21:17Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-02T02:25:07Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `8d22c82456afb8bc9e6d3753fe7a62ae5730e59e..4f0aff7cedf473be819f74c1ae133e4b046e7b23` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `pnpm test`: pass (4 files, 20 tests)
- `pnpm lint`: pass
- `pnpm build`: pass (TypeScript clean; `/api/products` and `/api/products/[slug]` both dynamic)
- `pnpm exec prisma migrate status`: pass (1 migration, database schema up to date)

## Evidence

- Preflight: `HEAD` equals the target commit, `git merge-base main HEAD` equals the base commit, the SHA-256 of the tracked `blueprint/context/current-feature.md` equals the spec hash, and `git status` showed only `blueprint/context/review.md` modified, before and after the commands.
- Full `8d22c82..4f0aff7` delta read: 24 files, including `lib/catalog.ts`, `lib/db.ts`, `lib/api-error.ts`, `lib/money.ts`, both route handlers, all four test files, `prisma/schema.prisma`, the init migration, `prisma/seed.ts`, `prisma.config.ts`, `vitest.config.mts`, `package.json`, the `pnpm-lock.yaml` importers, `.gitignore`, `.env.example`, `eslint.config.mjs`, `AGENTS.md`, and `coding-standards.md`.
- `lib/catalog.ts` filters `status = PUBLISHED` in both queries and uses one explicit `select` without `digitalFile` or `status`; no other code reads `Product` apart from the seed, and `lib/db.ts` creates the only `PrismaClient`.
- `type` is compared against the two enum literals before any query; both handlers return the generic `internal_error` body on failure and export `GET` only.
- Migration SQL has the table, both enums, no default on `status`, and the unique index on `slug`, matching the schema and the spec's data contract.
- `.env` and `lib/generated/prisma` are ignored and untracked; `.env.example` holds a placeholder only. The lockfile delta adds registry packages only.
- No skipped, focused, or placeholder tests; unit tests mock the database client.

## Findings

- F-01 [P3] open - unused money helper and test-runner setup outside the spec's scope (`lib/money.ts:6`)
- F-02 [P3] open - seed upsert overwrites existing rows and has no development-only guard (`prisma/seed.ts:69`)
- F-03 [P3] unverified - a slug containing a NUL byte may return 500 instead of 404 (`app/api/products/[slug]/route.ts:12`)
- No P0 or P1 findings.

## Remaining risk

- Runtime HTTP behavior was not exercised by the reviewer: no dev or production server was started, and Check was not required. The step 4 done-when responses (405 on POST, 500 with the database unreachable, identical 404 bodies) rest on the builder's evidence, the unit tests, and code reading.
- The seed was not run by the reviewer, so its idempotency and the four-row count were not re-observed.
- `GET /api/products` is unbounded and returns the full `description` of every published item. The spec puts pagination out of scope; revisit when the catalog grows.
- `prisma` and `dotenv` are devDependencies while `postinstall` runs `prisma generate` and `prisma.config.ts` imports `dotenv/config`. An install that omits devDependencies would fail, and `prisma migrate deploy` needs both. No deployment target is chosen yet, so this is untested.
- A missing `DATABASE_URL` is not reported at startup; it surfaces as a generic 500 and a connection error in the server log on the first request.
- No dependency vulnerability scan was run (network-backed tools are not permitted in review); the lockfile was inspected locally only.
