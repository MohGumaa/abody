import {
  addToCart,
  createUser,
  dictionaries,
  expect,
  orderForSession,
  payAndConfirm,
  SEED,
  signIn,
  startCheckout,
  test,
} from "./support";

const en = dictionaries.en;

test("guest buys a digital product and downloads it @mobile", async ({ page }) => {
  await addToCart(page, "en", `/products/${SEED.template.slug}`);
  await startCheckout(page, "en");
  const sessionId = await payAndConfirm(page, "en");

  await expect(
    page.getByRole("heading", { name: en.checkoutResult.downloads.title }),
  ).toBeVisible();
  const link = page.getByRole("link", {
    name: new RegExp(`${en.checkoutResult.downloads.download}.*${SEED.template.name}`),
  });
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  const file = await page.request.get(href!);
  expect(file.status()).toBe(200);
  expect((await file.body()).byteLength).toBeGreaterThan(0);

  const order = await orderForSession(sessionId);
  expect(order).toMatchObject({ status: "PAID", totalCents: SEED.template.priceCents });

  await page.goto("/en/cart");
  await expect(page.getByRole("heading", { name: en.cart.emptyTitle })).toBeVisible();
});

test("signed-in customer sees the order and the download in the account", async ({ page }) => {
  const user = await createUser();
  await signIn(page, "en", user);
  await addToCart(page, "en", `/products/${SEED.guide.slug}`);
  await startCheckout(page, "en");
  const sessionId = await payAndConfirm(page, "en");
  const order = await orderForSession(sessionId);
  expect(order).toMatchObject({ status: "PAID", totalCents: SEED.guide.priceCents });

  await page.goto("/en/account/orders");
  const card = page.getByRole("article", { name: `${en.account.orderLabel} #${order!.number}` });
  await expect(card).toContainText(en.account.status.PAID);
  await expect(card).toContainText(SEED.guide.name);

  await page.goto("/en/account/downloads");
  await expect(
    page.getByRole("link", { name: new RegExp(`${en.account.download}.*${SEED.guide.name}`) }).first(),
  ).toBeVisible();
});

test("cancelling on the payment page returns to the saved cart", async ({ page }) => {
  await addToCart(page, "en", `/products/${SEED.template.slug}`);
  await startCheckout(page, "en");
  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(page).toHaveURL(/\/en\/cart\?checkout=cancelled/);
  await expect(page.getByText(en.cart.checkoutCancelled)).toBeVisible();
  await expect(page.getByText(SEED.template.name).first()).toBeVisible();
});
