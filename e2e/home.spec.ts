import { dictionaries, expect, test } from "./support";

const en = dictionaries.en.home.featured;
const ar = dictionaries.ar.home.featured;

// Which products are best sellers depends on orders other tests create, so
// these tests check the tabs, not the ranking.
test("featured products tabs switch by click and keyboard", async ({ page }) => {
  await page.goto("/en");
  const tablist = page.getByRole("tablist", { name: en.title });
  const bestSellers = tablist.getByRole("tab", { name: en.tabs.bestSellers });
  const newest = tablist.getByRole("tab", { name: en.tabs.new });
  const templates = tablist.getByRole("tab", { name: en.tabs.templates });

  await expect(bestSellers).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: en.tabs.bestSellers })).toBeVisible();

  await templates.click();
  await expect(templates).toHaveAttribute("aria-selected", "true");
  await expect(bestSellers).toHaveAttribute("aria-selected", "false");
  const templatesPanel = page.getByRole("tabpanel", { name: en.tabs.templates });
  await expect(templatesPanel).toBeVisible();
  await expect(templatesPanel.getByText("Templates", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("tabpanel", { name: en.tabs.bestSellers })).toBeHidden();

  await templates.press("Home");
  await expect(bestSellers).toBeFocused();
  await bestSellers.press("ArrowRight");
  await expect(newest).toHaveAttribute("aria-selected", "true");
  await expect(newest).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: en.tabs.new })).toBeVisible();
});

test("featured products tabs follow right-to-left order in Arabic", async ({ page }) => {
  await page.goto("/ar");
  const tablist = page.getByRole("tablist", { name: ar.title });
  const bestSellers = tablist.getByRole("tab", { name: ar.tabs.bestSellers });
  const newest = tablist.getByRole("tab", { name: ar.tabs.new });

  await expect(bestSellers).toHaveAttribute("aria-selected", "true");
  await expect(tablist.getByRole("tab", { name: ar.tabs.templates })).toBeVisible();

  await bestSellers.focus();
  await bestSellers.press("ArrowLeft");
  await expect(newest).toHaveAttribute("aria-selected", "true");
  await expect(newest).toBeFocused();
});
