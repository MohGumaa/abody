# Fix: Store card preview on admin edit pages

**Type:** Fix
**Status:** verified
**Branch:** fix/store-card-preview-on-admin-edit-pages

## The problem

An admin cannot see how a product or service will look in the store before
publishing it. The edit pages (`app/admin/products/[id]/page.tsx` and
`app/admin/services/[id]/page.tsx`) show only the form, and "View in store"
appears only once the item is published. Unpublished items return a 404 on the
public pages, so the only way to check the card today is to publish first.
Arabic content falls back to English field by field, so the admin also cannot
tell which fields the Arabic card will show in English.

## The fix

Add a "Store card preview" panel to the right-hand column of both edit pages,
above "Visibility". It renders the real store card (`ProductCard`) twice: once
in English and once in Arabic (wrapped in `lang="ar" dir="rtl"`), using the
saved product.

- **Same mapping as the store.** Build each card's data with `toPublicProduct`
  from `lib/catalog.ts`, so the localized fallbacks match the storefront.
  `getAdminProduct` in `lib/admin.ts` gains `type` and `createdAt` in its select
  and in `AdminProduct` so the row fits `toPublicProduct`. `digitalFile` is
  still stripped before return; nothing private reaches the card.
- **No dead link.** `ProductCard` gets an optional `linked` prop (default
  `true`). When `false`, the title renders as plain text with no stretched link
  and no hover lift, because the public page 404s for unpublished items. Store
  callers are unchanged.
- **Card text.** The admin area has no `[lang]` segment, so the panel imports
  the `en` and `ar` dictionaries directly for the badge labels
  (`instantDownload`, `startsAfterOnboarding`).
- **New component.** `components/admin/StoreCardPreview.tsx`, a server
  component that takes the `AdminProduct`. Its section uses the same `CARD`
  panel style as its neighbors.
- **Saved state only.** The preview reflects the last save, not unsaved form
  edits. A one-line note under the heading says so. A live preview is out of
  scope (it would need a client card and splitting `lib/catalog.ts` from the
  database).

Must not break: store listing, home, and related-item cards (link, hover, and
focus ring); the existing edit page panels and their order otherwise; the
admin role check on both pages.

No new dependencies.

## Build steps

- [x] **1. Preview panel on both edit pages.** Add `linked` to `ProductCard`,
  add `type` and `createdAt` to `getAdminProduct`, create
  `StoreCardPreview`, and render it on the product and service edit pages.
  Done when: as an admin, an unpublished product and an unpublished service
  each show an English and an Arabic card matching the store card (cover,
  category, name, short description, price, badge, service duration chip);
  an item with no Arabic fields shows English text on the Arabic card; the
  preview cards have no link; a store listing card still links and lifts on
  hover; `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Verify

- Sign in as an admin, open an unpublished product's edit page: the preview
  panel shows the EN and AR cards. Change the name, save, and the preview
  updates.
- Do the same for an unpublished service: the dark cover, duration chip, and
  "Starts after onboarding" badge appear.
- Clicking a preview card does nothing; `/en/products` cards still open the
  product page.
- Check the panel at 390px and 1366px widths.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass. UI-only change, so no new
  unit tests.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":3561,"specSha256":"b8781c2a616bae3149fab712969ce466125e3d610f6dbd30712fde45d06ae28c","branch":"refs/heads/fix/store-card-preview-on-admin-edit-pages","head":"8b4a95d3e209666a65909e98b756c83f7de741eb","baseRef":"refs/heads/main","baseCommit":"8b4a95d3e209666a65909e98b756c83f7de741eb","sourceTree":"a9b177282f4880c6b2fcb565bc83dd2f79b971f4","absentOptional":[]} -->
