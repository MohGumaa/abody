# Fix: Mockup type scale and trust-bar icon

**Type:** Fix
**Status:** verified
**Branch:** fix/mockup-type-scale-and-trust-bar-icon

## The problem

1. **Text is smaller than the design.** The mockup's type scale in
   `prototypes/theme.css` was never ported, so `app/globals.css` still uses
   Tailwind's defaults. Body text is 16px with 1.5 line height instead of 17px
   with 1.65. `text-sm` is 14px instead of 15px. Headings are a step smaller.
   Arabic pages do use Tajawal, but the text looks small and cramped for the
   same reason.

   | Token | Mockup | Tailwind default |
   |---|---|---|
   | `text-xs` | 0.8125rem (13px) | 12px |
   | `text-sm` | 0.9375rem (15px) | 14px |
   | `text-base` | 1.0625rem (17px) | 16px |
   | `text-lg` | 1.1875rem (19px) | 18px |
   | `text-xl` | 1.5rem (24px) | 20px |
   | `text-2xl` | 1.875rem (30px) | 24px |
   | `text-3xl` | 2.5rem (40px) | 30px |
   | `text-4xl` | 3.25rem (52px) | 36px |

2. **Some components picked Tailwind sizes by pixel value, not by mockup
   token.** For example, the cart heading uses `text-3xl` (30px today) for the
   mockup's `--text-2xl` (30px). Porting the scale alone would make those
   elements grow past the design.
3. **The "Track every service" icon is wrong.**
   - `ChartIcon` in `components/icons.tsx` draws a bar chart. The mockup's
     `.i-chart` is an axis chart: `M4 20V4m0 16h16M8 16v-4m4 4V8m4 8v-6`.
   - The trust-bar icons are 16px. Mockup icons are `1.25em` of their text,
     about 19px in the trust bar.

## The fix

**Type scale** (`app/globals.css`):
- Override `--text-xs` through `--text-4xl` in `@theme` with the mockup values
  in the table above.
- Set each `--text-*--line-height`:
  - 1.65 for `xs`, `sm`, `base`, and `lg` (the mockup's `--leading`)
  - 1.2 for `xl` through `4xl` (the mockup's heading line height)
- In the `body` rule, set `font-size: var(--text-base)` and `line-height: 1.65`
  so unclassed text matches the mockup.
- Keep the existing unlayered Arabic heading rule (no letter-spacing, 1.4 line
  height).

**Remap existing sizes to mockup tokens.** In every component built from a
mockup, set each `text-*` class to the token the mockup CSS names for that
element, not to the old pixel value. At minimum:
- `app/[lang]/cart/page.tsx`, `components/cart/*`: compare against
  `prototypes/cart.html` and `mockup.css`. For example, the cart and empty-state
  `h1` are `--text-2xl`, the item `h2` is `--text-lg`, the summary `h2` is
  `--text-xl`, and the total row is `--text-lg`.
- `components/layout/SiteHeader.tsx`, `MainNav.tsx`, `LanguageSwitcher.tsx`,
  `SiteFooter.tsx`: these already use the mockup names (`text-sm`, `text-xs`),
  so the port fixes them. Just confirm.
- `components/catalog/ProductDetail.tsx` and `RelatedProducts.tsx` predate the
  mockups and are redesigned in 26c. Leave their classes alone and accept the
  larger sizes, unless something overflows at 375px.
- `app/[lang]/error.tsx`, `not-found.tsx`: check that they still look balanced.
- The home page placeholder (`app/[lang]/page.tsx`) is replaced in 26d. Leave
  it alone.

**Trust-bar icon:**
- Replace the `ChartIcon` path with the mockup's `.i-chart` path.
- Size the trust-bar icons and the footer's lock icon at `size-[1.25em]`
  instead of `h-4 w-4`, so they scale with their text as in the mockup.

**Must not break:**
- Tajawal on Arabic pages and Geist on English pages (already correct; no font
  change).
- RTL mirroring: logical properties only.
- Header and cart layouts at 375px: no sideways scroll, and the logo and header
  actions stay on one row.
- AA contrast and focus-visible outlines.

**Out of scope:**
- Tajawal weights. It has no 600, so `font-semibold` renders at 700 in Arabic,
  the same as in the mockup.
- Redesigning the detail page (26c) or the home page (26d).
- Icon sizes outside the trust bar and the footer lock.

## Build steps

- [x] **1. Port the type scale.** Add the `--text-*` and line-height overrides
  in `@theme`, and the body font size and line height.
  **Done when:** on `/en/cart`, body text computes to 17px with a 28.05px line
  height and nav links to 15px. `pnpm build` passes.
- [x] **2. Remap cart sizes to mockup tokens.** Update `text-*` classes in the
  cart page and `components/cart/*` to match `prototypes/cart.html`, then check
  the header, footer, error, and not-found pages.
  **Done when:** the cart headings compute to the mockup sizes (`h1` 30px, item
  name 19px, summary heading 24px) in both languages. `/en/cart` and `/ar/cart`
  have no sideways scroll at 375px, and the header actions stay on one row.
- [x] **3. Trust-bar icon.** Replace the `ChartIcon` path, and size the trust-bar
  and footer-lock icons at `1.25em`.
  **Done when:** the trust bar shows the axis-chart icon at about 19px in both
  languages. `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Verify

- `pnpm test`, `pnpm lint`, `pnpm build`.
- With `pnpm dev`, check `/en` and `/ar`, `/en/cart` and `/ar/cart` (empty and
  with items), a product detail page, and a 404 page, each at 375px, 768px, and
  1280px.
  - Body text is 17px and nav and trust-bar text is 15px, in Tajawal on Arabic
    pages and Geist on English pages.
  - The "Track every service" icon matches the mockup's axis chart.
  - Nothing scrolls sideways.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":5292,"specSha256":"e76f7d4893eb2d6b51eacf5d027005272ecd5973de79834eb7dce8c669fcb334","branch":"refs/heads/fix/mockup-type-scale-and-trust-bar-icon","head":"9078924f5c8fa918b0064feaabe8ef6143d300d0","baseRef":"refs/heads/main","baseCommit":"9078924f5c8fa918b0064feaabe8ef6143d300d0","sourceTree":"7d1f3de1a4babfd331442e0595c2ec374c417078","absentOptional":[]} -->
