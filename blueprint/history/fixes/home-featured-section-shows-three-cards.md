# Fix: Home featured section shows three cards

**Type:** Fix
**Status:** verified
**Branch:** fix/home-featured-section-shows-three-cards

## The problem

The home page's featured products section (feature 29a tabs: Best sellers,
New, Templates) shows up to four product cards per tab in a four-column row.
It should show three.

Where:

- `lib/home.ts` - `FEATURED_LIMIT = 4` caps each tab's list.
- `app/[lang]/page.tsx` - the tab panel grid is
  `min-[600px]:grid-cols-2 min-[960px]:grid-cols-4`.

## The fix

- Set `FEATURED_LIMIT` to `3` and update the "Mockup row sizes" comment.
- Change the panel grid's wide breakpoint from `grid-cols-4` to `grid-cols-3`.
  Keep the one-column phone and two-column `600px` layouts, so at tablet width
  the third card wraps to its own row.
- Update `lib/home.test.ts` expectations that assume four (newest, best
  sellers, templates cap) and their test names.

Must not break: tab ordering rules (best sellers by units sold, newest first,
templates category match), the hero and services selection, the empty state,
and the tab keyboard behavior. No change to `SERVICES_LIMIT` or the cart and
listing pages.

## Build steps

1. [x] **Three featured cards per tab** - change the limit, grid, comment, and unit
   tests.
   Done when: `pnpm test` passes with the updated expectations, and each
   featured tab on `/en` and `/ar` shows at most three cards in one row at
   desktop width.

## Verify

- `pnpm test`, `pnpm lint`, and `pnpm build` pass.
- `pnpm dev`, open `/en`: each of the three featured tabs shows at most three
  cards, in a three-column row at 960px and wider; switching tabs still works.
- Repeat on `/ar` (right-to-left).
- `pnpm test:browser` home specs still pass (they check tabs, not card counts).


<!-- blueprint:completion {"schemaVersion":1,"specBytes":1764,"specSha256":"12901b1af0575c0f84a832a964a8b2511e5949408239681dcb9fbe4a6233480e","branch":"refs/heads/fix/home-featured-section-shows-three-cards","head":"55bf661e39c05e651cc86e757d219e5071882ede","baseRef":"refs/heads/main","baseCommit":"55bf661e39c05e651cc86e757d219e5071882ede","sourceTree":"f769bb29983dbd456bc3bacb0977348f33b2d8bc","absentOptional":[]} -->
