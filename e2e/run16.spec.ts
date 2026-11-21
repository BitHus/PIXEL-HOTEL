// TESTER RUN 16 ship gate (one browser): start layout, pour anywhere, food stash, punch toggle, level-up toast, phone UI, skills tabs, fishing. Shots r16-shots/
import { test } from '@playwright/test';
import * as fs from 'fs';
import { kit } from './run6kit';
import { watchErrors, openMore } from './helpers';

fs.mkdirSync('r16-shots', { recursive: true });
const tagOf = (page: any) => (page.viewportSize().width < 600 ? 'phone' : 'desktop');
const S = (page: any, n: string) => page.screenshot({ path: `r16-shots/${tagOf(page)}-${n}.png` });
const tap = async (page: any, x: number, y: number) => { if (tagOf(page) === 'phone') await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); };
const box = (page: any, sel: string) => page.evaluate((s: string) => [...document.querySelectorAll(s)].map((e) => { const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; }), sel);
const txt = (page: any, sel: string): Promise<string[]> => page.evaluate((s: string) => [...document.querySelectorAll(s)].map((e) => (e as HTMLElement).innerText.replace(/\s+/g, ' ').slice(0, 160)), sel);

test('r16 gate', async ({ page }) => {
  test.setTimeout(900000);
  page.setDefaultTimeout(6000);
  const errs = watchErrors(page); const k = kit(page, 'r16');
  const guard = async (n: string, f: () => Promise<void>) => { try { await f(); } catch (e) { k.note(`STEP ${n} THREW ${String((e as Error).message).split('\n')[0]}`); } };
  await page.goto('/?e2e'); await page.waitForTimeout(2500);
  await page.getByText('New game').first().click();
  await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click();
  await page.getByRole('button', { name: 'Open my tavern' }).click();
  await page.waitForTimeout(800);
  await tap(page, 210, 20); await page.waitForTimeout(3500);
  // (1) layout
  await S(page, '01-start');
  await guard('layout', async () => {
    const w = await k.where(); k.note('room ' + JSON.stringify({ kind: w.kind, shape: w.shape, w: w.w, h: w.h, av: w.av })); k.note('items ' + w.items.join(' '));
    const vp = page.viewportSize()!;
    const pts = await k.ph<any>(`const o={}; for(const i of h.st.items.filter(i=>i.roomId===h.st.room.id&&['register','tap_stand','stove','serving_hatch','bar','barrel','brewing_barrel'].includes(i.typeId))){ const p=h.worldToScreen({x:i.x,y:i.y},h.st.shown); (o[i.typeId]=o[i.typeId]||[]).push([Math.round(p.x),Math.round(p.y)]); } return o`);
    k.note('screen pts ' + JSON.stringify(pts) + ' vp ' + vp.width + 'x' + vp.height);
  });
  // prep: dishes in bag + xp 14 + dirt
  await guard('patch', async () => {
    await k.patchAndContinue((s) => { const p = s.player ?? s; p.materials = { ...(p.materials ?? {}), roasted_turnip: 12, potato_stew: 6, dirt: 5 }; p.xp = 14; });
    await S(page, '02-continued');
  });
  // (3) stash
  await guard('stash', async () => {
    const st = await k.state(); const hatch = st.items.find((i: any) => i.typeId === 'serving_hatch');
    k.note('hatch ' + JSON.stringify(hatch && { x: hatch.x, y: hatch.y }));
    const p = await k.toScreen(hatch.x, hatch.y - 14); await tap(page, p.x, p.y); await page.locator('.stash-panel .stash-slots').waitFor({ state: 'visible', timeout: 20000 }).catch(() => k.note('stash panel never visible')); await page.waitForTimeout(500);
    await S(page, '10-stash-open'); k.note('stash panel ' + JSON.stringify(await txt(page, '.stash-panel')));
    k.note('bag dishes ' + await page.locator('.stash-dish').count());
    await page.locator('.stash-dish').first().click(); await page.waitForTimeout(500); await S(page, '11-stash-loaded'); k.note('after 1 click ' + JSON.stringify(await txt(page, '.stash-slot')));
    await page.locator('.stash-slot:not(.empty)').first().click(); await page.waitForTimeout(500); k.note('after unload ' + JSON.stringify(await txt(page, '.stash-slot')));
    await page.locator('.stash-dish').first().click(); await page.waitForTimeout(300);
    await page.locator('.stash-dish').first().click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(300);
    k.note('refill visible ' + await page.locator('.stash-refill:visible').count());
    await page.locator('.stash-refill:visible').click({ timeout: 1500 }).catch(() => k.note('refill not clickable'));
    await page.waitForTimeout(500); await S(page, '12-stash-two'); k.note('stash now ' + JSON.stringify(await txt(page, '.stash-slot')));
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    await S(page, '13-lowdots');
  });
  // (4) punch toggle
  await guard('punch', async () => {
    const av = await k.ph<any>('return {x:h.st.avatar.x,y:h.st.avatar.y}');
    const c = Math.floor(av.x / 32) + 2, r = Math.floor(av.y / 32);
    const placed = await k.ph<any>(`return JSON.stringify(await h.api.placeBlock(${c},${r},'dirt'))`).catch((e) => 'ERR ' + e);
    k.note('placeBlock ' + String(placed).slice(0, 80));
    await page.waitForTimeout(500);
    const has = async () => (await k.ph<any>(`return JSON.stringify(h.st.room.blocks).includes('dirt')`));
    k.note('block present ' + await has());
    const p = await k.toScreen(c * 32 + 16, r * 32 + 16);
    const btn = page.locator('.hotbar-punch'); k.note('punch btn ' + JSON.stringify(await box(page, '.hotbar-punch')) + ' hotbar ' + JSON.stringify(await box(page, '.hotbar')) + ' cls ' + await btn.getAttribute('class') + ' pressed ' + await btn.getAttribute('aria-pressed'));
    await S(page, '20-punch-before');
    for (let i = 0; i < 4; i++) { await tap(page, p.x, p.y); await page.waitForTimeout(700); }
    k.note('chill after 4 taps present ' + await has()); await S(page, '21-chill');
    await btn.click(); await page.waitForTimeout(300); k.note('punch cls ' + await btn.getAttribute('class') + ' pressed ' + await btn.getAttribute('aria-pressed'));
    await S(page, '22-punch-on');
    for (let i = 0; i < 6 && await has(); i++) { await tap(page, p.x, p.y); await page.waitForTimeout(700); }
    k.note('punch on after taps present ' + await has()); await S(page, '23-punched');
    await btn.click().catch(() => {});
  });
  // (2)+(5) pour with level up
  await guard('pour', async () => {
    let g: any = null; const t0 = Date.now();
    for (let i = 0; i < 70 && !g; i++) { await page.waitForTimeout(2000); g = (await k.state()).tavern.guests.find((x: any) => x.order); }
    k.note('guest with order after ' + (Date.now() - t0) + 'ms ' + !!g);
    if (!g) return;
    const p = await k.toScreen(g.x, g.y - 28); await tap(page, p.x, p.y);
    let waiting = false; for (let i = 0; i < 30 && !waiting; i++) { await page.waitForTimeout(500); waiting = JSON.stringify((await k.state()).tavern).includes('pourwait'); }
    k.note('pourwait ' + waiting); await S(page, '30-pourwait');
    k.note('serve/pour buttons ' + JSON.stringify((await txt(page, 'button')).filter((s) => /serve|pour/i.test(s))) + ' ctx ' + await page.locator('.ctx-btn:visible').count() + ' htmlpour ' + await page.locator('.pour-bar:visible').count());
    const vp = page.viewportSize()!; const hx = Math.round(vp.width * 0.3), hy = Math.round(vp.height * 0.35);
    await tap(page, hx, hy); await page.waitForTimeout(250); k.note('toast after quick tap ' + JSON.stringify(await txt(page, '.toast')));
    await S(page, '31-quicktap');
    if (tagOf(page) === 'desktop') { await page.mouse.move(hx, hy); await page.mouse.down(); await page.waitForTimeout(600); await S(page, '32-holding'); k.note('htmlpour while holding ' + await page.locator('.pour-bar:visible').count()); await page.waitForTimeout(450); await page.mouse.up(); }
    else {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: hx, y: hy }] }); await page.waitForTimeout(600); await S(page, '32-holding'); await page.waitForTimeout(450);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await page.waitForTimeout(400); const st = await k.state(); k.note('tray after pour ' + JSON.stringify(st.tavern.tray));
    await S(page, '33-after-pour');
    const g2 = st.tavern.guests.find((x: any) => x.order);
    if (g2 && st.tavern.tray?.length) { const q = await k.toScreen(g2.x, g2.y - 28); await tap(page, q.x, q.y); }
    for (let i = 0; i < 24; i++) { await page.waitForTimeout(500); const t = await txt(page, '.toast'); if (t.some((s) => /Level/i.test(s))) { k.note('LEVEL TOAST ' + JSON.stringify(t) + ' box ' + JSON.stringify(await box(page, '.toast'))); await S(page, '34-levelup'); break; } }
    const s2 = await k.state(); k.note('player level ' + s2.player?.level + ' xp ' + s2.player?.xp);
    k.note('toast bg ' + await page.evaluate(() => { const e = document.querySelector('.toast'); return e ? getComputedStyle(e).backgroundColor : 'none'; }));
  });
  // (6) hat picker
  await guard('hat', async () => {
    await page.keyboard.press('Escape');
    await openMore(page, 'Avatar'); await page.waitForTimeout(800); await S(page, '40-avatar');
    const lk = async () => { const s = await k.state(); return JSON.stringify(s.player?.look ?? s.look); };
    const before = await lk();
    await page.locator('.ui-panel.open').getByText('Hat', { exact: true }).first().click({ timeout: 2500 }).catch(() => k.note('hat tab not found by text'));
    await page.waitForTimeout(400); await S(page, '41-hattab');
    const tiles = page.locator('.ui-panel.open [class*=hat]'); const n = await tiles.count(); k.note('hat-ish elements ' + n + ' wear btn ' + await page.getByRole('button', { name: /^Wear$/ }).count());
    for (let i = 0; i < Math.min(n, 12); i++) { await tiles.nth(i).click({ timeout: 1000 }).catch(() => {}); await page.waitForTimeout(300); if ((await lk()) !== before) { k.note('look changed after click on element ' + i); break; } }
    await S(page, '42-hatworn'); await page.keyboard.press('Escape');
  });
  // tutorial card + text amount
  await guard('tutorial', async () => {
    await page.evaluate(() => localStorage.setItem('pixel-hotel.first-ten', JSON.stringify({ active: true, skipped: false, done: [], tips: [] })));
    await page.goto('/?e2e'); await page.waitForTimeout(2500);
    await page.getByText('Continue').first().click(); await page.waitForTimeout(5000);
    await S(page, '50-tutorial'); k.note('guide card ' + JSON.stringify(await txt(page, '.guide-card')) + JSON.stringify(await box(page, '.guide-card')) + ' info ' + JSON.stringify(await box(page, '.info-panel')) + ' infotext ' + JSON.stringify(await txt(page, '.info-panel')));
    await page.evaluate(() => localStorage.setItem('pixel-hotel.first-ten', JSON.stringify({ active: false, skipped: true, done: [], tips: [] })));
  });
  // (7) skills
  await guard('skills', async () => {
    await page.goto('/?e2e'); await page.waitForTimeout(2000); await page.getByText('Continue').first().click(); await page.waitForTimeout(3500);
    await openMore(page, 'Skills'); await page.waitForTimeout(800); await S(page, '60-skills');
    const all = await box(page, '.ui-panel.open .tab-btn'); const alt = await page.locator('.ui-panel.open [class*=tab]').count();
    k.note('skills tab-btn ' + all.length + ' any [class*=tab] ' + alt + ' panel ' + JSON.stringify(await box(page, '.ui-panel.open')) + ' side ' + JSON.stringify(await box(page, '.side-buttons')) + ' classes ' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.ui-panel.open button')].slice(0, 12).map((b) => b.className + '|' + (b as HTMLElement).title))));
    const tabs = await page.evaluate(() => { const p = document.querySelector('.ui-panel.open')!.getBoundingClientRect(); return [...document.querySelectorAll('button')].map((b) => ({ r: b.getBoundingClientRect(), c: b.className, t: b.title })).filter((o) => o.r.width > 0 && o.r.bottom <= p.top + 70 && o.r.bottom >= p.top - 5 && o.r.left >= p.left - 10 && o.r.right <= p.right + 10).map((o) => `${o.c}|${o.t}|${Math.round(o.r.left)},${Math.round(o.r.top)},${Math.round(o.r.width)}`); });
    k.note('skill tabs above panel ' + tabs.length + ' ' + JSON.stringify(tabs));
    const p0 = (await box(page, '.ui-panel.open'))[0]; await tap(page, p0[0] + 40, Math.max(2, p0[1] - 20)); await page.waitForTimeout(400); await S(page, '61-skills-tab2');
    await page.keyboard.press('Escape');
  });
  // fishing
  await guard('fish', async () => {
    await page.evaluate(() => (document.querySelector('button[title^="Worlds"]') as HTMLElement).click()); await page.waitForTimeout(600);
    await page.locator('.travel-card', { hasText: /Lakeside/ }).first().click(); await page.waitForTimeout(6500);
    await tap(page, 5, 300); await page.waitForTimeout(500); await S(page, '70-lakeside');
    const vp = page.viewportSize()!; const w = await k.where(); k.note('lake ' + JSON.stringify({ kind: w.kind, av: w.av }));
    let cast = false; let tried = 0;
    for (const fy of [0.28, 0.2, 0.38, 0.5, 0.6, 0.15]) for (const fx of [0.85, 0.75, 0.9, 0.6, 0.4, 0.25]) {
      if (cast) break; tried++;
      await tap(page, vp.width * fx, vp.height * fy); await page.waitForTimeout(1500);
      cast = (await page.locator('.fish-bar:visible').count()) > 0;
      if (cast) { k.note(`cast at ${fx},${fy}`); await S(page, '71-cast'); }
    }
    k.note('cast ' + cast + ' tried ' + tried + ' fish-ish elements ' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('[class*=fish]')].map((e) => e.className))));
    await S(page, '72-end');
  });
  k.note('errors ' + errs.list.length + ' ' + JSON.stringify(errs.list));
});
