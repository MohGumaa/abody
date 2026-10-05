# Abody Digital Ecommerce Platform - Project Overview

<!-- blueprint:source-hash 2d9111153909ad733825c2d4a00c9161567b7162c454746a6b6c029f84c110ba -->

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

Access tiers: anonymous visitors browse the public store; signed-in customers
reach the account area; admins reach the admin area. Customers and admins have
different permissions, enforced on the server. Until feature 8, checkout is
anonymous (guest).

## Usage model

The project plan has no usage-model section, so scale, tenancy, availability,
and compliance are not established. Do not assume them. Confirmed constraints:

- Never trust the frontend to decide whether an order was paid. Payment status is
  verified server-side, and the Stripe webhook (signature verified) is the
  authority, not the browser redirect.
- Stripe handles card data; no sensitive card or Stripe payment details are
  stored locally.
- Digital files are not publicly accessible. Only customers who purchased a file
  can download it, through protected URLs.
- Admin role protection and server-side authorization on admin operations.
- Input validation, rate limiting where appropriate, HTTPS in production, and
  secrets kept in environment variables.
- Two languages only: English and Arabic.

Explicitly not required for v1: affiliate system, complex subscription billing,
multi-vendor marketplace, advanced coupons, loyalty points, complex CRM,
languages other than English and Arabic, advanced reporting, native mobile apps.

## Features

In `build-plan.md` order. Shipped: 1-4, 26, 22, 5, 6. Next: 7 (in progress on
its feature branch). The headline flow is items 1-2 and 4-7: discover, add to
cart, pay with Stripe, and receive the product.

1. **Product & Service Catalog** (done) - database models and APIs for digital
   products and services.
2. **Product & Service Details** (done) - customer-facing detail pages with
   pricing, descriptions, features, images, and purchase actions.
3. **Multi-Language Support** (done) - English and Arabic customer website.
   - 3a. **Bilingual Routing and Interface** (done) - every customer page under
     `/en` and `/ar`, language from saved choice, then browser, then English;
     header language switcher; right-to-left layout and Tajawal for Arabic.
   - 3b. **Bilingual Product Content** (done) - product and service name,
     descriptions, what's included, and requirements in both languages.
4. **Shopping Cart** (done) - add, remove, update quantity, and review items,
   with subtotal and total.
26. **Storefront Design Alignment** (done) - the customer site matches the
    `prototypes/` mockups in both languages. Built after 4, before 5.
    - 26a. **Site Header and Footer** (done) - navigation, sign in, cart,
      language switcher, trust bar, footer, page canvas.
    - 26b. **Store Listing Pages** (done) - shared product card, `/products` and
      `/services` with a category filter, related items.
    - 26c. **Product and Service Detail Pages** (done) - buy panel, chips, How it
      works.
    - 26d. **Home Page** (done) - hero, categories, featured products, services,
      value proposition, How it works, social proof, call to action.
22. **SEO & Social Sharing** (done) - bilingual titles and descriptions, Open
    Graph images, `hreflang`, canonical URLs, bilingual sitemap, robots,
    product structured data.
5. **Stripe Checkout** (done) - Stripe Checkout sessions with success,
   cancelled, and failed states.
6. **Stripe Webhooks & Orders** (done) - verified webhooks create and update
   orders.
7. **Digital Product Delivery** - store files securely and give paying customers
   protected download access.
8. **Customer Authentication** - registration, login, logout, password and
   account management, protected customer routes.
9. **Customer Account Dashboard** - profile, orders, purchased products,
   downloads, and services.
10. **Service Purchase & Onboarding** - post-purchase forms that collect what
    Abody needs to start a service (for example Ads Management).
11. **Customer Service Tracking** - customers view purchased services, submitted
    requirements, status, and updates.
12. **Admin Dashboard** - protected overview of revenue, orders, customers,
    products, active services, and recent orders.
13. **Admin Product Management** - create, edit, publish, unpublish, and delete
    digital products with pricing, images, descriptions, and files.
14. **Admin Service Management** - create and manage service offerings: packages,
    pricing, duration, requirements, availability.
15. **Admin Order Management** - view and manage orders, purchased items, payment
    status, order status, and refunds.
16. **Admin Service Management** - manage purchased service orders: customer
    requirements, notes, progress, completion. (Same title as 14, different
    scope.)
17. **Customer Management** - admins view customers with their orders, purchases,
    downloads, and active services.
18. **Secure File Storage** - private object storage with protected,
    authenticated download URLs.
19. **Email Notifications** - transactional emails for orders, payments,
    downloads, service purchases, and service status updates, to customers and
    admins.
20. **Discount & Coupon System** - admins create, edit, activate, deactivate, and
    apply discount codes.
21. **Website Content Management** - admins manage featured products, homepage
    sections, promotional content, and basic site settings.
23. **Analytics & Sales Reporting** - track page and product views, add to cart,
    checkout started, purchases, popular products, and revenue.
24. **Security & Access Control** - protect customer and admin routes, APIs,
    database operations, digital files, and webhook endpoints.
25. **Production Testing & Launch** - test complete customer and admin flows,
    payments, webhooks, downloads, emails, permissions, mobile layouts, and the
    production deployment.

## Data model

Derived from project-plan section 7 and the features that use each field.
PostgreSQL with Prisma (`prisma/schema.prisma`). `Product`, `Order`, and
`OrderItem` are shipped and locked: cart, checkout, webhooks, delivery, and the
admin forms depend on them. `User` and `Service` do not exist yet. The cart has
no table.

### User (feature 8)

- `id` (string, primary key)
- `name` (string)
- `email` (string, unique)
- password or auth-provider identity (depends on the auth choice)
- `role` (enum: `CUSTOMER`, `ADMIN`) - from the plan's separate customer and
  admin permissions
- `stripeCustomerId` (string, optional) - Stripe reference
- `createdAt` (datetime)
- has many `Order`

### Product (shipped)

One model for both product types; `type` decides delivery.

- `id` (string cuid, primary key)
- `name` (string) - English, as are the other unsuffixed text fields
- `slug` (string, unique) - one slug for both languages, used in
  `/<lang>/products/[slug]` and `/<lang>/services/[slug]`
- `shortDescription` (string), `description` (text)
- `priceCents` (integer) - whole US cents; the store currency is USD
- `type` (enum: `DIGITAL_PRODUCT`, `SERVICE`)
- `category` (string, free text, one language only)
- `image` (string, optional) - URL or storage key
- `digitalFile` (string, optional) - private storage key, digital products only;
  never returned in a public response
- `included` (string list) - "What's Included" lines
- `durationDays` (integer, optional), `requirements` (text, optional) - services
- `nameAr`, `shortDescriptionAr` (string, optional), `descriptionAr`,
  `requirementsAr` (text, optional), `includedAr` (string list) - Arabic
  content; a missing value falls back to English
- `status` (enum: `PUBLISHED`, `UNPUBLISHED`)
- `createdAt`, `updatedAt` (datetime)
- has many `OrderItem`

> TODO: Stripe product and price identifiers named in the plan's admin form are
> not stored; checkout builds prices from `priceCents`. The admin product form
> (features 13 and 14) must also edit the Arabic fields.

### Cart (shipped, no table)

A `cart` browser cookie holds `[productId, quantity]` pairs. It is untrusted
input, written only by Server Actions; prices, names, and availability always
come from current `Product` rows. Digital products take quantity 1-99; services
are fixed at 1. No account cart or merge at login exists.

### Order (shipped)

- `id` (string cuid, primary key)
- `number` (integer, unique, autoincrement from 1001) - shown as #1001
- `userId` (string, optional) - linked to `User` in feature 8; null until then
- `customerEmail` (string, optional) - from Stripe; how a guest order reaches an
  account
- `status` (enum: `PENDING`, `PAID`, `PROCESSING`, `COMPLETED`, `CANCELLED`,
  `REFUNDED`; default `PENDING`)
- `totalCents` (integer), `currency` (string) - from the session's amount total
- `stripeCheckoutSessionId` (string, unique), `stripePaymentIntentId` (string,
  optional)
- `createdAt`, `updatedAt` (datetime)
- has many `OrderItem`; will have many `Service`

### OrderItem (shipped)

- `id` (string cuid, primary key)
- `orderId` (foreign key to `Order`, cascade delete)
- `productId` (foreign key to `Product`, restrict delete)
- `priceCents` (integer) - unit price paid, from the Stripe line item
- `quantity` (integer)

### Service (feature 10)

A purchased service being delivered, created from a paid order. This is the
work record, not the catalog entry (a `Product` with type `SERVICE`).

- `id` (string, primary key)
- `orderId` (string, foreign key to `Order`)
- `status` (enum: `NEW`, `WAITING_FOR_INFORMATION`, `IN_PROGRESS`, `COMPLETED`,
  `CANCELLED`)
- `requirements` (structured onboarding data, for example business name,
  website, ad account information, campaign requirements, budget, notes)
- `adminNotes` (text)
- `startDate`, `completedDate` (datetime, optional)

### Payments

No local payments table. Stripe is the source of truth; the app stores only the
references on `Order` (and `User.stripeCustomerId` later).

> TODO: no data shapes yet for discount codes (20), service packages (14),
> managed website content (21), analytics events (23), or a signed-in
> customer's preferred language (today only a `lang` cookie).

## Tech stack

Installed: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4,
PostgreSQL with Prisma 7, Stripe, Vitest, ESLint, pnpm.

- **Next.js + TypeScript** - frontend and backend; server components where
  appropriate; server-side functionality and API routes for products, orders,
  checkout, accounts, Stripe webhooks, and admin operations
- **Tailwind CSS + shadcn/ui** - styling, responsive (shadcn/ui not installed)
- **PostgreSQL + Prisma** - transactional database and ORM
- **Stripe Checkout** - payments in v1, confirmed by webhook
  (`/api/stripe/webhook`)
- **Clerk or Auth.js** - authentication (undecided)
- **Cloudflare R2 or AWS S3** - private object storage (undecided; feature 7
  uses a private local `storage/` folder until feature 18)
- **Transactional email and analytics** - required by features 19 and 23; no
  provider named
- **Translations** - no library; typed dictionaries in `lib/i18n/` and a root
  `proxy.ts` for the language redirect

## Monetization

Direct sales: one-off purchases of digital products and services through Stripe
Checkout. Subscriptions, memberships, recurring services, and an affiliate
program are future ideas, not v1.

## UI/UX

Modern, minimal, professional, premium, fast, easy to understand, mobile-first.
Start from the existing Abody brand and modernize it.

- Primary brand and action color: `oklch(59% 0.13 248)` for primary buttons,
  links, important states, selected navigation, product CTAs, and accents. Not
  everywhere: pair it with white, very light gray/blue backgrounds, dark text,
  subtle borders, and soft shadows.
- English (left-to-right) and Arabic (right-to-left). Layouts, directional
  icons, and navigation mirror in Arabic. Arabic uses Tajawal. Prices and order
  numbers keep the same format in both languages. The bilingual logo is used as
  is.
- The header language switch persists through browsing, checkout, and the
  account. Every customer link, redirect, and Stripe return URL carries the
  language prefix.
- All customer-facing text exists in both languages, including order and
  service statuses and transactional emails. Each feature translates the text it
  introduces.
- Navigation: Home, Products, Services, About, Contact, Login, Cart.
- Detail pages are conversion-focused: image, name, price, description, feature
  list, Add to Cart, Stripe trust line, What's Included, How It Works. Services
  replace the download part with onboarding.
- Core flow: Discover, Understand, Purchase, Receive, Manage.
- Design reference: `prototypes/` (untracked) holds the static mockups. Its
  tokens live in `app/globals.css`; the app never imports from `prototypes/`.

Routes. Customer pages live under `/en/...` or `/ar/...`. An unprefixed customer
URL redirects to the visitor's language. `/api/*` is never prefixed.

- `/<lang>` - home page (shipped)
- `/<lang>/products`, `/<lang>/products/[slug]` - store and detail (shipped)
- `/<lang>/services`, `/<lang>/services/[slug]` - services and detail (shipped)
- `/<lang>/cart` - cart (shipped)
- `/<lang>/checkout`, `/<lang>/success` - checkout start and return, payment
  success (shipped; feature 7 adds downloads to success)
- `/<lang>/login` - sign in (feature 8)
- `/<lang>/account`, `.../orders`, `.../downloads`, `.../services` - customer
  dashboard (overview, orders, downloads, services, profile, logout)
- `/admin`, `/admin/products`, `/admin/products/new`, `/admin/orders`,
  `/admin/customers`, `/admin/services`, `/admin/settings` - admin dashboard
  (prefixing depends on the admin language decision)
- `/api/products`, `/api/products/[slug]` - catalog API; optional `?lang=en|ar`
- `/api/stripe/webhook` - Stripe webhook (signature verified)

## Deployment

> TODO: no deployment target is named. The plan requires HTTPS in production and
> secure environment variables. In use: `DATABASE_URL` and Stripe secrets
> (including the webhook signing secret). Expect auth, file storage, and email
> secrets later. The Stripe webhook needs a public endpoint. Until feature 18,
> the local `storage/` folder needs a host with a persistent disk.

## Open questions

Resolve these in the plans, then re-run `/overview`.

1. **Project plan's language section is out of date.** It still lists four
   decisions as open. The build plan (3a, 3b) settled three: URL prefixes
   `/en` and `/ar`, English default, bilingual product content. Section 11's
   route list is still unprefixed.
2. **Admin dashboard language.** Undecided. If admin stays in one language,
   feature 12 must exclude `/admin` from the language redirect.
3. **Category language.** `category` stays in one language, so Arabic pages show
   an untranslated category. Neither plan says whether that is intended.
4. **About and Contact pages.** Named in the navigation but have no build-plan
   item or mockup.
5. **Coupons conflict.** Build-plan item 20 is a discount and coupon system. The
   project plan lists advanced coupons as not v1 and a coupon system as future.
6. **Duplicate title.** Items 14 and 16 are both "Admin Service Management" with
   different scopes (catalog vs purchased service work).
7. **Guest checkout is not in the plans.** Authentication is item 8, after
   checkout, orders, and delivery, so orders ship as guest orders
   (`userId` null, `customerEmail` kept). The plans never mention guest
   checkout or how guest orders attach to an account.
8. **File storage order.** Item 7 delivers files from a local private folder;
   private object storage is item 18, and item 13 (admin upload) depends on it.
9. **Security as a late item.** Item 24 protects routes, APIs, files, and
   webhooks, but the plan requires those protections as each feature ships.
10. **Undecided stack choices.** Clerk or Auth.js; Cloudflare R2 or AWS S3; no
    email or analytics provider; no deployment target.
11. **Service packages.** Item 14 and the service flow mention choosing a
    package, but the data list has no package or pricing-tier shape.
12. **Cart after sign-in.** The cart is an anonymous cookie. Neither plan says
    whether it moves to the account or merges at login.
13. **Product reviews.** The detail-page sketch shows a star rating, but no
    review or rating feature or data exists in either plan.
14. **Refunds.** Item 15 includes refunds and `REFUNDED` is a status, but
    whether refunds are issued from the admin or only mirrored from Stripe is
    not stated.
15. **Heading typo.** `project-plan.md` section "9. Stripe Payment Flow" is
    missing its `##` heading marker.
