// TESTER RUN 10: full walk (title, new game, first serve, floors/walls, close X, More, catalog, farm, lakeside, hotel). Shots r10b-shots/. Needs a build served on 4240.
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { kit } from './run6kit';
import { watchErrors, openMoreMenu, openSide } from './helpers';

fs.mkdirSync('r10b-shots', { recursive: true });
const tagOf = (page: any) => (page.viewportSize().width < 600 ? 'phone' : 'desktop');
const S = (page: any, n: string) => page.screenshot({ path: `r10b-shots/${tagOf(page)}-${n}.png` });

test('r10b walk', async ({ page }) => {
  test.setTimeout(240000);
  const errs = watchErrors(page); const k = kit(page, 'r10b');
  await page.goto('/?e2e'); await page.waitForTimeout(2500); await S(page, '01-title');
  await page.getByText('New game').first().click(); await page.waitForTimeout(600); await S(page, '02-create');
  await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click(); await page.waitForTimeout(600); await S(page, '03-hotelshape');
  await page.getByRole('button', { name: 'Open my tavern' }).click(); await page.waitForTimeout(1500); await S(page, '04-intro');
  await page.mouse.click(page.viewportSize()!.width / 2, 300); await page.waitForTimeout(3500); await S(page, '05-tavern');
  // first serve: wait for a guest order, tap guest, hold stand
  let served = false;
  for (let i = 0; i < 40 && !served; i++) {
    await page.waitForTimeout(1500);
    const g = await k.ph<any>(`const gs=h.guestViews?Array.from(h.guestViews.values?h.guestViews.values():h.guestViews):[]; return gs.length`);
    if (i === 10) await S(page, '06-guests');
    served = (await k.ph<any>(`return (h.st.tavern?.guests||[]).some?.(g=>g.order)||false`).catch(() => false)) as boolean;
    if (i === 39) k.note('no guest order seen in 60s');
  }
  await S(page, '07-after-wait');
  // close X on panels: Bar, Catalog, More>Room
  await openSide(page, 'Catalog'); await page.waitForTimeout(700); await S(page, '10-catalog');
  const x = page.locator('.panel-close:visible').first(); k.note('close X count ' + await page.locator('.panel-close:visible').count());
  const box = await x.boundingBox().catch(() => null); k.note('X box ' + JSON.stringify(box));
  await x.dispatchEvent('click'); await page.waitForTimeout(400);
  expect(await page.locator('.panel-close:visible').count(), 'catalog closes').toBe(0);
  await openMoreMenu(page); await page.waitForTimeout(400); await S(page, '11-more');
  for (const lab of ['Room', 'Book', 'Skills', 'Settings', 'Quests', 'Avatar']) {
    await page.keyboard.press('Escape');
    await openMoreMenu(page);
    await page.locator(`.more-menu button[title^="${lab}"]`).first().dispatchEvent('click'); await page.waitForTimeout(600);
    await S(page, '12-more-' + lab);
    const cx = page.locator('.panel-close:visible').first();
    if (await cx.count()) { const b = await cx.boundingBox(); k.note(lab + ' X ' + JSON.stringify(b)); await cx.dispatchEvent('click'); await page.waitForTimeout(300); }
    else k.note(lab + ' has NO visible close X');
  }
  // other rooms
  for (const room of ['Farm', 'Lakeside', 'Hotel', 'Suite']) {
    await page.keyboard.press('Escape');
    await openSide(page, 'Worlds'); await page.waitForTimeout(500);
    const card = page.locator('.travel-card', { hasText: new RegExp(room) }).first();
    if (!(await card.count())) { k.note('no travel card ' + room); continue; }
    await card.click(); await page.waitForTimeout(4500); await S(page, '20-room-' + room);
    await page.mouse.click(page.viewportSize()!.width / 2, 300); await page.waitForTimeout(800); await S(page, '21-room-' + room + '-b');
  }
  k.note('errors ' + JSON.stringify(errs.list));
  expect(errs.list).toEqual([]);
});
