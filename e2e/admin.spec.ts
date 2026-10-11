import { type Page } from "@playwright/test";
import {
  addToCart,
  createUser,
  dictionaries,
  expect,
  orderForSession,
  orderItems,
  orderStatus,
  payAndConfirm,
  SEED,
  signIn,
  startCheckout,
  test,
  type TestUser,
} from "./support";

const en = dictionaries.en;

// The customer's browser buys one item while signed in; returns the paid order.
async function buy(page: Page, user: TestUser, path: string) {
  await signIn(page, "en", user);
  await addToCart(page, "en", path);
  await startCheckout(page, "en");
  const order = await orderForSession(await payAndConfirm(page, "en"));
  expect(order?.status).toBe("PAID");
  return order!;
}

test("admin moves a paid order through fulfilment and the customer sees it", async ({
  browser,
}) => {
  const customer = await createUser();
  const admin = await createUser({ role: "ADMIN", name: "E2E Admin" });
  const customerPage = await (await browser.newContext()).newPage();
  const adminPage = await (await browser.newContext()).newPage();

  const order = await buy(customerPage, customer, `/products/${SEED.template.slug}`);

  await signIn(adminPage, "en", admin);
  await adminPage.goto("/admin/orders");
  await adminPage.getByRole("link", { name: `#${order.number}` }).click();
  await expect(adminPage).toHaveURL(new RegExp(`/admin/orders/${order.id}`));

  for (const status of ["Processing", "Completed"] as const) {
    await adminPage.getByRole("radio", { name: new RegExp(`^${status}`) }).check();
    await adminPage.getByRole("button", { name: "Save status" }).click();
    await expect(adminPage.getByRole("button", { name: "Save status" })).toBeEnabled();
    await expect.poll(() => orderStatus(order.id)).toBe(status.toUpperCase());
  }

  await customerPage.goto("/en/account/orders");
  await expect(
    customerPage.getByRole("article", { name: `${en.account.orderLabel} #${order.number}` }),
  ).toContainText(en.account.status.COMPLETED);
});

test("admin starts service work and the customer sees the progress", async ({ browser }) => {
  const customer = await createUser();
  const admin = await createUser({ role: "ADMIN", name: "E2E Admin" });
  const customerPage = await (await browser.newContext()).newPage();
  const adminPage = await (await browser.newContext()).newPage();

  const order = await buy(customerPage, customer, `/services/${SEED.ads.slug}`);
  const [item] = await orderItems(order.id);
  await customerPage.getByRole("link", { name: en.onboarding.add }).first().click();
  await customerPage
    .getByLabel(new RegExp(`^${en.onboarding.fields.businessName}`))
    .fill("E2E Business");
  await customerPage.getByRole("button", { name: en.onboarding.submit }).click();
  await expect(customerPage.getByText(en.onboarding.saved)).toBeVisible();

  await signIn(adminPage, "en", admin);
  await adminPage.goto("/admin/service-orders");
  await adminPage.locator(`a[href="/admin/service-orders/${item.id}"]`).first().click();
  await expect(adminPage).toHaveURL(new RegExp(`/admin/service-orders/${item.id}`));
  await expect(adminPage.getByText("E2E Business")).toBeVisible();

  await adminPage.getByRole("radio", { name: /^In progress/ }).check();
  await adminPage.getByLabel("Internal notes").fill("Kick-off call booked.");
  await adminPage.getByRole("button", { name: "Save", exact: true }).click();
  await expect(adminPage.getByRole("status").filter({ hasText: /\S/ })).toBeVisible();

  await customerPage.goto(`/en/account/services/${item.id}`);
  await expect(customerPage.getByText(en.account.service.messages.IN_PROGRESS)).toBeVisible();
  await expect(customerPage.getByText("Kick-off call booked.")).toHaveCount(0);
});
