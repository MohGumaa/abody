import { randomUUID } from "node:crypto";
import { createUser, dictionaries, expect, signIn, test } from "./support";

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
