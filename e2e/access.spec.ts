import {
  addToCart,
  createUser,
  database,
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

for (const path of ["/admin", "/admin/orders"]) {
  test(`${path} is a 404 for guests and customers`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();

    await signIn(page, "en", await createUser());
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  });
}

test("the account sends guests to sign in", async ({ page }) => {
  await page.goto("/en/account");
  await expect(page).toHaveURL(/\/en\/login\?next=/);
});

test("another customer's service and download are refused", async ({ browser }) => {
  const owner = await createUser();
  const other = await createUser();
  const ownerPage = await (await browser.newContext()).newPage();
  const otherPage = await (await browser.newContext()).newPage();

  // The owner buys a service and a digital product in one order.
  await signIn(ownerPage, "en", owner);
  await addToCart(ownerPage, "en", `/services/${SEED.ads.slug}`);
  await addToCart(ownerPage, "en", `/products/${SEED.template.slug}`);
  await startCheckout(ownerPage, "en");
  const sessionId = await payAndConfirm(ownerPage, "en");
  const order = await orderForSession(sessionId);
  const { rows } = await database().query<{ id: string; type: string }>(
    `SELECT oi.id, p.type FROM "OrderItem" oi JOIN "Product" p ON p.id = oi."productId" WHERE oi."orderId" = $1`,
    [order!.id],
  );
  expect(rows).toHaveLength(2);
  const serviceItem = rows.find((row) => row.type === "SERVICE")!.id;
  const fileItem = rows.find((row) => row.type === "DIGITAL_PRODUCT")!.id;

  await signIn(otherPage, "en", other);
  for (const path of [`/en/onboarding/${serviceItem}`, `/en/account/services/${serviceItem}`]) {
    await otherPage.goto(path);
    await expect(
      otherPage.getByRole("heading", { level: 1, name: en.notFound.title }),
    ).toBeVisible();
  }

  // Downloads belong to the checkout session link, not the account: without
  // the owner's session id the route answers the same 404 for everyone.
  for (const query of ["", "?session_id=cs_test_notTheOwnersSession"]) {
    const response = await otherPage.request.get(`/api/downloads/${fileItem}${query}`);
    expect(response.status()).toBe(404);
  }
  const owned = await ownerPage.request.get(`/api/downloads/${fileItem}?session_id=${sessionId}`);
  expect(owned.status()).toBe(200);
});
