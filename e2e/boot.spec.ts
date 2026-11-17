// OWN-4: the start is deterministic: the canvas stays hidden (a loading line shows) until the first room frame, and never stays an empty dark screen.
import { expect, test } from '@playwright/test';
import { newGame } from './helpers';

test('after Continue the canvas is revealed with a drawn room (CPU x4)', async ({
  page }) => {
  test.setTimeout(120_000);
  await newGame(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.reload();
  await page.getByText('Continue').first().click({ timeout: 20000 }).catch(() => undefined);
  await page.waitForSelector('canvas', { timeout: 30000 });
  await expect(page.locator('#boot-veil')).toHaveCount(0, { timeout: 30000 });
  await page.waitForTimeout(800);
  const opacity = await page.evaluate(() => getComputedStyle(document.querySelector('canvas')!).opacity);
  expect(opacity).toBe('1');
  const shot = await page.screenshot();
  // More than the clear colour: the room is drawn.
  const { PNG } = await import('pngjs');
  const png = PNG.sync.read(shot);
  const colours = new Set<number>();
  for (let i = 0; i < png.data.length; i += 4 * 97) colours.add((png.data[i]! << 16) | (png.data[i + 1]! << 8) | png.data[i + 2]!);
  expect(colours.size).toBeGreaterThan(12);
});
