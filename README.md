This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

Production runs on Vercel with a Neon Postgres database, a private R2 or S3
bucket for product files, Resend for email, and Stripe. Vercel's Next.js
defaults (pnpm from the lockfile, `pnpm build`) need no `vercel.json`. Set
environment variables for **Production** only; preview deployments are not
set up.

> Connecting the GitHub repository to Vercel makes every push to `main` a
> production deploy.

### Database (Neon)

Neon gives two connection strings. The app uses the **pooled** one (host
contains `-pooler`) as `DATABASE_URL` on Vercel. Migrations and admin scripts
use the **direct** one, set only in your shell and never committed:

```bash
DATABASE_URL="<direct url>" pnpm db:deploy                 # prisma migrate deploy
DATABASE_URL="<direct url>" pnpm exec prisma migrate status
DATABASE_URL="<direct url>" pnpm admin:promote you@example.com
```

In PowerShell, set it first with `$env:DATABASE_URL = "<direct url>"`. Never run
`pnpm db:seed` against production; it loads development data.

Run `pnpm db:deploy` **before** deploying any commit that adds a migration under
`prisma/migrations/`. The Vercel build never migrates.

### Environment variables (Production)

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled URL |
| `SITE_URL` | The public origin, such as `https://abody.example` (the `*.vercel.app` URL until a domain is added) |
| `STRIPE_SECRET_KEY` | `sk_test_...` first, `sk_live_...` after the smoke test |
| `STRIPE_WEBHOOK_SECRET` | The signing secret of the matching webhook endpoint below |
| `RESEND_API_KEY`, `EMAIL_FROM` | `EMAIL_FROM`'s domain must be verified in Resend |
| `ADMIN_NOTIFICATION_EMAIL` | The inbox for new-order and requirements emails |
| `RATE_LIMIT_IP_HEADER` | `x-real-ip` (set by Vercel, not by clients) |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | The private bucket; R2 uses `S3_REGION=auto` |
| `S3_ENDPOINT` | R2 only: `https://<account-id>.r2.cloudflarestorage.com` |

Never set `STRIPE_API_BASE` in production; it is for the browser tests.

### Bucket

The bucket stays private. Vercel has no persistent disk, so the bucket is
required. Admin file uploads go from the browser straight to the bucket through
a short-lived signed link, so the bucket needs this CORS rule (origin = your
`SITE_URL`):

```json
[
  {
    "AllowedOrigins": ["https://abody.example"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

### Stripe webhook

Add an endpoint at `https://<domain>/api/stripe/webhook` with these events:
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, and `charge.refunded`. Test mode and
live mode each need their own endpoint and signing secret.

### Order of a launch

1. Create the Neon database and run `pnpm db:deploy` with the direct URL.
2. Create the bucket with the CORS rule and verify the Resend sender domain.
3. Create the Vercel project from the GitHub repository, set the Production
   variables with **test** Stripe keys, and add the test-mode webhook.
4. Deploy, register your account on the site, and promote it with
   `pnpm admin:promote`.
5. Smoke test, using a Stripe test card:
   - store pages in `/en` and `/ar`;
   - `robots.txt` and the sitemap use `SITE_URL`;
   - security headers, including HSTS;
   - buy a digital product: the order turns Paid, the emails arrive, and the
     download works;
   - buy a service, submit the onboarding form, and get the requirements email;
   - as admin, create a product and upload a ZIP over 5 MB;
   - change a service's status;
   - fully refund an order, which ends its download.
6. Switch to live: set the live `STRIPE_SECRET_KEY`, add the live-mode webhook
   with the same events, set its `STRIPE_WEBHOOK_SECRET`, and redeploy.
