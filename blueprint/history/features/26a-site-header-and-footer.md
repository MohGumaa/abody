# Feature: Site Header and Footer

**From build-plan:** feature 26a
**Build attempt:** 1
**Status:** verified
**Branch:** feature/site-header-and-footer

## Goal

Give every customer page the approved site chrome from the mockups, in English
and Arabic: a panel header with logo, main navigation, language switcher, and
cart pill, then a trust bar under it, a footer, and the light canvas background
behind the pages. Only links whose page already exists are shown. Each later
feature adds its own links when its page ships.

## Design reference

- `prototypes/index.html`: the `<header class="site-header">` and
  `<footer class="site-footer">` markup.
- `prototypes/mockup.css`: `.site-header`, `.header-main`, `.logo`, `.nav`,
  `.header-actions`, `.btn-ghost`, `.btn-soft`, `.count`, `.trust-bar`,
  `.site-footer`, `.footer-grid`, `.footer-blurb`, `.footer-bottom`, plus the
  rules for these classes in the 960px and 600px media queries.
- `prototypes/i18n.js`: the Arabic wording.

The theme tokens are already in `app/globals.css`. Use the same token map as
the cart fix: `--bg` is `canvas`, `--surface` is `panel`, `--surface-2` is
`surface`, `--accent*` is `primary*`, `--radius-lg` is `rounded-panel`,
`--radius` is `rounded-card`, `--radius-sm` is `rounded-control`, `--shadow-sm`
is `shadow-soft`, and `--container` is `max-w-site`. `prototypes/` is untracked
and reference-only, so nothing in the app may import from it.

## In scope

- **Header layout.** A `max-w-site` container with 16px side padding and 24px
  top padding. Inside it:
  - A white panel row, rounded on top only, holding:
    - the logo (34px tall, links to `/<lang>`)
    - the main navigation
    - the actions (language switcher and cart pill), pushed to the inline end
  - The trust bar under the panel, rounded on the bottom only.
- **Main navigation.** A `nav` with a translated `aria-label` that holds only
  Home today.
  - Mark the link for the current page with `aria-current="page"`: Home only on
    exactly `/<lang>`. Later items match their own path and any sub-path.
  - The current link uses the `primary-soft` / `primary-strong` treatment.
  - The items come from one list in the header, so 26b, 8, and others add
    Products, Services, Sign in, and so on by adding entries.
- **Language switcher.** Restyle it as the mockup's ghost button: globe icon
  plus the other language's name, `hover:bg-surface`. Below 600px, the name is
  visually hidden but stays the accessible name. Keep its link behavior and
  cookie write unchanged.
- **Cart pill.** Keep it as shipped in the cart fix: soft pill, filled count
  badge, label hidden below `sm`, accessible name `header.cartLabel(count)`.
- **Trust bar.** Three items, each with an icon:
  - bolt: "Instant download after payment" / "تحميل فوري بعد الدفع"
  - lock: "Secure payment with Stripe" / "دفع آمن عبر Stripe"
  - chart: "Track every service from your account" / "تابع كل خدماتك من حسابك"

  Use a `ul` on `bg-primary-soft text-primary-strong`, 14px medium text, with
  items spread across the row and wrapping on narrow screens.
- **Footer.** A white footer with a top border, as the last element in the
  body. It holds:
  - The logo (a link to `/<lang>`) and the blurb "Digital products you can
    download today and services run by the Abody team." / "منتجات رقمية
    تحمّلها اليوم وخدمات ينفذها فريق عبودي."
  - Link columns (Shop, Company, Account) from one list. A column renders only
    when it has at least one link, so today none render and the brand column
    stands alone.
  - A bottom row: "© {year} Abody. All rights reserved." / "© {year} عبودي.
    جميع الحقوق محفوظة." with the current year in Latin digits, and the lock
    icon with "Payments secured by Stripe" / "مدفوعات مؤمّنة عبر Stripe".
  - The footer sits at the bottom of short pages.
- **Page canvas.**
  - The body background becomes `canvas`.
  - The cart page and the product detail page widen from `max-w-5xl` to
    `max-w-site`, so they line up with the header.
  - The detail page's content sits in one white `rounded-panel` panel so it
    stays readable on the canvas until 26c restyles it.
  - The error and not-found pages keep their centered layout on the canvas.
- **Responsive rules, from the mockup's media queries.**
  - Below 960px: the navigation moves to its own full-width row under the logo
    and actions, scrolling sideways if needed. The header, trust bar, and
    footer use 24px side padding, and the footer link columns use two columns.
  - Below 600px: the action labels hide (the language name visually, the cart
    label as today). The header row uses 12px side padding and the trust bar
    20px.

## Out of scope

- Links to pages that do not exist yet: Products and Services (26b), Sign in
  (8), the account pages (9), About and Contact (no plan item), and the
  footer's category links (26b). No `#` placeholders.
- The home page body (26d), listing pages (26b), and the detail page redesign
  (26c). The detail page only gets the panel wrapper and the width.
- The "You might also like" row on the cart page (26b).
- Changing `header.cartLabel` to plural forms.
- Dark mode, and a sticky or collapsing header.

## Build loop

Per `blueprint/config.json` (`stepReview: "feature"`, `checkpointCommits:
"disabled"`): build all steps, then one review packet at the end of the
feature. No per-step checkpoint commits. `/complete` makes the single feature
commit.

## Build steps

- [x] **1. Current-link helper.** Add `isCurrentNavPath(pathname, href)` with
  tests. The home href matches only exactly. Any other href matches itself or
  `href + "/..."`, but not a longer sibling such as `/products-old`. A trailing
  slash on the pathname is ignored.
  **Done when:** `pnpm test` passes with cases for `/en` vs `/en`, `/en/cart`
  vs `/en`, `/ar/products` vs `/ar/products/x`, and `/en/products-old`.
- [x] **2. Header and trust bar.** Restyle `SiteHeader` and `LanguageSwitcher`,
  and add a small client `MainNav` that uses `usePathname` and the helper. Add
  `ChartIcon` (and a globe icon if the switcher's inline SVG moves) to
  `components/icons.tsx`. Add the dictionary strings in both languages: the nav
  label ("Main navigation" / "القائمة الرئيسية"), Home ("Home" /
  "الرئيسية"), and the three trust items.
  **Done when:** `/en` and `/ar/cart` show the panel header and trust bar
  matching the mockup at 1280px, 768px, and 375px, mirrored in Arabic. Home
  carries `aria-current="page"` only on `/<lang>`. The switcher still switches
  language and keeps the path. `pnpm lint` passes.
- [x] **3. Footer.** Add `components/layout/SiteFooter.tsx` and render it after
  `{children}` in `app/[lang]/layout.tsx`. Add the footer strings in both
  languages, with the year passed into the copyright string.
  **Done when:** the footer shows on `/en`, `/ar/cart`, and a 404 page,
  mirrored in Arabic, at the bottom of the viewport on short pages, with no
  empty link columns. `pnpm lint` passes.
- [x] **4. Canvas and widths.** Set the body background to `canvas`. Widen the
  cart and detail pages to `max-w-site`, and wrap the detail content in a
  white panel.
  **Done when:** the cart, a product detail page, a service detail page, and
  the 404 page sit on the canvas and line up with the header edges at 1280px.
  Nothing scrolls sideways at 375px. `pnpm test`, `pnpm lint`, and
  `pnpm build` pass.

## Files / areas

- `components/layout/SiteHeader.tsx`, `components/layout/LanguageSwitcher.tsx`
- `components/layout/MainNav.tsx` (new, client)
- `components/layout/SiteFooter.tsx` (new)
- `components/icons.tsx`
- `lib/nav.ts` and `lib/nav.test.ts` (new): `isCurrentNavPath`
- `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/ar.ts`: new `header`
  keys (nav label, home, trust items) and a `footer` group
- `app/[lang]/layout.tsx`: footer, body background
- `app/globals.css`: body background, only if done there instead of in the
  layout
- `app/[lang]/cart/page.tsx`, `components/catalog/ProductDetail.tsx`: container
  width and the detail panel only

## Data / contracts

- No data, API, or route changes. No new dependencies.
- Nav and footer link items are `{ href: string; label: string }`. `href` is
  built with `localizedPath(locale, path)`, so every link keeps the language
  prefix.
- The year comes from `new Date().getFullYear()` in the server-rendered footer.
  The layout is already dynamic because the header reads the cart cookie.

## Testing

- Unit: `lib/nav.test.ts` for `isCurrentNavPath` (Vitest, `pnpm test`).
- No browser harness is configured. Visual checks at 1280px, 768px, and 375px
  in both languages are done manually or during `/check`.
- Final gate: `pnpm test`, `pnpm lint`, and `pnpm build`. All three passed on
  `main` (`258aee9`) in this session, the tree this branch starts from.

## Notes for the AI

- Use logical properties only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`,
  `text-start`). Rounded corners use logical-safe utilities (`rounded-t-panel`,
  `rounded-b-panel`), which are the same in both directions.
- Keep focus-visible outlines (`outline-primary-strong`) on every link.
- AA contrast: no `hover:bg-primary` under white text (finding F-05). The trust
  bar's `primary-strong` on `primary-soft` is the mockup's pairing.
- The mockup's `.nav` hides its scrollbar. Keep that only if the row still
  scrolls with the keyboard, because the links stay focusable.
- Directional icons mirror in Arabic. None of the icons in this feature are
  directional.
- `MainNav` is the only new client component. Keep `SiteHeader` and
  `SiteFooter` server components, and pass translated labels into `MainNav` as
  props.
- Read the relevant guides in `node_modules/next/dist/docs/` before using any
  Next.js API that is new to this codebase.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":9934,"specSha256":"86632d773dad221e21b808494a2495fa5acc7dd4ff618e9257eade90d49a9d5b","branch":"refs/heads/feature/site-header-and-footer","head":"258aee9ba79ca5f7dbc0ce01849b1c2d0b32ef21","baseRef":"refs/heads/main","baseCommit":"258aee9ba79ca5f7dbc0ce01849b1c2d0b32ef21","sourceTree":"737934cea77eed91209b3aa100e95e30a7330006","absentOptional":[]} -->
