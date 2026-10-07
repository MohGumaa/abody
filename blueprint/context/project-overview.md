# Abody Digital Ecommerce Platform - Project Overview

<!-- blueprint:source-hash 68384fc5aca46e709bf3bd2f49b31f74fb3722119a41537096769deba783410f -->

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

In `build-plan.md` order. Shipped: 1-4, 26, 22, 5-14, 15a. Next: 15b. The headline
flow (discover, cart, pay, receive, manage) is complete; the remaining items
are admin tools, storage, email, content, analytics, hardening, and launch.

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
15. **Admin Order Management** - orders, purchased items, payment and order
    status, refunds.
    - 15a. **Order List and Fulfilment** (done) - paged order list and detail
      (customer, items, amounts, payment and order status, Stripe references);
      admins move a paid order between Paid, Processing, and Completed only.
    - 15b. **Refunds** - full refund from the admin via the Stripe Refunds API;
      the verified `charge.refunded` webhook (also for dashboard refunds) marks
      the order Refunded, ending download access.
16. **Admin Service Management** - purchased service work: requirements, notes,
    progress, completion. (Same title as 14, different scope.)
17. **Customer Management** - customers with their orders, purchases,
    downloads, and active services.
18. **Secure File Storage** - private object storage with protected,
    authenticated download URLs.
19. **Email Notifications** - transactional emails to customers and admins.
20. **Discount & Coupon System** - admins create, edit, activate, deactivate,
    and apply discount codes.
21. **Website Content Management** - featured products, homepage sections,
    promotional content, basic site settings.
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
- `digitalFile` (string, optional) - private storage key under `storage/`,
  digital products only; never selected for a public response
- `included` (string list), `durationDays` (int, optional), `requirements`
  (text, optional) - the last two for services
- `nameAr`, `categoryAr`, `shortDescriptionAr`, `descriptionAr`, `includedAr`,
  `requirementsAr` - optional Arabic content; a missing value falls back to
  English
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

### Payments

No local payments table. Stripe is the source of truth; the app stores only the
references on `Order`.

> TODO: no data shapes yet for discount codes (20),
> managed website content (21), analytics events (23), `User.stripeCustomerId`,
> or a signed-in customer's preferred language (today a `lang` cookie).

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
- **File storage** - private local `storage/` folder (features 7 and 13) until
  feature 18 moves files to private object storage (Cloudflare R2 or AWS S3,
  undecided)
- **Translations** - typed dictionaries in `lib/i18n/` and a root `proxy.ts`
  for the language redirect; no library
- **Email and analytics** - required by features 19 and 23; no provider named

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
- `/admin`, `/admin/products[/new|/[id]]`, `/admin/services[/new|/[id]]`,
  `/admin/orders[?page=N]`, `/admin/orders/[id]` (shipped); `/admin/customers`,
  `/admin/settings` (planned). Service work (16) still needs an admin route;
  `/admin/services` now holds the service catalog.
- `/api/products`, `/api/products/[slug]` - catalog API, optional `?lang=en|ar`
- `/api/downloads/[itemId]` - protected download for a paid order item
- `PUT /api/admin/products/[id]/file` - admin file upload (PDF or ZIP, 25 MB)
- `/api/stripe/webhook` - Stripe webhook (signature verified)

## Deployment

> TODO: no deployment target is named. The plan requires HTTPS in production and
> secure environment variables. In use: `DATABASE_URL`, `SITE_URL`,
> `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. The webhook needs a public
> endpoint, production must run `prisma migrate deploy`, and until feature 18
> the local `storage/` folder needs a host with a persistent disk.

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
4. **About and Contact pages.** In the navigation, but no build-plan item or
   mockup.
5. **Coupons conflict.** Build-plan item 20 is a coupon system; the project plan
   lists advanced coupons as not v1 and coupons as a future feature.
6. **Duplicate title.** Items 14 and 16 are both "Admin Service Management".
7. **Image upload.** The plan's admin form shows an image upload; feature 13
   uses an image URL field. Uploading images waits for storage (18).
8. **Security as a late item.** Item 24 protects routes, APIs, files, and
   webhooks, but the plan requires those protections as each feature ships.
9. **Undecided providers.** Object storage (R2 or S3), email, analytics, and the
   deployment target.
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
