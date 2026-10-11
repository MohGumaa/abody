# Abody Digital Ecommerce Platform - Project Overview

<!-- blueprint:source-hash a821fccb2dfaecbea3a0ac11a2defae1513c8d02cb522804777864ff34fc36d1 -->

> A bilingual (English and Arabic) storefront where customers buy Abody's
> downloadable digital products and digital services with Stripe, plus an admin
> dashboard to run the store.

> **Generated file. Don't hand-edit.** Distilled from
> [../project-plan.md](../project-plan.md) and
> [../build-plan.md](../build-plan.md). When the plans change, re-run `/overview`.

## Problem

Abody needs a modern ecommerce platform that replaces and improves its current
website. Customers should be able to discover and buy digital products and
services, pay securely, and receive downloads automatically. The Abody team
should manage products, services, orders, customers, and content from an admin
dashboard instead of handling service customers manually through email.

## Users

- **Customer (primary)** - browses products and services in English or Arabic,
  adds to cart, pays with Stripe, downloads purchased files, submits service
  requirements, and tracks orders and service status from an account.
- **Abody admin (secondary)** - manages products, services, pricing, digital
  files, availability, orders, customers, service work, and website content.

Access tiers, enforced on the server: anonymous visitors browse the store and
can check out as guests; signed-in customers reach `/<lang>/account`; users with
role `ADMIN` reach `/admin`. Anyone else gets a 404 at `/admin`. Admins sign in
through the store login and are promoted from a shell with
`pnpm admin:promote <email>`; no web request grants the role.

## Features

In `build-plan.md` order. Shipped: 1-4, 26, 22, 5-20, 21a. Next: 21b. The
headline flow (discover, cart, pay, receive, manage), the admin tools, coupons,
and featured picks are complete; the remaining items are content, analytics,
hardening, and launch.

1. **Product & Service Catalog** (done) - database models and catalog API.
2. **Product & Service Details** (done) - detail pages with pricing,
   descriptions, features, images, and purchase actions.
3. **Multi-Language Support** (done) - English and Arabic customer website.
   - 3a. **Bilingual Routing and Interface** (done) - every customer page under
     `/en` and `/ar`; language from saved choice, then browser, then English;
     header switcher; right-to-left layout and Tajawal for Arabic.
   - 3b. **Bilingual Product Content** (done) - product and service text in both
     languages.
4. **Shopping Cart** (done) - add, remove, update quantity, review, totals.
26. **Storefront Design Alignment** (done) - customer site matches the
    `prototypes/` mockups in both languages (26a header and footer, 26b listing
    pages, 26c detail pages, 26d home page).
22. **SEO & Social Sharing** (done) - bilingual titles and descriptions, Open
    Graph images, `hreflang`, canonical URLs, sitemap, robots, product JSON-LD.
5. **Stripe Checkout** (done) - Checkout sessions with success, cancelled, and
   failed states.
6. **Stripe Webhooks & Orders** (done) - verified webhooks create and update
   orders.
7. **Digital Product Delivery** (done) - protected downloads for paid orders.
8. **Customer Authentication** (done) - 8a email and password accounts with
   built-in database sessions, guest checkout kept; 8b account settings.
9. **Customer Account Dashboard** (done) - profile, orders, downloads,
   services.
10. **Service Purchase & Onboarding** (done) - post-purchase onboarding forms.
11. **Customer Service Tracking** (done) - customers see service status and
    their submitted requirements.
12. **Admin Dashboard** (done) - revenue, orders, customers, catalog counts,
    active services, recent orders.
13. **Admin Product Management** (done) - create, edit, publish, unpublish, and
    delete digital products, upload their file, edit Arabic content.
14. **Admin Service Management** (done) - create, edit, publish, unpublish,
    and delete service offerings: price, duration, requirements, Arabic
    content. One service is one package; tiers are separate services.
15. **Admin Order Management** (done) - orders, purchased items, payment and
    order status, refunds.
    - 15a. **Order List and Fulfilment** (done) - paged order list and detail
      (customer, items, amounts, payment and order status, Stripe references);
      admins move a paid order between Paid, Processing, and Completed only.
    - 15b. **Refunds** (done) - full refund from the admin via the Stripe Refunds API;
      the verified `charge.refunded` webhook (also for dashboard refunds) marks
      the order Refunded, ending download access.
16. **Admin Service Management** (done) - purchased service work at
    `/admin/service-orders`: requirements, notes, status, start and completion
    dates. (Same title as 14, different scope.)
17. **Customer Management** (done) - customers with their orders, purchases,
    downloads, and active services.
18. **Secure File Storage** (done) - private S3-compatible bucket (R2 or S3)
    when the `S3_*` variables are set, local `storage/` otherwise; downloads
    redirect to a 300-second signed GET URL.
19. **Email Notifications** (done) - transactional email through Resend.
    - 19a. **Order Emails** (done) - bilingual customer order and payment
      confirmation, and an admin new-order email, sent from the verified
      Stripe webhook.
    - 19b. **Service Emails** (done) - customer email on service status change;
      admin email when requirements are submitted.
20. **Discount & Coupon System** (done) - simple percentage codes,
    one per order, applied on the cart and charged through Stripe Checkout.
21. **Website Content Management** - featured products, homepage sections,
    promotional content, basic site settings.
    - 21a. **Featured Picks** (done) - optional featured position on products
      and services orders the home hero card, Featured products row, and
      Services row; newest items fill in when nothing is picked.
    - 21b. **Homepage Sections and Promotion** - bilingual hero and
      call-to-action text, show or hide home sections, one site-wide
      announcement bar (bilingual text, optional link, on/off).
    - 21c. **Site Settings** - `/admin/settings` for the public contact email
      shown in the footer.
27. **Information Pages** - About, Contact, Terms and Conditions, Privacy
    Policy, and Return Policy in English and Arabic; About and Contact in the
    header, all five in the footer.
23. **Analytics & Sales Reporting** - page and product views, add to cart,
    checkout started, purchases, popular products, revenue.
24. **Security & Access Control** - protect routes, APIs, database operations,
    files, and webhook endpoints.
25. **Production Testing & Launch** - end-to-end customer and admin flows,
    payments, downloads, emails, permissions, mobile, deployment.

## Data model

PostgreSQL with Prisma 7 (`prisma/schema.prisma`). Ids are cuid strings. All
models below are shipped; cart, checkout, webhooks, delivery, accounts, and the
admin pages depend on them, so treat their shapes as locked.

### Product

One model for both product types; `type` decides delivery.

- `name`, `shortDescription` (string), `description` (text) - English, as are
  the other unsuffixed text fields
- `slug` (string, unique) - one slug for both languages:
  `/<lang>/products/[slug]` or `/<lang>/services/[slug]`
- `priceCents` (integer) - whole US cents; the store currency is USD
- `type` (enum: `DIGITAL_PRODUCT`, `SERVICE`)
- `category` (string) - the language-neutral key for filters, `?category=`
  URLs, and related items; admins pick an existing one or add a new one
- `image` (string, optional) - `https://` URL or site path
- `digitalFile` (string, optional) - private storage key, the same key in the
  bucket or under `storage/`; digital products only; never selected for a
  public response
- `included` (string list), `durationDays` (int, optional), `requirements`
  (text, optional) - the last two for services
- `nameAr`, `categoryAr`, `shortDescriptionAr`, `descriptionAr`, `includedAr`,
  `requirementsAr` - optional Arabic content; a missing value falls back to
  English
- `featuredRank` (int 1-99, optional, not unique) - home page order from 21a,
  lowest first; ties show the newer item first; null means not featured
- `status` (enum: `PUBLISHED`, `UNPUBLISHED`); a published digital product must
  have a `digitalFile`
- `createdAt`, `updatedAt`; has many `OrderItem`

> TODO: Stripe product and price ids from the plan's admin form are not stored;
> checkout builds prices from `priceCents`.

### Cart (no table)

A `cart` cookie of `[productId, quantity]` pairs, written only by Server
Actions and treated as untrusted; prices and availability always come from
current `Product` rows. Digital products take quantity 1-99, services 1.

### User and Session

- `User`: `name`, `email` (unique, trimmed and lowercased), `passwordHash`
  (scrypt), `role` (enum `CUSTOMER` default, `ADMIN`), `createdAt`; has many
  `Session` and `Order`
- `Session`: `tokenHash` (unique SHA-256 of the cookie token; the raw token is
  never stored), `userId` (cascade delete), `expiresAt`, `createdAt`

### Order

- `number` (integer, unique, from 1001) - shown as #1001
- `userId` (optional, set null on user delete) - set when signed in at
  checkout; guest orders keep only `customerEmail` (from Stripe)
- `status` (enum: `PENDING` default, `PAID`, `PROCESSING`, `COMPLETED`,
  `CANCELLED`, `REFUNDED`); paid, processing, and completed orders keep their
  downloads. Admins may only move between `PAID`, `PROCESSING`, and
  `COMPLETED` (one conditional write); the other three are set by Stripe events
  and refunds. Payment status is derived, not stored: Pending "Awaiting
  payment", Paid/Processing/Completed "Paid", Cancelled "Not paid", Refunded
  "Refunded"
- `totalCents`, `currency` - from the Checkout session
- `stripeCheckoutSessionId` (unique), `stripePaymentIntentId` (optional)
- `createdAt`, `updatedAt`; has many `OrderItem`

### OrderItem

- `orderId` (cascade delete), `productId` (restrict delete, so a product with
  orders cannot be deleted)
- `priceCents` (unit price paid), `quantity`
- has at most one `Service`

### Service

The work record for one paid service order item, created when the customer
first sends onboarding details. The catalog entry is a `Product` of type
`SERVICE`.

- `orderItemId` (unique, cascade delete)
- `status` (enum: `NEW` default, `WAITING_FOR_INFORMATION`, `IN_PROGRESS`,
  `COMPLETED`, `CANCELLED`)
- `requirements` (JSON onboarding answers: business name, website, ad account,
  campaign goals, budget, notes)
- `adminNotes` (text, optional), `startDate`, `completedDate` (optional)
- `createdAt`, `updatedAt`

### Coupon

Shipped by feature 20. Codes are entered on the cart (a `coupon` cookie holding
the normalized code, re-checked on every render and at checkout), one per
order, and a use counts only when the verified webhook marks the order paid.

- `code` (string, unique; uppercase A-Z, 0-9, hyphens; 3-32; fixed after
  creation), `percentOff` (int 1-99)
- `appliesTo` (enum `ALL`, `DIGITAL_PRODUCTS`, `SERVICES`), `active` (bool,
  default false)
- `expiresOn` (date, optional, inclusive UTC), `maxRedemptions` (int, optional)
- `redemptionCount` (int) - paid orders that used it; refunds don't give it back
- `createdAt`, `updatedAt`; has many `Order`
- `Order` gains `couponId` (optional, restrict delete) and `discountCents`
  (int, default 0)

### Payments

No local payments table. Stripe is the source of truth; the app stores only the
references on `Order`.

> TODO: no data shapes yet for homepage content, the announcement bar, and site
> settings (21b, 21c), analytics events
> (23), `User.stripeCustomerId`, or a signed-in customer's preferred language
> (today a `lang` cookie).

## Tech stack

Installed: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4,
shadcn/ui (`components/ui/`, restyled to the theme tokens), PostgreSQL with
Prisma 7, Stripe, Vitest, ESLint, pnpm.

- **Next.js + TypeScript** - server components by default; Server Actions for
  forms; route handlers for the Stripe webhook, file downloads, and admin file
  upload
- **Authentication** - built in (feature 8a): scrypt password hashes and
  database sessions, no auth vendor
- **Payments** - Stripe Checkout, confirmed by the signature-verified webhook
- **File storage** - private S3-compatible bucket (Cloudflare R2 or AWS S3)
  via `@aws-sdk/client-s3` and the presigner when all `S3_*` variables are set;
  the local `storage/` folder when none are; partial config is an error.
  `pnpm storage:upload` copies local files to the bucket
- **Translations** - typed dictionaries in `lib/i18n/` and a root `proxy.ts`
  for the language redirect; no library
- **Email** - Resend over HTTP (`lib/email.ts`); off when `RESEND_API_KEY` and
  `EMAIL_FROM` are unset, error when only one is set
- **Analytics** - required by feature 23; no provider named

Security rules from the plan, applied as each feature ships:

- Never trust the frontend about payment; the verified Stripe webhook is the
  authority. No card or sensitive Stripe data is stored locally.
- Digital files are never public; only buyers of a paid order download them.
- Admin role protection and server-side authorization on every admin page,
  action, and route.
- Input validation, rate limiting where appropriate, HTTPS in production,
  secrets in environment variables.

## Monetization

Direct sales: one-off purchases of digital products and services through Stripe
Checkout. Subscriptions, memberships, recurring services, and an affiliate
program are future ideas. Not v1: affiliate system, complex subscription
billing, multi-vendor marketplace, advanced coupons, loyalty points, complex
CRM, other languages, advanced reporting, native mobile apps.

## UI/UX

Modern, minimal, professional, premium, fast, easy to understand, mobile-first,
built from the existing Abody brand.

- Primary brand and action color `oklch(59% 0.13 248)` for primary buttons,
  links, important states, selected navigation, product CTAs, and accents, used
  sparingly with white, very light gray/blue backgrounds, dark text, subtle
  borders, and soft shadows. Tokens live in `app/globals.css`.
- English (left-to-right) and Arabic (right-to-left). Layouts, directional
  icons, and navigation mirror in Arabic; Arabic uses Tajawal. Prices and order
  numbers keep the same format in both languages. The bilingual logo is used as
  is.
- The language choice persists through browsing, checkout, and the account;
  every customer link, redirect, and Stripe return URL carries the prefix.
- All customer-facing text exists in both languages, including statuses and
  emails. The admin area is English-only.
- Navigation: Home, Products, Services, About, Contact, Login, Cart.
- Detail pages: image, name, price, description, feature list, Add to Cart,
  trust line, What's Included, How It Works; services show onboarding instead
  of downloads.
- Core flow: Discover, Understand, Purchase, Receive, Manage.
- `prototypes/` (untracked) holds static mockups; the app never imports it.

Routes. Customer pages live under `/en/...` or `/ar/...`; an unprefixed customer
URL redirects to the visitor's language. `/admin` and `/api` are never prefixed.

- `/<lang>`, `/<lang>/products[/slug]`, `/<lang>/services[/slug]`,
  `/<lang>/cart` - store (shipped)
- `/<lang>/checkout/return`, `/<lang>/success` - Stripe return and success with
  downloads (shipped)
- `/<lang>/login`, `/<lang>/register` (shipped)
- `/<lang>/account`, `.../orders`, `.../downloads`, `.../services[/itemId]`,
  `.../settings` - customer dashboard (shipped)
- `/<lang>/onboarding/[itemId]` - service onboarding form (shipped)
- `/<lang>/about`, `/contact`, `/terms`, `/privacy`, `/returns` - information
  pages (planned, 27)
- `/admin`, `/admin/products[/new|/[id]]`, `/admin/services[/new|/[id]]`,
  `/admin/orders[?page=N]`, `/admin/orders/[id]`,
  `/admin/service-orders[?page=N]`, `/admin/service-orders/[itemId]`,
  `/admin/customers[?page=N]`, `/admin/customers/[id]` (shipped);
  `/admin/coupons[/new|/[id]]` (shipped); `/admin/settings`
  (planned). `/admin/services` holds the service catalog.
- `/api/products`, `/api/products/[slug]` - catalog API, optional `?lang=en|ar`
- `/api/downloads/[itemId]` - protected download for a paid order item
  (streams locally, 302 to a signed URL in bucket mode)
- `PUT /api/admin/products/[id]/file` - admin file upload (PDF or ZIP, 25 MB)
- `/api/stripe/webhook` - Stripe webhook (signature verified)

## Deployment

> TODO: no deployment target is named. The plan requires HTTPS in production and
> secure environment variables. In use: `DATABASE_URL`, `SITE_URL`,
> `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `S3_BUCKET`, `S3_REGION`,
> `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT` (R2),
> `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL`. The webhook needs
> a public endpoint and production must run `prisma migrate deploy`. With the
> bucket configured, the host needs no persistent disk.

## Open questions

Resolve these in the plans, then re-run `/overview`.

1. **Project plan is behind the build plan.** Its language section still lists
   decisions as open (settled by 3a and 3b: `/en` and `/ar` prefixes, English
   default, bilingual content); section 11's routes are unprefixed; the admin
   dashboard language (English-only in practice) is not recorded.
2. **Authentication choice.** The project plan names Clerk or Auth.js; build
   plan 8a chose built-in email and password with database sessions.
3. **Guest checkout.** Build plan 8a keeps guest checkout and does not attach
   guest orders by email; the project plan never mentions guest checkout.
4. **Information page content.** Item 27 does not say whether the page text is
   written in code or edited by admins (which would need a content table and
   overlap 21b/21c), nor whether Contact has a form or only shows contact
   details. The legal text itself must come from Abody.
5. **Coupons conflict.** Build-plan item 20 is a coupon system; the project plan
   lists advanced coupons as not v1 and coupons as a future feature. The
   feature 20 spec settles it (simple percentage codes in v1, approved
   2026-10-10), but neither plan records that.
6. **Duplicate title.** Items 14 and 16 are both "Admin Service Management".
7. **Image upload.** The plan's admin form shows an image upload; feature 13
   uses an image URL field. Storage (18) shipped without image upload, so no
   item owns it now.
8. **Security as a late item.** Item 24 protects routes, APIs, files, and
   webhooks, but the plan requires those protections as each feature ships.
9. **Undecided providers.** Analytics and the deployment target. Storage (R2
   or S3, chosen by environment) and email (Resend) were settled by 18 and 19
   but are not recorded in the project plan.
10. **Service packages.** Feature 14 shipped "one service is one package"
    (tiers are separate services), but item 14 and project-plan section 13
    ("Choose Package") still read as if packages exist. Record the decision.
11. **Cart after sign-in.** Neither plan says whether the cookie cart moves to
    the account.
12. **Product reviews.** The detail sketch shows a star rating; no review
    feature or data exists.
13. **Payment vs order status.** The project plan lists them as separate
    fields; 15a derives payment status from the single order status. Not
    recorded in the plans.
14. **Heading typo.** Project-plan section "9. Stripe Payment Flow" is missing
    its `##` marker.
