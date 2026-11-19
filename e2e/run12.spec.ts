// TESTER RUN 12 ship gate: icons, tutorial pointer, build aids, camera, orders, doors, lakeside. Shots r12-shots/{desktop,phone}-*.png
import { test } from '@playwright/test';
import * as fs from 'fs';
import { kit } from './run6kit';
import { watchErrors } from './helpers';

fs.mkdirSync('r12-shots', { recursive: true });
const tagOf = (page: any) => (page.viewportSize().width < 600 ? 'phone' : 'desktop');
const S = (page: any, n: string, clip?: any) => page.screenshot({ path: `r12-shots/${tagOf(page)}-${n}.png`, ...(clip ? { clip } : {}) });

const ptr = (page: any) => page.evaluate(() => {
  const r = (e: Element | null) => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
  const p = document.querySelector('.guide-pointer');
  const card = document.querySelector('.guide-card, .first-ten, .guide');
  return { on: !!p?.classList.contains('on'), ptr: r(p), ring: r(document.querySelector('.guide-ring')), card: card ? (card as HTMLElement).innerText.replace(/\s+/g, ' ').slice(0, 200) : null, cardCls: card?.className };
});

test('r12 tutorial', async ({ page }) => {
  const errs = watchErrors(page); const k = kit(page, 'r12tut');
  await page.goto('/?e2e'); await page.waitForTimeout(1500);
  await S(page, '01-title');
  await k.newGame();
  await S(page, '02-start');
  k.note('start ' + JSON.stringify(await ptr(page)));
  k.note('keys ' + JSON.stringify(await k.ph<any>(`return Object.keys(h).concat(['--'],Object.keys(h.st).slice(0,80))`)));
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(1500);
    k.note(`t${i} ` + JSON.stringify(await ptr(page)));
    await S(page, `03-tut-${i}`);
  }
  k.note('errors ' + JSON.stringify(errs.list));
});

const STEPS = ['zoom','walk','holdwalk','menu','pour','serve','coins','barrel','collect','load','cellar','stove','farm','plant','harvest','build','wall','dungeon'];
test('r12 guide steps', async ({ page }) => {
  test.setTimeout(900000);
  const errs = watchErrors(page); const k = kit(page, 'r12steps');
  await page.goto('/?e2e'); await page.waitForTimeout(1500);
  await k.newGame();
  k.note('inv ' + JSON.stringify(await k.ph<any>('return h.st.inventory')).slice(0, 600));
  const want = (process.env.STEPS ?? 'menu,barrel,load,stove,farm,plant,build,wall,dungeon').split(',');
  for (const s of want) {
    const idx = STEPS.indexOf(s);
    const nocrops = s === 'stove' || s === 'farm';
    await page.evaluate(({ done }) => { localStorage.setItem('pixel-hotel.first-ten', JSON.stringify({ active: true, skipped: false, done, tips: [] })); }, { done: STEPS.slice(0, idx) });
    await k.patchAndContinue((st) => {
      if (nocrops) { const m = st.player.materials; if (m) for (const key of Object.keys(m)) if (/turnip|potato|carrot|wheat|cabbage|pumpkin|onion/.test(key)) delete m[key]; }
    });
    await page.waitForTimeout(2500);
    k.note('   mats ' + JSON.stringify(await k.ph<any>('return h.st.inventory.materials')));
    k.note(`== ${s} nocrops=${nocrops} ` + JSON.stringify(await ptr(page)));
    await S(page, `10-step-${s}`);
    // open More and look for pointer
    await page.evaluate(() => (document.querySelector('button.more-btn') as HTMLElement)?.click()); await page.waitForTimeout(1200);
    k.note(`   more open ` + JSON.stringify(await ptr(page)));
    await S(page, `11-step-${s}-more`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    const sel = s === 'farm' ? 'button[title^="Worlds"]' : (s === 'plant' || s === 'wall') ? 'button[title^="Catalog"]' : s === 'build' ? 'button[title^="Build"]' : null;
    if (sel) {
      await page.evaluate((q) => (document.querySelector(q) as HTMLElement)?.click(), sel); await page.waitForTimeout(1500);
      k.note('   panel ' + JSON.stringify(await ptr(page)));
      await S(page, `12-step-${s}-panel`);
      if (s === 'wall') { // flip to the wall tab if any
        const tab = page.locator('.cat-tab, .tab', { hasText: /wall|decor/i }).first(); if (await tab.count()) { await tab.click().catch(() => {}); await page.waitForTimeout(1000); k.note('   walltab ' + JSON.stringify(await ptr(page))); await S(page, '13-step-wall-tab'); }
      }
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    }
  }
  k.note('errors ' + JSON.stringify(errs.list));
});

test('r12 build', async ({ page }) => {
  test.setTimeout(400000);
  const errs = watchErrors(page); const k = kit(page, 'r12build');
  await page.goto('/?e2e'); await page.waitForTimeout(1500);
  await k.newGame();
  console.log('A'); k.note('newgame ok');
  await k.patchAndContinue((st) => { console.log; if (typeof st.player.wallet === 'number') st.player.wallet = 5000; else st.player.wallet.gold = 5000; });
  console.log('B');
  const ids = ['rug', 'lamp', 'plant', 'banner', 'mug_shelf', 'shop_rug'];
  for (const id of ids) k.note(`buy ${id} ` + JSON.stringify(await k.ph<any>(`const r = await h.api.buyCatalog('${id}'); return r && (r.kind ?? r.ok ?? 'ok')`)));
  const items = await k.ph<any[]>(`return h.st.items.map(i=>({uid:i.uid,t:i.typeId,x:i.x,y:i.y,room:i.roomId,surf:i.onSurface??i.surfaceOf??null}))`);
  k.note('items ' + JSON.stringify(items));
  const sv = await k.state(); const bag = (sv.items as any[]).filter((i: any) => i.roomId == null || i.roomId === 0 || i.roomId === -1 || !('x' in i)); k.note('bag ' + JSON.stringify(bag.map((b: any) => [b.uid, b.typeId, b.roomId])) + ' wallet ' + JSON.stringify(sv.player.wallet) + ' item0 ' + JSON.stringify(sv.items[sv.items.length - 1]));
  const uidOf = (t: string) => (bag.find((b: any) => b.typeId === t || b.type === t) ?? {}).uid;
  const pl = async (t: string, x: number, y: number, extra = '') => k.note(`place ${t} @${x},${y} ` + JSON.stringify(await k.ph<any>(`const r = await h.api.placeItem(${uidOf(t)}, {center:{x:${x},y:${y}}, facing:'down', snap:true${extra}}); return r && (r.kind ?? r.problem ?? 'ok')`)));
  await pl('rug', 300, 160);  await pl('banner', 200, -24); for (const my of [-24, -32]) { await pl('mug_shelf', 280, my); if ((await k.state()).items.some((i: any) => i.typeId === 'mug_shelf' && i.roomId != null)) break; } for (const [lx, ly] of [[112, 236], [112, 232], [112, 240], [112, 228]]) { await pl('lamp', lx, ly); if ((await k.state()).items.some((i: any) => i.typeId === 'lamp' && i.roomId != null)) break; } await pl('plant', 400, 300); await pl('shop_rug', 336, 180);
  await page.waitForTimeout(800);
  k.note('placed ' + JSON.stringify((await k.state()).items.filter((i: any) => /rug|lamp|plant|banner|mug_shelf/.test(i.typeId)).map((i: any) => [i.uid, i.typeId, i.roomId, i.x, i.y, i.onItemUid])));
  await page.reload(); await page.waitForTimeout(2500); await page.getByText('Continue').first().click(); await page.waitForTimeout(4500);
  await page.evaluate(() => (document.querySelector('button[title^="Build"]') as HTMLElement).click());
  await page.waitForTimeout(1500);
  await page.mouse.move(500, 350); for (let q = 0; q < 6; q++) { await page.mouse.wheel(0, 500); await page.waitForTimeout(150); } await page.waitForTimeout(1500);
  await S(page, '20-build-on');
  await S(page, '21-build-bar', { x: 0, y: 0, width: 500, height: 350 });
  // select each small item by tap
  for (const t of ['lamp', 'plant', 'banner', 'rug']) {
    const it = await k.ph<any>(`const i=h.st.items.find(i=>i.typeId==='${t}'); return i&&{uid:i.uid,x:i.x,y:i.y}`);
    if (!it) { k.note('select ' + t + ' not placed'); continue; }
    const yoff = t === 'banner' ? -24 : t === 'rug' ? -32 : -14;
    const pt = await k.toScreen(it.x, it.y + yoff);
    await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(500);
    const sel = await page.evaluate(() => Array.from(document.querySelectorAll('.build-menu button, .item-menu button, .ui-panel button')).map((b) => (b.textContent || '').trim()).filter(Boolean).slice(0, 8));
    k.note('select ' + t + ' at ' + JSON.stringify(pt) + ' menu ' + JSON.stringify(sel) + ' selUid ' + JSON.stringify(await k.ph<any>('return h.st.marked ?? h.st.selected ?? null')).slice(0, 80));
    await S(page, '22-select-' + t);
  }
  // drag with aids visible
  for (const [t, dx, dy, yoff] of [['lamp', -26, 0, -14], ['banner', 60, 0, -24], ['rug', 40, 60, -32], ['plant', -60, 20, -14]] as const) {
    const it = await k.ph<any>(`const i=h.st.items.find(i=>i.typeId==='${t}'); return i&&{x:i.x,y:i.y}`);
    const a = await k.toScreen(it.x, it.y + yoff);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(a.x + dx / 2, a.y + dy / 2, { steps: 4 }); await page.mouse.move(a.x + dx, a.y + dy, { steps: 4 }); await page.waitForTimeout(400);
    await S(page, '23-drag-' + t);
    await page.mouse.up(); await page.waitForTimeout(500);
    const after = await k.ph<any>(`const i=h.st.items.find(i=>i.typeId==='${t}'); return i&&{x:i.x,y:i.y}`);
    k.note(`drag ${t} ` + JSON.stringify(it) + ' -> ' + JSON.stringify(after));
  }
  await page.keyboard.press('Escape');
  k.note('errors ' + JSON.stringify(errs.list));
});

const travel = async (page: any, k: any, re: RegExp, ms = 7000) => {
  await page.evaluate(() => (document.querySelector('button[title^="Worlds"]') as HTMLElement).click()); await page.waitForTimeout(600);
  await page.locator('.travel-card', { hasText: re }).first().click(); await page.waitForTimeout(ms);
};

test('r12 rooms', async ({ page }) => {
  test.setTimeout(400000);
  const errs = watchErrors(page); const k = kit(page, 'r12rooms');
  await page.goto('/?e2e'); await page.waitForTimeout(1500);
  await k.newGame();
  await S(page, '30-tavern');
  await travel(page, k, /Hotel/); await S(page, '31-hotel');
  await travel(page, k, /Tavern/); await S(page, '32-tavern-again');
  await travel(page, k, /Farm/); await S(page, '33-farm');
  await travel(page, k, /Lakeside/, 8000); await S(page, '34-lake');
  k.note('lake room ' + JSON.stringify(await k.ph<any>('return {kind:h.st.room.kind,w:h.st.room.w,h:h.st.room.h,av:{x:Math.round(h.st.avatar.x),y:Math.round(h.st.avatar.y)},cam:h.st.camera}')));
  // dump nav info
  k.note('lake room items ' + JSON.stringify(await k.ph<any>('return h.st.items.filter(i=>i.roomId===h.st.room.id).map(i=>i.typeId+"@"+i.x+","+i.y)')));
  k.note('errors ' + JSON.stringify(errs.list));
});

test('r12 pond', async ({ page }) => {
  test.setTimeout(400000);
  const errs = watchErrors(page); const k = kit(page, 'r12pond');
  await page.goto('/?e2e'); await page.waitForTimeout(1500);
  await k.newGame();
  await travel(page, k, /Lakeside/, 8000);
  await page.mouse.click(5, 300); await page.waitForTimeout(500); // skip intro
  const vp = page.viewportSize()!;
  const targets: Array<[string, number, number]> = [['pond-middle', 0.72, 0.3], ['pond-near-edge', 0.6, 0.38]];
  for (const [name, fx, fy] of targets) {
    const w0 = await k.ph<any>('return {x:Math.round(h.st.avatar.x),y:Math.round(h.st.avatar.y)}');
    await page.mouse.click(vp.width * fx, vp.height * fy);
    const click = await k.ph<any>(`return h.worldToScreen({x:0,y:0},h.st.shown)`); void click;
    const wt = await k.ph<any>(`const c=h.st.shown; return {x:Math.round(${vp.width * fx}/c.zoom+c.x), y:Math.round(${vp.height * fy}/c.zoom+c.y)}`);
    const trace: any[] = [];
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(500);
      trace.push(await k.ph<any>('return [Math.round(h.st.avatar.x),Math.round(h.st.avatar.y),(h.st.path||[]).length,h.st.goal?Math.round(h.st.goal.x)+","+Math.round(h.st.goal.y):null,Math.round(h.st.avatar.x)]'));
      if (i === 3 || i === 10) await S(page, `40-${name}-t${i}`);
    }
    k.note(`${name}: start ${JSON.stringify(w0)} tapWorld ${JSON.stringify(wt)} trace(x,y,pathLen,goal) ${JSON.stringify(trace.map((t) => t.slice(0, 4)))}`);
    k.note(`${name}: path ${JSON.stringify(await k.ph<any>('return (h.st.path||[]).map(p=>[Math.round(p.x),Math.round(p.y)])'))}`);
    await S(page, `41-${name}-end`);
  }
  // overview of the lake room: zoom out
  await page.mouse.move(500, 350); for (let q = 0; q < 8; q++) { await page.mouse.wheel(0, 500); await page.waitForTimeout(150); } await page.waitForTimeout(1500);
  await S(page, '42-lake-overview');
  k.note('errors ' + JSON.stringify(errs.list));
});

test('r12 pond2', async ({ page }) => {
  test.setTimeout(400000);
  const errs = watchErrors(page); const k = kit(page, 'r12pond2');
  await page.goto('/?e2e'); await page.waitForTimeout(1500);
  await k.newGame();
  await travel(page, k, /Lakeside/, 8000);
  await page.mouse.click(5, 300); await page.waitForTimeout(500);
  await page.mouse.move(500, 350); for (let q = 0; q < 8; q++) { await page.mouse.wheel(0, 500); await page.waitForTimeout(150); } await page.waitForTimeout(1500);
  // pond bounds in world from the overview shot: screen rect (510..780, 192..462)
  const toW = async (sx: number, sy: number) => k.ph<any>(`const c=h.st.shown; return {x:Math.round(${sx}/c.zoom+c.x), y:Math.round(${sy}/c.zoom+c.y)}`);
  k.note('pond world TL ' + JSON.stringify(await toW(510, 192)) + ' BR ' + JSON.stringify(await toW(780, 462)) + ' pier ' + JSON.stringify(await toW(485, 345)) + ' cam ' + JSON.stringify(await k.ph<any>('return h.st.shown')));
  const taps: Array<[string, number, number]> = [['center', 645, 327], ['farRight', 760, 330], ['topRight', 740, 215], ['bottomRight', 745, 440], ['topMid', 640, 215], ['bottomMid', 640, 445]];
  for (const [name, sx, sy] of taps) {
    const w = await toW(sx, sy);
    const a0 = await k.ph<any>('return {x:Math.round(h.st.avatar.x),y:Math.round(h.st.avatar.y)}');
    await page.mouse.click(sx, sy);
    const pts: any[] = []; let shot = false;
    for (let i = 0; i < 36; i++) {
      await page.waitForTimeout(350);
      const a = await k.ph<any>('return [Math.round(h.st.avatar.x),Math.round(h.st.avatar.y)]');
      pts.push(a);
      if (!shot && i === 5) { await S(page, '43-pond-' + name + '-mid'); shot = true; }
    }
    // compress trace: points where the position changes by > 24 px
    const key: any[] = [a0 ? [a0.x, a0.y] : null]; for (const q of pts) { const l = key[key.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 40) key.push(q); }
    const last = pts[pts.length - 1];
    k.note(`${name}: tapWorld ${JSON.stringify(w)} start ${JSON.stringify(a0)} end ${JSON.stringify(last)} trace ${JSON.stringify(key)}`);
    await S(page, '43-pond-' + name + '-end');
  }
  k.note('errors ' + JSON.stringify(errs.list));
});

test('r12 icons', async ({ page }) => {
  test.setTimeout(400000);
  const errs = watchErrors(page); const k = kit(page, 'r12icons');
  await page.goto('/?e2e'); await page.waitForTimeout(1500);
  await k.newGame();
  await k.patchAndContinue((st) => {
    st.player.level = 5; st.player.potions = 3; st.player.wallet.gems = 120; st.player.wallet.gold = 900;
    st.player.gear = ['mithril_sword', 'mithril_armor', 'steel_pickaxe', 'steel_axe', 'mithril_rod'];
    for (const m of ['wood', 'cloth', 'copper_ore', 'iron_ore', 'mithril_ore', 'copper_bar', 'iron_bar', 'mithril_bar', 'coal', 'gold_nugget', 'diamond', 'crystal', 'amber', 'bone', 'resin']) st.player.materials[m] = 7;
    st.player.materials.gem = 5;
  });
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  const q = (sel: string) => page.evaluate((s) => (document.querySelector(s) as HTMLElement)?.click(), sel);
  const bagBtn = '.hotbar-bag, button[title^="Bag"]';
  const col = await page.evaluate(() => { const b = document.querySelector('.side-buttons')!.getBoundingClientRect(); return { x: Math.max(0, b.x - 6), y: Math.max(0, b.y - 6), width: Math.min(innerWidth - Math.max(0, b.x - 6), b.width + 12), height: b.height + 12 }; });
  await S(page, '50-side-column', col);
  await q(bagBtn); await page.waitForTimeout(1200); await S(page, '51-bag');
  k.note('bag tabs ' + JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('.ui-panel button')).map((b) => (b.getAttribute('title') || b.textContent || '').trim().slice(0, 20)).filter(Boolean).slice(0, 24))));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await q('button.more-btn'); await page.waitForTimeout(500);
  await q('.more-menu button[title^="Workshop"], button[title^="Workshop"]'); await page.waitForTimeout(1200); await S(page, '52-workshop');
  const tabs = page.locator('.ui-panel [role=tab], .ui-panel .tab, .ui-panel .ws-tab'); k.note('ws tabs ' + (await tabs.count()));
  for (const re of [/smith/i, /forge/i]) { const t = page.locator('.ui-panel button', { hasText: re }).first(); if (await t.count()) { await t.click().catch(() => {}); await page.waitForTimeout(800); await S(page, '53-workshop-' + re.source); break; } }
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await q('button[title^="Catalog"]'); await page.waitForTimeout(1200); await S(page, '54-catalog');
  // packs tab = last tab
  const tabsC = await page.evaluate(() => Array.from(document.querySelectorAll('.cat-tabs > *, .catalog-tabs > *, .ui-panel [data-tab]')).length); k.note('catalog tabs ' + tabsC);
  const lastTab = page.locator('.cat-tabs > *, .catalog-tabs > *, .ui-panel [data-tab]').last(); if (await lastTab.count()) { await lastTab.click().catch(() => {}); await page.waitForTimeout(1000); await S(page, '55-packs'); }
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  // hotbar: put items in via api bag->hotbar? try moveSlot with materials
  k.note('slots ' + JSON.stringify(await k.ph<any>('return Object.keys(h.api).filter(k=>/slot|hotbar|bag/i.test(k))')));
  k.note('errors ' + JSON.stringify(errs.list));
});
