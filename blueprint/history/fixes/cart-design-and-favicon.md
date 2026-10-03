# Fix: Cart design and favicon

**Type:** Fix
**Status:** verified
**Branch:** fix/cart-design-and-favicon

## The problem

1. **The cart does not match the approved mockup.** Feature 4 (Shopping Cart)
   was specced without its design reference, `prototypes/cart.html`, so the
   `/<lang>/cart` page and the header cart link use ad-hoc styling.
   - Cart items are flat rows. The mockup shows tinted item cards with chips,
     a − / + quantity stepper, a trash-icon remove button, a breadcrumb and an
     item count, a sticky summary with an accent border and a Stripe note, and
     an empty state with an icon.
   - The header cart link is a ghost link. The mockup uses a soft pill with a
     filled count badge.
2. **The browser shows the Next.js favicon.** `app/favicon.ico` is the Create
   Next App default, and it takes precedence over the Abody icons already in
   `public/`. Nothing links `public/apple-touch-icon.png` or
   `public/site.webmanifest`, and the manifest's `name` and `short_name` are
   empty.

## The fix

**Design reference:** `prototypes/cart.html` (markup and per-page CSS) and
`prototypes/mockup.css` (`.btn-soft`, `.count`, `.breadcrumb`, `.eyebrow`,
`.chip*`, `.qty`, `.summary*`, `.secure-note`). The theme tokens are already in
`app/globals.css`. Mockup names map to these tokens:

| Mockup | App token |
|---|---|
| `--bg` | `canvas` |
| `--surface` | `panel` |
| `--surface-2` | `surface` |
| `--accent*` | `primary*` |
| `--radius` | `rounded-card` |
| `--radius-lg` | `rounded-panel` |
| `--radius-sm` | `rounded-control` |
| `--shadow-sm` | `shadow-soft` |

Arabic wording comes from `prototypes/i18n.js` wherever it has the string (for
example "سلة المشتريات", "ملخص الطلب", "تحميل فوري", "سلتك فارغة"). The
`prototypes/` folder is untracked and reference-only, so nothing in the app may
import from it.

**Cart page** (`app/[lang]/cart/page.tsx`, `components/cart/*`):

- **Breadcrumb:** Home › Cart in a `nav` panel with a translated
  `aria-label`. Home links to `localizedPath(locale, "/")`. The chevron mirrors
  in RTL.
- **Items panel:** white panel with a heading row showing "Your cart" and the
  item count, for example "3 items" / "3 عناصر".
- **Item cards:** each item is a tinted card on the `surface` color.
  - Small image (`ProductImage`, about 96px, 64px on phones).
  - Eyebrow "Type · Category".
  - The name as a link to its detail page.
  - Chips: a digital product shows a success chip with a bolt icon, "Instant
    download". A service shows a primary chip with a clock icon and its
    duration, when it has one, plus a plain chip "Onboarding form after
    payment".
  - Side column: line price, then the stepper and a trash icon button.
- **Quantity stepper:** replace the number input and Update button in
  `CartQuantityForm` with − / output / + buttons. Each button submits
  `updateCartQuantity` with `quantity` set to the new value via the submit
  button's `name` and `value`.
  - − is disabled at 1, because removing is the trash button's job. + is
    disabled at 99. Both are disabled while pending.
  - Accessible names include the product name, for example "Decrease
    quantity: Digital Marketing Template".
  - The current quantity sits in an `<output>`.
  - Services keep a fixed quantity with no stepper, shown as text.
- **Remove:** an icon-only ghost button with a trash icon. Its accessible name
  is "Remove: <name>". On hover it uses the danger tint. Keep the existing
  behavior of moving focus to the heading after a removal.
- **Summary:** sticky on wide screens, with the accent border.
  - "Subtotal (N items)", then Total.
  - A large primary "Continue to checkout" button, still `disabled` with the
    "Checkout is coming soon" note linked through `aria-describedby` until
    feature 5.
  - The lock-icon secure note "You pay on Stripe's secure page".
- **Empty state:** a centered panel with a round cart icon, the heading "Your
  cart is empty", the body line from the mockup, and a "Browse the store"
  button. The button links to `localizedPath(locale, "/")` until item 26 builds
  the listing pages.
- **Unavailable-items notice:** keep it, styled as a warning panel.
- **Layout:** two columns (`1fr` / 360px) on wide screens and one column below
  960px. Below 600px, the item side column moves under the details, as in the
  mockup's media rules.
- **Item count:** use correct plural forms in both languages. Add
  `cart.itemCount` as a per-category map (`zero`, `one`, `two`, `few`, `many`,
  `other`, each with `{count}`), chosen with `Intl.PluralRules`. Add a small
  `formatItemCount(locale, count, forms)` helper in `lib/i18n/` with Latin
  digits. Add `itemCount` (the sum of the shown line quantities) to
  `buildCartView`.

**Header cart link** (`components/layout/SiteHeader.tsx`): restyle it as the
mockup's `.btn-soft`.
- `bg-primary-soft text-primary-strong`, 44px tall, `rounded-card`.
- Cart icon from the mockup. The "Cart" label stays hidden below `sm`.
- Count badge filled `bg-primary-strong text-white`, 20px, pill-shaped.
- Keep the accessible name `header.cartLabel(count)`.
- The language switcher is unchanged.

**Favicon:**
- Move `public/favicon.ico` (the Abody icon) over `app/favicon.ico` with `git
  mv`, so only one `/favicon.ico` exists.
- Add the icon metadata in `app/[lang]/layout.tsx` `generateMetadata`:
  - `icons`: the 16px and 32px PNGs, plus `apple: "/apple-touch-icon.png"`
  - `manifest: "/site.webmanifest"`
- In `public/site.webmanifest`, set `name` and `short_name` to `"Abody"` and
  `start_url` to `"/"`. Leave the icons and colors unchanged.
- Before using these metadata fields, read
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`
  and `manifest.md` in the same folder.
- The proxy matcher already skips paths with a dot, so these files are not
  redirected.

**Must not break:**
- Cart behavior and validation in `actions/cart.ts`: the server still rejects
  quantities outside 1–99.
- The language prefix on every link.
- RTL mirroring: use logical properties only (`ms-`, `me-`, `ps-`, `pe-`,
  `start-`, `end-`, `text-start`).
- Focus-visible outlines.
- AA contrast. Do not use `hover:bg-primary` under white text (finding F-05);
  darken or add a shadow instead.
- Product names stay as React text with `dir="auto"`.

**Out of scope (item 26):**
- Site-wide canvas background, header navigation, Sign in and the trust bar,
  the footer.
- The cart's "You might also like" row. It needs the product card component
  that item 26 restyles.
- Any change to the product detail page.

## Build steps

- [x] **1. Favicon and manifest.** Do the `git mv`, the layout metadata, and the
  manifest names.
  **Done when:** `pnpm build` passes and the rendered `<head>` of `/en` links
  the Abody icon, the apple-touch icon, and `/site.webmanifest`. Confirm in the
  browser tab during `/check`.
- [x] **2. Plural item count.** Add `formatItemCount` with tests in
  `lib/i18n/` and `itemCount` in `buildCartView` with a test. Add the
  `cart.itemCount` dictionary maps in both languages. English uses `one` and
  `other`. Arabic uses all six forms: "لا عناصر", "عنصر واحد", "عنصران",
  "{count} عناصر", "{count} عنصراً", "{count} عنصر".
  **Done when:** `pnpm test` passes with cases for 0, 1, 2, 3, 11, and 100 in
  Arabic and 1 and 3 in English.
- [x] **3. Header cart pill.** Restyle the header cart link.
  **Done when:** the header cart link shows the soft pill with a filled badge
  in both languages and at phone width. `pnpm lint` passes.
- [x] **4. Cart page restyle.** Implement everything under **Cart page**. Add
  the new dictionary strings in both languages: breadcrumb label, Home,
  chips, decrease and increase labels, continue to checkout, secure note,
  empty-state heading, body, and button. Remove strings that are no longer
  used (`update`, `updating`).
  **Done when:** `/en/cart` and `/ar/cart`, with items and empty, match
  `prototypes/cart.html` apart from the out-of-scope parts. The stepper
  changes quantity and is disabled at 1 and 99. Remove still works and focus
  lands on the heading. `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Verify

- `pnpm test`, `pnpm lint`, `pnpm build`.
- With `pnpm dev`:
  - Compare http://localhost:3000/en/cart and `/ar/cart` against
    `prototypes/cart.html`, with items and empty. Use the mockup's
    "With items" and "Empty" buttons.
  - Use the stepper on a digital product, and check that a service has no
    stepper.
  - Remove an item.
  - Check widths of 375px, 768px, and 1280px.
  - Check that the browser tab shows the Abody icon. Hard-reload, because
    favicons cache.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":8756,"specSha256":"ec67324c9a34629c24bbec29bf5b89109b4fd1b3e05558e5484fd7a9339bbe7b","branch":"refs/heads/fix/cart-design-and-favicon","head":"4452d6270de06259297e881870e4c50b2eb10e3f","baseRef":"refs/heads/main","baseCommit":"4452d6270de06259297e881870e4c50b2eb10e3f","sourceTree":"c7c29cc8b974007cd571a43d07ae20c69f0ee054","absentOptional":[]} -->
