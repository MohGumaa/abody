# Feature: Information Pages

**From build-plan:** feature 27
**Build attempt:** 1
**Branch:** feature/information-pages
**Status:** verified

## Goal

Give customers five static information pages, About, Contact, Terms and
Conditions, Privacy Policy, and Return Policy, in English and Arabic at
`/<lang>/about`, `/contact`, `/terms`, `/privacy`, and `/returns`. About and
Contact join the header navigation; all five are linked from the footer.

## In scope

- Five customer routes under `app/[lang]/`, each with a per-language title,
  meta description, canonical URL, and `hreflang` alternates through the
  existing `pageMetadata` helper (`lib/seo.ts`).
- One shared server component that renders an information page: breadcrumb
  (Home > page), a panel with the `<h1>` and intro, then ordered sections (a
  heading plus paragraphs or a bullet list), styled like the existing listing
  panels.
- All page text in the typed dictionaries (`lib/i18n/dictionaries/en.ts` and
  `ar.ts`); the `Dictionary` type keeps Arabic in step with English.
- Contact page shows the admin-set contact email from site settings (feature
  21c, `getSiteContent()`) as a `mailto:` link, `dir="ltr"`, rendered as React
  text. With no email saved, or when the settings read fails (it already
  returns `null`), the page shows a translated "not available yet" line instead
  of an empty link.
- Header navigation: Home, Products, Services, About, Contact (matches the
  overview's navigation order; Login and Cart stay where they are).
- Footer: a **Company** column (About, Contact) and a **Legal** column (Terms
  and Conditions, Privacy Policy, Return Policy) beside **Shop**, filling the
  existing three-column footer grid.
- The five paths added to `app/sitemap.ts` (both languages via
  `sitemapEntries`).

## Out of scope

- A contact form, message storage, or sending email from the site (would add
  validation, spam and rate-limit work no plan item asks for).
- Admin editing of page content; the text is static in the dictionaries.
- Cookie banners, consent tooling, or account deletion flows.
- Linking the policies from checkout, registration, or emails.
- Any change to refund behavior; feature 15b already defines refunds.

## Build loop

`workflow.stepReview` is `feature`: build all steps, running the checks named
in each step, then present one review packet for the whole feature. Checkpoint
commits are disabled. `/complete` creates the final feature commit.

## Build steps

- [x] **1. Shared page component and the About page.** Add the information-page
  content shape to the English dictionary (`info.about` with `title`,
  `description`, `intro`, `sections`) and the Arabic translation, a shared
  `InfoPage` server component, and `app/[lang]/about/page.tsx` with
  `generateMetadata` via `pageMetadata`. About copy describes Abody from the
  overview: a bilingual store for downloadable digital products and services
  (ads and account management) run by the Abody team.
  **Done when:** `/en/about` and `/ar/about` render (Arabic right-to-left, in
  Tajawal) with breadcrumb, heading, and sections; the page head has the
  translated title, canonical, and alternates; `pnpm lint` and `pnpm build`
  pass.

- [x] **2. Contact page.** Add `info.contact` text and
  `app/[lang]/contact/page.tsx` using `InfoPage` plus the contact-email block
  from `getSiteContent()`, with the no-email fallback line. Copy asks customers
  with an order question to include their order number.
  **Done when:** with an email saved in `/admin/settings` both languages show a
  working `mailto:` link that stays left-to-right in Arabic; with none saved
  the fallback line shows and no empty link renders; lint and build pass.

- [x] **3. Terms, Privacy, and Return Policy pages.** Add `info.terms`,
  `info.privacy`, and `info.returns` text and the three route files. Copy
  states only what the app actually does (see Notes for the AI) and the
  answers to the Open questions; nothing about jurisdiction, company identity,
  or refund eligibility is invented.
  **Done when:** all three pages render in both languages with metadata; the
  Return Policy matches the answered refund terms; lint and build pass.

- [x] **4. Navigation, footer, and sitemap.** Add About and Contact to
  `navItems` in `SiteHeader`; add the Company and Legal columns to
  `SiteFooter` (headings and link labels translated; update the stale column
  comment); add the five paths to `app/sitemap.ts`.
  **Done when:** the header shows the two new links with `aria-current="page"`
  on their own pages, the mobile nav still scrolls horizontally without
  overflowing the page, the footer shows Shop, Company, and Legal in both
  languages (mirrored in Arabic), `/sitemap.xml` lists all five pages in both
  languages, and `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Files / areas

- `app/[lang]/about/page.tsx`, `contact/page.tsx`, `terms/page.tsx`,
  `privacy/page.tsx`, `returns/page.tsx` (new). Static segments take precedence
  over the existing `app/[lang]/[...rest]` catch-all.
- `components/info/InfoPage.tsx` (new) - shared layout; reuses `ChevronIcon`
  and the `PANEL` styling used by `components/catalog/StoreListing.tsx`.
- `lib/i18n/dictionaries/en.ts`, `ar.ts` - new `info` block; new `header.about`,
  `header.contact`; new `footer.company`, `footer.legal`, and the three policy
  link labels.
- `components/layout/SiteHeader.tsx`, `components/layout/SiteFooter.tsx`.
- `app/sitemap.ts`.

## Data / contracts

- No database, API, or persisted-data change. Contact reads the existing
  `contactEmail` from `getSiteContent()` (never throws; `null` on failure).
- Dictionary shape per page:
  `{ title: string; description: string; intro: string; sections: { heading: string; paragraphs?: string[]; items?: string[] }[] }`.
  Arabic may differ in section count but uses the same type.
- URLs are unprefixed paths passed through `localizedPath`; metadata `path`
  values are `/about`, `/contact`, `/terms`, `/privacy`, `/returns`.

## Testing

- No new logic-bearing code: pages are static dictionary text, and nav
  matching already has `lib/nav.test.ts`. Gates are `pnpm test`, `pnpm lint`,
  and `pnpm build` (build type-checks the Arabic dictionary against
  `Dictionary`).
- No browser test command exists; Check verifies the pages, header, footer,
  and sitemap in the running app in both languages and at phone width.

## Notes for the AI

- All text renders as React text nodes; no `dangerouslySetInnerHTML`.
- Use logical properties (`ms-`, `me-`, `text-start`) and
  `rtl:-scale-x-100` on the breadcrumb chevron, as `StoreListing` does.
- Facts the Terms and Privacy copy may state, from the repository: payment by
  Stripe Checkout and no card data stored by Abody; account email, name, and a
  scrypt password hash stored for registered customers; cookies for the
  language choice, the cart, and the sign-in session; order and service
  requirement data kept to deliver orders; transactional email sent through
  Resend; downloads available only to buyers of a paid order; a full refund
  ends download access (feature 15b). Do not mention analytics (feature 23 not
  built).
- Mark the legal copy in the review packet as a draft for the owner to review
  before launch.
- Keep heading levels: `<h1>` page title, `<h2>` section headings.

## Resolved questions

1. **Return and refund terms** (answered at implement): refunds are
   case-by-case. There is no automatic right to a refund; customers email the
   contact address with their order number and each request is reviewed. A
   refund ends download access. No time window is promised.
2. **Legal copy source** (answered at implement): draft Terms and Privacy from
   the facts in Notes for the AI for the owner to review before launch; name
   no company, country, or governing law.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":7838,"specSha256":"e7f8f2fec7fd61d370f5da55f1ceda0cd62728e0c31ced8264b1386af0464a19","branch":"refs/heads/feature/information-pages","head":"98552a4ffe30809666dd6cbcb2d5240af0536c0f","baseRef":"refs/heads/main","baseCommit":"98552a4ffe30809666dd6cbcb2d5240af0536c0f","sourceTree":"0cbdaf4660bf80a12a7b508f26a09daff21aadcb","absentOptional":[]} -->
