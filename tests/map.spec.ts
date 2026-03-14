import { test, expect } from "@playwright/test";

test("map page renders leaflet container", async ({ page }) => {
  await page.goto("/map");
  await expect(page.locator(".leaflet-container")).toBeVisible();
});

test("navigation between chat and map", async ({ page }) => {
  await page.goto("/");
  await page.click('a[href="/map"]');
  await expect(page).toHaveURL("/map");

  await page.click('a[href="/"]');
  await expect(page).toHaveURL("/");
});
