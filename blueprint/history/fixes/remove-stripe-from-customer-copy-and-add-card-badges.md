# Fix: Remove Stripe from customer copy and add card badges

**Type:** Fix
**Status:** verified
**Branch:** fix/remove-stripe-from-customer-copy-and-add-card-badges

## The problem

Customer-facing text names the payment processor ("Secure payment with
Stripe", "Redirecting to Stripe…", and others) in both languages. The owner
wants a general secure-payment message instead. The footer also has no sign of
which cards are accepted.

Stripe is named in these dictionary entries (`lib/i18n/dictionaries/en.ts` and
`ar.ts`):

- `header.trust.payment` (header trust bar)
- `footer.stripe` (footer bottom row, `components/layout/SiteFooter.tsx`)
- `product.securePayment` (product detail page)
- `home.values.secure.body` and `home.steps[1].body` (home page)
- `cart.redirecting` and `cart.secureNote` (cart summary)
- `checkoutResult.processing.body` (success page while payment is processing)

## The fix

Change the copy only. The Stripe integration does not change.

- **Dictionaries (en and ar):** remove every customer-facing mention of Stripe:

  | Key | English | Arabic |
  |---|---|---|
  | `header.trust.payment` | Encrypted checkout with all major cards | دفع مشفّر بجميع البطاقات الرئيسية |
  | `footer.securePayment` (renamed from `footer.stripe`) | Secure payment | دفع آمن |
  | `footer.acceptedCards` (new) | Accepted cards | البطاقات المقبولة |
  | `product.securePayment` | Secure payment | دفع آمن |
  | `home.values.secure.body` | Your payment is encrypted. Abody never sees or stores your card details. | عملية الدفع مشفّرة. عبودي لا يطّلع على بيانات بطاقتك ولا يخزنها. |
  | `home.steps[1].body` | Pay securely in a few clicks. | ادفع بأمان بنقرات قليلة. |
  | `cart.redirecting` | Redirecting to secure checkout… | جارٍ التحويل إلى صفحة الدفع الآمنة… |
  | `cart.secureNote` | You pay on a secure, encrypted page | تدفع عبر صفحة آمنة ومشفّرة |
  | `checkoutResult.processing.body` | We are still confirming your payment. … | لا نزال نؤكد عملية الدفع. … |

- **`components/layout/PaymentCards.tsx` (new):** a list of inline SVG badges
  for Visa, Mastercard, and American Express. Each badge is a white card face
  with `role="img"` and the brand name as `aria-label`. The list's
  `aria-label` is `footer.acceptedCards`. The badges show only card brands,
  because Checkout uses Stripe's dynamic payment methods and cards are always
  on. Apple Pay and Google Pay are left out until they are turned on in the
  Stripe dashboard.
- **`SiteFooter.tsx`:** the bottom row shows the lock icon, `footer.securePayment`,
  and `<PaymentCards>`, wrapping on narrow screens.

**Must not break:**
- Checkout, webhook, and success flows (no payment code changes).
- Arabic layout: the footer row wraps cleanly in RTL at phone width.
- The `Dictionary` type: `ar.ts` still satisfies `typeof en`.

**Out of scope:**
- Stripe references in code, comments, env vars, and the `/api/stripe/webhook`
  route. Customers do not see these.
- Official brand artwork. The badges are simplified marks and can be swapped later.

**Note:** these changes are already in the working tree on `main`
(uncommitted). `/implement` moves them onto the fix branch and verifies them.

## Build steps

- [x] **1. Copy and footer badges.** Update both dictionaries, add
  `PaymentCards.tsx`, and use it in `SiteFooter.tsx`.
  **Done when:** searching `lib/i18n/dictionaries` for "Stripe" finds nothing.
  The footer shows the secure-payment line and three card badges in both
  languages. `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Verify

- `pnpm test`, `pnpm lint`, `pnpm build`.
- With `pnpm dev`, on `/en` and `/ar`: the header trust bar shows the new
  payment line; the footer shows "Secure payment" / "دفع آمن" with the Visa,
  Mastercard, and Amex badges; and nothing visible says "Stripe" on the home
  page, a product page, or the cart (including the "Redirecting…" text after
  clicking checkout).
- At about 375px wide, the footer bottom row wraps without horizontal scroll.
- A screen reader announces the badges as "Accepted cards" followed by
  Visa, Mastercard, and American Express.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":4310,"specSha256":"5882b6b32324edcbc24fcc42936133c39415d784e99a02b3b4c760e25e5e3317","branch":"refs/heads/fix/remove-stripe-from-customer-copy-and-add-card-badges","head":"36a2c08f6e7798abd2dda869f34b574c8ff12e5f","baseRef":"refs/heads/main","baseCommit":"36a2c08f6e7798abd2dda869f34b574c8ff12e5f","sourceTree":"5da3b31318dd6bdaf6f3ee6e946bd832c0462004","absentOptional":[]} -->
