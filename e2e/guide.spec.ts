import { expect, test } from '@playwright/test';
import { newGame, shot, watchErrors } from './helpers';

// ONBOARD-1: the first-steps card shows the goal in "tavern" words and the animated pointer sits on the exact thing to tap.
test('guide card and pointer in a new game', async ({ page }) => {
  const errs = watchErrors(page);
  await newGame(page); // the intro-skip taps already walked the avatar: the walk step is done
  await expect(page.locator('.first-ten')).toBeVisible();
  const text = await page.locator('.first-ten-text').innerText();
  expect(text).toMatch(/register/i);
  expect(text).not.toMatch(/\binn\b/i);
  await expect(page.locator('.info-inn')).toContainText("Tester's Tavern");
  await expect(page.locator('.guide-pointer.on')).toHaveCount(1);
  await page.waitForFunction(() => !document.body.classList.contains('walk-compact') && !document.querySelector('.walk-compact'), null, { timeout: 15000 });
  await page.waitForTimeout(600);
  await shot(page, '10-guide-register');
  // The pointer ring is on the register: a tap there opens the bar panel and ticks the step off.
  const ring = (await page.locator('.guide-ring').boundingBox())!;
  await page.mouse.click(ring.x + ring.width / 2, ring.y + ring.height / 2);
  await page.waitForTimeout(1500);
  await shot(page, '11-guide-after-register');
  await expect(page.locator('.first-ten-text')).not.toContainText(/register/i);
  expect(errs.list.filter((e) => !/favicon/.test(e))).toEqual([]);
});
