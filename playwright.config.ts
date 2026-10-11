import { defineConfig, devices } from "@playwright/test";

// Browser tests run against a production build on port 3100. The dev server is
// not used: Turbopack's dev client fails to load in headless Chromium ("module
// factory is not available"). Port 3100 keeps `pnpm dev` on 3000 free.
//
// The app uses the DATABASE_URL database in .env and the fake Stripe in
// e2e/fake-stripe.ts (feature 25a). Each run re-seeds (never deletes) and
// leaves its @example.test users and orders behind. Email is off. A server
// already listening on 3100 or 12111 is reused locally, which skips the seed
// and the build, so stop it after code changes.
const PORT = 3100;
const FAKE_STRIPE_PORT = 12111;

// Process env wins over .env in Next.js, so these replace the real keys.
const APP_ENV = {
  SITE_URL: `http://localhost:${PORT}`,
  STRIPE_SECRET_KEY: "sk_test_e2e",
  STRIPE_WEBHOOK_SECRET: "whsec_e2e",
  STRIPE_API_BASE: `http://localhost:${FAKE_STRIPE_PORT}`,
  RATE_LIMIT_IP_HEADER: "x-e2e-client",
  RESEND_API_KEY: "",
  EMAIL_FROM: "",
  S3_BUCKET: "",
  S3_REGION: "",
  S3_ACCESS_KEY_ID: "",
  S3_SECRET_ACCESS_KEY: "",
  S3_ENDPOINT: "",
};

export default defineConfig({
  testDir: "./e2e",
  // Flows sign in, buy, and work as an admin against a remote database, so
  // each test and wait gets more time than Playwright's 30 s and 5 s defaults.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: [
    {
      command: "pnpm exec tsx e2e/fake-stripe.ts",
      url: `http://localhost:${FAKE_STRIPE_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `pnpm db:seed && pnpm build && pnpm start --port ${PORT}`,
      url: `http://localhost:${PORT}/en`,
      env: APP_ENV,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
});
