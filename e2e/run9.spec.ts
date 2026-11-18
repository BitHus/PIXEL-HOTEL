// TESTER RUN 9: PixelLab tavern furniture in game. Shots in r9-shots/.
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { kit } from './run6kit';
import { watchErrors } from './helpers';

fs.mkdirSync('r9-shots', { recursive: true });
const phone = (page: any) => page.viewportSize().width < 600;
const S = (page: any, n: string) => page.screenshot({ path: `r9-shots/${phone(page) ? 'phone' : 'desktop'}-${n}.png` });

test('r9 tavern furniture', async ({ page }) => {
  test.setTimeout(240000);
  const errs = watchErrors(page); const k = kit(page, 'r9');
  await k.newGame(); await page.waitForTimeout(2500); await S(page, '01-settled');
  const items = await k.ph<any[]>(`return h.st.items.filter(i=>i.roomId===h.st.room.id).map(i=>({uid:i.uid,t:i.typeId,x:i.x,y:i.y,r:i.rotation,s:i.onSurfaceOf??null}))`);
  k.note('items ' + JSON.stringify(items));
  const cam = async (wx: number, wy: number, z: number) => { await k.ph(`const W=innerWidth,H=innerHeight; h.setCamera({x:${wx}-W/2/${z},y:${wy}-H/2/${z},zoom:${z}},true); return 1`); await page.waitForTimeout(400); };
  const Z = phone(page) ? 4 : 4;
  const at = (t: string) => items.find((i) => i.t === t);
  const reg = at('register'); const tap = at('tap_stand'); const tb = at('table'); const st = at('stove'); const br = at('brewing_barrel'); const av = await k.ph<any>(`return {x:h.st.avatar.x,y:h.st.avatar.y}`);
  k.note('avatar ' + JSON.stringify(av));
  if (reg && tap) { await cam((reg.x + tap.x) / 2, reg.y - 20, Z); await S(page, '02-bar-zoom'); }
  if (tb) { await cam(tb.x, tb.y - 20, Z); await S(page, '03-table-empty'); }
  // wait for guests seated
  for (let i = 0; i < 60; i++) { const g = await k.ph<any[]>(`return h.st.guests?.length?1:0`).catch(() => 0); if ((await k.state()).tavern.guests.some((x: any) => x.state === 'seated' || x.order)) break; await page.waitForTimeout(2000); }
  await page.waitForTimeout(1500);
  if (tb) { await cam(tb.x, tb.y - 20, Z); await S(page, '04-table-guests'); }
  await cam(tb ? tb.x : 200, tb ? tb.y : 200, 2.5); await S(page, '05-guests-wide');
  // stove cooking
  if (st) {
    const food = await k.ph<any>(`const f=h.st.player?.inventory; return null`).catch(() => null);
    const ok = await k.ph<any>(`const f='roasted_turnip'; try { return await h.api.startCook(${st.uid}, f, 2); } catch(e) { return String(e); }`);
    k.note('startCook ' + ok);
    await cam(st.x, st.y - 20, Z); await page.waitForTimeout(1500); await S(page, '06-stove-cooking');
    await page.waitForTimeout(24000); await S(page, '07-stove-ready');
  }
  if (br) { await cam(br.x, br.y - 20, Z); await S(page, '08-barrel-idle');
    const ok = await k.ph<any>(`try { const r = await h.api.startBrew?.(${br.uid}, 'root_ale', 1); return r; } catch(e) { return String(e); }`); k.note('brew ' + ok);
    await page.waitForTimeout(1500); await S(page, '09-barrel-brewing'); }
  // depth: avatar behind and in front of counter
  const cnt = at('counter');
  if (cnt) {
    for (const [n, dy] of [['behind', -40], ['front', 40]] as const) {
      await k.ph(`h.st.avatar.x=${cnt.x}; h.st.avatar.y=${cnt.y + dy}; return 1`);
      await cam(cnt.x, cnt.y - 20, Z); await page.waitForTimeout(500); await S(page, `10-depth-${n}`);
    }
  }
  expect(errs.list).toEqual([]);
});

test('r9 build rotations and catalog', async ({ page }) => {
  test.setTimeout(120000);
  const errs = watchErrors(page); const k = kit(page, 'r9b');
  await k.newGame(); await page.waitForTimeout(1500);
  const cam = async (wx: number, wy: number, z: number) => { await k.ph(`const W=innerWidth,H=innerHeight; h.setCamera({x:${wx}-W/2/${z},y:${wy}-H/2/${z},zoom:${z}},true); return 1`); await page.waitForTimeout(400); };
  const items = await k.ph<any[]>(`return h.st.items.filter(i=>i.roomId===h.st.room.id).map(i=>({uid:i.uid,t:i.typeId,x:i.x,y:i.y}))`);
  const tag = phone(page) ? 'phone' : 'desktop';
  const side = async (t: string) => { const b = page.locator(`button[title^="${t}"]`).first(); if (!(await b.isVisible())) await page.locator('button.more-btn').dispatchEvent('click'); await b.dispatchEvent('click'); await page.waitForTimeout(800); };
  await side('Catalog');
  await page.locator('.ui-panel').first().evaluate((el) => { const s = el.querySelector('[class*=grid], [class*=list]') ?? el; (s as HTMLElement).scrollTop = 0; });
  await page.screenshot({ path: `r9-shots/${tag}-20-catalog.png` });
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await side('Build'); await page.waitForTimeout(600);
  for (let n = 1; n <= 3; n++) {
    for (const t of ['table', 'stove', 'counter', 'bar_stool', 'brewing_barrel']) {
      const it = items.find((i) => i.t === t); if (!it) continue;
      const r = await Promise.race([k.ph<any>(`const r = await h.api.rotateItem(${it.uid}); return r ? 'ok' : 'refused'`), new Promise((res) => setTimeout(() => res('timeout'), 4000))]); k.note('rot' + n + ' ' + t + ' ' + r);
    }
    await cam(130, 300, phone(page) ? 2.5 : 3); await page.waitForTimeout(900);
    await page.screenshot({ path: `r9-shots/${tag}-2${1 + n}-build-rot${n}.png` });
  }
  expect(errs.list).toEqual([]);
});

test('r9 build rotate by UI', async ({ page }) => {
  test.setTimeout(120000);
  const errs = watchErrors(page); const k = kit(page, 'r9c');
  await k.newGame(); await page.waitForTimeout(1500);
  const tag = phone(page) ? 'phone' : 'desktop';
  const cam = async (wx: number, wy: number, z: number) => { await k.ph(`const W=innerWidth,H=innerHeight; h.setCamera({x:${wx}-W/2/${z},y:${wy}-H/2/${z},zoom:${z}},true); return 1`); await page.waitForTimeout(500); };
  const side = async (t: string) => { const b = page.locator(`button[title^="${t}"]`).first(); if (!(await b.isVisible())) await page.locator('button.more-btn').dispatchEvent('click'); await b.dispatchEvent('click'); await page.waitForTimeout(800); };
  await side('Build'); await cam(130, 310, phone(page) ? 2.5 : 3);
  const items = await k.ph<any[]>(`return h.st.items.filter(i=>i.roomId===h.st.room.id).map(i=>({uid:i.uid,t:i.typeId,x:i.x,y:i.y}))`);
  let idx = 0;
  for (const t of ['table', 'counter', 'stove', 'brewing_barrel', 'bar_stool']) {
    const it = items.find((i) => i.t === t)!;
    for (let n = 0; n < 4; n++) {
      const p = await k.toScreen(it.x, it.y - 14); await page.mouse.click(p.x, p.y); await page.waitForTimeout(500);
      if (n === 0) { await page.screenshot({ path: `r9-shots/${tag}-30-${t}-selected.png` }); k.note(t + ' menu: ' + (await page.locator('button').allInnerTexts()).filter((x) => /rotate|pick/i.test(x)).join('|')); }
      const rot = page.locator('button[title^="Rotate"], button[aria-label^="Rotate"]').first();
      if (n > 0 && await rot.count()) await rot.dispatchEvent('click');
      await page.waitForTimeout(600);
      if (n > 0) await page.screenshot({ path: `r9-shots/${tag}-3${++idx % 10}-${t}-rot${n}.png` });
    }
    await page.keyboard.press('Escape');
  }
  expect(errs.list).toEqual([]);
});
