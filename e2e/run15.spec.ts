// TESTER RUN 15 ship gate (one browser): title logo, taps panel, skills, phone orders row, camera peek, NPC bubbles, fishing, console. Shots r15-shots/
import { test } from '@playwright/test';
import * as fs from 'fs';
import { kit } from './run6kit';
import { watchErrors, openMore } from './helpers';

fs.mkdirSync('r15-shots', { recursive: true });
const tagOf = (page: any) => (page.viewportSize().width < 600 ? 'phone' : 'desktop');
const S = (page: any, n: string) => page.screenshot({ path: `r15-shots/${tagOf(page)}-${n}.png` });
const tap = async (page: any, x: number, y: number) => { if (tagOf(page) === 'phone') await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); };
const box = (page: any, sel: string) => page.evaluate((s: string) => [...document.querySelectorAll(s)].map((e) => { const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; }), sel);

test('r15 gate', async ({ page }) => {
  test.setTimeout(900000);
  const errs = watchErrors(page); const k = kit(page, 'r15');
  await page.addInitScript(() => {
    (window as any).__says = [];
    const start = Date.now();
    new MutationObserver((ms) => { for (const m of ms) m.addedNodes.forEach((n: any) => { if (n.nodeType === 1) { const l = n.classList?.contains('npc-line') ? n : n.querySelector?.('.npc-line'); if (l) (window as any).__says.push([Math.round((Date.now() - start) / 1000), l.textContent]); } }); }).observe(document, { childList: true, subtree: true });
  });
  await page.goto('/?e2e'); await page.waitForTimeout(3000);
  await S(page, '01-title');
  await page.getByText('New game').first().click();
  await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click();
  await page.getByRole('button', { name: 'Open my tavern' }).click();
  await page.waitForTimeout(800);
  await tap(page, 210, 20); await page.waitForTimeout(3500);
  await S(page, '02-start');
  // (2) taps panel
  const uid = (await k.state()).items.find((i: any) => i.typeId === 'tap_stand').uid;
  const sp = await k.ph<any>(`return h.standPoint(${uid})`);
  await tap(page, sp.x, sp.y); await page.waitForTimeout(1500);
  await page.screenshot({ path: `r15-shots/${tagOf(page)}-10-taps.png` });
  k.note('taps panel ' + JSON.stringify({ panel: await box(page, '.taps-panel'), hotbar: await box(page, '.hotbar'), btns: await box(page, '.taps-panel button'), side: await box(page, '.side-buttons'), txt: await page.evaluate(() => (document.querySelector('.taps-panel') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').slice(0, 300)) }));
  // (3) skills
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await openMore(page, 'Skills'); await page.waitForTimeout(800);
  await S(page, '20-skills');
  k.note('skills ' + JSON.stringify({ panel: await box(page, '.ui-panel.open'), side: await box(page, '.side-buttons'), tabs: await box(page, '.ui-panel.open .tab-btn') }));
  const tabs = page.locator('.ui-panel.open .tab-btn'); const n = await tabs.count();
  k.note('skill tabs ' + n);
  for (let i = 0; i < n; i++) { await tabs.nth(i).click({ timeout: 2000 }).catch(() => k.note('tab ' + i + ' NOT clickable')); await page.waitForTimeout(250); if (i === 3 || i === 4) await S(page, `21-skills-tab${i}`); }
  // ore_sense: mining tab
  const mi = page.locator('.ui-panel.open .tab-btn[title*="ine" i], .ui-panel.open .tab-btn[title*="Mining" i]').first();
  if (await mi.count()) { await mi.click().catch(() => {}); await page.waitForTimeout(300); await S(page, '22-skills-mining'); }
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  // (4)+(6) wait for guests, sample bubbles, orders row
  let g: any = null;
  for (let i = 0; i < 60 && !g; i++) { await page.waitForTimeout(2000); g = (await k.state()).tavern.guests.find((x: any) => x.order); }
  k.note('guest with order ' + !!g);
  await page.waitForTimeout(2500);
  await S(page, '30-orders');
  k.note('orders ' + JSON.stringify({ strip: await box(page, '.orders-strip'), chips: await box(page, '.orders-strip > *'), ctx: await box(page, '.ctx-btn'), toast: await box(page, '.toast'), avatarScreen: await k.ph<any>('return h.worldToScreen({x:h.st.avatar.x,y:h.st.avatar.y-28}, h.st.shown)') }));
  if (g) {
    const p = await k.toScreen(g.x, g.y - 28); await tap(page, p.x, p.y); await page.waitForTimeout(3500);
    const sp2 = await k.ph<any>(`return h.standPoint(${uid})`);
    if (tagOf(page) === 'desktop') { await page.mouse.move(sp2.x, sp2.y); await page.mouse.down(); await page.waitForTimeout(1250); await page.mouse.up(); }
    else { const c = await page.evaluate(() => 0); await page.touchscreen.tap(sp2.x, sp2.y); }
    await page.waitForTimeout(1500); await S(page, '31-after-pour');
    const st = await k.state(); k.note('tray ' + JSON.stringify(st.tavern.tray));
    const g2 = st.tavern.guests.find((x: any) => x.order);
    if (g2 && st.tavern.tray?.length) { const q = await k.toScreen(g2.x, g2.y - 28); await tap(page, q.x, q.y); }
    await page.waitForTimeout(12000);
  }
  await page.waitForTimeout(60000);
  await S(page, '32-later');
  k.note('says ' + JSON.stringify(await page.evaluate(() => (window as any).__says)));
  // (5) peek after Continue on menu step
  await page.evaluate(() => localStorage.setItem('pixel-hotel.first-ten', JSON.stringify({ active: true, skipped: false, done: ['zoom', 'walk', 'holdwalk'], tips: [] })));
  await page.goto('/?e2e'); await page.waitForTimeout(2500);
  await page.getByText('Continue').first().click(); await page.waitForTimeout(6000);
  await S(page, '40-continue-peek');
  const reg = await k.ph<any>(`const s=h.st.items.find(i=>i.typeId==='register'&&i.roomId===h.st.room.id); return h.worldToScreen({x:s.x,y:s.y}, h.st.shown)`);
  k.note('register screen ' + JSON.stringify(reg) + ' vp ' + JSON.stringify(page.viewportSize()) + ' guide ' + JSON.stringify(await page.evaluate(() => (document.querySelector('.guide-card') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').slice(0, 100))));
  await page.waitForTimeout(3000); await S(page, '41-peek-later');
  await page.evaluate(() => localStorage.setItem('pixel-hotel.first-ten', JSON.stringify({ active: false, skipped: true, done: [], tips: [] })));
  // (7) fishing
  await page.evaluate(() => (document.querySelector('button[title^="Worlds"]') as HTMLElement).click()); await page.waitForTimeout(600);
  await page.locator('.travel-card', { hasText: /Lakeside/ }).first().click(); await page.waitForTimeout(6500);
  await tap(page, 5, 300); await page.waitForTimeout(500);
  await S(page, '50-lakeside');
  const vp = page.viewportSize()!;
  const bar = page.locator('.fish-bar:visible');
  let cast = false;
  for (const fy of [0.28, 0.2, 0.38, 0.5, 0.6]) for (const fx of [0.85, 0.75, 0.9, 0.6, 0.4]) {
    if (cast) break;
    await tap(page, vp.width * fx, vp.height * fy); await page.waitForTimeout(1400);
    cast = (await bar.count()) > 0;
    if (cast) k.note(`cast at ${fx},${fy}`);
  }
  k.note('cast ' + cast);
  if (cast) {
    let last = ''; let m = 0; let reel = 0; const t0 = Date.now(); let win = false;
    for (let i = 0; i < 700; i++) {
      await page.waitForTimeout(100);
      if (!(await bar.count())) { k.note('bar gone after ' + (Date.now() - t0) + 'ms'); break; }
      const t = (await page.locator('.fish-text').first().innerText().catch(() => '')) || '';
      if (t !== last) { last = t; m++; if (m < 8) await S(page, `51-fish-${m}`); k.note(`t=${Date.now() - t0} phase: ${t}`); }
      if (/bite|now|!/i.test(t)) await tap(page, vp.width * 0.5, vp.height * 0.8);
      else if (/box|fish|reel|hold/i.test(t)) { reel++; if (reel % 3 === 0) { await page.keyboard.down('Space'); await page.waitForTimeout(220); await page.keyboard.up('Space'); } if (reel === 6) { await S(page, '52-reel'); k.note('fishbar ' + JSON.stringify(await box(page, '.fish-bar'))); } }
    }
    await page.waitForTimeout(1500); await S(page, '53-after');
  }
  k.note('errors ' + JSON.stringify(errs.list));
});
