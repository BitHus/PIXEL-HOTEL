// TESTER RUN 11: pouring UI states (hold, perfect window, over, tray, coins) and fishing UI states (cast, bite, reel, catch, result).
// Shots r11-shots/{desktop,phone}-pour-* and -fish-*. One browser, one project at a time (config e2e/run11live.config.ts).
import { test } from '@playwright/test';
import * as fs from 'fs';
import { kit } from './run6kit';
import { watchErrors, openMoreMenu } from './helpers';

fs.mkdirSync('r11-shots', { recursive: true });
const tagOf = (page: any) => (page.viewportSize().width < 600 ? 'phone' : 'desktop');
const S = (page: any, n: string) => page.screenshot({ path: `r11-shots/${tagOf(page)}-${n}.png` });

test('r11 pour and fish', async ({ page }) => {
  test.setTimeout(540000);
  const errs = watchErrors(page); const k = kit(page, 'r11fish');
  await page.goto('/?e2e'); await page.waitForTimeout(1500);
  await k.newGame();
  // ---- pouring
  let g: any = null;
  for (let i = 0; i < 60 && !g && !process.env.NOPOUR; i++) { await page.waitForTimeout(2000); g = (await k.state()).tavern.guests.find((x: any) => x.order); }
  k.note('guest order ' + !!g);
  if (g) {
    await S(page, 'pour-00-order-marker');
    const uid = (await k.state()).items.find((i: any) => i.typeId === 'tap_stand').uid;
    const p = await k.toScreen(g.x, g.y - 28); await page.mouse.click(p.x, p.y); await page.waitForTimeout(3500);
    await S(page, 'pour-01-waiting-at-taps');
    const sp = await k.ph<any>(`return h.standPoint(${uid})`);
    await page.mouse.move(sp.x, sp.y); await page.mouse.down();
    await page.waitForTimeout(450); await S(page, 'pour-02-hold-early');
    await page.waitForTimeout(550); await S(page, 'pour-03-hold-nearperfect');
    await page.waitForTimeout(100); await S(page, 'pour-04-hold-late');
    await page.waitForTimeout(300); await S(page, 'pour-05-hold-over');
    await page.mouse.up(); await page.waitForTimeout(400); await S(page, 'pour-06-released');
    await page.waitForTimeout(1200); await S(page, 'pour-07-tray');
    const st = await k.state(); k.note('tray ' + JSON.stringify(st.tavern.tray));
    const g2 = st.tavern.guests.find((x: any) => x.order) ?? st.tavern.guests[0];
    const p2 = await k.toScreen(g2.x, g2.y - 28); await page.mouse.click(p2.x, p2.y);
    await page.waitForTimeout(2500); await S(page, 'pour-08-carrying');
    await page.waitForTimeout(5000); await S(page, 'pour-09-delivered');
    await page.waitForTimeout(25000); await S(page, 'pour-10-coins');
  }
  // ---- fishing
  await openMoreMenu(page);
  await page.locator('.more-menu button[title^="Worlds"]').first().dispatchEvent('click'); await page.waitForTimeout(500);
  await page.locator('.travel-card', { hasText: /Lakeside/ }).first().click(); await page.waitForTimeout(6500);
  await page.mouse.click(5, 300); await page.waitForTimeout(500);
  await S(page, 'fish-00-lakeside');
  const vp = page.viewportSize()!;
  const bar = page.locator('.fish-bar:visible');
  let cast = false;
  for (const fy of [0.28, 0.2, 0.38, 0.5]) for (const fx of [0.85, 0.75, 0.9, 0.6]) {
    if (cast) break;
    await page.mouse.click(vp.width * fx, vp.height * fy); await page.waitForTimeout(900);
    cast = (await bar.count()) > 0;
    if (cast) k.note(`cast at ${fx},${fy}`);
  }
  k.note('cast ' + cast);
  if (cast) {
    let last = ''; let n = 0; let reel = 0;
    for (let i = 0; i < 600; i++) {
      await page.waitForTimeout(100);
      if (!(await bar.count())) { await S(page, 'fish-90-barGone'); break; }
      const t = (await page.locator('.fish-text').first().innerText().catch(() => '')) || '';
      if (/bite|now/i.test(t) && t !== last) await page.mouse.click(vp.width * 0.5, vp.height * 0.8);
      if (t !== last) { last = t; n++; await S(page, `fish-${String(n).padStart(2, '0')}-${t.replace(/[^a-z]/gi, '').slice(0, 12)}`); k.note('phase text: ' + t); }
      if (/bite|now/i.test(t)) { await page.mouse.click(vp.width * 0.4, vp.height * 0.8); }
      if (/box|fish/i.test(t) && !/bite/i.test(t)) {
        reel++; if (reel % 3 === 0) { await page.keyboard.down('Space'); await page.waitForTimeout(220); await page.keyboard.up('Space'); }
        if (reel === 6 || reel === 20) await S(page, `fish-reel-${reel}`);
      }
    }
    await page.waitForTimeout(1500); await S(page, 'fish-95-after');
  }
  k.note('errors ' + JSON.stringify(errs.list));
});
