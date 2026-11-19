// ON-5: the Account panel against a MOCKED server (page.route). Needs a build with VITE_CLOUD_SAVE=1 VITE_SERVER_URL=https://mock.test served on 4250:
//   VITE_CLOUD_SAVE=1 VITE_SERVER_URL=https://mock.test npx vite build --outDir dist-account && npx vite preview --outDir dist-account --port 4250
//   npx playwright test -c e2e/account.config.ts   (ONE browser)
import { test, expect } from '@playwright/test';
import { newGame, openMore, watchErrors } from './helpers';

test('account: log in, conflict dialog, keep cloud, log out; banned text', async ({ page }) => {
  const errs = watchErrors(page);
  let banned = true;
  await page.route('https://mock.test/**', async (route) => {
    const u = new URL(route.request().url());
    const key = `${route.request().method()} ${u.pathname}`;
    const json = (status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(body) });
    if (route.request().method() === 'OPTIONS') return json(204, {});
    if (key === 'POST /api/login') return banned ? json(403, { error: 'banned' }) : json(200, { token: 'T', username: 'Tester' });
    if (key === 'GET /api/save/meta') return json(200, { revision: 1, version: 40, savedAt: Date.now() + 5000 });
    if (key === 'GET /api/save') return json(200, { savedAt: 1, save: { version: 40, savedAt: 1, state: {} } });
    return json(404, { error: 'not_found' });
  });
  await newGame(page);
  await openMore(page, 'Account');
  await expect(page.locator('.account-panel')).toBeVisible();
  await page.getByLabel('Account name').fill('Tester');
  await page.getByLabel('Password').fill('correct horse battery');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.locator('.account-message')).toContainText('banned');
  banned = false;
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.locator('.conflict-panel')).toBeVisible();
  await page.screenshot({ path: 'test-results/account-conflict.png' });
  await page.getByRole('button', { name: 'Decide later' }).click();
  await expect(page.locator('.account-status')).toContainText('Signed in as Tester');
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.locator('.account-status')).toContainText('Not signed in');
  expect(errs.list.filter((x) => !x.includes('mock.test') && !/status of 40[34]/.test(x))).toEqual([]);
});
