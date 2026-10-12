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

test("listing search, sort, and category combine in the URL", async ({ page }) => {
  const text = en.listing;
  await page.goto("/en/products");
  const results = page.getByRole("region", { name: text.types.DIGITAL_PRODUCT.title });
  const names = () => results.getByRole("heading", { level: 2 }).allInnerTexts();

  await page.getByLabel(text.sortBy).selectOption({ label: text.sort.priceDesc });
  await expect(page).toHaveURL(/sort=price-desc/);
  const byPrice = await names();
  expect(byPrice.indexOf(SEED.template.name)).toBeLessThan(byPrice.indexOf(SEED.guide.name));

  await page.getByRole("link", { name: new RegExp(`^${SEED.guide.category}`) }).click();
  await expect(page).toHaveURL(/category=.*sort=price-desc/);

  // Searches as you type, with no button, and keeps focus in the field.
  const search = page.getByRole("searchbox", { name: text.types.DIGITAL_PRODUCT.searchLabel });
  await expect(page.getByRole("button", { name: text.searchButton })).toHaveCount(0);
  await search.pressSequentially("facebook ads");
  await expect(page).toHaveURL(/category=.*q=facebook\+ads.*sort=price-desc/);
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("facebook ads");
  await expect(results.getByRole("heading", { name: SEED.guide.name })).toBeVisible();

  // The clear button drops only the search.
  await page.getByRole("button", { name: text.clearSearch }).click();
  await expect(page).not.toHaveURL(/q=/);
  await expect(page).toHaveURL(/category=.*sort=price-desc/);
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();

  // Enter searches without waiting for the pause.
  await search.fill("zzqx nothing");
  await search.press("Enter");
  await expect(page).toHaveURL(/q=zzqx\+nothing/);
  await expect(results.getByRole("status")).toContainText(text.searchEmpty);
  await results.getByRole("link", { name: text.clearSearch }).click();
  await expect(page).not.toHaveURL(/q=/);
  await expect(page).toHaveURL(/category=.*sort=price-desc/);
  await expect(search).toHaveValue("");
  await expect(results.getByRole("heading", { name: SEED.guide.name })).toBeVisible();
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
