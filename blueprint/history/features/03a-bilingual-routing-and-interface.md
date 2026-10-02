# Feature: Bilingual Routing and Interface

**From build-plan:** feature 3a
**Build attempt:** 1
**Branch:** feature/bilingual-routing-and-interface
**Status:** verified

## Goal

Make the customer website available in English and Arabic. Every customer page
lives under `/en` or `/ar`, a header on every page lets the visitor switch
language, Arabic pages render right-to-left in the Tajawal font, and all
interface text that exists today is translated. This is the foundation every
later customer page builds on.

Decisions made at spec time (the project plan left them open):

- **URL shape:** both languages are prefixed: `/en/...` and `/ar/...`.
- **First visit:** the browser's language when it is Arabic or English,
  otherwise English.
- **Product content:** stored bilingually in follow-up 3b, not here.
- **Header:** a minimal header (logo and language switcher) is built here
  because no shared header exists yet.

## Design reference

- `prototypes/theme.css` - the agreed tokens. Port them before building UI.
- `prototypes/mockup.css` - header layout (`.site-header`, `.header-main`,
  `.header-actions`, `.btn-ghost`) and the Arabic typography rules (lines 19-21:
  Arabic font, zero letter-spacing and taller line-height on headings).
- `prototypes/product.html` - header markup: logo and the language button
  (globe icon plus the other language's name).
- `prototypes/i18n.js` - approved Arabic wording. Reuse its strings wherever an
  existing interface string matches.

`prototypes/` is currently untracked in Git. It is a reference only; nothing in
the app may import from it.

## In scope

- Two locales, `en` and `ar`, defined once and reused by routing, the layout,
  and translations.
- All customer pages move under `app/[lang]/`. The root layout sets
  `<html lang>` and `dir` (`ltr` for English, `rtl` for Arabic).
- A root `proxy.ts` that redirects any customer URL without a language prefix to
  the same path and query under the visitor's language.
- Language resolution for unprefixed URLs: saved choice cookie, then the
  browser's `Accept-Language`, then English.
- A minimal site header on every customer page: the Abody logo linking to the
  language's home, and the language switcher.
- The switcher goes to the same page in the other language and saves the choice.
- Tajawal for Arabic text, loaded through `next/font/google`; Geist stays for
  English.
- Theme tokens from `prototypes/theme.css` ported into `app/globals.css`.
- Translation dictionaries for both languages and translation of all existing
  interface text: product and service detail pages, the Add to Cart button and
  its note, related items heading, service duration, the error screen, a
  not-found page, the header, and the site title and description.
- Internal links carry the current language prefix.

## Out of scope

- Arabic product and service content (name, descriptions, what's included,
  requirements, category). That is feature 3b. Until then Arabic pages show the
  stored content as is.
- Navigation links, Sign in, Cart, the trust bar, and a footer. Later features
  add each link when its page ships.
- Building or translating the home page. `app/page.tsx` is still the
  create-next-app placeholder and no build-plan item replaces it yet; it only
  moves under `app/[lang]/`.
- Redesigning the product detail page to match `prototypes/product.html`.
- `hreflang` alternates, sitemap, and other SEO metadata (feature 22).
- Translating `/api/*` responses. The API stays unprefixed and language-neutral.
- Transactional emails, order and service status labels, form messages: each is
  translated by the feature that introduces it.
- Any new dependency. Two languages do not need an i18n library or a locale
  negotiation package.
- Storing a language preference on a user record (no accounts exist yet).

## Build loop

`workflow.stepReview` is `feature` and `workflow.checkpointCommits` is
`disabled`: implement every step below in order, run each step's check as you
go, then present one review packet after the last step. No per-step approval
pauses and no checkpoint commits. `/complete` creates the final feature commit.

## Build steps

- [x] **1. Locale core.** Add the locale module with the supported locales, the
  default, the cookie name, a locale type guard, the text direction for a
  locale, the resolver (cookie value and `Accept-Language` header in, locale
  out), and a helper that prefixes a root-relative path with a locale. Pure
  functions only, no Next.js imports.
  **Done when:** `pnpm test` passes with new tests covering the cases listed
  under Testing.

- [x] **2. Localized routing.** Move `app/layout.tsx`, `app/page.tsx`,
  `app/error.tsx`, `app/products/`, and `app/services/` under `app/[lang]/`.
  The root layout sets `lang` and `dir`, declares both locales in
  `generateStaticParams`, and returns 404 for any other `[lang]` value. Add
  `proxy.ts` with a matcher that skips `/api`, `/_next`, and any path with a
  file extension. Update the `PageProps` and `LayoutProps` route strings.
  Check: confirm `app/favicon.ico` is still served with the root layout under a
  dynamic segment; move it only if it is not. Check: confirm what an unmatched
  URL such as `/en/nope` renders. If it does not render the localized not-found
  page inside the layout, add a catch-all page under `app/[lang]/` that calls
  `notFound()` rather than enabling the experimental `globalNotFound` flag.
  **Done when:** on the dev server `/products/<seeded-slug>` redirects (307) to
  `/en/products/<seeded-slug>` with the query string kept, the same request with
  `Accept-Language: ar` redirects to `/ar/...`, both prefixed pages render with
  the right `lang` and `dir` on `<html>`, `/fr/products/<slug>` returns 404,
  `/api/products` responds exactly as before, and `pnpm build` passes.

- [x] **3. Theme tokens and Arabic typography.** Port the color, font, radius,
  shadow, and container tokens from `prototypes/theme.css` into the `@theme`
  block in `app/globals.css`, keeping the token names the app already uses
  (`primary`, `primary-strong`, `surface`, `border`, `muted`). Do not port the
  type-size or spacing scales: they would override Tailwind's defaults and
  silently resize the shipped detail pages. Load Tajawal with
  `next/font/google` (subsets `arabic` and `latin`; weights 400, 500, 700) and
  make it the sans font when the page language is Arabic. Apply the prototype's
  Arabic heading rules (no letter-spacing, taller line-height). Remove the
  `Arial` body font so the theme font applies.
  **Done when:** on `/ar/...` the computed body and heading font is Tajawal with
  normal letter-spacing, on `/en/...` it is Geist, the detail pages look
  unchanged apart from the font and the small token value shifts, and
  `pnpm build` passes.

- [x] **4. Dictionaries and translated interface text.** Add English and Arabic
  dictionaries with one shared type so a key missing in either language fails
  the build. Add a server-side `getDictionary` for the current locale.
  Translate every hardcoded interface string in `ProductDetail`,
  `AddToCartButton`, `RelatedProducts`, the error screen, and the layout
  metadata, and add a translated `not-found` page. Make
  `formatDurationDays` locale-aware. Prefix related-item links with the current
  locale. Mark stored product content with `dir="auto"`.
  **Done when:** `/ar/products/<slug>` and `/ar/services/<slug>` show no English
  interface text (stored product content excepted), the English pages read
  exactly as before, a related-item link on an Arabic page points at `/ar/...`,
  `/ar/products/does-not-exist` shows the Arabic not-found page, and `pnpm test`
  and `pnpm build` pass.

- [x] **5. Header and language switcher.** Add the site header to the root
  layout: the logo linking to `/<lang>` and the switcher from the prototype.
  The switcher is a link to the current path under the other locale and writes
  the choice cookie when activated. Check: the prototype uses
  `public/Logo-0.jpg`; use `public/Logo-0.svg` instead only if it is the same
  artwork. The logo file used is added to Git with this feature; leave the other
  untracked logo files alone.
  **Done when:** every customer page shows the header, activating the switcher
  on `/en/products/<slug>` lands on `/ar/products/<slug>` and back, after
  choosing Arabic a request to an unprefixed URL redirects to `/ar/...` even
  with an English browser, the switcher is reachable and operable by keyboard
  with a visible focus ring, and `pnpm build` passes.

- [x] **6. Right-to-left pass and final checks.** Walk the product page, service
  page, not-found page, and header in both languages at a phone width and a
  desktop width. Replace any physical-direction utility with its logical
  equivalent, and confirm prices read `$299.00` in Arabic.
  **Done when:** nothing overflows, overlaps, or stays left-anchored on Arabic
  pages, the English pages are visually unchanged apart from the new header and
  tokens, and `pnpm test`, `pnpm build`, and `pnpm lint` all pass.

## Files / areas

- `lib/i18n/` (new) - locale config and pure helpers, their test file, the two
  dictionaries, and `getDictionary`. Keep the pure helpers in a module with no
  `next/*` imports so Vitest and `proxy.ts` can both load it.
- `proxy.ts` (new, project root) - the unprefixed-URL redirect. Next.js 16 uses
  `proxy.ts`; `middleware.ts` is deprecated.
- `app/[lang]/layout.tsx`, `page.tsx`, `error.tsx`, `not-found.tsx`,
  `products/[slug]/page.tsx`, `services/[slug]/page.tsx` - moved or new.
- `app/globals.css` - tokens, font variables, Arabic typography. Stays in
  `app/` and is imported by the root layout.
- `app/api/**` - not moved, not changed.
- `components/layout/SiteHeader.tsx`, `components/layout/LanguageSwitcher.tsx`
  (new). Only the switcher is a client component.
- `components/catalog/ProductDetail.tsx`, `AddToCartButton.tsx`,
  `RelatedProducts.tsx` - translated strings, locale-prefixed links,
  `dir="auto"` on stored content.
- `lib/catalog.ts` and `lib/catalog.test.ts` - `formatDurationDays` gains a
  locale. `productPath` stays language-neutral; callers add the prefix.
- `public/Logo-0.jpg` or `public/Logo-0.svg` - tracked with this feature.

## Data / contracts

No database change and no API change.

**Locales.** Exactly `en` and `ar`, lowercase. English is the default. `en` is
`ltr`, `ar` is `rtl`.

**URLs.** Every customer page is `/<locale>/<path>`: `/en`, `/ar`,
`/<locale>/products/[slug]`, `/<locale>/services/[slug]`. A locale in the URL
always wins over the cookie and the browser. `/api/*`, `/_next/*`, and files
with an extension are never prefixed or redirected. An unsupported first segment
is not a locale: `/fr/x` is treated as an unprefixed path, redirected to
`/<locale>/fr/x`, and ends as a 404.

**Redirect.** Unprefixed customer URLs get a `307` to
`/<locale><pathname><search>`. It is temporary because the target depends on the
visitor.

**Language resolution for unprefixed URLs**, in order:

1. The choice cookie, when its value is exactly `en` or `ar`.
2. `Accept-Language`: among entries whose primary subtag is `en` or `ar`
   (so `ar-SA` and `en-GB` count), the one with the highest `q` wins; a tie goes
   to the one listed first. Entries with `q=0` are ignored.
3. English.

A missing, empty, or malformed cookie or header never throws; resolution falls
through to the next rule.

**Choice cookie.** Name `lang`, value `en` or `ar`, `Path=/`,
`Max-Age` one year, `SameSite=Lax`. It is written in the browser by the
switcher, so it is not `HttpOnly`. It holds no sensitive data and is only ever
read through the allowlist above. Visiting a prefixed URL does not write it;
only using the switcher does.

**Dictionaries.** One TypeScript module per language sharing one type. The
English module defines the shape. Dictionaries are read on the server; client
components receive only the strings they render.

**Formatting.** Prices keep `formatPriceCents` unchanged (`$299.00`, `en-US`)
in both languages. Service duration uses the platform's
`Intl.NumberFormat` unit formatting (`unit: "day"`, long display) for the page
locale, with Latin digits in Arabic (`ar-u-nu-latn`). English output stays
`1 day` and `30 days`.

**Rendering stored content.** Product name, descriptions, included lines,
requirements, and category still render as escaped React text, never as HTML.
They get `dir="auto"` so English content inside an Arabic page keeps correct
alignment and punctuation.

**Switcher.** A real link, so it works without JavaScript (the cookie is then
simply not saved). Its label is the other language's own name: `العربية` on
English pages, `English` on Arabic pages. It carries `lang` and `hreflang` for
the target language. It preserves the path. It does not preserve the query
string; no page uses one today.

## Testing

`pnpm test` is a gate for the logic in steps 1 and 4. Tests live next to the
source.

- Locale guard: accepts `en` and `ar`; rejects `EN`, `fr`, an empty string.
- Resolver: valid cookie wins over the header; invalid cookie is ignored;
  `ar-SA,ar;q=0.9,en;q=0.8` gives `ar`; `en-GB,en;q=0.9` gives `en`;
  `fr-FR,fr;q=0.9,ar;q=0.5` gives `ar`; `fr,de` gives `en`; `ar;q=0,en;q=0.1`
  gives `en`; missing, empty, and malformed headers give `en`.
- Path prefixing: `/` becomes `/ar`; `/products/x` becomes `/ar/products/x`.
- Prefix detection used by the proxy: `/en`, `/ar/products/x` are prefixed;
  `/`, `/products/x`, `/enx`, `/arabic` are not.
- `formatDurationDays`: English `1 day` and `30 days` exactly. For Arabic assert
  only that the result contains Arabic script, that `30` appears in Latin
  digits, and that no Arabic-Indic digits appear. Exact Arabic wording comes
  from the runtime's CLDR data and must not be hardcoded.

Not unit tested: `proxy.ts` itself, the layout, components, and visual
right-to-left correctness. No `Browser tests` command is declared, so no browser
harness is added. Those are verified on the dev server during `/check`, and by
`pnpm build` and `pnpm lint`. Nothing in this spec has been run yet.

## Notes for the AI

- Read `node_modules/next/dist/docs/01-app/02-guides/internationalization.md`,
  the `proxy.md` and `layout.md` file-convention docs, and the
  `next-root-params.md` function doc before writing routing code.
- Prefer the `lang` getter from `next/root-params` inside `getDictionary` so
  server components do not prop-drill the locale. Its types are generated by
  `next dev` or `next build`. If the getter cannot be used somewhere (it does
  not work in client components, Server Actions, or route handlers), pass the
  locale from `params` instead.
- `app/[lang]/error.tsx` is a client component and cannot call
  `getDictionary`. Read the locale with `useParams` and import only the error
  strings, not whole dictionaries.
- Do not read `cookies()` or `headers()` in layouts or pages. The locale comes
  from the URL; only `proxy.ts` looks at the cookie and the header.
- Tajawal has no 600 weight. Existing `font-semibold` text falls to 700 in
  Arabic through normal font matching; do not add synthetic weights.
- `tracking-tight` on headings breaks Arabic letter joining. The Arabic rule in
  `globals.css` must reset it.
- From now on every customer component uses logical utilities (`ms-`, `me-`,
  `ps-`, `pe-`, `start-`, `end-`, `text-start`, `text-end`). An icon that points
  in a direction is mirrored in Arabic; check marks, locks, and logos are not.
- New Arabic strings that are not in `prototypes/i18n.js` (the cart note, error
  screen, not-found page, site description) are first drafts. List them in the
  review packet so a native speaker can approve the wording.
- Later features must build customer links, redirects, and Stripe return URLs
  with the locale prefix so the choice survives checkout and the account.
- No em dashes, en dashes, or ellipsis characters in code comments or copy.
- The project plan's language section still lists these decisions as open, and
  the overview repeats that. Do not edit either from `/implement`; the user
  records the decisions in the plan and re-runs `/overview`.

## Open questions

- **Admin dashboard language (not blocking).** Whether `/admin` is translated or
  stays in one language is still undecided. No admin page exists, so nothing
  here depends on it. Feature 12 must decide, and if admin stays single-language
  it adds `/admin` to the paths the proxy leaves unprefixed.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":16494,"specSha256":"55617e32bfc8cfea9dcae78ab2b7ee55a35e1f9c73a7e3e78caa6b7a41f40ae0","branch":"refs/heads/feature/bilingual-routing-and-interface","head":"24b7cb0e01a009cf3bd5537e0c22dd136e899ec5","baseRef":"refs/heads/main","baseCommit":"24b7cb0e01a009cf3bd5537e0c22dd136e899ec5","sourceTree":"8679a85ade7341be031f0a00352aa6a62e0bffb6","absentOptional":[]} -->
