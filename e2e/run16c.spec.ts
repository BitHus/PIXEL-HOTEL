// TESTER RUN 16c: phone fishing cast on explicit water points + hat picker + tutorial card. Shots r16-shots/c-*
import { test } from '@playwright/test';
import * as fs from 'fs';
import { kit } from './run6kit';
import { watchErrors, openMore } from './helpers';

fs.mkdirSync('r16-shots', { recursive: true });
const tagOf = (page: any) => (page.viewportSize().width < 600 ? 'phone' : 'desktop');
const S = (page: any, n: string) => page.screenshot({ path: `r16-shots/${tagOf(page)}-c-${n}.png` });
const tap = async (page: any, x: number, y: number) => { if (tagOf(page) === 'phone') await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); };
const txt = (page: any, sel: string): Promise<string[]> => page.evaluate((s: string) => [...document.querySelectorAll(s)].map((e) => (e as HTMLElement).innerText.replace(/\s+/g, ' ').slice(0, 200)), sel);

test('r16c', async ({ page }) => {
  test.setTimeout(400000); page.setDefaultTimeout(6000);
  const errs = watchErrors(page); const k = kit(page, 'r16c');
  const guard = async (n: string, f: () => Promise<void>) => { try { await f(); } catch (e) { k.note(`STEP ${n} THREW ${String((e as Error).message).split('\n')[0]}`); } };
  await page.goto('/?e2e'); await page.waitForTimeout(2500);
  await page.getByText('New game').first().click(); await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click(); await page.getByRole('button', { name: 'Open my tavern' }).click();
  await page.waitForTimeout(800); await tap(page, 210, 20); await page.waitForTimeout(3500);
  await S(page, '01-start'); k.note('guide card ' + JSON.stringify(await txt(page, '.guide-card, .guide')) + ' info ' + JSON.stringify(await txt(page, '.info-panel')));
  if (false) await guard('hat', async () => {
    await openMore(page, 'Avatar'); await page.waitForTimeout(800); await S(page, '10-avatar');
    k.note('avatar panel buttons ' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.ui-panel.open button, .ui-panel.open [role=tab]')].map((b) => (b.className + '|' + ((b as HTMLElement).title || (b as HTMLElement).innerText)).slice(0, 40)))));
    const lk = async () => JSON.stringify((await k.state()).player?.look);
    const before = await lk();
    const hatTab = page.locator('.ui-panel.open').locator('button, [role=tab]').filter({ hasText: /hat/i }).first();
    if (await hatTab.count()) await hatTab.click(); else { const t = page.locator('.ui-panel.open [title*="Hat" i]').first(); if (await t.count()) await t.click(); else k.note('no hat tab'); }
    await page.waitForTimeout(500); await S(page, '11-hattab');
    const tiles = page.locator('.ui-panel.open canvas'); const n = await tiles.count(); k.note('canvases ' + n + ' wear btn ' + await page.getByRole('button', { name: /^Wear/ }).count());
    for (let i = 0; i < Math.min(n, 10); i++) { await tiles.nth(i).click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(300); if ((await lk()) !== before) { k.note('look changed after canvas ' + i + ' ' + await lk()); break; } }
    await S(page, '12-hatworn'); await page.keyboard.press('Escape');
  });
  await guard('fish', async () => {
    await page.evaluate(() => (document.querySelector('button[title^="Worlds"]') as HTMLElement).click()); await page.waitForTimeout(600);
    await page.locator('.travel-card', { hasText: /Lakeside/ }).first().click(); await page.waitForTimeout(6500);
    await tap(page, 5, 300); await page.waitForTimeout(500);
    const vp = page.viewportSize()!;
    // find water cells in screen space via the room data when exposed, else a coarse grid
    const water = await k.ph<any>(`const r=h.st.room; const out=[]; const wc=r.waterCells||r.water||null; return wc?JSON.stringify(wc).slice(0,200):'nowater'`).catch(() => 'err');
    k.note('water data ' + water);
    let cast = false; const log: string[] = [];
    for (let gy = 0.3; gy <= 0.56 && !cast; gy += 0.06) for (let gx = 0.45; gx <= 0.88 && !cast; gx += 0.1) {
      const before = await k.ph<any>('return {x:Math.round(h.st.avatar.x),y:Math.round(h.st.avatar.y)}');
      await tap(page, vp.width * gx, vp.height * gy); await page.waitForTimeout(2200);
      const after = await k.ph<any>('return {x:Math.round(h.st.avatar.x),y:Math.round(h.st.avatar.y)}');
      cast = (await page.locator('.fish-bar:visible').count()) > 0;
      log.push(`${gx.toFixed(2)},${gy.toFixed(2)} moved ${after.x - before.x},${after.y - before.y} cast ${cast} toast ${(await txt(page, '.toast')).join('/')}`);
      if (cast) await S(page, '20-cast');
    }
    k.note('fishing taps ' + log.length + ' cast ' + cast); for (const l of log.slice(0, 40)) k.note('  ' + l);
    await S(page, '21-end');
  });
  k.note('errors ' + errs.list.length + ' ' + JSON.stringify(errs.list));
});
