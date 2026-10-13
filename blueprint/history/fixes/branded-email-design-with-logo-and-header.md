# Fix: Branded email design with logo and header

**Type:** Fix
**Status:** verified
**Branch:** fix/branded-email-design-with-logo-and-header

## The problem

The six transactional emails (customer order, admin order, customer service
status, admin service requirements, password reset) all go through one plain
wrapper, `page()` in `lib/order-emails.ts`. It is a white box on a grey page:
no logo, no header, no footer, no inbox preview text, and colors that do not
match the store (`#1d4ed8` buttons, stone greys). The emails do not look like
they come from Abody.

The approved design is the mockup in `prototypes/emails.html` (v2).

## The fix

Replace the wrapper with a branded layout and restyle each email's body to the
mockup. Email HTML stays inline-styled and table-based (email clients ignore
Tailwind and most `<head>` CSS); this is the one place the "no inline styles"
standard does not apply, as today.

- **Shared layout module.** Move `escapeHtml`, `ltr`, `button`, `page`, and
  `BuiltEmail` out of `lib/order-emails.ts` into a new pure `lib/email-layout.ts`
  (no db, `next/*`, or fetch imports, so Vitest loads it directly). Update the
  imports in `lib/order-emails.ts`, `lib/service-emails.ts`, and
  `lib/password-reset-email.ts`.
- **Colors.** One `EMAIL_COLORS` constant with the `app/globals.css` tokens
  converted to hex (email clients do not support `oklch`): brand `#0061a2`,
  brand light `#3282c6`, soft `#dff1ff`, canvas `#ecf3fa`, border `#dbe2e9`,
  ink `#0e1e2f`, foreground `#121921`, muted `#3f4952`, faint `#606a74`,
  success `#106c3e` / `#daf7e3`, plus warning and danger pairs.
- **`page()` layout**, in order:
  - Hidden preheader (inbox preview text).
  - 5px brand-light accent bar.
  - Logo row: `Logo-0.jpg` from `${siteUrl}/Logo-0.jpg` (absolute, as email
    needs), alt text "Abody" / "عبودي", with optional meta text (order number,
    date) at the end side; meta hides below 480px.
  - Hero band: round icon badge, optional eyebrow, `h1` heading, optional
    subline. Brand blue for customer emails, ink for admin emails with an
    "Admin notice" eyebrow.
  - Body.
  - Customer footer: the three `header.trust` lines from the dictionary,
    Products / Services / Contact links (localized paths), "Questions?" line with
    the contact email, the email's reason note, and a copyright line. Admin
    footer: one muted note line.
  - `<meta name="color-scheme" content="light">`, a `max-width:480px` media query
    that stacks columns, makes buttons full width, and trims padding. `lang` and
    `dir` follow the locale; start and end alignment flip for Arabic.
- **Brand input.** `page()` takes an `EmailBrand { siteUrl: string;
  contactEmail: string | null }` passed in by the callers. A new server helper
  `emailBrand()` in `lib/email.ts` returns `siteUrl` from `lib/seo.ts` and
  `contactEmail` from `getSiteContent()` (already returns `null` on failure).
  The "Questions?" line is left out when no contact email is saved. The three
  notification modules (`order-`, `service-`, `password-reset-notifications.ts`)
  call it only after the email-off and no-address checks, and pass it through.
- **Bulletproof button.** The button color sits on a table cell so Outlook
  keeps it. `button(href, label, color?)`.
- **Customer order email.** Meta shows order number and order date (from the
  order's `createdAt`, formatted the way the account pages format dates).
  Subline has the "Payment received" pill. Lines in a bordered card with a
  "Digital product" / "Service" pill and quantity; a highlighted total row;
  "What happens next" as numbered step cards for downloads and services (only
  the ones that apply); centered button.
- **Customer service status email.** For NEW, IN_PROGRESS, and COMPLETED, a
  three-step tracker (Details received, In progress, Completed) with the current
  step highlighted and the status message under it. WAITING_FOR_INFORMATION
  shows an amber callout with its own heading and an "Update your details"
  button (same order page link). CANCELLED shows a red callout.
- **Password reset email.** Centered button, expiry note, "Didn't ask for this?"
  box, and a "Button not working? Paste this link" fallback with the reset URL.
- **Admin order email.** Ink header, stats row (Total paid, Items, Customer),
  "Includes a service" pill when relevant, lines card with an "Open service
  order" link per service, ink button.
- **Admin service requirements email.** Same admin layout; service, order, and
  customer as a stats row.
- **Plain text parts** keep their current content and add the contact email
  (when set) and the site link at the end.
- **New dictionary strings** (`en` and `ar`): an `emailLayout` group (questions
  line, rights line, product type pills, admin eyebrow is English only) and
  per-email preheaders, "What happens next", the waiting/cancelled headings,
  "Update your details", "Didn't ask for this?", the paste-link line, and the
  reset footer note. Arabic copy follows the tone of the existing Arabic strings.

Must not break:

- Every admin-entered value (product names, customer label, contact email) is
  still escaped; names still go in through replacer functions.
- Subjects, idempotency keys, send conditions, and logging are unchanged; logs
  still never carry an address, link, or content.
- No admin notes or customer requirements in any email.
- Email-off and no-address paths still skip before any site-content lookup.

No new dependencies.

## Build steps

- [x] **1. Branded layout and order emails.** Add `lib/email-layout.ts` with the
  colors, `page()`, `button()`, pill and preheader helpers; `emailBrand()` in
  `lib/email.ts`; the `emailLayout` and order dictionary strings; restyle
  `customerOrderEmail` and `adminOrderEmail` and pass `emailBrand()` and the
  order date from `lib/order-notifications.ts`. Update
  `lib/order-emails.test.ts` and add `lib/email-layout.test.ts`.
  Done when: the order emails render like the mockup in EN and AR; tests cover
  the absolute logo URL, the preheader, contact line present and escaped / absent
  when `null`, RTL `dir` and end alignment, escaping of names; `pnpm test` and
  `pnpm lint` pass.
- [x] **2. Service and password reset emails.** Restyle
  `customerServiceStatusEmail` (tracker and callouts),
  `adminServiceRequirementsEmail`, and `passwordResetEmail`; add their
  dictionary strings; pass `emailBrand()` from the service and password reset
  notification modules. Update their tests.
  Done when: each service status renders the right tracker step or callout
  (tested per status); the reset email carries the fallback link; all six
  emails match the mockup; `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Verify

- Unit tests: `pnpm test` covers escaping, preheader, logo URL, contact line,
  tracker step per status, and RTL attributes.
- Visual: render each built email's `html` to a local file (one-off script, not
  committed) and open it at desktop and 375px widths in EN and AR; compare with
  `prototypes/emails.html`.
- Real send (optional, needs `RESEND_API_KEY` and `EMAIL_FROM`): trigger a test
  order and a password reset, check Gmail web and a phone mail app. The logo
  only loads when `SITE_URL` points to a public deployment.
- `pnpm lint` and `pnpm build` pass.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":7301,"specSha256":"31176ff7b36a5f7bf60267899712fdad1518c632409894491aad5531ea1e4559","branch":"refs/heads/fix/branded-email-design-with-logo-and-header","head":"72665bc863dabd1664d39a579edac6d9812944be","baseRef":"refs/heads/main","baseCommit":"72665bc863dabd1664d39a579edac6d9812944be","sourceTree":"699f7336f61f0c0919a48804571af0b695caee2e","absentOptional":[]} -->
