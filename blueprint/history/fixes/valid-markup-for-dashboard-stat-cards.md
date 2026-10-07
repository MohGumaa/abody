# Fix: Valid markup for dashboard stat cards

**Type:** Fix
**Status:** verified
**Branch:** fix/valid-markup-for-dashboard-stat-cards
**Fixes:** F-21

## The problem

On the admin dashboard (`app/admin/page.tsx`, stat cards around line 95), each
card is a `<div>` group inside the `<dl>` that holds the decorative icon
`<span>` followed by the `<dt>` and two `<dd>`s. In HTML a `div` inside a `dl`
may contain only `dt` and `dd` elements, so the markup is invalid and
accessibility checkers (axe `definition-list` / `dlitem`) can flag it. The span
is also not `aria-hidden`, only the SVG inside it.

## The fix

Move the icon inside the `<dt>`, before the label, and mark its wrapper
`aria-hidden="true"`. Keep the current look (icon box on the left, spanning
the label, value, and detail lines) by making the card `relative` with start
padding for the icon, and positioning the icon box absolutely at the card's
start edge, vertically centered. Each group then holds only `dt` and `dd`.

Must not break: the six stats, their order, values, and detail text; the
1/2/3-column responsive grid; the accessible name of each term (the label text
only, no icon text).

No new components or dependencies.

## Build steps

- [x] **1. Move the stat icon into the term.** Update the stat card markup in
  `app/admin/page.tsx` as above.
  Done when: in the browser on `/admin` as an admin, each `<dl>` group's
  children are only `dt`/`dd` (checked with a DOM query), the icon box has
  `aria-hidden="true"`, the cards look the same at 390px and 1366px, and
  `pnpm lint` and `pnpm build` pass.

## Verify

- Sign in as an admin and open `/admin`: the six stat cards look as before,
  with the icon on the left of each card at mobile and desktop widths.
- In the browser console: `[...document.querySelectorAll('dl > div > :not(dt):not(dd)')].length`
  returns `0`.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass (no logic changes, so no new
  unit tests).


<!-- blueprint:completion {"schemaVersion":1,"specBytes":1950,"specSha256":"c2fe384d5dfe80c1933be104c7c9eeae6bbfa118cc3f29a7035561a73ede22b9","branch":"refs/heads/fix/valid-markup-for-dashboard-stat-cards","head":"5312d5f70df2e18f9bb4d5db7d974c8cfd43bd0d","baseRef":"refs/heads/main","baseCommit":"5312d5f70df2e18f9bb4d5db7d974c8cfd43bd0d","sourceTree":"fc10ed400ad1db6bd2750168a4edf15f10f2c598","absentOptional":[]} -->
