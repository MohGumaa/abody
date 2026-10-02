# Feature: Shopping Cart

**From build-plan:** feature 4
**Build attempt:** 1
**Branch:** feature/shopping-cart
**Status:** verified

## Goal

Let anonymous visitors add digital products and services to a cart from the
detail pages, then open `/<lang>/cart` to review items, change digital product
quantities, remove items, and see the subtotal and total before checkout. The
cart lives in a browser cookie that holds only product IDs and quantities. The
server always loads current prices and publish status from the database.

## In scope

- A `cart` cookie holding `[productId, quantity]` pairs. It is set and cleared
  only by Server Actions and never trusted for prices, names, or availability.
- Working **Add to Cart** on product and service detail pages, with pending,
  success, already-in-cart, unavailable, cart-full, and unexpected-error
  feedback.
- A **Cart** link in the header, on every customer page, showing the item count.
- The `/<lang>/cart` page: line items (image, localized name linking to the
  detail page, type label, unit price, quantity, line total), subtotal, total,
  quantity update for digital products, remove for every item, and an empty state.
- Services are fixed at quantity 1. Digital products can have quantity 1-99.
- English and Arabic text for everything this feature adds, with RTL layout.
- Unit tests for cart parsing and logic, the catalog lookup by ID, and the
  Server Actions.

## Out of scope

- Checkout, Stripe, orders, and the `/<lang>/checkout` page (feature 5). The
  cart's checkout button stays disabled with a "coming soon" note, matching the
  pattern the Add to Cart button used before this feature.
- A database cart, a cart tied to an account, or merging carts at login
  (feature 8 and later).
- Discounts, coupons, taxes, or fees (feature 20). The total equals the subtotal
  for now.
- Analytics events for add-to-cart (feature 23), the rest of the header
  navigation (Home, Products, Services, About, Contact, Login), and SEO metadata
  beyond a page title (feature 22).

## Build loop

`workflow.stepReview` is `feature`: implement all steps, keeping each one
working and its checks green, then present one review packet for the whole
feature. `workflow.checkpointCommits` is `disabled`: no step commits.
`/complete` creates the final feature commit.

## Build steps

- [x] **1. Cart logic and catalog lookup by ID.** Add `lib/cart.ts` (pure, no
  `next/*` imports, like `lib/i18n/config.ts`) with the constants, `parseCart`,
  `serializeCart`, `addCartItem`, `setCartQuantity`, `removeCartItem`,
  `cartItemCount`, and `buildCartView` described under Data / contracts. Add
  `listPublishedProductsByIds(ids, locale)` to `lib/catalog.ts`. It uses
  `publicProductSelect` and `toPublicProduct`, filters `status: PUBLISHED` and
  `id: { in: ids }`, returns `[]` without a query for an empty list, and never
  selects `digitalFile`.
  **Done when:** `lib/cart.test.ts` and new `lib/catalog.test.ts` cases cover the
  behavior listed under Testing, and `pnpm test` passes.

- [x] **2. Cart Server Actions.** Add `actions/cart.ts` (`"use server"`) with
  `addToCart`, `updateCartQuantity`, and `removeFromCart`. Each one reads the
  cookie through `cookies()` from `next/headers`, validates `FormData` input on
  the server, runs the `lib/cart.ts` logic, prunes entries whose product is no
  longer published (one `listPublishedProductsByIds` query), writes the cookie
  with the attributes under Data / contracts, and returns the action result
  shape. Wrap DB work in try/catch, log the error server-side, and return
  `unexpected`.
  **Done when:** `actions/cart.test.ts` (mocking `next/headers` and
  `@/lib/catalog`) covers the cases under Testing and `pnpm test` passes.

- [x] **3. Add to Cart and header cart link.** Replace the disabled
  `components/catalog/AddToCartButton.tsx` with a working form. It is a client
  component that gets the product ID and its translated strings as props from
  `ProductDetail` and uses `useActionState` with `addToCart`. Show the pending
  label and disable the button while the action runs. Results appear in a
  `role="status"` region below the button (unavailable, cart-full, and
  unexpected errors use `role="alert"`). Success and already-in-cart messages
  include a "View cart" link to `localizedPath(locale, "/cart")`. Add a Cart link
  with the item count to `components/layout/SiteHeader.tsx`, before the language
  switcher. Its accessible name includes the count (see Data / contracts). Add
  the dictionary keys in `en.ts` and `ar.ts` and remove `cartComingSoon`.
  **Done when:** on `/en/products/<slug>` and `/ar/services/<slug>`, adding an
  item shows the success message and the header count updates without a manual
  reload. Adding the same service again shows "already in your cart" and the
  count stays the same. `pnpm lint` and `pnpm build` pass.

- [x] **4. Cart page.** Add `app/[lang]/cart/page.tsx` (server component,
  `generateMetadata` title from the dictionary). It reads and parses the cookie,
  loads products with `listPublishedProductsByIds`, and renders `buildCartView`.
  Put the components under `components/cart/`: `CartLineItem` for each line,
  `CartQuantityForm` (client, digital products only), `RemoveFromCartButton`
  (client), and the summary with subtotal, total, and the disabled checkout
  button with a note. Services show "Quantity: 1" as text. Cover the empty state
  (message plus a "Continue shopping" link to `localizedPath(locale, "/")`) and
  the stale-items notice when `removedCount > 0`. Prices use `formatPriceCents`.
  Mirror the layout in Arabic using logical properties (`ms-`, `me-`, `text-start`).
  **Done when:** in both languages, `/<lang>/cart` lists items added in step 3
  with correct line totals, subtotal, and total. Changing a digital product's
  quantity and removing an item update the page and header count. An empty cart
  shows the empty state. A quantity outside 1-99 sent to the action shows the
  inline error. `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Files / areas

- New: `lib/cart.ts`, `lib/cart.test.ts`, `actions/cart.ts`,
  `actions/cart.test.ts`, `app/[lang]/cart/page.tsx`, `components/cart/*`
- Changed: `lib/catalog.ts`, `lib/catalog.test.ts`,
  `components/catalog/AddToCartButton.tsx`, `components/catalog/ProductDetail.tsx`,
  `components/layout/SiteHeader.tsx`, `lib/i18n/dictionaries/en.ts`,
  `lib/i18n/dictionaries/ar.ts`
- Reused: `components/catalog/ProductImage.tsx`, `lib/money.ts`,
  `productPath` and `publicImageSrc` from `lib/catalog.ts`, `localizedPath` from
  `lib/i18n/config.ts`, `getLocale` and `getDictionary`
- Unchanged: `prisma/schema.prisma` (no migration), `proxy.ts` (`/en/cart` and
  `/ar/cart` already pass through), `/api/*`

## Data / contracts

**Cookie** (`CART_COOKIE = "cart"`):

- Value: `JSON.stringify` of an array of `[productId: string, quantity: number]`
  pairs in the order items were added, for example `[["clx…",2],["cly…",1]]`.
  `cookies().set` handles encoding.
- Attributes: `httpOnly: true`, `sameSite: "lax"`, `secure` when
  `NODE_ENV === "production"`, `path: "/"`, `maxAge: CART_COOKIE_MAX_AGE`
  (30 days, refreshed on every write). When the cart becomes empty, delete the
  cookie instead of writing `[]`.
- Bounds (technical, set by the cookie's ~4 KB size and kept simple to change):
  `MAX_CART_LINES = 50` distinct products, `MAX_QUANTITY = 99` per digital
  product.

**`parseCart(raw: string | undefined): CartEntry[]`**, where
`CartEntry = { productId: string; quantity: number }`. The cookie is untrusted
input. A missing, non-JSON, or non-array value returns `[]` and never throws. It
drops entries that are not a two-item array, IDs that do not match
`/^[A-Za-z0-9_-]{1,64}$/`, and quantities that are not integers in 1-99. Only the
first occurrence of a duplicate ID is kept. The result is truncated to
`MAX_CART_LINES`. Product type is not known here, so service quantities are
enforced in the add, update, and view logic.

**Logic results.** These are pure functions that return a new array.

- `addCartItem(entries, { id, type })` returns
  `{ entries, outcome: "added" | "already_in_cart" | "max_quantity" | "cart_full" }`.
  - A new product is appended with quantity 1, or returns `cart_full` when 50
    lines already exist.
  - A service that is already in the cart returns `already_in_cart` unchanged.
  - A digital product that is already in the cart has its quantity incremented,
    or returns `max_quantity` unchanged at 99.
- `setCartQuantity(entries, { id, type }, quantity)`: a service always stays at
  1. A missing ID leaves the cart unchanged. The caller validates the range.
- `removeCartItem(entries, id)` and `cartItemCount(entries)` (sum of quantities).
- `buildCartView(entries, products)` returns
  `{ lines, subtotalCents, totalCents, removedCount }`.
  - Lines follow cookie order and only include entries with a matching published
    product.
  - A service line uses quantity 1 even if the cookie says otherwise.
  - `lineTotalCents = priceCents * quantity`, and
    `totalCents = subtotalCents` (integer cents).
  - `removedCount` counts entries with no published product.

**Server Actions** (`actions/cart.ts`), with signatures compatible with
`useActionState`: `(prevState, formData) => Promise<CartActionResult>`.

```ts
type CartActionError = "invalid_input" | "unavailable" | "cart_full" | "unexpected";
type CartActionResult =
  | { success: true; data: { outcome: "added" | "already_in_cart" | "max_quantity" | "updated" | "removed"; count: number } }
  | { success: false; error: CartActionError }
  | null; // initial state
```

- `addToCart`: `productId` comes from form data. It must pass the ID pattern
  (`invalid_input`) and belong to a published product (`unavailable`).
  `cart_full` maps to `{ success: false, error: "cart_full" }`.
- `updateCartQuantity`: `productId` and `quantity` come from form data. The
  quantity must be an integer string in 1-99 (`invalid_input`). The product must
  be in the cart and still published (`unavailable`).
- `removeFromCart`: `productId` (`invalid_input`). Removing an ID that is not in
  the cart succeeds idempotently.
- The actions never take a price, name, or type from the client. The type comes
  from the DB lookup.

**Header count label:** a visible "Cart" text plus a count badge. Its accessible
name avoids plural forms (Arabic has several), for example `Cart, items: 3` /
`السلة، عدد العناصر: 3`. Digits are Latin in both languages, the same as prices.

**Prices:** these always come from the current `Product.priceCents`. The cart
stores no price. Feature 5 must re-price on the server the same way.

## Testing

`pnpm test` gates steps 1, 2, and 4. Steps 3 and 4 also need `pnpm lint` and
`pnpm build`, plus manual checks in the running app during `/check`. There is no
Browser tests command, so no browser tests are added.

- `lib/cart.test.ts`:
  - `parseCart`: undefined, empty, invalid JSON, non-array, bad entry shapes,
    bad IDs, quantities 0 / 100 / 1.5 / string, duplicates, truncation at 50.
  - Round trip through `serializeCart`.
  - `addCartItem`: every outcome, including a service already in the cart, a
    digital product at 99, and 50 lines.
  - `setCartQuantity`: a service is clamped to 1 and a missing ID does nothing.
  - `removeCartItem`, `cartItemCount`.
  - `buildCartView`: totals, cookie order, a service with a cookie quantity of 3
    shown as 1, `removedCount`, and an empty cart.
- `lib/catalog.test.ts`: `listPublishedProductsByIds` returns `[]` with no query
  for an empty list, filters PUBLISHED and `id in`, uses the public select (no
  `digitalFile`), and localizes.
- `actions/cart.test.ts`: mock `next/headers` (a cookie store with `get`, `set`,
  and `delete`) and `@/lib/catalog`. Cover:
  - add new, add a duplicate service, unpublished or unknown ID, malformed ID
  - update a valid quantity, quantity `"0"` / `"100"` / `"abc"`, update a
    product not in the cart
  - remove, and removing the last item deletes the cookie
  - stale entries pruned on write, cookie attributes, and a DB failure returning
    `unexpected`

## Notes for the AI

- Read these before writing Next.js code:
  - `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`
- The cookies doc says setting a cookie in a Server Action used as a form
  `action` returns the updated UI in the same roundtrip, so the cart page and
  header count should refresh without `revalidatePath`. Confirm this in the
  running app. Add `revalidatePath` only if the header does not update.
- Reading `cookies()` in `SiteHeader` makes every `[lang]` route render
  dynamically. That is acceptable for a store with a live cart. Check the
  `pnpm build` route table and mention the change in the review packet.
- Dictionaries are server-only. Pass the strings a client component needs as
  props. Do not import the dictionaries into client components.
- Product names come from the database. Render them as React text with
  `dir="auto"`, as `ProductDetail` does, and never as HTML.
- Accessibility:
  - Each quantity input has a `<label>`, visually hidden, that includes the
    product name, plus `min="1"`, `max="99"`, `inputMode="numeric"`, and
    `required`. Its server error is linked with `aria-describedby` in a
    `role="alert"` element and cleared on the next successful submit.
  - Each remove button's accessible name includes the product name.
  - After a removal, move focus to the cart `<h1>` (`tabIndex={-1}`) so
    keyboard focus is not lost.
  - Pending buttons are disabled.
- Do not add Zod or another dependency. The hand-written parser in
  `lib/cart.ts` is enough.
- Keep `components/catalog/AddToCartButton.tsx` at its current path so
  `ProductDetail` keeps a single import. Only its contents change.
- Do not start Stripe or checkout work. The checkout button is
  `disabled` with `aria-describedby` pointing to the coming-soon note.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":14063,"specSha256":"a72b3c8a771cc9f4fd92e38ccccef0d5896adfff34dc434b0b3ebcaea98af858","branch":"refs/heads/feature/shopping-cart","head":"d9f216266ef0a836d02babf054185b0b13b338e0","baseRef":"refs/heads/main","baseCommit":"d9f216266ef0a836d02babf054185b0b13b338e0","sourceTree":"02a1747905b9f3f79bd6196c8b4410796dbe0433","absentOptional":[]} -->
