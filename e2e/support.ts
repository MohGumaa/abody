// Shared browser-test helpers (feature 25a). Test rows go into the DATABASE_URL
// database and are never deleted; every email ends in @example.test.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { expect, test as base, type Page } from "@playwright/test";
import { Pool } from "pg";
import { ar } from "../lib/i18n/dictionaries/ar";
import { en } from "../lib/i18n/dictionaries/en";
import { formatPriceCents } from "../lib/money";
import { hashPassword } from "../lib/password";

export { expect, formatPriceCents };

export type Lang = "en" | "ar";
export const dictionaries = { en, ar } as const;

// The seeded catalog (prisma/seed.ts); the seed runs before every test server.
export const SEED = {
  template: {
    slug: "digital-marketing-template",
    name: "Digital Marketing Template",
    nameAr: "قالب التسويق الرقمي",
    priceCents: 4900,
    category: "Templates",
  },
  guide: {
    slug: "facebook-ads-guide",
    name: "Facebook Ads Guide",
    priceCents: 1900,
    category: "Guides",
  },
  ads: {
    slug: "ads-management",
    name: "Ads Management",
    nameAr: "إدارة الإعلانات",
    priceCents: 29900,
  },
  draft: { name: "Social Media Resources" },
} as const;

let pool: Pool | null = null;

// Test-side reads and inserts. Never delete or update rows a test did not create.
export function database(): Pool {
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    allowExitOnIdle: true,
  });
  return pool;
}

export interface TestUser {
  id: string;
  name: string;
  email: string;
  password: string;
}

export async function createUser(
  options: { role?: "CUSTOMER" | "ADMIN"; name?: string } = {},
): Promise<TestUser> {
  const id = `e2e${randomUUID().replace(/-/g, "")}`;
  const user = {
    id,
    name: options.name ?? "E2E Customer",
    email: `e2e-${randomUUID()}@example.test`,
    password: `pw-${randomUUID()}`,
  };
  await database().query(
    `INSERT INTO "User" (id, name, email, "passwordHash", role) VALUES ($1, $2, $3, $4, $5::"Role")`,
    [user.id, user.name, user.email, await hashPassword(user.password), options.role ?? "CUSTOMER"],
  );
  return user;
}

// Each test gets its own rate-limit client (RATE_LIMIT_IP_HEADER is
// x-e2e-client on the test server), so repeated runs never share a window.
export const test = base.extend({
  extraHTTPHeaders: async ({}, provide) => {
    await provide({ "x-e2e-client": randomUUID() });
  },
});

export async function signIn(page: Page, lang: Lang, user: TestUser) {
  const text = dictionaries[lang].auth;
  await page.goto(`/${lang}/login`);
  await page.getByLabel(text.email, { exact: true }).fill(user.email);
  await page.getByLabel(text.password, { exact: true }).fill(user.password);
  await page.getByRole("button", { name: text.submitSignIn, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${lang}/account`));
}

export async function addToCart(page: Page, lang: Lang, path: string) {
  const text = dictionaries[lang].product;
  await page.goto(`/${lang}${path}`);
  await page.getByRole("button", { name: text.addToCart }).click();
  await expect(page.getByRole("status").filter({ hasText: text.added })).toBeVisible();
}

// Cart -> fake Stripe Checkout page. Returns at the fake page.
export async function startCheckout(page: Page, lang: Lang) {
  await page.goto(`/${lang}/cart`);
  await page.getByRole("button", { name: dictionaries[lang].cart.checkout }).click();
  await expect(page.getByRole("heading", { name: "Fake Stripe Checkout" })).toBeVisible();
}

// Pays on the fake Stripe page and waits for the success page with its order.
export async function payAndConfirm(page: Page, lang: Lang): Promise<string> {
  await page.getByRole("button", { name: "Pay" }).click();
  await expect(page).toHaveURL(new RegExp(`/${lang}/success\\?session_id=cs_test_`));
  const sessionId = new URL(page.url()).searchParams.get("session_id") ?? "";
  await expect(
    page.getByRole("heading", { name: dictionaries[lang].checkoutResult.paid.title }),
  ).toBeVisible();
  return sessionId;
}

export async function orderForSession(sessionId: string) {
  const { rows } = await database().query<{
    id: string;
    number: number;
    status: string;
    totalCents: number;
  }>(
    `SELECT id, number, status, "totalCents" FROM "Order" WHERE "stripeCheckoutSessionId" = $1`,
    [sessionId],
  );
  return rows[0] ?? null;
}

export async function orderStatus(orderId: string): Promise<string | null> {
  const { rows } = await database().query<{ status: string }>(
    `SELECT status FROM "Order" WHERE id = $1`,
    [orderId],
  );
  return rows[0]?.status ?? null;
}

export async function orderItems(orderId: string) {
  const { rows } = await database().query<{ id: string; productId: string }>(
    `SELECT id, "productId" FROM "OrderItem" WHERE "orderId" = $1`,
    [orderId],
  );
  return rows;
}

export async function hasNoHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
}
