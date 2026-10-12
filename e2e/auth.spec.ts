import { randomUUID } from "node:crypto";
import { hashResetToken } from "../lib/password-reset";
import { createUser, database, dictionaries, expect, signIn, test } from "./support";

const en = dictionaries.en;

test("register, sign out, and sign back in", async ({ page }) => {
  const email = `e2e-${randomUUID()}@example.test`;
  const password = `pw-${randomUUID()}`;

  await page.goto("/en/register");
  await page.getByLabel(en.auth.name, { exact: true }).fill("E2E Registered");
  await page.getByLabel(en.auth.email, { exact: true }).fill(email);
  await page.getByLabel(en.auth.password, { exact: true }).fill(password);
  await page.getByLabel(en.auth.confirm, { exact: true }).fill(password);
  await page.getByRole("button", { name: en.auth.submitRegister, exact: true }).click();
  // Registration hashes the password and makes several database round trips.
  await expect(page).toHaveURL(/\/en\/account/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.getByRole("button", { name: en.account.signOut }).click();
  await expect(page.getByRole("link", { name: en.header.signIn }).first()).toBeVisible();
  await page.goto("/en/account");
  await expect(page).toHaveURL(/\/en\/login/);

  await signIn(page, "en", { id: "", name: "E2E Registered", email, password });
});

test("a wrong password shows the sign-in error", async ({ page }) => {
  const user = await createUser();
  await page.goto("/en/login");
  await page.getByLabel(en.auth.email, { exact: true }).fill(user.email);
  await page.getByLabel(en.auth.password, { exact: true }).fill(`${user.password}-wrong`);
  await page.getByRole("button", { name: en.auth.submitSignIn, exact: true }).click();
  await expect(page.getByText(en.auth.errors.invalid_credentials)).toBeVisible();
  await expect(page).toHaveURL(/\/en\/login/);
});

for (const lang of ["en", "ar"] as const) {
  test(`forgot password answers the same for any email (${lang})`, async ({ page }) => {
    const text = dictionaries[lang].auth;
    const user = await createUser();
    await page.goto(`/${lang}/login`);
    await page.getByRole("link", { name: text.forgotLink }).click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/forgot-password$`));

    await page.getByLabel(text.email, { exact: true }).fill(user.email);
    await page.getByRole("button", { name: text.submitForgot }).click();
    await expect(page.getByRole("status").filter({ hasText: text.forgotSent })).toBeVisible();

    await page.goto(`/${lang}/forgot-password`);
    await page
      .getByLabel(text.email, { exact: true })
      .fill(`nobody-${randomUUID()}@example.test`);
    await page.getByRole("button", { name: text.submitForgot }).click();
    await expect(page.getByRole("status").filter({ hasText: text.forgotSent })).toBeVisible();
  });
}

test("a reset link sets a new password and signs out other sessions", async ({ page, browser }) => {
  const user = await createUser();
  // Another device signed in with the old password.
  const other = await browser.newPage();
  await signIn(other, "en", user);

  const token = `e2e-${randomUUID()}`;
  await database().query(
    `INSERT INTO "PasswordResetToken" (id, "tokenHash", "userId", "expiresAt")
     VALUES ($1, $2, $3, now() + interval '1 hour')`,
    [`e2e${randomUUID().replace(/-/g, "")}`, hashResetToken(token), user.id],
  );
  const password = `new-${randomUUID()}`;

  await page.goto(`/en/reset-password?token=${encodeURIComponent(token)}`);
  await page.getByLabel(en.auth.newPassword, { exact: true }).fill(password);
  await page.getByLabel(en.auth.confirm, { exact: true }).fill(password);
  await page.getByRole("button", { name: en.auth.submitReset }).click();
  await expect(page).toHaveURL(/\/en\/login\?reset=1$/, { timeout: 20_000 });
  await expect(page.getByRole("status").filter({ hasText: en.auth.resetDone })).toBeVisible();

  await signIn(page, "en", { ...user, password });

  await other.goto("/en/account");
  await expect(other).toHaveURL(/\/en\/login/);
  await other.close();

  // The link worked once.
  await page.goto(`/en/reset-password?token=${encodeURIComponent(token)}`);
  await expect(
    page.getByRole("heading", { name: en.auth.invalidLinkHeading }),
  ).toBeVisible();
});

test("an unknown reset link offers a new one (ar)", async ({ page }) => {
  const ar = dictionaries.ar.auth;
  await page.goto(`/ar/reset-password?token=not-a-real-token`);
  await expect(page.getByRole("heading", { name: ar.invalidLinkHeading })).toBeVisible();
  await page.getByRole("link", { name: ar.requestNewLink }).click();
  await expect(page).toHaveURL(/\/ar\/forgot-password$/);
});
