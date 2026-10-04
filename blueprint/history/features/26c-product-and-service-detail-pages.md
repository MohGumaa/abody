# Feature: Product and Service Detail Pages

**From build-plan:** feature 26c
**Build attempt:** 1
**Status:** verified
**Branch:** feature/product-and-service-detail-pages

## Goal

Restyle `/<lang>/products/[slug]` and `/<lang>/services/[slug]` to match the
approved detail mockup in English and Arabic: a breadcrumb, a three-column
detail panel (cover, info with chips and What's included, buy panel), a prose
panel, a How it works panel, and the related row in its own panel. Data,
routes, the cart action, and metadata stay as they are.

## Design reference

- `prototypes/product.html`: the whole page, both variants (the proto bar's
  "Digital product" / "Service" toggle). Its inline `<style>` holds `.detail`,
  `.thumbs`, `.info`, `.chips`, `.buy`, `.facts`, `.prose`, `.how`, and the
  1100px and 720px breakpoints.
- `prototypes/mockup.css`: `.panel`, `.breadcrumb`, `.eyebrow`, `.chip`,
  `.chip-accent`, `.chip-success`, `.cover`, `.cover--ink`, `.checklist`,
  `.secure-note`, `.btn-lg`, `.btn-block`, `.section-head`, and the
  `[lang="ar"]` letter-spacing reset for `.buy .label`.
- `prototypes/i18n.js` (lines ~126-200): the Arabic wording.

Use the 26a/26b token map: `--surface` is `panel`, `--surface-2` is `surface`,
`--accent*` is `primary*`, `--radius-lg` is `rounded-panel`, `--radius` is
`rounded-card`, `--radius-sm` is `rounded-control`, `--shadow` is
`shadow-raised`, `--tint-N` is `tint-N`. `prototypes/` is untracked and
reference only; nothing in the app imports from it.

## In scope

- **Page frame.** `ProductDetail` renders a `max-w-site` `main` with the same
  container, gutters, and panel stack spacing as `StoreListing`. Every section
  below is its own `rounded-panel bg-panel shadow-soft` panel with the
  listing page's padding steps.
- **Breadcrumb panel.** Styled exactly like the `StoreListing` breadcrumb, with
  `aria-label` from `dictionary.cart.breadcrumb`: Home › Products (or
  Services, linking to that type's listing) › item name. The name is a `span`
  with `aria-current="page"` and `dir="auto"`, and wraps (`break-words`) on
  narrow screens. Chevrons mirror in Arabic. (The mockup shows "Products" for
  the service too; Services is used because that listing exists now.)
- **Detail panel layout.** Three columns at 1100px and up:
  `minmax(0,1.05fr) minmax(0,1.2fr) 320px`, top-aligned, `gap-10`. From 720px
  to 1099px: two equal columns with the buy panel spanning the full row below.
  Below 720px: one column in source order (cover, info, buy).
- **Cover.** The shared cover from the product card (see Build step 1), 4:3,
  `rounded-card`:
  - An image from `publicImageSrc(image)` shows with `object-cover` and
    `alt={product.name}`.
  - Otherwise the decorative placeholder: products use `tint-1` with the
    tilted card shapes; services use the `ink` cover with the chart disc.
  - A service with `durationDays > 0` shows the duration chip on the cover at
    the inline start, as on the card.
- **Info column.**
  - Eyebrow: `typeLabels[type] · category` in the `.eyebrow` style (small,
    uppercase, `primary-strong`, no letter spacing in Arabic). The category
    keeps `dir="auto"`.
  - `h1` (`text-3xl`, `dir="auto"`, `break-words`) with the name.
  - Lead: `shortDescription` in `text-lg` muted, `dir="auto"`.
  - Chips row (wraps):
    - Products: success chip with the bolt icon "Instant download" / "تحميل
      فوري", and a neutral `surface` chip with a download icon "Kept in your
      account" / "يبقى محفوظاً في حسابك".
    - Services: when `durationDays > 0`, an accent chip with the clock icon and
      `formatDurationDays(days, locale)`; then a neutral chip with the chart
      icon "Status updates in your account" / "تحديثات الحالة داخل حسابك".
  - What's included: an `h2` (`text-base`) "What's included" / "ماذا يتضمن"
    and a checklist of the non-blank `included` lines (check icon in
    `primary`, `dir="auto"` per line). The block is omitted when there are no
    lines.
- **Buy panel.** An `aside` labelled "Purchase" / "الشراء", bordered,
  `rounded-panel`, `bg-surface`, `p-6`, `gap-5`:
  - Small uppercase muted label "Price" / "السعر" (no letter spacing in
    Arabic), then `formatPriceCents(priceCents)` at `text-3xl` bold. A service
    with `durationDays > 0` appends a small muted `/ {formatDurationDays}`
    suffix (for example "/ 30 days" / "/ 30 يوماً").
  - `AddToCartButton`, now full width, 52px tall, with the cart icon before
    the label. Its pending, added, already-in-cart, max-quantity, and error
    messages (`role="status"` / `role="alert"`) stay as they are. Label
    "Add to cart" (sentence case, matching the mockup) / "أضف إلى السلة".
  - Secure note centred with the lock icon: "Secure payment powered by Stripe"
    (existing string).
  - A `dl` of facts above a top border, `text-sm`, `dt` muted, `dd` bold and
    end-aligned:
    - Delivery / التسليم: "Instant download" / "تحميل فوري" for products,
      "Starts after onboarding" / "تبدأ بعد استلام بياناتك" for services.
    - Duration / المدة: services with `durationDays > 0` only.
    - Access / الوصول: "From your account" / "من حسابك".
- **Prose panel.** Two equal columns at 720px and up, one below:
  - Description: `h2` (`text-xl`) and `description` with `dir="auto"`,
    `whitespace-pre-line`, `leading-7`, `break-words` (as today).
  - Products: "After you buy" / "بعد الشراء" with a fixed three-line
    checklist from the dictionary: "The download appears on your order
    confirmation page." / "يظهر رابط التحميل في صفحة تأكيد الطلب.", "It stays
    available under Downloads in your account." / "يبقى متاحاً ضمن التحميلات في
    حسابك.", "You get a receipt by email." / "يصلك إيصال عبر البريد
    الإلكتروني."
  - Services: "What we need from you" / "ما نحتاجه منك" with a checklist of the
    non-blank lines of `requirements` (split on line breaks, trimmed). The
    column is omitted when there are none; Description then spans the panel.
- **How it works panel.** A `section` with `section-head` `h2` "How it works" /
  "كيف تعمل المنصة" and an `ol` of the existing three type-specific steps in 3
  columns at 960px and up (1 below 600px, matching `.grid-3`). Each step is a
  `rounded-card bg-surface p-5` row with a 36px `primary-strong` numbered disc
  (`aria-hidden`; the `ol` carries the order) and the step text.
- **Related panel.** `RelatedProducts` keeps its content and rules but renders
  as its own panel instead of a section inside the old single panel. It still
  renders nothing when there are no related items.
- **States.** Unknown, draft, or wrong-type slugs still 404 through
  `requirePublishedProduct`; unexpected errors still reach `app/[lang]/error.tsx`.
  No loading UI is added (the page is server-rendered, as today).

## Out of scope

- The image thumbnail strip: the data model holds one image.
- "Best seller" / "New" badges and per-item cover icons: no data.
- Star ratings and reviews (overview open question 13).
- Translating categories (open question 3). They show as stored, `dir="auto"`.
- Splitting `description` into separately styled paragraphs: it keeps
  `whitespace-pre-line`.
- Changes to the catalog API, schema, metadata/SEO (item 22), the cart page,
  the card's look, or the home page (26d).
- Making the "After you buy" and "Kept in your account" promises true: that is
  items 5-8 and email. Checkout stays disabled until item 5.

## Build loop

Per `blueprint/config.json` (`stepReview: "feature"`, `checkpointCommits:
"disabled"`): build all steps, then hand over one review packet at the end of
the feature. No per-step checkpoint commits. `/complete` makes the single
feature commit.

## Build steps

- [x] **1. Shared pieces.**
  - Extract the card's cover (image or placeholder, duration chip) from
    `ProductCard` into `components/catalog/ProductCover.tsx` with props
    `product`, `locale`, `index`, `alt` (card passes `""`). `ProductCard`
    uses it with no visual change.
  - Add `DownloadIcon` and `CheckIcon` to `components/icons.tsx` in the
    existing `Icon` style; drop the local `CheckIcon` from `ProductDetail`.
  - Add a pure `checklistLines(text: string | null): string[]` to
    `lib/catalog.ts` (split on `\r?\n`, trim, drop blanks) with tests in
    `lib/catalog.test.ts`.
  **Done when:** `pnpm test` passes, covering `null`, blank-only text, CRLF
  input, and the seeded three-line requirements; the related row and the
  listing cards look unchanged; `pnpm lint` passes.
- [x] **2. Breadcrumb, detail panel, and buy panel.** Rebuild the top of
  `ProductDetail` (frame, breadcrumb, cover, info column, buy panel). Update
  `AddToCartButton` to the full-width 52px style with the cart icon. Add the
  new `product` dictionary strings in `en.ts` and `ar.ts` (chips, buy panel
  label, price label, facts, "After you buy" lines) and switch "Add to Cart",
  "What's Included", and "How It Works" to the mockup's sentence case.
  **Done when:** the seeded product and the seeded Ads Management service match
  the mockup's top section at 1280px, 900px, and 375px in `/en` and `/ar`
  (mirrored), the buy panel moves below at 900px and stacks at 375px, Add to
  cart still adds and shows its notices, and nothing scrolls sideways at
  375px. `pnpm lint` passes.
- [x] **3. Prose, How it works, and related panels.** Add the prose and How
  it works panels, move `RelatedProducts` into its own panel, and remove the
  old single-panel markup and the `ProductImage` import from `ProductDetail`
  (`ProductImage` stays for the cart).
  **Done when:** both seeded detail pages show Description plus After you buy
  (product) or What we need from you as a three-item checklist (service), the
  three numbered steps, and the related row, matching the mockup in both
  languages at 1280px and 375px; a service with no requirements shows
  Description alone; an unknown slug and a product slug under `/services` 404.
  `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Files / areas

- `components/catalog/ProductDetail.tsx` (rewritten layout)
- `components/catalog/ProductCover.tsx` (new, extracted)
- `components/catalog/ProductCard.tsx` (uses `ProductCover`)
- `components/catalog/AddToCartButton.tsx` (button style, icon)
- `components/catalog/RelatedProducts.tsx` (own panel wrapper)
- `components/icons.tsx` (`DownloadIcon`, `CheckIcon`)
- `lib/catalog.ts`, `lib/catalog.test.ts` (`checklistLines`)
- `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/ar.ts` (`product` group)
- Unchanged: `app/[lang]/products/[slug]/page.tsx`,
  `app/[lang]/services/[slug]/page.tsx`, `lib/product-page.ts`,
  `actions/cart.ts`

## Data / contracts

- No schema, API, route, or server action changes. The page reads the existing
  `PublicProduct` (locale-resolved by `getPublishedProductBySlug`).
- `checklistLines` is display-only; stored `requirements` stays free text.
- New dictionary keys live under `product` in both locales so the `en`/`ar`
  dictionary types stay aligned.

## Testing

- Unit: `checklistLines` in `lib/catalog.test.ts` (Vitest, `pnpm test`).
- No browser test command exists; the layout, both languages, breakpoints,
  and the add-to-cart flow are checked manually against the mockup during
  `/check`. No visual evidence is claimed by this spec.
- Final gate: `pnpm test`, `pnpm lint`, `pnpm build`.

## Notes for the AI

- Read the Next.js 16 docs in `node_modules/next/dist/docs/` before touching
  anything route-level; this feature should not need to.
- Stored content (name, category, descriptions, included, requirements) is
  rendered as React text only, always with `dir="auto"`, because Arabic fields
  fall back to English.
- Directional icons (breadcrumb chevron) use `rtl:-scale-x-100`; use logical
  properties (`start`, `end`, `ps`, `pe`, `text-end`) throughout.
- Use the mockup breakpoints as Tailwind arbitrary variants
  (`min-[720px]:`, `min-[1100px]:`), matching the 26b `min-[600px]` /
  `min-[960px]` style.
- "Purchase" in the mockup's step list is the verb "اشترِ"; the buy panel's
  `aria-label` uses the noun "الشراء".
- The "After you buy" lines and "Kept in your account" describe items 5-8
  (order confirmation, downloads, receipt email), which are not built. They
  are the approved mockup copy, and no purchase is possible until checkout
  ships.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":12553,"specSha256":"d2f2df5882dff44bc08af48a0f246ca78ea294e1bd846a1ad70c27b900ef67d6","branch":"refs/heads/feature/product-and-service-detail-pages","head":"80033af6e503e311e94689f85f45ad9d00f000c9","baseRef":"refs/heads/main","baseCommit":"80033af6e503e311e94689f85f45ad9d00f000c9","sourceTree":"8df7f73c7c5eca9092e34692ab094a9e93bcab46","absentOptional":[]} -->
