// TESTER RUN 10b: title settled, first serve (timed), room overviews. Shots r10b-shots/. Config e2e/run10live.config.ts (add to testMatch via -g or run10serve).
import { test, expect } from '@playwright/test';
import { kit } from './run6kit';
import { watchErrors, openSide } from './helpers';

const tagOf = (page: any) => (page.viewportSize().width < 600 ? 'phone' : 'desktop');
const S = (page: any, n: string) => page.screenshot({ path: `r10b-shots/${tagOf(page)}-${n}.png` });

test('r10b serve and overviews', async ({ page }) => {
  test.setTimeout(240000);
  const errs = watchErrors(page); const k = kit(page, 'r10s');
  await page.goto('/?e2e'); await page.waitForTimeout(8000); await S(page, '30-title-settled');
  await k.newGame();
  const t0 = Date.now(); const el = () => Math.round((Date.now() - t0) / 1000);
  let g: any = null;
  for (let i = 0; i < 60 && !g; i++) { await page.waitForTimeout(2000); g = (await k.state()).tavern.guests.find((x: any) => x.order); }
  k.note(`guest order after ${el()}s`); expect(g).toBeTruthy();
  const uid = (await k.state()).items.find((i: any) => i.typeId === 'tap_stand').uid;
  const p = await k.toScreen(g.x, g.y - 28); await page.mouse.click(p.x, p.y); await page.waitForTimeout(3500); await S(page, '31-walk-to-bar');
  const sp = await k.ph<any>(`return h.standPoint(${uid})`);
  await page.mouse.move(sp.x, sp.y); await page.mouse.down(); await page.waitForTimeout(1250); await S(page, '32-pouring');
  await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(800); await S(page, '33-poured');
  const st = await k.state(); k.note('tray ' + JSON.stringify(st.tavern.tray)); expect(st.tavern.tray.length).toBeGreaterThan(0);
  const g2 = st.tavern.guests.find((x: any) => x.order) ?? st.tavern.guests[0];
  const p2 = await k.toScreen(g2.x, g2.y - 28); await page.mouse.click(p2.x, p2.y);
  for (let i = 0; i < 20 && (await k.state()).tavern.tray.length; i++) await page.waitForTimeout(1000);
  k.note(`delivered at ${el()}s`); await S(page, '34-delivered');
  let gold = 100; for (let i = 0; i < 25 && gold <= 100; i++) { await page.waitForTimeout(2000); gold = (await k.state()).player.wallet.gold; }
  k.note(`gold ${gold} at ${el()}s`); await S(page, '35-coins');
  // overview shots of the other rooms
  for (const room of ['Farm', 'Lakeside', 'Hotel']) {
    await openSide(page, 'Worlds'); await page.waitForTimeout(500);
    await page.locator('.travel-card', { hasText: new RegExp(room) }).first().click(); await page.waitForTimeout(6500);
    await S(page, `40-${room}-intro-end`);
    await k.ph(`h.setCamera({x:0,y:0,zoom:1},true); return 1`); await page.waitForTimeout(700); await S(page, `41-${room}-zoom1`);
  }
  k.note('errors ' + JSON.stringify(errs.list));
  expect(errs.list).toEqual([]);
});
