// TESTER RUN 16b: pour anywhere, stash, punch toggle, level-up (camera zoomed out first). Shots r16-shots/b-*
import { test } from '@playwright/test';
import * as fs from 'fs';
import { kit } from './run6kit';
import { watchErrors } from './helpers';

fs.mkdirSync('r16-shots', { recursive: true });
const tagOf = (page: any) => (page.viewportSize().width < 600 ? 'phone' : 'desktop');
const S = (page: any, n: string) => page.screenshot({ path: `r16-shots/${tagOf(page)}-b-${n}.png` });
const tap = async (page: any, x: number, y: number) => { if (tagOf(page) === 'phone') await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); };
const txt = (page: any, sel: string): Promise<string[]> => page.evaluate((s: string) => [...document.querySelectorAll(s)].map((e) => (e as HTMLElement).innerText.replace(/\s+/g, ' ').slice(0, 160)), sel);

test('r16b', async ({ page }) => {
  test.setTimeout(600000);
  page.setDefaultTimeout(6000);
  const errs = watchErrors(page); const k = kit(page, 'r16b');
  const guard = async (n: string, f: () => Promise<void>) => { try { await f(); } catch (e) { k.note(`STEP ${n} THREW ${String((e as Error).message).split('\n')[0]}`); } };
  await k.newGame();
  const vp = page.viewportSize()!;
  const zoomOut = async () => { await page.mouse.move(vp.width / 2, vp.height / 3); for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 500); await page.waitForTimeout(150); } await page.waitForTimeout(800); };
  await k.patchAndContinue((s) => { const p = s.player ?? s; p.materials = { ...(p.materials ?? {}), roasted_turnip: 12, potato_stew: 6, dirt: 5 }; p.xp = 13; });
  await zoomOut(); await S(page, '00-zoomedout');
  k.note('zoom ' + await k.ph<any>('return h.st.shown && h.st.shown.zoom'));
  // stash
  await guard('stash', async () => {
    const st = await k.state(); const hatch = st.items.find((i: any) => i.typeId === 'serving_hatch');
    const p = await k.toScreen(hatch.x, hatch.y - 14); k.note('hatch screen ' + JSON.stringify(p));
    await tap(page, p.x, p.y);
    await page.locator('.stash-panel .stash-slots').waitFor({ state: 'visible', timeout: 15000 }).catch(() => k.note('stash panel never visible'));
    await page.waitForTimeout(500); await S(page, '10-stash-open'); k.note('stash panel ' + JSON.stringify(await txt(page, '.stash-panel')));
    await page.locator('.stash-dish').first().click(); await page.waitForTimeout(500); await S(page, '11-loaded'); k.note('after 1 click ' + JSON.stringify(await txt(page, '.stash-slot')));
    await page.locator('.stash-slot:not(.empty)').first().click(); await page.waitForTimeout(500); k.note('after unload ' + JSON.stringify(await txt(page, '.stash-slot')));
    await page.locator('.stash-dish').first().click(); await page.waitForTimeout(300);
    await page.locator('.stash-dish').first().click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(300);
    k.note('refill visible ' + await page.locator('.stash-refill:visible').count());
    await page.locator('.stash-refill:visible').click({ timeout: 1500 }).catch(() => k.note('refill not clickable'));
    await page.waitForTimeout(500); await S(page, '12-two'); k.note('stash now ' + JSON.stringify(await txt(page, '.stash-slot')));
    // menu shows only stocked dish
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    const reg = (await k.state()).items.find((i: any) => i.typeId === 'register'); const rp = await k.toScreen(reg.x, reg.y - 14); await tap(page, rp.x, rp.y);
    await page.locator('.ui-panel.open').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => k.note('bar panel not open'));
    await page.getByText('Menu', { exact: true }).first().click({ timeout: 2000 }).catch(() => k.note('no Menu tab'));
    await page.waitForTimeout(500); await S(page, '13-menu'); k.note('menu ' + JSON.stringify(await txt(page, '.ui-panel.open')));
    await page.keyboard.press('Escape'); await page.waitForTimeout(500); await S(page, '14-lowdots');
  });
  // punch toggle
  await guard('punch', async () => {
    const av = await k.ph<any>('return {x:h.st.avatar.x,y:h.st.avatar.y}');
    const c = Math.floor(av.x / 32) + 3, r = Math.floor(av.y / 32) - 4;
    const pp = await k.toScreen(c * 32 + 16, r * 32 + 16); await page.keyboard.press('1'); await tap(page, pp.x, pp.y); await page.waitForTimeout(1500);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    const res = 'tap-placed';
    const has = async () => JSON.stringify(((await k.state()).rooms ?? []).map((x: any) => x.blocks ?? null)).includes('dirt');
    await page.waitForTimeout(500); k.note('placeBlock ' + res + ' present ' + await has());
    const btn = page.locator('.hotbar-punch'); const state = async () => (await btn.getAttribute('aria-pressed')) + '/' + (await btn.getAttribute('class'));
    k.note('initial punch state ' + await state());
    const p = await k.toScreen(c * 32 + 16, r * 32 + 16);
    if ((await btn.getAttribute('aria-pressed')) === 'true') await btn.click();
    await page.waitForTimeout(300); k.note('now ' + await state()); await S(page, '20-chill');
    for (let i = 0; i < 4; i++) { await tap(page, p.x, p.y); await page.waitForTimeout(600); }
    k.note('CHILL after 4 taps present ' + await has());
    await btn.click(); await page.waitForTimeout(300); k.note('now ' + await state()); await S(page, '21-punchon');
    for (let i = 0; i < 6 && await has(); i++) { await tap(page, p.x, p.y); await page.waitForTimeout(700); }
    k.note('PUNCH after taps present ' + await has()); await S(page, '22-after');
  });
  // pour
  await guard('pour', async () => {
    await page.waitForTimeout(500);
    let g: any = null;
    for (let i = 0; i < 60 && !g; i++) { await page.waitForTimeout(2000); g = (await k.state()).tavern.guests.find((x: any) => x.order); }
    k.note('guest with order ' + !!g); if (!g) return;
    const p = await k.toScreen(g.x, g.y - 28); k.note('guest screen ' + JSON.stringify(p) + ' order ' + JSON.stringify(g.order)); await tap(page, p.x, p.y);
    await page.waitForTimeout(5000); await S(page, '30-wait');
    k.note('Serve-ish buttons ' + JSON.stringify((await txt(page, 'button')).filter((s) => /serve|pour/i.test(s))) + ' ctx ' + await page.locator('.ctx-btn:visible').count() + ' htmlpour ' + await page.locator('.pour-bar:visible').count());
    const hx = Math.round(vp.width * 0.15), hy = Math.round(vp.height * 0.55);
    await tap(page, hx, hy); await page.waitForTimeout(250); k.note('toast after quick tap ' + JSON.stringify(await txt(page, '.toast'))); await S(page, '31-quicktap');
    await page.waitForTimeout(2500);
    if (tagOf(page) === 'desktop') { await page.mouse.move(hx, hy); await page.mouse.down(); await page.waitForTimeout(500); await S(page, '32-holding'); await page.waitForTimeout(550); await page.mouse.up(); }
    else {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: hx, y: hy }] }); await page.waitForTimeout(500); await S(page, '32-holding'); await page.waitForTimeout(550);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await page.waitForTimeout(500); const st = await k.state(); k.note('tray after pour ' + JSON.stringify(st.tavern.tray)); await S(page, '33-after');
    const g2 = st.tavern.guests.find((x: any) => x.order);
    if (g2 && st.tavern.tray?.length) { const q = await k.toScreen(g2.x, g2.y - 28); await tap(page, q.x, q.y); }
    for (let i = 0; i < 30; i++) { await page.waitForTimeout(500); const t = await txt(page, '.toast'); if (t.some((s) => /Level/i.test(s))) { k.note('LEVEL TOAST ' + JSON.stringify(t) + ' bg ' + await page.evaluate(() => getComputedStyle(document.querySelector('.toast')!).backgroundColor) + ' rect ' + JSON.stringify(await page.evaluate(() => { const b = document.querySelector('.toast')!.getBoundingClientRect(); return [b.x, b.y, b.width, b.height].map(Math.round); }))); await S(page, '34-levelup'); break; } }
    const s2 = await k.state(); k.note('level ' + s2.player?.level + ' xp ' + s2.player?.xp);
  });
  k.note('errors ' + errs.list.length + ' ' + JSON.stringify(errs.list));
});
