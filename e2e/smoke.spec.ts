import { test, expect } from '@playwright/test';
test('title screen loads without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  await expect(page.getByText('New game')).toBeVisible();
  await page.screenshot({ path: 'test-results/title.png' });
  expect(errors).toEqual([]);
});
