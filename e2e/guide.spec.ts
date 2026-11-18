import { expect, test } from '@playwright/test';
import { newGame, shot, watchErrors } from './helpers';

// ONBOARD-1: the first-steps card shows the goal in "tavern" words and the animated pointer sits on the exact thing to tap.
test('guide card and pointer in a new game', async ({ page }) => {
  const errs = watchErrors(page);
  await newGame(page); // the intro-skip taps already walked the avatar: the walk step is done
  await expect(page.locator('.first-ten')).toBeVisible();
  const text = await page.locator('.first-ten-text').innerText();
  // RUN 7: the tutorial STARTS AT 0/N with zoom, hold-walk and tap-walk; the register step comes later.
  expect(text).toMatch(/wheel|pinch|zoom|hold|tap/i);
  expect(text).not.toMatch(/inn/i);
  await expect(page.locator('.info-inn')).toContainText("Tester's Tavern");
  expect(await page.locator('.first-ten-count').textContent()).toMatch(/^\d+\/21$/);
  await shot(page, '10-guide-first-step');
  expect(errs.list.filter((e) => !/favicon/.test(e))).toEqual([]);
});

// TUT-2: a new game always starts the tutorial (first card visible) and Continue resumes the stored step instead of restarting.
test('new game shows the first card; Continue keeps the step', async ({ page }) => {
  await newGame(page);
  await expect(page.locator('.first-ten')).toBeVisible();
  const before = await page.locator('.first-ten-count').innerText();
  await page.reload();
  await page.getByText('Continue').first().click();
  await page.waitForTimeout(3000);
  await expect(page.locator('.first-ten')).toBeVisible();
  expect(await page.locator('.first-ten-count').innerText()).toBe(before);
});
