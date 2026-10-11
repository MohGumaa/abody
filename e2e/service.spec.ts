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

const ar = dictionaries.ar;

test("Arabic service purchase, onboarding, and tracking", async ({ page }) => {
  const user = await createUser();
  await signIn(page, "ar", user);
  await addToCart(page, "ar", `/services/${SEED.ads.slug}`);
  await startCheckout(page, "ar");
  const sessionId = await payAndConfirm(page, "ar");
  expect(await orderForSession(sessionId)).toMatchObject({
    status: "PAID",
    totalCents: SEED.ads.priceCents,
  });
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  await page.getByRole("link", { name: ar.onboarding.add }).first().click();
  await expect(page).toHaveURL(/\/ar\/onboarding\//);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  // Empty submit: the required business name is reported, nothing is saved.
  await page.getByRole("button", { name: ar.onboarding.submit }).click();
  await expect(page.getByText(ar.onboarding.fieldErrors.business_name_required)).toBeVisible();
  const businessName = page.getByLabel(new RegExp(`^${ar.onboarding.fields.businessName}`));
  await expect(businessName).toHaveAttribute("aria-invalid", "true");

  await businessName.fill("شركة الاختبار");
  await page.getByLabel(ar.onboarding.fields.website).fill("https://example.test");
  await page.getByLabel(ar.onboarding.fields.campaignGoals).fill("زيادة المبيعات");
  await page.getByRole("button", { name: ar.onboarding.submit }).click();
  await expect(page.getByText(ar.onboarding.saved)).toBeVisible();

  await page.goto("/ar/account/services");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByText(SEED.ads.nameAr).first()).toBeVisible();
  await expect(page.getByText(ar.account.serviceStatus.NEW).first()).toBeVisible();

  await page.getByRole("link", { name: new RegExp(SEED.ads.nameAr) }).first().click();
  await expect(page).toHaveURL(/\/ar\/account\/services\//);
  await expect(page.getByText("شركة الاختبار")).toBeVisible();
  await expect(page.getByText("زيادة المبيعات")).toBeVisible();
});
