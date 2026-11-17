import { expect, test } from '@playwright/test';
import { shot, watchErrors } from './helpers';

// VG-1: the one-time hint chip bobs on a thing in reach (shown once), and SG4b: the seed hint chip.
test('hint chip near a stove shows once', async ({ page }) => {
  const errs = watchErrors(page);
  await page.goto('/?e2e');
  await page.getByText('New game').first().click();
  await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Open my tavern' }).click();
  await page.waitForTimeout(800);
  await page.mouse.click(5, 300);
  await page.waitForTimeout(500);
  await page.mouse.click(5, 300);
  await page.waitForTimeout(1500);
  // Skip the guide so its pointer does not hold the hints back.
  await page.locator('.first-ten button').first().click();
  const at = await page.evaluate(() => {
    const ph = (window as any).__ph;
    const stove = ph.st.items.find((i: any) => i.typeId === 'stove');
    return ph.worldToScreen({ x: stove.x, y: stove.y + 40 }, ph.st.shown);
  });
  await page.mouse.click(at.x, at.y);
  await page.waitForFunction(() => document.querySelector('.hint-chip.on') !== null, null, { timeout: 8000 });
  await page.waitForTimeout(700);
  await shot(page, '20-hint-chip');
  const seen = await page.evaluate(() => Object.values(localStorage).join('|'));
  expect(seen).toContain('hintsSeen');
  expect(errs.list.filter((e) => !/favicon/.test(e))).toEqual([]);
});
