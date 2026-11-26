import { test, expect } from '@playwright/test';

test('SOS dashboard renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SOS DASHBOARD' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'FIND WATER' })).toBeVisible();
});
