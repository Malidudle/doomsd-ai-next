import { test, expect } from '@playwright/test';

test('chat UI renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByPlaceholder('/msg ...')).toBeVisible();
  await expect(page.getByRole('button', { name: 'SEND' })).toBeVisible();
});
