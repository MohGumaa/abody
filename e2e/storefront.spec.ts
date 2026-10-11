import {
  addToCart,
  dictionaries,
  expect,
  formatPriceCents,
  hasNoHorizontalScroll,
  SEED,
  test,
} from "./support";

const en = dictionaries.en;
const ar = dictionaries.ar;

test("products listing shows published seeded products and filters by category", async ({
  page,
}) => {
  await page.goto("/en/products");
  const results = page.getByRole("region", { name: en.listing.types.DIGITAL_PRODUCT.title });
  await expect(results.getByRole("heading", { name: SEED.template.name })).toBeVisible();
  await expect(results.getByRole("heading", { name: SEED.guide.name })).toBeVisible();
  await expect(results.getByText(SEED.draft.name)).toHaveCount(0);

  await page.getByRole("link", { name: new RegExp(`^${SEED.guide.category}`) }).click();
  await expect(page).toHaveURL(/category=/);
  await expect(results.getByRole("heading", { name: SEED.guide.name })).toBeVisible();
  await expect(results.getByRole("heading", { name: SEED.template.name })).toHaveCount(0);
});

test("product and service detail pages show name, price, and add to cart", async ({ page }) => {
  await page.goto(`/en/products/${SEED.template.slug}`);
  await expect(page.getByRole("heading", { level: 1, name: SEED.template.name })).toBeVisible();
  await expect(page.getByText(formatPriceCents(SEED.template.priceCents)).first()).toBeVisible();
  await expect(page.getByRole("button", { name: en.product.addToCart })).toBeVisible();

  await page.goto(`/en/services/${SEED.ads.slug}`);
  await expect(page.getByRole("heading", { level: 1, name: SEED.ads.name })).toBeVisible();
  await expect(page.getByText(formatPriceCents(SEED.ads.priceCents)).first()).toBeVisible();
  await expect(page.getByRole("button", { name: en.product.addToCart })).toBeVisible();
});

test("cart adds, updates quantity, totals, and empties", async ({ page }) => {
  await addToCart(page, "en", `/products/${SEED.template.slug}`);
  await addToCart(page, "en", `/services/${SEED.ads.slug}`);

  await page.goto("/en/cart");
  const summary = page.getByRole("region", { name: en.cart.summary });
  await expect(summary).toContainText(
    formatPriceCents(SEED.template.priceCents + SEED.ads.priceCents),
  );

  await page
    .getByRole("button", { name: `${en.cart.increase}: ${SEED.template.name}` })
    .click();
  await expect(summary).toContainText(
    formatPriceCents(SEED.template.priceCents * 2 + SEED.ads.priceCents),
  );

  await page.getByRole("button", { name: `${en.cart.remove}: ${SEED.template.name}` }).click();
  await expect(summary).toContainText(formatPriceCents(SEED.ads.priceCents));
  await page.getByRole("button", { name: `${en.cart.remove}: ${SEED.ads.name}` }).click();
  await expect(page.getByRole("heading", { name: en.cart.emptyTitle })).toBeVisible();
});

test("Arabic listing and cart render right to left", async ({ page }) => {
  await page.goto("/ar/products");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { level: 1, name: ar.listing.types.DIGITAL_PRODUCT.title }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: SEED.template.nameAr })).toBeVisible();

  await addToCart(page, "ar", `/products/${SEED.template.slug}`);
  await page.goto("/ar/cart");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1, name: ar.cart.title })).toBeVisible();
  await expect(page.getByText(SEED.template.nameAr).first()).toBeVisible();
});

test("phone width: listing to cart without sideways scroll @mobile", async ({ page }) => {
  await page.goto("/en/products");
  expect(await hasNoHorizontalScroll(page)).toBe(true);
  await page.getByRole("heading", { name: SEED.template.name }).click();
  await expect(page).toHaveURL(new RegExp(`/en/products/${SEED.template.slug}`));
  expect(await hasNoHorizontalScroll(page)).toBe(true);
  await addToCart(page, "en", `/products/${SEED.template.slug}`);
  await page.goto("/en/cart");
  await expect(page.getByRole("heading", { level: 1, name: en.cart.title })).toBeVisible();
  expect(await hasNoHorizontalScroll(page)).toBe(true);
});
