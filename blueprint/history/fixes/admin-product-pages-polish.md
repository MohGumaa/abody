# Fix: Admin product pages polish

**Type:** Fix
**Status:** verified
**Branch:** fix/admin-product-pages-polish

## The problem

The admin product pages shipped in feature 13 need three changes:

- **Category is free text.** Admins retype a category on every product, so a
  typo such as `Guide` vs `Guides` silently creates a new store filter. It should
  be a dropdown of the categories already in use, with a way to add a new one.
  Choosing an existing category should also fill in its Arabic name.
- **shadcn/ui is named in the project plan but not installed** (`coding-standards.md`
  Styling TODO). The admin product pages should use its Select and Table.
- **Admin links underline on hover.** These are the product names in the table,
  "← All products", "View in store", and the buttons on the admin error and
  not-found pages. The user wants no underline on admin pages. The storefront is
  unchanged.

The user decided:

- **Category options:** categories already in use, plus "New category…".
- **shadcn/ui scope:** the admin product pages only. The dashboard's Recent
  orders table is unchanged.
- **Underline removal:** admin pages only.

## The fix

- **shadcn/ui, set up by hand and owned in the repo.** Add `components.json`
  (Tailwind v4, `app/globals.css`, `@/components/ui`, `@/lib/utils`) and
  `lib/utils.ts` with `cn()` (`clsx` + `tailwind-merge`). Add the `select` and
  `table` components through the shadcn CLI.
  - Do **not** run `shadcn init`. Do not add shadcn's CSS variable set or
    `tw-animate-css` to `app/globals.css`. The project's `@theme` tokens stay the
    only color source, and they already define `background`, `foreground`,
    `border`, `primary`, and a `muted` that means gray *text*.
  - Restyle the copied components to project tokens: `bg-panel`,
    `border-border`, `bg-surface`, `text-faint`, `bg-primary-soft`,
    `text-primary-strong`, `rounded-control`, `shadow-raised`, and the existing
    focus-outline pattern. No class may rely on a token the project does not
    define, such as `bg-popover`, `border-input`, `ring-ring`, `bg-accent`, or
    `text-muted-foreground`, and `bg-muted` must not be used as a background.
  - Replace `lucide-react` icons with `ChevronIcon` and `CheckIcon` from
    `components/icons.tsx`, and drop the `animate-in`/`zoom` classes, so neither
    `lucide-react` nor `tw-animate-css` is installed.
  - New dependencies: only the Radix Select package the CLI installs, `clsx`,
    and `tailwind-merge`.
- **Category picker** in `ProductForm`.
  - The server passes the digital-product categories already in use, ordered by
    name. Each option carries the most recently updated non-empty `categoryAr`
    seen for that exact `category`, or `null`.
  - The Select lists those categories plus a last option, "New category…".
    Choosing "New category…" shows a required text input, labelled "New category"
    with a 60-character max, and moves focus to it.
  - Choosing an existing category sets the Arabic category field to that
    category's Arabic name when it has one. Otherwise the Arabic field is left
    as typed, and the admin can still edit it. A value the picker filled in
    (not typed by the admin) is replaced or cleared when the admin switches to
    another category or to "New category…", so a new category never inherits
    another category's Arabic name (found in browser verification).
  - Exactly one `category` value is submitted: a hidden input for an existing
    choice, or the text input in new mode. The Select itself has no `name`, so
    its option values never reach the server. Option values must not be
    confusable with a real category name; use an index or prefix scheme.
  - **Initial state:**
    - New product with categories: nothing is selected (placeholder "Choose a
      category").
    - New product with no categories yet: new mode, so only the text field shows.
    - Edit: the current category is selected.
    - After a failed submit: the echoed value is selected when it matches an
      existing category; otherwise new mode with the text prefilled.
    - After a successful save: the saved values.
  - Server validation is unchanged: `category` is required, at most 60
    characters, and is still parsed by `parseProductForm`. This fix stores no new
    data and changes no API.
  - Keep accessibility on par with the other fields:
    - a visible label linked to the Select trigger
    - `aria-invalid` and `aria-describedby` for the hint and error on the trigger
      and on the new-category input
    - keyboard operation, from Radix
- **Table:** `/admin/products` uses the shadcn `Table` components with the same
  columns, look, and horizontal scroll as today.
- **Underlines:** remove `hover:underline` from the five admin elements named in
  The problem. The empty state on `/admin/products` must not show an underlined
  link either: render the admin empty-state link without the shared
  `TEXT_LINK` hover underline, and leave the shared `EmptyState` unchanged for
  the account pages. Hover and focus stay visible through color and the existing
  focus outline.
- Update the Styling TODO in `coding-standards.md` to say shadcn/ui is installed
  (`components/ui/`, restyled to project tokens). `project-overview.md` is
  generated and still says "shadcn/ui not installed". Leave it for the next
  `/overview` run rather than hand-editing it.

Must not break:

- feature 13 behavior: create, edit, publish, upload, and delete
- server-side validation and admin checks
- the storefront, account pages, and admin dashboard appearance
- `app/globals.css` tokens

## Build steps

- [x] **1. shadcn/ui setup.** Add `components.json`, `lib/utils.ts`, and
  `components/ui/select.tsx` and `components/ui/table.tsx`, restyled as described
  above. Update the coding-standards TODO.
  - **Done when:**
    - `pnpm build`, `pnpm lint`, and `pnpm test` pass.
    - `git diff app/globals.css` is empty.
    - `package.json` adds only Radix Select, `clsx`, and `tailwind-merge`, with
      `pnpm-lock.yaml` updated and no npm or yarn lockfile.
    - `components/ui/*` has no reference to `lucide-react`, `bg-popover`,
      `border-input`, `ring-ring`, `bg-accent`, `muted-foreground`, or
      `animate-in`.
- [x] **2. Category picker.**
  - Add a query for the in-use categories and a pure helper that builds the
    options (dedupe by exact `category`, pick the Arabic name, sort). Also add a
    pure helper that maps a value to its initial picker state (an existing index,
    or new mode with text).
  - Wire the picker into `ProductForm`, and have both product pages pass the
    options.
  - **Done when:**
    - Unit tests for both helpers pass: duplicates, mixed or empty `categoryAr`,
      case-sensitive names, an empty list, an unknown echoed value, and an empty
      value.
    - `pnpm build` and `pnpm lint` pass.
    - In the browser, each of these works:
      - picking an existing category fills its Arabic name
      - "New category…" shows and focuses the text field
      - saving with nothing chosen shows the category required error
      - the edit page preselects the current category
      - a new category saves and then appears as an option
- [x] **3. Table and underlines.** Move the `/admin/products` table to the shadcn
  `Table` and remove the admin underlines, including in the empty state.
  - **Done when:**
    - `pnpm build` and `pnpm lint` pass.
    - In the browser, the products table looks as it does now, at desktop width
      and at 375px with horizontal scroll.
    - No admin link underlines on hover.
    - Storefront links are unchanged, for example the account empty-state link.

## Verify

- `pnpm test`, `pnpm lint`, and `pnpm build`.
- Browser (Playwright, with the user's dev server running; restart it with a
  clean `.next/dev` first, see the earlier upload 404):
  1. Open `/admin/products/new`. Open the Category select and confirm it lists
     the existing categories plus "New category…".
  2. Pick "Guides" and confirm the Arabic category field fills in when Guides has
     an Arabic name.
  3. Pick "New category…", type `Checklists`, fill in the other fields, and save.
     Expect the redirect to the edit page with `Checklists` preselected, and
     `Checklists` listed as an option on a new product.
  4. Submit with no category and confirm the category error appears next to the
     select.
  5. On `/admin/products`, the table matches the current look, with no underline
     on hover over product names or "← All products".


<!-- blueprint:completion {"schemaVersion":1,"specBytes":8561,"specSha256":"cad6a030a76c0856cdd9554d903485b380362cb88a4c8b3bc7dfbf07df458860","branch":"refs/heads/fix/admin-product-pages-polish","head":"015f46e593c60f543677247f96f31de9445c3dec","baseRef":"refs/heads/main","baseCommit":"015f46e593c60f543677247f96f31de9445c3dec","sourceTree":"622a05cbb00ae62f39b5473f5e06bd690fdf309a","absentOptional":[]} -->
