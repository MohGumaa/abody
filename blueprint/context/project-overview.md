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
different permissions, enforced on the server.

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

In `build-plan.md` order. Items 1 through 4 are shipped; 26 is next. The
headline flow is items 1-2 and 4-7: discover, add to cart, pay with Stripe, and
receive the product.

1. **Product & Service Catalog** (done) - database models and APIs for digital
   products and services.
2. **Product & Service Details** (done) - customer-facing detail pages with
   pricing, descriptions, features, images, and purchase actions.
3. **Multi-Language Support** (done) - English and Arabic customer
   website that every later customer page builds on. Split into:
   - 3a. **Bilingual Routing and Interface** (done) - every customer page under
     `/en` and `/ar`, language picked from the saved choice or the browser
     (English otherwise), minimal header with the language switcher,
     right-to-left layout and Tajawal for Arabic, existing interface text
     translated.
   - 3b. **Bilingual Product Content** (done) - store product and service name,
     descriptions, what's included, and requirements in English and Arabic, and
     show the content that matches the page language.
4. **Shopping Cart** (done) - add, remove, update quantity, and review items
   before checkout, with subtotal and total.
26. **Storefront Design Alignment** - bring the customer site in line with the
    mockups in `prototypes/` in both languages: full header (navigation, sign
    in, cart, trust bar), footer, home page, products and services listing
    pages, and the detail pages. Numbered 26 to keep existing IDs stable; it is
    built after 4 and before 5.
22. **SEO & Social Sharing** - per-page titles and descriptions in both
    languages, Open Graph images, `hreflang` alternates between `/en` and
    `/ar`, canonical URLs, a bilingual sitemap, robots, and product structured
    data. Built after 26 so it covers every public page.
5. **Stripe Checkout** - create Stripe Checkout sessions and handle success,
   cancelled, and failed states.
6. **Stripe Webhooks & Orders** - verify payments through webhooks and create or
   update orders automatically.
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
PostgreSQL with Prisma. `Product` is the only model that exists today (features
1, 2, and 3b), and its shape is locked: the cart, checkout, and admin forms
depend on it. Feature 6 locks `Order` and `OrderItem`. The cart (feature 4) has
no table; see Cart below.

### User

- `id` (string, primary key)
- `name` (string)
- `email` (string, unique)
- password or auth-provider identity (depends on the auth choice, see Open
  questions)
- `role` (enum: `CUSTOMER`, `ADMIN`) - derived from the plan's separate customer
  and admin permissions
- `stripeCustomerId` (string, optional) - Stripe reference
- `createdAt` (datetime)
- has many `Order`

### Product (shipped)

One model for both product types; `type` decides delivery. This is the shape in
`prisma/schema.prisma`.

- `id` (string cuid, primary key)
- `name` (string) - English, as are the other unsuffixed text fields
- `slug` (string, unique) - used in `/<lang>/products/[slug]` and
  `/<lang>/services/[slug]`; one slug for both languages
- `shortDescription` (string)
- `description` (text)
- `priceCents` (integer) - whole US cents; the store currency is USD
- `type` (enum: `DIGITAL_PRODUCT`, `SERVICE`)
- `category` (string, free text, one language only)
- `image` (string, optional) - URL or storage key
- `digitalFile` (string, optional) - private storage key, digital products only;
  never returned in a public response
- `included` (string list) - "What's Included" lines
- `durationDays` (integer, optional) - services only
- `requirements` (text, optional) - services only, what the customer must supply
- `nameAr`, `shortDescriptionAr` (string, optional), `descriptionAr`,
  `requirementsAr` (text, optional), `includedAr` (string list) - Arabic
  content; a missing value falls back to the English field
- `status` (enum: `PUBLISHED`, `UNPUBLISHED`)
- `createdAt`, `updatedAt` (datetime)
- will have many `OrderItem`

> TODO: Stripe product and price identifiers set by the admin are named in the
> plan's admin form but are not stored yet. The admin product form (features 13
> and 14) must also edit the Arabic fields.

### Cart (shipped, no table)

A `cart` browser cookie holds `[productId, quantity]` pairs for anonymous
visitors. It is untrusted input, written only by Server Actions; prices, names,
and availability always come from the current `Product` rows. Digital products
take quantity 1-99; services are fixed at 1. No database cart, account cart, or
merge at login exists.

### Order

- `id` (string, primary key; shown as an order number such as #1001)
- `userId` (string, foreign key to `User`)
- `status` (enum: `PENDING`, `PAID`, `PROCESSING`, `COMPLETED`, `CANCELLED`,
  `REFUNDED`)
- `total` (money, integer cents to match `Product.priceCents`)
- `currency` (string)
- `stripePaymentId` (string) - the plan also names `stripePaymentIntentId`,
  `stripeCheckoutSessionId`, and `paymentStatus` as stored references
- `createdAt` (datetime)
- belongs to `User`; has many `OrderItem`; has many `Service`

### OrderItem

- `id` (string, primary key)
- `orderId` (string, foreign key to `Order`)
- `productId` (string, foreign key to `Product`)
- `price` (money, the price paid at purchase time)
- `quantity` (integer)

### Service

A purchased service being delivered, created from a paid order. This is the
work record, not the catalog entry (that is a `Product` with type `SERVICE`).

- `id` (string, primary key)
- `orderId` (string, foreign key to `Order`)
- `status` (enum: `NEW`, `WAITING_FOR_INFORMATION`, `IN_PROGRESS`, `COMPLETED`,
  `CANCELLED`)
- `requirements` (structured data from the onboarding form, for example business
  name, website, ad account information, campaign requirements, budget, notes)
- `adminNotes` (text)
- `startDate`, `completedDate` (datetime, optional)

### Payments

No local payments table. Stripe is the source of truth; the app stores only the
references listed on `User` and `Order`.

> TODO: the plan's data list has no shapes for discount codes (feature 20),
> service packages (feature 14), managed website content (feature 21),
> analytics events (feature 23), or a signed-in customer's preferred language
> (today the choice lives only in a `lang` cookie).

## Tech stack

Installed today: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4,
PostgreSQL with Prisma 7, Vitest, ESLint, pnpm. The rest is recommended by the
plan and not installed.

- **Next.js + TypeScript** - frontend and backend; server components where
  appropriate; server-side functionality and API routes for products, orders,
  checkout, accounts, Stripe webhooks, and admin operations
- **Tailwind CSS + shadcn/ui** - styling and UI components, responsive
  (shadcn/ui is not installed yet)
- **PostgreSQL + Prisma** - transactional database and ORM
- **Clerk or Auth.js** - authentication with separate customer and admin
  permissions (undecided)
- **Stripe Checkout** - payments in v1, confirmed by webhook
- **Cloudflare R2 or AWS S3** - private object storage for digital files
  (undecided)
- **Transactional email and analytics** - required by features 19 and 23; no
  provider named
- **Translations** - no library; feature 3a shipped typed English and Arabic
  dictionaries in `lib/i18n/` and a root `proxy.ts` for the language redirect

## Monetization

Direct sales: one-off purchases of digital products and services through Stripe
Checkout. Subscriptions, memberships, recurring services, and an affiliate
program are future ideas, not v1.

## UI/UX

Modern, minimal, professional, premium, fast, easy to understand, mobile-first.
Start from the existing Abody brand and modernize it.

- Primary brand and action color: `oklch(59% 0.13 248)`, used for primary
  buttons, links, important states, selected navigation, product CTAs, and
  accents. Do not use it everywhere.
- Pair it with white, very light gray/blue backgrounds, dark text, subtle
  borders, and soft shadows.
- Two languages: English (left-to-right) and Arabic (right-to-left). Layouts,
  directional icons, and navigation mirror in Arabic. Arabic text uses the
  Tajawal font. Prices and order numbers keep the same format in both languages.
  The bilingual Abody logo is used as is.
- A language switch sits in the header on every page, and the choice persists
  through browsing, checkout, and the account. Every customer link, redirect,
  and Stripe return URL must carry the language prefix.
- All customer-facing interface text exists in both languages: navigation,
  buttons, labels, form messages, order and service statuses, and transactional
  emails. Each feature translates the text it introduces.
- Navigation: Home, Products, Services, About, Contact, Login, Cart. The header
  has only the logo, the cart link with its count, and the language switcher
  today; item 26 adds the rest.
- Product detail pages are simple and conversion-focused: image, name, price,
  description, feature list, Add to Cart, a Stripe trust line, What's Included,
  and How It Works. Services replace the download part with onboarding.
- Core flow: Discover, Understand, Purchase, Receive, Manage.
- Design reference: `prototypes/` (untracked) holds the static mockups for the
  agreed look in both languages. Its theme tokens are already ported into
  `app/globals.css`; nothing in the app imports from `prototypes/`.

Routes. Customer pages live under a language prefix, `/en/...` or `/ar/...`.
An unprefixed customer URL redirects to the visitor's language: saved choice,
then browser language, then English. `/api/*` is never prefixed.

- `/<lang>` - landing page: hero, featured products and services, value
  proposition, CTAs, social proof, footer (still the scaffold placeholder)
- `/<lang>/products`, `/<lang>/products/[slug]` - product store and detail
  (detail shipped, listing is item 26)
- `/<lang>/services`, `/<lang>/services/[slug]` - services list and detail
  (detail shipped, listing is item 26)
- `/<lang>/cart` - cart (shipped; checkout button disabled until item 5)
- `/<lang>/checkout`, `/<lang>/success` - checkout, payment success
- `/<lang>/login` - sign in
- `/<lang>/account`, `.../orders`, `.../downloads`, `.../services` - customer
  dashboard (overview, orders, downloads, services, profile, logout)
- `/admin`, `/admin/products`, `/admin/products/new`, `/admin/orders`,
  `/admin/customers`, `/admin/services`, `/admin/settings` - admin dashboard
  (whether it is prefixed depends on the admin language decision below)
- `/api/products`, `/api/products/[slug]` - shipped catalog API; an optional
  `?lang=en|ar` picks the content language (English by default)

## Deployment

> TODO: no deployment target is named. The plan only requires HTTPS in
> production and secure environment variables. `DATABASE_URL` is in use today.
> Expect secrets for Stripe (including the webhook signing secret), auth, file
> storage, and email once those are chosen. A publicly reachable webhook
> endpoint is required for Stripe.

## Open questions

Resolve these in the plans, then re-run `/overview`.

1. **Project plan's language section is out of date.** It still lists four
   decisions as open. The build plan (3a, 3b) has settled three: both languages
   are URL-prefixed (`/en`, `/ar`), English is the default, and product and
   service content is stored in both languages. Section 11's route list is also
   still unprefixed.
2. **Admin dashboard language.** Still undecided. If admin stays in one
   language, feature 12 must exclude `/admin` from the language redirect.
3. **Category language.** Feature 3b shipped Arabic fields for name,
   descriptions, what's included, and requirements. `category` was not in its
   list and stays in one language, so Arabic pages show an untranslated
   category. Neither plan says whether that is intended.
4. **Public pages (mostly resolved).** Item 26 now covers the homepage, the
   store listing pages, the navigation, and the footer, built from the
   prototypes. About and Contact are still named in the navigation but have no
   build-plan item or mockup.
5. **Coupons conflict.** Build-plan item 20 is a discount and coupon system. The
   project plan lists advanced coupons as not required for v1 and a coupon system
   as a future feature.
6. **Duplicate title.** Items 14 and 16 are both "Admin Service Management" with
   different scopes (catalog vs purchased service work).
7. **Authentication comes late.** Orders need a `userId` and downloads must be
   limited to the purchaser, but Customer Authentication is item 8, after
   checkout, orders, and delivery (items 5-7). Guest checkout is not mentioned.
8. **File storage comes late.** Item 7 stores and delivers digital files; private
   storage is item 18. Item 13 (admin file upload) also depends on it.
9. **Security as a late item.** Item 24 protects routes, APIs, files, and
   webhooks, but the plan requires those protections as each feature ships
   (items 6, 7, 12 onward).
10. **Undecided stack choices.** Clerk or Auth.js; Cloudflare R2 or AWS S3; no
    email or analytics provider named; no deployment target.
11. **Service packages.** Item 14 and the service flow mention choosing a package,
    but the data list has no package or pricing-tier shape.
12. **Cart after sign-in.** The shipped cart is an anonymous browser cookie.
    Neither plan says whether it moves to the account or merges at login once
    item 8 lands.
13. **Product reviews.** The detail-page sketch shows a star rating, but no
    review or rating feature or data exists in either plan.
14. **Refunds.** Item 15 includes refunds and `REFUNDED` is an order status, but
    whether refunds are issued from the admin or only reflected from Stripe is
    not stated.
15. **Heading typo.** `project-plan.md` section "9. Stripe Payment Flow" is
    missing its `##` heading marker.
