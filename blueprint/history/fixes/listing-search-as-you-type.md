# Fix: Listing search as you type

**Type:** Fix
**Status:** verified
**Branch:** fix/listing-search-as-you-type

## The problem

Feature 29b's search box on `/<lang>/products` and `/<lang>/services`
(`components/catalog/StoreListing.tsx`) only searches when the customer
presses the separate **Search** button or Enter. The user wants:

- results that update as the customer types, debounced so each key press does
  not hit the server;
- a search icon inside the field and a clear (×) button;
- no separate Search button.

Category and sort must stay in the URL, and the form must still work without
JavaScript.

The search form is also keyed by `category|q|sort` so that a server-side Clear
search link resets its fields. Once typing changes `q`, that key would remount
the form on every debounced update, and the input would lose focus and the
caret. The fix has to replace that reset mechanism.

## The fix

One new client component, `components/catalog/ListingSearchInput.tsx`, replaces
the plain `<input>` and the Search button inside the existing `next/form`
`Form`. Everything else from 29b stays: `?q=` and `?sort=` parsing, matching,
sorting, `listingHref`, the category links, the empty states, and
`ListingSortSelect`.

**Behavior**

- **Debounce:** keep the field's value in local state. 300 ms after the last
  change, call `router.replace(listingHref(basePath, { category, q, sort }),
  { scroll: false })` with `q = parseSearchParam(value)`, so an empty or
  whitespace-only field drops `?q=`. Use `replace`, not `push`, so typing does
  not add one Back step per keystroke. Keep the timer in a `useRef` and clear it
  on every change, on unmount, and on submit.
- **No navigation when nothing changes:** skip the call when
  `parseSearchParam(value)` equals the current `q` prop. Typing a trailing space
  must not refetch.
- **IME composition (Arabic keyboards):** while composing (between
  `compositionstart` and `compositionend`), schedule nothing. Schedule from
  `compositionend`.
- **Enter:** the form submits as today through `next/form` (client navigation
  with the current `category` and `sort`). Clear any pending timer in the form's
  submit path, or in the input's Enter handler, so the debounce does not fire a
  second navigation afterwards.
- **Clear (×):** a `type="button"` button, shown only when the field has text.
  It empties the field, navigates immediately (no debounce) without `?q=`, and
  moves focus back to the input. Its accessible name is the existing
  `listing.clearSearch` text, and its icon is `aria-hidden`.
- **Search icon:** a decorative magnifier at the inline start of the field
  (`aria-hidden`). Position the icon and clear button with logical `start`/`end`
  and pad the input with `ps-*`/`pe-*`, so Arabic RTL mirrors correctly. Hide the
  browser's own cancel button
  (`[&::-webkit-search-cancel-button]:appearance-none`) so there is only one ×.
- **Keeping the field in sync with the URL:** remove `q` from the `Form` key
  (keep `category|sort`). The input stores the last `q` prop it saw. When the
  prop changes (Clear search link, Back/Forward), it overwrites the field only
  if no timer is pending and `parseSearchParam(value) !== q`. Use the
  "adjust state during render" pattern rather than an effect. This keeps what
  the customer is typing while still resetting on outside navigation.
- **Without JavaScript:** the `Form` still renders a real `<form method="get">`.
  With one text field, implicit submission means Enter in the search field
  submits `q`, `category`, and `sort`. A `<noscript>` submit button (existing
  `listing.searchButton` label) keeps a way to apply a sort change without
  JavaScript.
- **Announce result changes:** results now change without a page action, so
  wrap the results status line in `role="status"`. That is the item count, the
  search no-results message, or the category-empty message. Do not make the
  product grid a live region.

**Must not break:** the category links keep `q` and `sort`. Sort changes keep
`q` and `category`. The Clear search link in the no-results state still drops
only `q`. `maxLength` stays at `SEARCH_MAX_LENGTH`, and `dir="auto"` stays on
the input. There is still no sideways scroll at phone width. `lib/listing.ts`
stays free of `next/*` imports. The client component imports only its pure
helpers.

**Icons:** add `SearchIcon` (magnifier) and `CloseIcon` (×) to
`components/icons.tsx`, following the existing `Icon` wrapper.

No new dependency, no new route, no server or data change. The 300 ms delay is
a constant in the component, not configuration.

## Build steps

- [x] **1. Search-as-you-type input.** Add the two icons and
  `ListingSearchInput.tsx`. Use it in `StoreListing.tsx`, where it receives
  `basePath`, `category`, `q`, `sort`, and its text. Remove the Search button,
  add the `<noscript>` submit, change the `Form` key to `category|sort`, and add
  `role="status"` to the results status line.
  **Done when:** `pnpm build` and `pnpm lint` pass. Typing on `/en/products`
  updates the URL and results about 300 ms after you stop, without losing focus.
  Enter searches immediately. × clears the field and the search. Category and
  sort survive all three.

- [x] **2. Browser test.** Update the 29b test in `e2e/storefront.spec.ts`:
  - fill the search box and expect the URL to gain `q=` with no button click;
  - assert the input stays focused after the URL updates;
  - press Enter on a new value and expect an immediate update;
  - click × and expect `q=` gone, the input empty, and `category` and `sort`
    kept;
  - keep the no-results and Clear search link checks.

  **Done when:** `pnpm test:browser` passes, including the existing storefront
  and phone-width tests.

## Verify

- `pnpm test` (unchanged unit suite still passes), `pnpm lint`, `pnpm build`,
  and `pnpm test:browser`.
- By hand on `/en/products` and `/ar/products`:
  1. Type "facebook" slowly. The URL updates once you pause, focus stays in the
     field, and Back does not step through each keystroke.
  2. Pick a category and a sort, then type again. All three stay in the URL.
  3. Click ×. The field empties and `q` leaves the URL.
  4. Search for nonsense, then click the Clear search link. The field empties.
  5. In Arabic, the icon sits on the right and × on the left.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":6330,"specSha256":"436786c63835d23a953262800c83581684a34f5cdb4622c0d62fee1c1ae6967a","branch":"refs/heads/fix/listing-search-as-you-type","head":"a5cf7fd0b5da981e4ee2a0d838f7e3c6118eb81f","baseRef":"refs/heads/main","baseCommit":"a5cf7fd0b5da981e4ee2a0d838f7e3c6118eb81f","sourceTree":"a1749fc1a90fa8a2d70b0781bc279978e9aed176","absentOptional":[]} -->

## Findings

- None (no new findings; open entries carried from earlier work unchanged)
