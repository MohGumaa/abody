import { expect, test } from "@playwright/test";

test("home page loads in English and switches to Arabic", async ({ page }) => {
  await page.goto("/en");

  const html = page.locator("html");
  await expect(html).toHaveAttribute("lang", "en");
  await expect(html).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.locator('header a[hreflang="ar"]').click();

  await expect(page).toHaveURL(/\/ar$/);
  await expect(html).toHaveAttribute("lang", "ar");
  await expect(html).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
