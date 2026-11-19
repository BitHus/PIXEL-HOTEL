// TESTER RUN 14 ship gate: RUN 13 fixes, highlight/arrow/trail/peek, misclick, audio, doors, skills, migration. Shots r14-shots/{desktop,phone}-*.png
import { test } from '@playwright/test';
import * as fs from 'fs';
import { kit } from './run6kit';
import { saveState, watchErrors } from './helpers';

fs.mkdirSync('r14-shots', { recursive: true });
const tagOf = (page: any) => (page.viewportSize().width < 600 ? 'phone' : 'desktop');
const S = (page: any, n: string) => page.screenshot({ path: `r14-shots/${tagOf(page)}-${n}.png` });
const tap = async (page: any, x: number, y: number) => { if (tagOf(page) === 'phone') await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); };
const R = (sel: string) => `(() => { const e = document.querySelector('${sel}'); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; })()`;
async function newGame1(page: any) {
  await page.goto('/?e2e'); await page.waitForTimeout(1200);
  await page.getByText('New game').first().click();
  await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click();
  await page.getByRole('button', { name: 'Open my tavern' }).click();
  await page.waitForTimeout(800);
  await tap(page, 210, 20); await page.waitForTimeout(3500);
}
const travel = async (page: any, re: RegExp, ms = 7000) => {
  await page.evaluate(() => (document.querySelector('button[title^="Worlds"]') as HTMLElement).click()); await page.waitForTimeout(600);
  await page.locator('.travel-card', { hasText: re }).first().click(); await page.waitForTimeout(ms);
};
const info = (page: any) => page.evaluate(() => {
  const r = (e: Element | null) => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
  const p = document.querySelector('.guide-pointer');
  return { on: !!p?.classList.contains('on'), edge: !!p?.classList.contains('edge'), ring: r(document.querySelector('.guide-ring')), hand: r(document.querySelector('.guide-hand')), card: r(document.querySelector('.guide-card')), cardText: (document.querySelector('.guide-card') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').slice(0, 90), vw: innerWidth, vh: innerHeight };
});

test('r14 fixes + tutorial', async ({ page }) => {
  test.setTimeout(900000);
  const errs = watchErrors(page); const k = kit(page, 'r14tut');
  await page.goto('/?e2e'); await page.waitForTimeout(2500);
  await S(page, '01-title');
  await newGame1(page);
  await S(page, '02-start');
  await page.locator('.icon-btn[aria-label*="atalog"], .icon-btn[title*="atalog"]').first().click(); await page.waitForTimeout(500);
  await page.locator('.tab-btn[title="Packs"]').click(); await page.waitForTimeout(500);
  await S(page, '10-packs');
  k.note('packs ' + JSON.stringify(await page.evaluate(`({ panel: ${R('.catalog-panel')}, tab: ${R('.tab-btn[title="Packs"]')}, side: ${R('.side-buttons')}, labels: [...document.querySelectorAll('.pack-odds-label')].map(e=>e.textContent).slice(0,4) })`)));
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  const STEPS = ['zoom', 'walk', 'holdwalk', 'menu', 'pour', 'serve', 'coins', 'barrel', 'collect', 'load', 'cellar', 'stove', 'farm', 'plant', 'harvest', 'build', 'wall', 'dungeon'];
  for (const s of ['menu', 'stove', 'cellar', 'wall', 'farm', 'build']) {
    const idx = STEPS.indexOf(s);
    await page.evaluate(({ done }) => { localStorage.setItem('pixel-hotel.first-ten', JSON.stringify({ active: true, skipped: false, done, tips: [] })); }, { done: STEPS.slice(0, idx) });
    await k.patchAndContinue((st) => { st.player.level = Math.max(st.player.level ?? 1, 1); });
    await page.waitForTimeout(2500);
    const q = await info(page);
    const hl = await page.evaluate(`({ ringHasPk: !!document.querySelector('.guide-ring.pk-hl'), orders: ${R('.orders-strip')} })`);
    k.note(`== ${s} ` + JSON.stringify(q) + ' ' + JSON.stringify(hl));
    await S(page, `20-step-${s}`);
    if (s === 'menu' || s === 'stove') {
      const c0 = await k.ph<any>('return {x:h.st.shown.x,y:h.st.shown.y,g:h.st.guideWorld}');
      await page.waitForTimeout(2200);
      const c1 = await k.ph<any>('return {x:h.st.shown.x,y:h.st.shown.y,g:h.st.guideWorld}');
      k.note(`peek ${s} before ${JSON.stringify(c0)} after ${JSON.stringify(c1)}`);
      await S(page, `21-peek-${s}`);
    }
  }
  k.note('errors ' + JSON.stringify(errs.list));
});

test('r14 misclick', async ({ page }) => {
  test.setTimeout(400000);
  const errs = watchErrors(page); const k = kit(page, 'r14mis');
  await newGame1(page);
  await page.evaluate(() => localStorage.setItem('pixel-hotel.first-ten', JSON.stringify({ active: false, skipped: true, done: [], tips: [] })));
  await page.waitForTimeout(500);
  const stove = await k.ph<any>(`const s=h.st.items.find(i=>i.typeId==='stove'&&i.roomId===h.st.room.id); return {x:s.x,y:s.y}`);
  const p = await k.toScreen(stove.x, stove.y - 12);
  k.note('stove screen ' + JSON.stringify(p));
  if (k.tag === 'desktop') {
    await page.mouse.move(p.x, p.y); await page.waitForTimeout(400);
    await S(page, '30-hover-stove');
    k.note('hover ' + JSON.stringify(await page.evaluate(`({ hl: ${R('.interact-hl')}, hidden: document.querySelector('.interact-hl')?.hasAttribute('hidden'), tag: document.querySelector('.interact-tag')?.textContent, cur: document.querySelector('canvas').style.cursor, pk: !!document.querySelector('.interact-hl.pk-hl') })`)));
    for (const id of ['register', 'tap_stand', 'brewing_barrel']) {
      const it = await k.ph<any>(`const s=h.st.items.find(i=>i.typeId==='${id}'&&i.roomId===h.st.room.id); return s?{x:s.x,y:s.y}:null`);
      if (!it) { k.note('no ' + id); continue; }
      const q = await k.toScreen(it.x, it.y - 14); await page.mouse.move(q.x, q.y); await page.waitForTimeout(300);
      k.note(`hover ${id} ` + JSON.stringify(await page.evaluate(`({ tag: document.querySelector('.interact-tag')?.textContent, hidden: document.querySelector('.interact-hl')?.hasAttribute('hidden') })`)));
      await S(page, `31-hover-${id}`);
    }
    await page.mouse.move(5, 690); await page.waitForTimeout(300);
    await page.mouse.click(p.x, p.y + 40); await page.waitForTimeout(3500);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await page.keyboard.press('e'); await page.waitForTimeout(1200);
    await S(page, '32-after-E');
    k.note('after E panel ' + await page.evaluate(() => (document.querySelector('.ui-panel.open') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').slice(0, 80) ?? 'none'));
    await page.keyboard.press('Escape');
    await page.mouse.click(300, 560); await page.waitForTimeout(250);
    await S(page, '33-walk-ring');
    k.note('walk ring ' + JSON.stringify(await page.evaluate(`({ w: ${R('.walk-mark')}, hidden: document.querySelector('.walk-mark')?.hasAttribute('hidden') })`)));
  } else {
    await page.touchscreen.tap(p.x, p.y + 30); await page.waitForTimeout(250);
    await S(page, '33-walk-ring');
    k.note('walk ring ' + JSON.stringify(await page.evaluate(`({ w: ${R('.walk-mark')}, hidden: document.querySelector('.walk-mark')?.hasAttribute('hidden') })`)));
    await page.waitForTimeout(3500);
    await page.keyboard.press('Escape');
    await k.ph(`h.st.avatar = { ...h.st.avatar, x: ${stove.x}, y: ${stove.y + 40} }; h.st.path = []; return 1`);
    await page.waitForTimeout(600);
    await S(page, '34-ctx-button');
    k.note('ctx ' + JSON.stringify(await page.evaluate(`({ text: document.querySelector('.ctx-btn')?.textContent, box: ${R('.ctx-btn')} })`)));
    await page.locator('.ctx-btn').click({ timeout: 4000 }).catch(() => k.note('ctx click failed'));
    await page.waitForTimeout(700); await S(page, '35-ctx-after');
  }
  k.note('errors ' + JSON.stringify(errs.list));
});

test('r14 audio skills doors', async ({ page }) => {
  test.setTimeout(600000);
  const errs = watchErrors(page); const k = kit(page, 'r14misc');
  await page.goto('/?e2e'); await page.waitForTimeout(2500);
  await tap(page, 200, 300); await page.waitForTimeout(800);
  await newGame1(page);
  await page.evaluate(() => (document.querySelector('button.more-btn') as HTMLElement)?.click()); await page.waitForTimeout(600);
  await page.locator('button', { hasText: /Settings/ }).first().click(); await page.waitForTimeout(700);
  await S(page, '40-settings');
  k.note('volume rows ' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.volume-row')].map((r) => (r.textContent || '').replace(/\s+/g, ' ').slice(0, 40) + '|' + ((r.querySelector('input') as HTMLInputElement)?.value)))));
  const ms = page.locator('.volume-row', { hasText: /Music/i }).locator('input').first();
  if (await ms.count()) { await ms.fill('0.8').catch(() => {}); k.note('music after ' + await ms.inputValue()); } else k.note('NO music row');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.evaluate(() => (document.querySelector('button[title^="Skills"]') as HTMLElement)?.click()); await page.waitForTimeout(600);
  if (!(await page.locator('.ui-panel.open').count())) { await page.evaluate(() => (document.querySelector('button.more-btn') as HTMLElement)?.click()); await page.waitForTimeout(400); await page.locator('button', { hasText: /^\s*Skills/ }).first().click().catch(() => {}); await page.waitForTimeout(600); }
  await S(page, '41-skills');
  k.note('skills ' + JSON.stringify(await page.evaluate(() => ({ tabs: [...document.querySelectorAll('.ui-panel.open .tab-btn')].map((b) => b.getAttribute('title') || b.textContent), soon: [...document.querySelectorAll('.skill-done')].filter((e) => e.textContent === 'Soon').length, txt: (document.querySelector('.ui-panel.open') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').slice(0, 260) }))));
  const tabs = page.locator('.ui-panel.open .tab-btn'); const n = await tabs.count();
  for (let i = 1; i < Math.min(n, 8); i++) { await tabs.nth(i).click().catch(() => {}); await page.waitForTimeout(250); if (i === 3) await S(page, '42-skills-tab3'); }
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  const DOORS = JSON.parse(fs.readFileSync('shared/data/innDoors.json', 'utf8'));
  const w = await k.ph<any>('const r=h.st.room; return {kind:r.kind,shape:r.shape,lvl:r.level}');
  for (const [id, label] of [['tavern_to_suite', 'suite'], ['tavern_to_garden', 'garden'], ['tavern_to_cellar', 'cellar']] as const) {
    const d = (DOORS.rooms[w.kind]?.[w.shape]?.[w.lvl - 1] ?? []).find((x: any) => x.id === id);
    if (!d) { k.note('no door ' + id); continue; }
    await k.ph(`h.setCamera({x:${d.col * 32 + d.w * 16},y:${d.row * 32 + 40}}); h.st.lookAround=true; return 1`).catch((e) => k.note('cam fail ' + e));
    await page.mouse.move(500, 350); for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -300).catch(() => {});
    await page.waitForTimeout(700);
    await S(page, `51-door-${label}`);
  }
  k.note('errors ' + JSON.stringify(errs.list));
});

test('r14 old save migration', async ({ page }) => {
  test.setTimeout(300000);
  const errs = watchErrors(page); const k = kit(page, 'r14mig');
  await newGame1(page);
  const base: any = await saveState(page);
  k.note('save version ' + base.version);
  await page.evaluate(() => { const k2 = Object.keys(localStorage).find((x) => /save/i.test(x) && !/backup/i.test(x))!; const v = JSON.parse(localStorage.getItem(k2)!); v.version = 41; delete v.state.player.skills; localStorage.setItem(k2, JSON.stringify(v)); });
  await page.goto('/?e2e'); await page.waitForTimeout(2500);
  await page.getByText('Continue').first().click(); await page.waitForTimeout(4500);
  await S(page, '60-after-migration');
  const v = await page.evaluate(() => { const k2 = Object.keys(localStorage).find((x) => /save/i.test(x) && !/backup/i.test(x))!; return JSON.parse(localStorage.getItem(k2)!).version; });
  k.note('version after continue (from 41) ' + v);
  k.note('errors ' + JSON.stringify(errs.list));
});

test('r14 peek + door closeups', async ({ page }) => {
  test.setTimeout(600000);
  const errs = watchErrors(page); const k = kit(page, 'r14door');
  await newGame1(page);
  const DOORS = JSON.parse(fs.readFileSync('shared/data/innDoors.json', 'utf8'));
  const w = await k.ph<any>('const r=h.st.room; return {kind:r.kind,shape:r.shape,lvl:r.level}');
  // peek: tutorial on menu step, avatar far from the bar, stand still
  await page.evaluate(() => localStorage.setItem('pixel-hotel.first-ten', JSON.stringify({ active: true, skipped: false, done: ['zoom', 'walk', 'holdwalk'], tips: [] })));
  await k.patchAndContinue((st) => { st.player.level = 1; });
  await page.waitForTimeout(1500);
  const a0 = await k.ph<any>('return {x:h.st.avatar.x,y:h.st.avatar.y}');
  await k.ph(`h.st.avatar = { ...h.st.avatar, x: h.st.avatar.x + 90, y: h.st.avatar.y }; h.st.path = []; return 1`);
  const cams: string[] = [];
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(700); cams.push(JSON.stringify(await k.ph<any>('return {x:Math.round(h.st.shown.x),y:Math.round(h.st.shown.y),z:h.st.shown.zoom,g:h.st.guideWorld}'))); }
  k.note('peek cams ' + cams.join(' | ') + ' avatar0 ' + JSON.stringify(a0));
  await S(page, '70-peek-after');
  await page.evaluate(() => localStorage.setItem('pixel-hotel.first-ten', JSON.stringify({ active: false, skipped: true, done: [], tips: [] })));
  await k.patchAndContinue(() => {});
  await page.waitForTimeout(1500);
  for (const [id, label] of [['tavern_to_suite', 'suite'], ['tavern_to_garden', 'garden'], ['tavern_to_cellar', 'cellar']] as const) {
    const d = (DOORS.rooms[w.kind]?.[w.shape]?.[w.lvl - 1] ?? []).find((x: any) => x.id === id);
    if (!d) { k.note('no door ' + id); continue; }
    await k.ph(`h.st.avatar = { ...h.st.avatar, x: ${d.col * 32 + d.w * 16}, y: ${d.row * 32 + 60} }; h.st.path = []; return 1`);
    await page.mouse.move(500, 350); for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -200);
    await page.waitForTimeout(1500);
    await S(page, `71-door-${label}`);
  }
  k.note('errors ' + JSON.stringify(errs.list));
});
