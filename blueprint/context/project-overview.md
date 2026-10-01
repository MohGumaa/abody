# Abody Digital Ecommerce Platform - Project Overview

<!-- blueprint:source-hash aeb18daa53123a79842f9ce3c454e24e2c41bca00001b34d6874a8b5e67648a1 -->

> A storefront where customers buy Abody's downloadable digital products and
> digital services with Stripe, plus an admin dashboard to run the store.

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

- **Customer (primary)** - browses products and services, adds to cart, pays with
  Stripe, downloads purchased files, submits service requirements, and tracks
  orders and service status from an account.
- **Abody admin (secondary)** - manages products, services, pricing, digital
  files, availability, orders, customers, service work, and website content.

Access tiers: anonymous visitors browse the public store; signed-in customers
reach `/account`; admins reach `/admin`. Customers and admins have different
permissions, enforced on the server.

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

Explicitly not required for v1: affiliate system, complex subscription billing,
multi-vendor marketplace, advanced coupons, loyalty points, complex CRM,
multi-language, advanced reporting, native mobile apps.

## Features

In `build-plan.md` order. The headline flow is items 1-6: discover, add to cart,
pay with Stripe, and receive the product.

1. **Product & Service Catalog** - database models and APIs for digital products
   and services (name, slug, description, price, category, images, files, status).
2. **Product & Service Details** - customer-facing detail pages with pricing,
   descriptions, features, images, and purchase actions.
3. **Shopping Cart** - add, remove, update quantity, and review items before
   checkout, with subtotal and total.
4. **Stripe Checkout** - create Stripe Checkout sessions and handle success,
   cancelled, and failed states.
5. **Stripe Webhooks & Orders** - verify payments through webhooks and create or
   update orders automatically.
6. **Digital Product Delivery** - store files securely and give paying customers
   protected download access.
7. **Customer Authentication** - registration, login, logout, password and
   account management, protected customer routes.
8. **Customer Account Dashboard** - profile, orders, purchased products,
   downloads, and services.
9. **Service Purchase & Onboarding** - post-purchase forms that collect what
   Abody needs to start a service (for example Ads Management).
10. **Customer Service Tracking** - customers view purchased services, submitted
    requirements, status, and updates.
11. **Admin Dashboard** - protected overview of revenue, orders, customers,
    products, active services, and recent orders.
12. **Admin Product Management** - create, edit, publish, unpublish, and delete
    digital products with pricing, images, descriptions, and files.
13. **Admin Service Management** - create and manage service offerings: packages,
    pricing, duration, requirements, availability.
14. **Admin Order Management** - view and manage orders, purchased items, payment
    status, order status, and refunds.
15. **Admin Service Management** - manage purchased service orders: customer
    requirements, notes, progress, completion. (Same title as 13, different
    scope.)
16. **Customer Management** - admins view customers with their orders, purchases,
    downloads, and active services.
17. **Secure File Storage** - private object storage with protected,
    authenticated download URLs.
18. **Email Notifications** - transactional emails for orders, payments,
    downloads, service purchases, and service status updates, to customers and
    admins.
19. **Discount & Coupon System** - admins create, edit, activate, deactivate, and
    apply discount codes.
20. **Website Content Management** - admins manage featured products, homepage
    sections, promotional content, and basic site settings.
21. **SEO & Social Sharing** - metadata, Open Graph images, sitemap, robots,
    structured data, SEO-friendly URLs.
22. **Analytics & Sales Reporting** - track page and product views, add to cart,
    checkout started, purchases, popular products, and revenue.
23. **Security & Access Control** - protect customer and admin routes, APIs,
    database operations, digital files, and webhook endpoints.
24. **Production Testing & Launch** - test complete customer and admin flows,
    payments, webhooks, downloads, emails, permissions, mobile layouts, and the
    production deployment.

## Data model

Derived from project-plan section 7 and the features that use each field. Field
names follow the plan. Types are the intended shape for PostgreSQL with Prisma.
Feature 1 locks `Product`; feature 5 locks `Order` and `OrderItem`. Later
features depend on those shapes.

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

### Product

One model for both product types; `type` decides delivery.

- `id` (string, primary key)
- `name` (string)
- `slug` (string, unique) - used in `/products/[slug]` and `/services/[slug]`
- `shortDescription` (string)
- `description` (text)
- `price` (money)
- `type` (enum: `DIGITAL_PRODUCT`, `SERVICE`)
- `category` (string)
- `image` (string, URL or storage key)
- `digitalFile` (string, private storage key, digital products only)
- `status` (enum: `PUBLISHED`, `UNPUBLISHED`)
- `createdAt`, `updatedAt` (datetime)
- has many `OrderItem`

Named in the plan's features and forms but absent from its data list; settle in
feature 1:

- features or "what's included" list
- service duration (for example 30 days) and customer requirements text, for
  services
- Stripe product and price identifiers set by the admin

> TODO: money representation (integer minor units vs decimal) and whether
> `category` is free text or its own model are not specified.

### Order

- `id` (string, primary key; shown as an order number such as #1001)
- `userId` (string, foreign key to `User`)
- `status` (enum: `PENDING`, `PAID`, `PROCESSING`, `COMPLETED`, `CANCELLED`,
  `REFUNDED`)
- `total` (money)
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

> TODO: the plan's data list has no shapes for discount codes (feature 19),
> service packages (feature 13), managed website content (feature 20), or
> analytics events (feature 22).

## Tech stack

Installed today: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4,
ESLint, pnpm. Everything else below is recommended by the plan and not installed.

- **Next.js + TypeScript** - frontend and backend; server components where
  appropriate; server-side functionality and API routes for products, orders,
  checkout, accounts, Stripe webhooks, and admin operations
- **Tailwind CSS + shadcn/ui** - styling and UI components, responsive
- **PostgreSQL + Prisma** - transactional database and ORM
- **Clerk or Auth.js** - authentication with separate customer and admin
  permissions (undecided)
- **Stripe Checkout** - payments in v1, confirmed by webhook
- **Cloudflare R2 or AWS S3** - private object storage for digital files
  (undecided)
- **Transactional email and analytics** - required by features 18 and 22; no
  provider named

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
- Navigation: Home, Products, Services, About, Contact, Login, Cart.
- Product detail pages are simple and conversion-focused: image, name, price,
  description, feature list, Add to Cart, a Stripe trust line, What's Included,
  and How It Works. Services replace the download part with onboarding.
- Core flow: Discover, Understand, Purchase, Receive, Manage.

Routes:

- `/` - landing page: hero, featured products and services, value proposition,
  CTAs, social proof, footer
- `/products`, `/products/[slug]` - product store and detail
- `/services`, `/services/[slug]` - services list and detail
- `/cart`, `/checkout`, `/success` - cart, checkout, payment success
- `/login` - sign in
- `/account`, `/account/orders`, `/account/downloads`, `/account/services` -
  customer dashboard (overview, orders, downloads, services, profile, logout)
- `/admin`, `/admin/products`, `/admin/products/new`, `/admin/orders`,
  `/admin/customers`, `/admin/services`, `/admin/settings` - admin dashboard

## Deployment

> TODO: no deployment target is named. The plan only requires HTTPS in
> production and secure environment variables. Expect secrets for the database,
> Stripe (including the webhook signing secret), auth, file storage, and email
> once those are chosen. A publicly reachable webhook endpoint is required for
> Stripe.

## Open questions

Resolve these in the plans, then re-run `/overview`.

1. **No build-plan item for the public pages.** The project plan lists the
   homepage, Products page, and Services page as v1 must-haves, and names About
   and Contact in the navigation. The build plan has no item for the homepage,
   the store listing pages, or About and Contact (item 2 covers detail pages
   only; item 20 manages homepage content but does not build it).
2. **Coupons conflict.** Build-plan item 19 is a discount and coupon system. The
   project plan lists advanced coupons as not required for v1 and a coupon system
   as a future feature.
3. **Duplicate title.** Items 13 and 15 are both "Admin Service Management" with
   different scopes (catalog vs purchased service work).
4. **Authentication comes late.** Orders need a `userId` and downloads must be
   limited to the purchaser, but Customer Authentication is item 7, after
   checkout, orders, and delivery (items 4-6). Guest checkout is not mentioned.
5. **File storage comes late.** Item 6 stores and delivers digital files; private
   storage is item 17. Item 12 (admin file upload) also depends on it.
6. **Security as a late item.** Item 23 protects routes, APIs, files, and
   webhooks, but the plan requires those protections as each feature ships
   (items 5, 6, 11 onward).
7. **Undecided stack choices.** Clerk or Auth.js; Cloudflare R2 or AWS S3; no
   email or analytics provider named; no deployment target.
8. **Service packages.** Item 13 and the service flow mention choosing a package,
   but the data list has no package or pricing-tier shape.
9. **Cart storage.** No decision on where the cart lives (browser or database)
   or whether a service can have a quantity above one.
10. **Product reviews.** The detail-page sketch shows a star rating, but no
    review or rating feature or data exists in either plan.
11. **Refunds.** Item 14 includes refunds and `REFUNDED` is an order status, but
    whether refunds are issued from the admin or only reflected from Stripe is
    not stated.
12. **Heading typo.** `project-plan.md` section "9. Stripe Payment Flow" is
    missing its `##` heading marker.
