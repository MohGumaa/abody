# Coding Standards

> Conventions for `abody-app`, tuned by `/onboard` to the scaffolded stack:
> Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, ESLint 9, pnpm.
> Items marked `> TODO` are named in the project plan but not installed or
> decided yet; settle them in the feature that introduces them.

## Package Manager

- pnpm only (`packageManager` is pinned in `package.json`). Use `pnpm add`,
  `pnpm dev`, and so on; never create an npm or yarn lockfile.
- Commands live in the Commands section of `AGENTS.md`.

## TypeScript

- Strict mode enabled
- No `any` types - use proper typing or `unknown`
- Define interfaces for all props, API responses, and data models
- Use type inference where obvious, explicit types where helpful

## React

- Functional components only (no class components)
- Use hooks for state and side effects
- Keep components focused - one job per component
- Extract reusable logic into custom hooks

## Next.js

- This is Next.js 16 with breaking changes from earlier versions. Read the
  relevant guide in `node_modules/next/dist/docs/` before writing Next.js code,
  and heed deprecation notices (see the managed block at the top of `AGENTS.md`).
- App Router only; server components by default
- Only use `'use client'` when needed (interactivity, hooks, browser APIs)
- Use Server Actions for form submissions and simple mutations
- Use route handlers when you need:
  - Webhooks (Stripe)
  - File uploads or protected file downloads
  - Long-running operations
  - Specific HTTP status codes or headers
  - Third-party integrations
- Otherwise, fetch data directly in server components
- Dynamic routes for product and service pages (`/products/[slug]`)

## File Organization

There is no `src/` directory. Code lives at the repository root and the `@/*`
import alias resolves to the root.

- Pages: `app/[route]/page.tsx`
- Components: `components/[feature]/ComponentName.tsx`
- Server Actions: `actions/[feature].ts`
- Types: `types/[feature].ts`
- Lib/Utils: `lib/[utility].ts`

Only `app/` exists today; create the other folders when a feature first needs
them.

## Naming

- Components: PascalCase (`ItemCard.tsx`)
- Files: Match component name or kebab-case
- Functions: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Types/Interfaces: PascalCase (no prefix)

## Styling

- Tailwind CSS for all styling
- Tailwind v4: CSS-first config (`@theme` in `app/globals.css`), no `tailwind.config.js`
- No inline styles
- Light theme first, per the project plan: white and very light gray/blue
  surfaces, dark text, and `oklch(59% 0.13 248)` as the primary brand and action
  color. Define brand colors as theme tokens rather than repeating raw values.
- Mobile-first, responsive layouts

- shadcn/ui components live in `components/ui/` (config in `components.json`,
  `cn()` in `lib/utils.ts`). They are added with the shadcn CLI and then
  restyled to the `@theme` tokens in `app/globals.css`; never run `shadcn init`
  or add its separate CSS variable set. Use them where applicable.

## Database

PostgreSQL with Prisma 7 (`prisma/schema.prisma`, config in `prisma.config.ts`,
`@prisma/adapter-pg` driver adapter). The connection string is `DATABASE_URL`.

- Use the shared client from `lib/db.ts` for all database operations; do not
  create another `PrismaClient`
- Import generated types and enums from `@/lib/generated/prisma/...`; that folder
  is generated, ignored by Git and lint, and never edited by hand
- Money is stored as integer US cents (`priceCents`); the store currency is USD
- Public reads go through `lib/catalog.ts`, which selects public fields only.
  Never select `digitalFile` for a public response.
- Change the schema through migrations (`pnpm db:migrate`, not `db push`)
- Run `prisma migrate status` before committing to verify migrations are in sync
- Production deployments must run `prisma migrate deploy` before the app starts

## Data Fetching and Trust Boundaries

- Server components fetch data directly on the server
- Client components use Server Actions
- Validate all untrusted input on the server
- Scope every user-owned query by the authenticated user id taken from the
  server session; never trust a client-supplied user id
- Check the admin role on the server for every admin page, action, and route
- Never trust the browser to say an order was paid. The verified Stripe webhook
  (signature checked) is the authority for payment status.
- Digital files are never publicly reachable; serve them only to a customer whose
  purchase is confirmed

- Authentication is built in (feature 8a): scrypt password hashes in
  `lib/password.ts`, database sessions in `lib/session.ts`. Read the signed-in
  user with `getCurrentUser()`; only Server Actions and route handlers create or
  delete sessions.

> TODO: no validation library is installed (form parsing is hand-written, as in
> `lib/auth.ts`), and private file storage (Cloudflare R2 or AWS S3) is not
> chosen yet.

## Error Handling

- Use try/catch in Server Actions
- Return `{ success, data, error }` pattern from actions
- Display user-friendly error messages to the user (a toast once a toast
  component exists)

## Testing

**Gate status: on.** `AGENTS.md` declares `pnpm test` (Vitest, config in
`vitest.config.mts`, Node environment, files matching `**/*.test.ts`).

The blueprint installs no test runner; testing is opt-in at the project level,
because the overlay can't know your stack. Adding unit testing is an explicit
setup task the AI can do through the normal workflow, either as a build-plan item
or with `/tests`. The setup should choose the stack-native runner, wire the
scripts or commands, add a small example test, and update the Commands section
of `AGENTS.md`.

When `AGENTS.md` declares a `Verify` command, treat it as the umbrella automated
gate. It combines only the checks this project actually has, in this order when
available: typecheck, tests, then build. The command does not enable an absent
test runner or replace focused evidence. It gives local work and optional CI one
exact command to run. `/ci` owns Verify and CI setup. `/tests` adds the real test
command to Verify when it already exists, but never creates CI only because
testing was configured.

**The opt-in switch is one signal: a `test` command in the Commands section of
`AGENTS.md`.** Declare one and **tests become a gate for logic-bearing steps**,
not an optional extra; leave it out and the loop verifies logic with the evidence
it already uses (run it, a screenshot, the build). Adding the runner is itself a
deliberate step, never a silent mid-step install. This is the single definition
of the switch; the skills and `ai-interaction.md` only point back here.

- **What to test (the scope rule):** pure logic where a wrong answer is possible -
  parsers, formatters, validators, id/slug builders, server actions. These have
  assertable inputs and outputs and real edge cases (empty, missing, malformed).
- **What not to test:** UI components and integration-level surfaces (render or
  export routes, anything driving a real browser or external service). Verify those
  with a screenshot and the build, not brittle unit tests.
- **The gate (when a runner is configured):** a build step that adds in-scope logic
  must ship a passing test in the same reviewable diff. The project's test command
  must be green before the step is approved, before any checkpoint commit, and
  before `/complete` merges. UI and integration-only steps are exempt and ride on
  screenshot plus build evidence.
- **When it's named:** the `/feature` spec's Testing section predicts the coverage,
  `/implement` writes the test with the step, and if a step surfaces logic the spec
  didn't foresee, add a focused test then.
- An empty suite should fail, not pass, so "no tests ran" never looks like "passed".
- Test files live next to source files (for example `feature.test.ts`).
- Run them via the project's test command (see Commands in `AGENTS.md`), not a
  hardcoded tool name.

Stack binding: Vitest, with `vi.mock()` for external dependencies (database
client, auth, Stripe) and `vi.useFakeTimers()` for time-dependent logic.

## Browser Verification

For UI and integration behavior, prefer real browser evidence over reading the
code and assuming it works.

- Browser automation is separately opt-in through `/tests browser`. That setup
  reuses a compatible runner or prefers Playwright for supported projects, then
  documents the exact command as `Browser tests` in `AGENTS.md`.
- When `Browser tests` is declared, add focused coverage for stable behavioral
  done-whens when it is proportionate, and run the documented command during
  `/check`. Do not assume it proves visual fidelity, real authenticated-profile
  behavior, browser chrome, or another claim the test does not observe.
- If no Browser tests command is declared, do not add a runner silently in the
  middle of an unrelated feature. Use the available dev server, browser
  screenshots, build output, API output, or manual evidence instead.
- Browser tests are not part of the default Verify command or CI unless the user
  separately chooses that slower gate.
- Browser evidence is especially important for flows that click, type, submit,
  navigate, download files, render complex layouts, or depend on client-side
  state.

## Code Quality

- No commented-out code unless specified
- No unused imports or variables
- Keep functions under 50 lines when possible

## Comments

Write code that explains itself; comment only what the code cannot say.
Over-commenting is a common AI tell, so resist it.

- Comment the **why**, not the **what**. Delete any comment that restates the code.
- No banner/header blocks, section dividers, or step-by-step narration of obvious
  code. A file does not need a comment announcing each region.
- A comment earns its place only when it captures something the code can't: a
  non-obvious decision, a gotcha or workaround, why a value is what it is, or a
  link to a spec or issue.
- Prefer self-documenting names and small functions over explanatory comments.
- Keep doc comments minimal: a one-line purpose on an exported type or function is
  plenty; don't write JSDoc that just repeats the signature.
- When in doubt, leave the comment out.

## Writing

- No em dashes (U+2014) in generated content: docs, comments, commit messages,
  READMEs, specs. They read as AI-generated.
- Use a hyphen for `term - description` separators; rephrase prose with commas,
  parentheses, or a colon. Avoid en dashes and the ellipsis character too.
