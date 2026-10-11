# Fix: Cart page 500 when the cart has items

**Type:** Fix
**Status:** verified
**Branch:** fix/cart-page-500-when-the-cart-has-items

## The problem

With at least one item in the cart, `/<lang>/cart` returns 500 and shows
"Something went wrong" in both languages. An empty cart renders. The server
logs:

> Functions cannot be passed directly to Client Components … `appliedNote:
> function appliedNote`

`app/[lang]/cart/page.tsx:158-161` passes each `CartLineItem` the whole cart
dictionary (`{ ...text, typeLabel }`). `components/cart/CartLineItem.tsx:96`
and `:102` forward that object unchanged to the client components
`CartQuantityForm` and `RemoveFromCartButton`. Feature 20 added a function,
`coupon.appliedNote(percent)` (`lib/i18n/dictionaries/en.ts:213` and the Arabic
equivalent), so serializing those props fails. TypeScript allows the extra
properties, so `pnpm build`, tests, and review did not catch it; only rendering a
non-empty cart does.

## The fix

In `CartLineItem`, pass each client component only the fields its text
interface declares:

- `CartQuantityForm`: `{ decrease, increase, errors }` (`CartQuantityText`)
- `RemoveFromCartButton`: `{ remove, errors }` (`RemoveFromCartText`)

This is the root cause: the server-to-client boundary must receive plain
serializable text, and picking the fields keeps any later dictionary function
from crossing it. The cart page and dictionaries stay unchanged.

Must not break: quantity increase/decrease and remove (with their error
messages) in English and Arabic, the line's type label, quantity, and
instant-download / onboarding notes, the coupon form, and checkout.

## Build steps

- [x] 1. **Pass only client-safe text from `CartLineItem`.** Build the two
  narrowed text objects in `components/cart/CartLineItem.tsx` and pass them to
  `CartQuantityForm` and `RemoveFromCartButton`. **Done when** `/en/cart` and
  `/ar/cart` return 200 with a digital product and with a service in the cart
  (no "Functions cannot be passed" error in the response or server log), and
  `pnpm lint` and `pnpm build` pass.

- [x] 2. **Keep the coupon form inside the order summary.** Added after
  review: the coupon row is wider than the other summary items (316px against
  278px at a 1280px viewport), and while applying, the wider "Applying…" button
  pushes past the panel edge. The apply `<form>` in
  `components/cart/CouponForm.tsx` is a grid with an `auto` column, whose
  minimum is the text input's intrinsic width, so the input's `min-w-0` cannot
  shrink it. Give the form `grid-cols-1` (`minmax(0, 1fr)`) so the row takes
  the summary width and the input shrinks to fit the button. Keep `required`.
  **Done when** at 1280px and 390px, in `/en` and `/ar`, the coupon row is the
  same width as the other summary items and the button stays inside the content
  box at rest and while "Applying…", checked with a browser screenshot and
  measured boxes, and `pnpm lint` and `pnpm build` pass.

## Verify

- Repro used for diagnosis: request `/en/cart` with a `cart` cookie of
  `[["<published product id>",1]]`; before the fix it returns 500 with the
  error above, after the fix 200.
- In the browser: add a digital product and a service to the cart, open
  `/en/cart` and `/ar/cart`, change the digital product's quantity, remove an
  item, apply and remove a coupon code. No error page, and the labels are
  translated. The coupon field and Apply button line up with the totals and
  checkout button, and "Applying…" stays inside the panel, on desktop and mobile.
- `pnpm test` stays green. No new unit test: `coding-standards.md` keeps UI
  components out of unit tests; the live request and the build are the evidence.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":3703,"specSha256":"4dd9ceb43ed9d65ada5117f0e6b31a01437ee74eb76383309e466958ccb86cd6","branch":"refs/heads/fix/cart-page-500-when-the-cart-has-items","head":"c724782b68f2d2cfec28bbec315b9a0bedc5cad1","baseRef":"refs/heads/main","baseCommit":"c724782b68f2d2cfec28bbec315b9a0bedc5cad1","sourceTree":"5322664a3cde2d802969cbe3c09e01e15d49cd89","absentOptional":[]} -->
