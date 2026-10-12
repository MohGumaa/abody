# Abody Digital Ecommerce Platform - Project Overview

<!-- blueprint:source-hash a3247ffde4b657bfbf16e210c4a00ee2b31e8b086b9813e0519c57a8c1d135a8 -->

> A bilingual (English and Arabic) storefront where customers buy Abody's
> downloadable digital products and digital services with Stripe, plus an admin
> dashboard to run the store.

> **Generated file. Don't hand-edit.** Distilled from
> [../project-plan.md](../project-plan.md) and
> [../build-plan.md](../build-plan.md). When the plans change, re-run `/overview`.

## Problem

Abody needs a modern ecommerce platform that replaces and improves its current
website. Customers discover and buy digital products and services, pay
securely, and receive downloads automatically. The Abody team manages products,
services, orders, customers, and content from an admin dashboard instead of
handling service customers manually through email.

## Users

- **Customer (primary)** - browses in English or Arabic, adds to cart, pays
  with Stripe, downloads purchased files, submits service requirements, and
  tracks orders and service status from an account.
- **Abody admin (secondary)** - manages products, services, pricing, files,
  availability, orders, customers, service work, and website content.

Access tiers, enforced on the server: anonymous visitors browse and can check
out as guests; signed-in customers reach `/<lang>/account`; users with role
`ADMIN` reach `/admin` (everyone else gets a 404 there). Admins sign in through
the store login and are promoted from a shell with `pnpm admin:promote <email>`;
no web request grants the role.

## Features

In `build-plan.md` order. Every item is shipped except **25b, Production
Deployment**, which is next and last.

1. **Product & Service Catalog** (done) - models and catalog API.
2. **Product & Service Details** (done) - detail pages with purchase actions.
3. **Multi-Language Support** (done) - 3a every customer page under `/en` and
   `/ar` (saved choice, then browser, then English), header switcher, RTL and
   Tajawal for Arabic; 3b bilingual product and service content.
4. **Shopping Cart** (done) - add, remove, update quantity, totals.
26. **Storefront Design Alignment** (done) - matches `prototypes/` mockups:
    26a header and footer, 26b listings, 26c detail pages, 26d home page.
22. **SEO & Social Sharing** (done) - bilingual titles and descriptions, OG
    images, `hreflang`, canonicals, sitemap, robots, product JSON-LD.
5. **Stripe Checkout** (done) - success, cancelled, and failed states.
6. **Stripe Webhooks & Orders** (done) - verified webhooks create orders.
7. **Digital Product Delivery** (done) - protected downloads for paid orders.
8. **Customer Authentication** (done) - 8a email and password with database
   sessions, guest checkout kept; 8b account settings.
9. **Customer Account Dashboard** (done) - profile, orders, downloads, services.
10. **Service Purchase & Onboarding** (done) - post-purchase onboarding forms.
11. **Customer Service Tracking** (done) - status and submitted requirements.
12. **Admin Dashboard** (done) - revenue, orders, customers, counts, recent
    orders.
13. **Admin Product Management** (done) - CRUD, publish, file upload, Arabic
    content for digital products.
14. **Admin Service Management** (done) - CRUD for service offerings; one
    service is one package, tiers are separate services.
15. **Admin Order Management** (done) - 15a order list and detail, admins move
    paid orders between Paid, Processing, Completed; 15b full refunds via the
    Stripe Refunds API and the verified `charge.refunded` webhook.
16. **Admin Service Management** (done) - service work at
    `/admin/service-orders`: requirements, notes, status, dates.
17. **Customer Management** (done) - customers with orders and services.
18. **Secure File Storage** (done) - private S3-compatible bucket or local
    `storage/`; downloads redirect to a 300-second signed URL.
19. **Email Notifications** (done) - Resend: 19a bilingual order confirmation
    and admin new-order email from the webhook; 19b service status and
    requirements-submitted emails.
20. **Discount & Coupon System** (done) - simple percentage codes, one per
    order.
21. **Website Content Management** (done) - 21a featured positions for the
    home page; 21b `/admin/content` for bilingual hero and CTA text, home
    section toggles, and one announcement bar; 21c `/admin/settings` for the
    footer contact email.
27. **Information Pages** (done) - static bilingual About, Contact, Terms,
    Privacy, Returns from the dictionaries; Contact shows the settings email.
23. **Analytics & Sales Reporting** (done) - first-party, counts-only events
    and an admin report at `/admin/analytics` (7, 30, or 90 days).
24. **Security & Access Control** (done) - 24a access-control test sweep; 24b
    database rate limits on registration, coupon entry, and the beacon; 24c
    security headers (no CSP).
25. **Production Testing & Launch** - 25a (done) Playwright end-to-end tests of
    the main customer and admin flows in both languages and at phone width,
    Stripe stubbed at the server boundary; 25b (next) deployment to Vercel with
    migrations, live webhook, bucket, `RATE_LIMIT_IP_HEADER`, and a smoke test.

## Data model

PostgreSQL with Prisma 7 (`prisma/schema.prisma`). Ids are cuid strings unless
noted. All models are shipped and depended on; treat their shapes as locked.

### Product

One model for both types; `type` decides delivery.

- `name`, `shortDescription`, `description` (text) - English, as are the other
  unsuffixed text fields
- `slug` (unique) - shared by both languages
- `priceCents` (int) - whole US cents; store currency is USD
- `type` (enum `DIGITAL_PRODUCT`, `SERVICE`), `status` (enum `PUBLISHED`,
  `UNPUBLISHED`); a published digital product must have a `digitalFile`
- `category` (string) - language-neutral key for filters and related items
- `image` (optional) - `https://` URL or site path
- `digitalFile` (optional) - private storage key; never in a public response
- `included` (string list), `durationDays` (int, optional), `requirements`
  (text, optional) - the last two for services
- `nameAr`, `categoryAr`, `shortDescriptionAr`, `descriptionAr`, `includedAr`,
  `requirementsAr` - optional; missing Arabic falls back to English
- `featuredRank` (int 1-99, optional) - home order, lowest first, newer wins ties
- `createdAt`, `updatedAt`; has many `OrderItem` and `AnalyticsEvent`

> TODO: Stripe product and price ids from the plan's admin form are not stored;
> checkout builds prices from `priceCents`.

### Cart (no table)

A `cart` cookie of `[productId, quantity]` pairs, written only by Server
Actions and treated as untrusted; prices and availability come from current
`Product` rows. Digital products take quantity 1-99, services 1. A `coupon`
cookie holds the applied code.

### User and Session

- `User`: `name`, `email` (unique, lowercased), `passwordHash` (scrypt), `role`
  (enum `CUSTOMER` default, `ADMIN`), `createdAt`; has many `Session`, `Order`
- `Session`: `tokenHash` (unique SHA-256 of the cookie token), `userId`
  (cascade), `expiresAt`, `createdAt`

### Order

- `number` (int, unique, from 1001) - shown as #1001
- `userId` (optional, set null) - set when signed in at checkout; guest orders
  keep only `customerEmail` from Stripe
- `status` (enum `PENDING` default, `PAID`, `PROCESSING`, `COMPLETED`,
  `CANCELLED`, `REFUNDED`). Paid, processing, and completed keep downloads.
  Admins move only between `PAID`, `PROCESSING`, `COMPLETED`; the rest are set
  by Stripe events and refunds. Payment status is derived from this field
- `totalCents`, `currency`, `discountCents` (int, default 0), `couponId`
  (optional, restrict delete)
- `stripeCheckoutSessionId` (unique), `stripePaymentIntentId` (optional)
- `createdAt`, `updatedAt`; has many `OrderItem`

### OrderItem

`orderId` (cascade), `productId` (restrict, so sold products can't be deleted),
`priceCents` (discounted unit price paid), `quantity`; at most one `Service`.

### Service

Work record for one paid service item, created at first onboarding submit.

- `orderItemId` (unique, cascade)
- `status` (enum `NEW` default, `WAITING_FOR_INFORMATION`, `IN_PROGRESS`,
  `COMPLETED`, `CANCELLED`)
- `requirements` (JSON onboarding answers), `adminNotes` (optional),
  `startDate`, `completedDate` (optional), `createdAt`, `updatedAt`

### Coupon

- `code` (unique; A-Z, 0-9, hyphens; 3-32; fixed), `percentOff` (int 1-99)
- `appliesTo` (enum `ALL`, `DIGITAL_PRODUCTS`, `SERVICES`), `active` (bool,
  default false), `expiresOn` (date, optional), `maxRedemptions` (optional)
- `redemptionCount` - counted when the webhook marks the order paid; refunds
  don't return it. `createdAt`, `updatedAt`; has many `Order`

### SiteContent

One row, `id` 1 (int); no row means built-in text. Written only by the admin
save action (upsert, last save wins).

- Hero `heroEyebrow`, `heroTitle`, `heroLead` and CTA `ctaTitle`, `ctaBody`,
  `ctaAction`, each with an `...Ar` twin; optional, blank shows the built-in
  text for that language
- `showCategories`, `showFeatured`, `showServices`, `showValues`,
  `showHowItWorks`, `showCta` (bool, default true); the hero always shows
- `announcementEnabled` (default false), `announcementText`,
  `announcementTextAr` (both required when on), `announcementLink` (store path
  without language, or `https://` URL)
- `contactEmail` (optional, lowercased) - footer and Contact page
- `updatedAt`

### AnalyticsEvent

Counts only; never a visitor, user, session, IP, or cookie value.

- `type` (enum `PAGE_VIEW`, `ADD_TO_CART`, `CHECKOUT_STARTED`)
- `path` (optional) - page views only, validated `/<en|ar>/...` path
- `productId` (optional, set null) - detail-page views and add to cart
- `createdAt`; purchases and revenue come from paid `Order` rows

### RateLimit

Fixed-window counters: `key` (id, SHA-256 of `<action>:<client>`), `count`,
`resetAt`. Registration 5/hour, coupon apply 10/15 min, beacon 120/min per
client. Sign-in keeps its own limiter.

### Payments

No local payments table. Stripe is the source of truth; `Order` holds the
references.

> TODO: no `User.stripeCustomerId`, and a signed-in customer's language is only
> the `lang` cookie.

## Tech stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui
(`components/ui/`, restyled to theme tokens), PostgreSQL with Prisma 7, Stripe,
Vitest, Playwright (browser tests with a fake Stripe), ESLint, pnpm.

- **Next.js** - server components by default; Server Actions for forms; route
  handlers for the webhook, downloads, admin file upload, and analytics beacon
- **Auth** - built in: scrypt hashes and database sessions, no vendor
- **Payments** - Stripe Checkout, confirmed by the signature-verified webhook
- **Storage** - private S3-compatible bucket (R2 or S3) via `@aws-sdk/client-s3`
  when all `S3_*` vars are set, local `storage/` when none are, error when
  partial; `pnpm storage:upload` copies local files up
- **Translations** - typed dictionaries in `lib/i18n/`, root `proxy.ts` for the
  language redirect; no library
- **Email** - Resend over HTTP (`lib/email.ts`); off when `RESEND_API_KEY` and
  `EMAIL_FROM` are unset, error when only one is set
- **Analytics** - first-party client beacon to `POST /api/analytics` plus
  server-side cart and checkout events; no third-party script
- **Security** - verified webhook as payment authority, no card data stored,
  buyers-only file access, `requireAdmin()` on every admin page, action, and
  route, input validation, rate limits, HSTS (production), `nosniff`, frame
  blocking, `Referrer-Policy`, `Permissions-Policy`; no CSP yet

## Monetization

One-off purchases of digital products and services through Stripe Checkout,
with simple percentage coupons. Future: subscriptions, memberships, recurring
services, affiliates. Not v1: affiliate system, complex subscription billing,
multi-vendor, advanced coupons, loyalty points, complex CRM, other languages,
advanced reporting, native apps.

## UI/UX

Modern, minimal, professional, premium, fast, mobile-first, built from the
existing Abody brand.

- Brand color `oklch(59% 0.13 248)` for primary buttons, links, important
  states, selected nav, CTAs, and accents, used sparingly with white, light
  gray/blue backgrounds, dark text, subtle borders, soft shadows. Tokens live in
  `app/globals.css`.
- English (LTR) and Arabic (RTL, Tajawal); layouts, directional icons, and
  navigation mirror. Prices and order numbers keep one format. Bilingual logo
  used as is.
- Language persists through browsing, checkout, and account; every customer
  link, redirect, and Stripe return URL carries the prefix. All customer text,
  statuses, and emails exist in both languages. The admin is English-only.
- Navigation: Home, Products, Services, About, Contact, Login, Cart. Footer:
  Shop, Company, Legal columns.
- Core flow: Discover, Understand, Purchase, Receive, Manage.
- `prototypes/` (untracked) holds static mockups; the app never imports it.

Routes. Customer pages live under `/en` or `/ar`; unprefixed customer URLs
redirect. `/admin` and `/api` are never prefixed.

- `/<lang>`, `/products[/slug]`, `/services[/slug]`, `/cart`
- `/<lang>/checkout/return`, `/success` - Stripe return and downloads
- `/<lang>/login`, `/register`, `/account`, `.../orders`, `.../downloads`,
  `.../services[/itemId]`, `.../settings`
- `/<lang>/onboarding/[itemId]` - service onboarding form
- `/<lang>/about`, `/contact`, `/terms`, `/privacy`, `/returns`
- `/admin`, `/admin/analytics[?range=7|30|90]`, `/admin/products[/new|/[id]]`,
  `/admin/services[/new|/[id]]` (catalog), `/admin/orders[/[id]]`,
  `/admin/service-orders[/[itemId]]`, `/admin/customers[/[id]]`,
  `/admin/coupons[/new|/[id]]`, `/admin/content`, `/admin/settings`
- `/api/products[/[slug]]` (`?lang=en|ar`), `/api/downloads/[itemId]`,
  `PUT /api/admin/products/[id]/file` (PDF or ZIP, 25 MB),
  `POST /api/analytics`, `/api/stripe/webhook`

## Deployment

Target: Vercel (build-plan 25b), so the file bucket is required (no persistent
disk) and Postgres is external. The deploy itself needs a separate yes.

> TODO: the database provider and domain are not named. The plan requires
> HTTPS and secure environment variables. In use: `DATABASE_URL`, `SITE_URL`,
> `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`,
> `ADMIN_NOTIFICATION_EMAIL`, `RATE_LIMIT_IP_HEADER` (must be a header the host
> sets, not the client), `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`,
> `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT` (R2). The webhook needs a public
> endpoint; production runs `prisma migrate deploy`.

## Open questions

Plan-level gaps; resolve in the plans, then re-run `/overview`.

1. **Project plan is behind shipped decisions.** Not recorded there: `/en` and
   `/ar` prefixes with English default and bilingual content (its language
   section still lists these as open, and section 11 routes are unprefixed);
   English-only admin; built-in auth instead of Clerk or Auth.js; guest
   checkout; R2/S3 storage and Resend email; first-party counts-only analytics;
   one service per package (section 13 still says "Choose Package"); payment
   status derived from order status (the plan lists two fields); static
   dictionary text for information pages with no contact form.
2. **Coupons conflict.** Build-plan 20 shipped simple percentage codes; the
   project plan lists coupons as future and advanced coupons as not v1.
3. **Duplicate title.** Items 14 and 16 are both "Admin Service Management".
4. **Image upload.** The plan's admin form shows an image upload; products use
   an image URL field and no item owns upload.
5. **Cart after sign-in.** Neither plan says whether the cookie cart moves to
   the account.
6. **Product reviews.** The detail sketch shows a star rating; no review
   feature or data exists.
7. **Deployment.** Vercel is chosen in build-plan 25b but not recorded in the
   project plan; the Postgres provider, domain, and production
   `RATE_LIMIT_IP_HEADER` are open.
8. **Legal copy.** Terms, Privacy, and Returns text is a draft for Abody to
   review before launch; Privacy predates analytics (feature 23).
9. **Heading typo.** Project-plan "9. Stripe Payment Flow" lacks its `##`.
