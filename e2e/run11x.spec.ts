// TESTER RUN 11 extras: side column + sign geometry, stove cooking/ready states, bar-guest flow (strip chips, grab/serve all), fishing reel.
// Shots r11-shots/{desktop,phone}-x-*. Config e2e/run11live.config.ts (add run11x to testMatch via -g or file filter).
import { test } from '@playwright/test';
import * as fs from 'fs';
import { kit } from './run6kit';
import { watchErrors } from './helpers';

fs.mkdirSync('r11-shots', { recursive: true });
const tagOf = (page: any) => (page.viewportSize().width < 600 ? 'phone' : 'desktop');
const S = (page: any, n: string, clip?: any) => page.screenshot({ path: `r11-shots/${tagOf(page)}-x-${n}.png`, ...(clip ? { clip } : {}) });

test('r11 extras', async ({ page }) => {
  test.setTimeout(540000);
  const errs = watchErrors(page); const k = kit(page, 'r11x');
  await page.goto('/?e2e'); await page.waitForTimeout(1500);
  await k.newGame();
  // geometry
  const geo = await page.evaluate(() => {
    const r = (e: Element | null) => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
    const btns = Array.from(document.querySelectorAll('.side-buttons > button')).map((b) => ({ t: (b as HTMLElement).title, box: r(b), vis: getComputedStyle(b).display !== 'none' }));
    return { vp: [innerWidth, innerHeight], btns, sign: r(document.querySelector('.open-sign')), tl: r(document.querySelector('.top-left')), info: r(document.querySelector('.info-panel, .top-left > *')) };
  });
  k.note('geometry ' + JSON.stringify(geo));
  await S(page, '00-hud');
  // cook: give the avatar a stove batch through the api
  const stoveUid = await k.ph<number>(`return h.st.items.find(i=>i.typeId==='stove').uid`);
  await k.ph(`await h.api.ensureTutorialCookSupplies(); return await h.api.startCook(${stoveUid}, 'roasted_turnip', 2)`);
  const sp = await k.ph<any>(`const i=h.st.items.find(i=>i.typeId==='stove'); return h.worldToScreen({x:i.x,y:i.y-16},h.st.shown)`);
  const clip = { x: Math.max(0, sp.x - 110), y: Math.max(0, sp.y - 110), width: 220, height: 200 };
  await page.waitForTimeout(1500); k.note('cooks ' + JSON.stringify(await k.ph<any>('return h.st.tavern.cooks'))); await S(page, '10-stove-cooking', clip); await page.waitForTimeout(6000); await S(page, '10b-stove-cooking-6s', clip); await S(page, '10-stove-cooking-full');
  await page.waitForTimeout(23000); await S(page, '11-stove-ready', clip); await S(page, '11-stove-ready-full');
  // bar guest hunt: shoot the chip strip while waiting
  let shots = 0; let seen = false;
  for (let i = 0; i < 70; i++) {
    await page.waitForTimeout(2500);
    const gs = await k.ph<any[]>(`return h.st.tavern.guests.map(g=>({id:g.id,x:Math.round(g.x),y:Math.round(g.y),kind:g.kind??g.where??null,phase:g.phase??null,state:g.state??null,order:g.order??null}))`).catch(() => []);
    if (i === 0) k.note('guest fields ' + JSON.stringify(gs[0] ?? null));
    const bar = gs.find((g) => /bar/.test(JSON.stringify(g)));
    if (bar && shots < 5) { seen = true; shots++; k.note('bar guest ' + JSON.stringify(bar)); await S(page, `20-bar-guest-${shots}`); await S(page, `21-strip-${shots}`, { x: 0, y: 150, width: 260, height: 400 }); }
    if (seen && shots >= 5) break;
  }
  k.note('seen bar guest ' + seen);
  // grab all / serve all buttons present?
  k.note('buttons ' + JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('button')).map((b) => (b.textContent || '').trim()).filter((t) => /grab|serve all/i.test(t)))));
  k.note('errors ' + JSON.stringify(errs.list));
});

test('r11 fish reel', async ({ page }) => {
  test.setTimeout(300000);
  const errs = watchErrors(page); const k = kit(page, 'r11reel');
  await page.goto('/?e2e'); await page.waitForTimeout(1500);
  await k.newGame();
  await page.evaluate(() => (document.querySelector('.side-buttons > button[title^="Worlds"]') as HTMLElement).click()); await page.waitForTimeout(500);
  await page.locator('.travel-card', { hasText: /Lakeside/ }).first().click(); await page.waitForTimeout(6500);
  await page.mouse.click(5, 300); await page.waitForTimeout(500);
  const vp = page.viewportSize()!;
  const bar = page.locator('.fish-bar:visible');
  for (let attempt = 0; attempt < 6; attempt++) {
    let cast = false;
    for (const fy of [0.28, 0.2, 0.38]) for (const fx of [0.85, 0.75, 0.9]) {
      if (cast) break;
      await page.mouse.click(vp.width * fx, vp.height * fy); await page.waitForTimeout(700);
      cast = (await bar.count()) > 0;
    }
    k.note(`attempt ${attempt} cast ${cast}`);
    if (!cast) continue;
    await page.evaluate(() => {
      const w = window as any; let t = 0; w.__drv = setInterval(() => {
        const r = document.querySelector('.fish-bar') as HTMLElement | null; const tap = document.querySelector('.fish-tap') as HTMLElement | null; if (!r || !tap) return;
        const ph = r.dataset.phase; w.__ph_log = w.__ph_log || []; if (w.__ph_log[w.__ph_log.length - 1] !== ph) w.__ph_log.push(ph);
        const ev = (n: string) => tap.dispatchEvent(new PointerEvent(n, { bubbles: true, pointerId: 1 }));
        if (ph === 'bite') { ev('pointerdown'); ev('pointerup'); }
        if (ph === 'reel') { t++; if (t % 8 < 4) ev('pointerdown'); else ev('pointerup'); }
      }, 30);
    });
    let n = 0;
    for (let i = 0; i < 400; i++) {
      await page.waitForTimeout(100);
      if (!(await bar.count())) break;
      const ph = await page.evaluate(() => (document.querySelector('.fish-bar') as HTMLElement | null)?.dataset.phase);
      if (ph === "bite" && n === 0) { n = 1; await S(page, "29-bite"); }
      if (ph === 'reel') { n++; if (n === 3 || n === 20 || n === 45) await S(page, "30-reel-" + n); }
    }
    k.note('phases ' + JSON.stringify(await page.evaluate(() => (window as any).__ph_log)));
    await page.evaluate(() => clearInterval((window as any).__drv));
    await page.keyboard.up('Space');
    await page.waitForTimeout(800); await S(page, `31-after-${attempt}`);
    if (n > 5) break;
    await page.waitForTimeout(1500);
  }
  k.note('errors ' + JSON.stringify(errs.list));
});
