// TESTER RUN 13: start, doors, pond, tutorial, look around, packs, icons, cellar, tap forgiveness. Shots r13-shots/{desktop,phone}-*.png
import { test } from '@playwright/test';
import * as fs from 'fs';
import { kit, doorSpot } from './run6kit';
import { watchErrors } from './helpers';

fs.mkdirSync('r13-shots', { recursive: true });
const tagOf = (page: any) => (page.viewportSize().width < 600 ? 'phone' : 'desktop');
const S = (page: any, n: string) => page.screenshot({ path: `r13-shots/${tagOf(page)}-${n}.png` });
const tap = async (page: any, x: number, y: number) => { if (tagOf(page) === 'phone') await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); };
const travel = async (page: any, re: RegExp, ms = 7000) => {
  await page.evaluate(() => (document.querySelector('button[title^="Worlds"]') as HTMLElement).click()); await page.waitForTimeout(600);
  await page.locator('.travel-card', { hasText: re }).first().click(); await page.waitForTimeout(ms);
};

test('r13 start+ui', async ({ page }) => {
  test.setTimeout(300000);
  const errs = watchErrors(page); const k = kit(page, 'r13start');
  await page.goto('/?e2e'); await page.waitForTimeout(1500);
  await S(page, '01-title');
  await k.newGame();
  await S(page, '02-start');
  k.note('where ' + JSON.stringify(await k.where()));
  k.note('cam ' + JSON.stringify(await k.ph<any>('return {sh:h.st.shown, lock:h.st.lookAround}')));
  k.note('side ' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => { const r = b.getBoundingClientRect(); return r.x > innerWidth - 120 && r.width > 20; }).map((b) => [b.title || b.className, Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height)]))));
  await page.evaluate(() => (document.querySelector('button.more-btn') as HTMLElement)?.click()); await page.waitForTimeout(800);
  await S(page, '03-more');
  k.note('more items ' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.more-wrap button, .more-grid button')].map((b) => (b as HTMLElement).innerText.replace(/\s+/g, ' ').trim() + '|' + b.getAttribute('title')))));
  const look = page.locator('button', { hasText: /Look around/i }).first();
  if (await look.count()) {
    await look.click(); await page.waitForTimeout(500);
    k.note('look on ' + JSON.stringify(await k.ph<any>('return {l:h.st.lookAround, sh:h.st.shown}')));
    const before = await k.ph<any>('return {x:h.st.shown.x,y:h.st.shown.y, ax:h.st.avatar.x, ay:h.st.avatar.y}');
    await page.mouse.move(500, 300); await page.mouse.down(); await page.mouse.move(380, 260, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(500);
    const after = await k.ph<any>('return {x:h.st.shown.x,y:h.st.shown.y, ax:h.st.avatar.x, ay:h.st.avatar.y}');
    k.note('look drag before/after ' + JSON.stringify([before, after]));
    await S(page, '04-look-panned');
    await tap(page, 500, 400); await page.waitForTimeout(2500);
    k.note('after walk ' + JSON.stringify(await k.ph<any>('return {l:h.st.lookAround, sh:h.st.shown, ax:h.st.avatar.x, ay:h.st.avatar.y}')));
    await S(page, '05-look-after-walk');
  } else k.note('NO Look around button');
  const b0 = await k.ph<any>('return {x:h.st.shown.x,y:h.st.shown.y}');
  await page.mouse.move(500, 300); await page.mouse.down(); await page.mouse.move(420, 260, { steps: 6 }); await page.waitForTimeout(150); const mid = await k.ph<any>('return {x:h.st.shown.x,y:h.st.shown.y}'); await page.mouse.up();
  k.note('plain drag cam ' + JSON.stringify([b0, mid]));
  await page.evaluate(() => (document.querySelector('button.more-btn') as HTMLElement)?.click()); await page.waitForTimeout(600);
  const packs = page.locator('button', { hasText: /Packs/i }).first();
  if (await packs.count()) { await packs.click(); await page.waitForTimeout(1000); await S(page, '06-packs'); k.note('packs panel ' + JSON.stringify(await page.evaluate(() => (document.querySelector('.ui-panel.open') as HTMLElement)?.innerText.replace(/\s+/g, ' ').slice(0, 500)))); } else k.note('NO Packs button');
  await page.keyboard.press('Escape');
  k.note('errors ' + JSON.stringify(errs.list));
});

test('r13 doors', async ({ page }) => {
  test.setTimeout(400000);
  const errs = watchErrors(page); const k = kit(page, 'r13doors');
  await newGame1(page);
  const kind = () => k.ph<string>('return h.st.room.kind');
  const ids = ['tavern_to_suite', 'tavern_to_garden', 'tavern_to_cellar'];
  for (const id of ids) {
    for (const [label, dx, dy] of [['arch', 0, -28], ['left+14', -46, -16], ['right+14', 46, -16], ['left+30', -62, -16], ['right+30', 62, -16], ['front', 0, 30]] as Array<[string, number, number]>) {
      if ((await kind()) !== 'shop') await travel(page, /Tavern/, 4500);
      await page.keyboard.press('Escape'); await page.waitForTimeout(200);
      await page.mouse.move(500, 350); for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 300); await page.waitForTimeout(900);
      await page.waitForTimeout(800); const w = await k.where(); const sp = doorSpot(w, id); if (!sp) { k.note('NO SPOT ' + JSON.stringify(w).slice(0, 200)); continue; }
      const tx = sp.x + dx, ty = sp.y + dy;
      const s = await k.toScreen(tx, ty); const vp = page.viewportSize()!;
      const on = s.x > 0 && s.y > 0 && s.x < vp.width && s.y < vp.height;
      k.note(`${id} ${label} spot ${sp.x},${sp.y} target ${tx},${ty} screen ${Math.round(s.x)},${Math.round(s.y)} on=${on} av ${w.av.x},${w.av.y}`);
      if (!on) { k.note('  OFFSCREEN (skipped)'); continue; }
      await tap(page, s.x, s.y); await page.waitForTimeout(4000);
      const now = await kind(); const w2 = await k.where();
      k.note(`  -> ${now} av ${w2.av.x},${w2.av.y} toast=${await page.evaluate(() => document.querySelector('.toast')?.textContent ?? '')}`);
      if (label === 'arch' || label === 'left+14') await S(page, `11-${id}-${label}`);
    }
  }
  k.note('errors ' + JSON.stringify(errs.list));
});

async function newGame1(page: any) {
  await page.goto('/?e2e'); await page.waitForTimeout(1200);
  await page.getByText('New game').first().click();
  await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click();
  await page.getByRole('button', { name: 'Open my tavern' }).click();
  await page.waitForTimeout(800);
  await tap(page, 210, 20); await page.waitForTimeout(3500);
}

const wheelOut = async (page: any) => { await page.mouse.move(500, 350); for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 300); await page.waitForTimeout(900); };

test('r13 pond', async ({ page }) => {
  test.setTimeout(400000);
  const errs = watchErrors(page); const k = kit(page, 'r13pond');
  await newGame1(page);
  await travel(page, /Lakeside/, 8000);
  await S(page, '20-lake-start');
  await wheelOut(page);
  await S(page, '21-lake-overview');
  k.note('room ' + JSON.stringify(await k.where()));
  const pts: Array<[string, number, number]> = tagOf(page) === 'phone' ? [['p-up', 210, 300], ['p-far', 210, 160], ['p-right', 340, 330], ['p-left', 80, 330]] : [['deep-mid', 600, 190], ['deep-low', 560, 262], ['east-shallow', 715, 200], ['southeast', 735, 275], ['north', 640, 118], ['west-by-pier', 470, 170], ['far-east-top', 750, 140]];
  for (const [name, x, y] of pts) {
    // walk back to the south shore first
    await tap(page, tagOf(page) === 'phone' ? 210 : 500, tagOf(page) === 'phone' ? 560 : 395); await page.waitForTimeout(3500);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    const a0 = await k.ph<any>('return {x:h.st.avatar.x,y:h.st.avatar.y}');
    await tap(page, x, y);
    let dist = 0, last = a0; const trace: string[] = []; let fish = '';
    for (let i = 0; i < 44; i++) {
      await page.waitForTimeout(250);
      const a = await k.ph<any>('return {x:h.st.avatar.x,y:h.st.avatar.y}');
      dist += Math.hypot(a.x - last.x, a.y - last.y); last = a;
      if (i % 5 === 0) trace.push(Math.round(a.x) + ',' + Math.round(a.y));
      fish = await page.evaluate(() => [...document.querySelectorAll('.toast, .fish, [class*=fish], [class*=Fish]')].map((e) => (e as HTMLElement).innerText?.replace(/s+/g, ' ')).filter(Boolean).join(' | ').slice(0, 80));
      if (/bite|Hold|Waiting|cast/i.test(fish)) break;
    }
    k.note(`${name} tap ${x},${y} from ${Math.round(a0.x)},${Math.round(a0.y)} walked ${Math.round(dist)}px end ${Math.round(last.x)},${Math.round(last.y)} fishUi=[${fish}] trace ${trace.join(' > ')}`);
    await S(page, `22-lake-${name}`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    const stop = page.locator('button', { hasText: /Stop|Close/i }).first(); if (await stop.isVisible().catch(() => false)) await stop.click().catch(() => {});
  }
  k.note('errors ' + JSON.stringify(errs.list));
});

const ptrInfo = (page: any) => page.evaluate(() => {
  const r = (e: Element | null) => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
  const p = document.querySelector('.guide-pointer');
  const card = document.querySelector('.guide-card, .first-ten, .guide');
  return { on: !!p?.classList.contains('on'), edge: !!p?.classList.contains('edge'), ptr: r(p), ring: r(document.querySelector('.guide-ring')), vw: innerWidth, vh: innerHeight, card: card ? (card as HTMLElement).innerText.replace(/\s+/g, ' ').slice(0, 160) : null, cardBox: r(card) };
});
const STEPS = ['zoom', 'walk', 'holdwalk', 'menu', 'pour', 'serve', 'coins', 'barrel', 'collect', 'load', 'cellar', 'stove', 'farm', 'plant', 'harvest', 'build', 'wall', 'dungeon'];
test('r13 tutorial', async ({ page }) => {
  test.setTimeout(900000);
  const errs = watchErrors(page); const k = kit(page, 'r13tut');
  await newGame1(page);
  k.note('first ' + JSON.stringify(await ptrInfo(page))); await S(page, '30-tut-first');
  for (const s of (process.env.STEPS ?? STEPS.join(',')).split(',')) {
    const idx = STEPS.indexOf(s);
    await page.evaluate(({ done }) => { localStorage.setItem('pixel-hotel.first-ten', JSON.stringify({ active: true, skipped: false, done, tips: [] })); }, { done: STEPS.slice(0, idx) });
    await k.patchAndContinue((st) => { st.player.level = Math.max(st.player.level ?? 1, 1); });
    await page.waitForTimeout(2500);
    const q = await ptrInfo(page);
    k.note(`== ${s} ` + JSON.stringify(q));
    await S(page, `31-tut-${s}`);
  }
  k.note('errors ' + JSON.stringify(errs.list));
});

const idle = async (page: any, k: any) => { for (let i = 0; i < 30; i++) { const a = await k.ph<any>('return {x:h.st.avatar.x,y:h.st.avatar.y,m:(h.st.path||[]).length}'); await page.waitForTimeout(400); const b = await k.ph<any>('return {x:h.st.avatar.x,y:h.st.avatar.y,m:(h.st.path||[]).length}'); if (a.x === b.x && a.y === b.y) break; } await page.waitForTimeout(900); };

test('r13 firstview+forgive', async ({ page }) => {
  test.setTimeout(300000);
  const errs = watchErrors(page); const k = kit(page, 'r13fv');
  await newGame1(page);
  await page.waitForTimeout(3000);
  await S(page, '40-first-view');
  const w = await k.where();
  const vp = page.viewportSize()!;
  k.note('avatar ' + JSON.stringify(w.av) + ' shown ' + JSON.stringify(await k.ph<any>('return h.st.shown')) + ' vp ' + vp.width + 'x' + vp.height);
  const find = (id: string) => { const it = w.items.find((i: string) => i.startsWith(id + '@'))!; return it.split('@')[1].split(',').map(Number); };
  const probe = async (name: string, id: string, ox: number, oy: number, dx: number, dy: number) => {
    await page.keyboard.press('Escape'); await page.waitForTimeout(300); await idle(page, k);
    const [wx, wy] = find(id);
    const s = await k.toScreen(wx + ox, wy + oy); const x = s.x + dx, y = s.y + dy;
    if (x < 0 || y < 0 || x > vp.width || y > vp.height) { k.note(`${name} off-screen ${Math.round(x)},${Math.round(y)}`); return; }
    const a0 = await k.ph<any>('return {x:h.st.avatar.x,y:h.st.avatar.y}');
    await tap(page, x, y); await page.waitForTimeout(3500);
    const r = await k.ph<any>('return {panel:!!document.querySelector(".ui-panel.open"), pend:[!!h.st.pendingStove,!!h.st.pendingBarrel], av:[Math.round(h.st.avatar.x),Math.round(h.st.avatar.y)], toast:(document.querySelector(".toast")||{}).textContent}');
    k.note(`${name} tap ${Math.round(x)},${Math.round(y)} from av ${Math.round(a0.x)},${Math.round(a0.y)} -> ${JSON.stringify(r)}`);
  };
  // sprite rect approximations: stove 64 wide x ~56 tall; barrel 32 x 40; centre of sprite = anchor + (0,-22)
  await probe('stove-centre', 'stove', 0, -22, 0, 0);
  await probe('stove-rightedge+12', 'stove', 32, -22, 12, 0);
  await probe('stove-rightedge+40', 'stove', 32, -22, 40, 0);
  await probe('barrel-centre', 'brewing_barrel', 0, -20, 0, 0);
  await probe('barrel-leftedge-12', 'brewing_barrel', -16, -20, -12, 0);
  await probe('barrel-leftedge-40', 'brewing_barrel', -16, -20, -40, 0);
  await probe('tapstand-centre', 'tap_stand', 0, -34, 0, 0);
  await probe('tapstand+14', 'tap_stand', 16, -34, 14, 0);
  await probe('register-centre', 'register', 0, -34, 0, 0);
  await probe('register-above-12', 'register', 0, -50, 0, -12);
  await S(page, '41-after-forgive');
  k.note('errors ' + JSON.stringify(errs.list));
});

test('r13 cellar', async ({ page }) => {
  test.setTimeout(300000);
  const errs = watchErrors(page); const k = kit(page, 'r13cellar');
  await newGame1(page);
  const vp = page.viewportSize()!;
  await k.patchAndContinue((st) => { st.player.level = 2; if (typeof st.player.wallet === 'number') st.player.wallet = 5000; else st.player.wallet.gold = 5000; });
  // door tap while NOT built
  const goTo = async (id: string, tries: number) => {
    for (let i = 0; i < tries; i++) {
      const ww = await k.where(); if (ww.kind !== 'shop') return;
      const dlg = await page.evaluate(() => !!document.querySelector('[class*=confirm]'));
      if (dlg) return;
      const sp = doorSpot(ww, id)!; const s = await k.toScreen(sp.x, sp.y - 24);
      const inside = s.x > 20 && s.x < vp.width - 70 && s.y > 60 && s.y < vp.height - 170;
      const tx = inside ? s.x : Math.max(30, Math.min(vp.width - 80, vp.width / 2 + (s.x - vp.width / 2) * 0.5)); const ty = inside ? s.y : Math.max(70, Math.min(vp.height - 180, vp.height / 2 + (s.y - vp.height / 2) * 0.5));
      await tap(page, tx, ty); await page.waitForTimeout(2500);
      k.note(`goTo ${id} try ${i} inside=${inside} tap ${Math.round(tx)},${Math.round(ty)} av ${JSON.stringify((await k.where()).av)}`);
    }
  };
  await goTo('tavern_to_cellar', 10);
  await S(page, '50-cellar-door-confirm');
  k.note('dialog ' + JSON.stringify(await page.evaluate(() => (document.querySelector('[class*=confirm]') as HTMLElement)?.innerText?.slice(0, 200))));
  await page.evaluate(() => { const b = [...document.querySelectorAll('[class*=confirm] button')].find((x) => /300/.test((x as HTMLElement).innerText)) as HTMLElement | undefined; b?.click(); });
  await page.waitForTimeout(3500);
  k.note('after confirm ' + JSON.stringify(await k.where().then((x: any) => ({ kind: x.kind, av: x.av }))));
  await S(page, '51-after-confirm');
  await goTo('tavern_to_cellar', 10);
  await page.waitForTimeout(2500);
  const wc = await k.where(); k.note('room now ' + wc.kind + ' ' + JSON.stringify(wc.av)); await S(page, '52-cellar');
  if (wc.kind === 'cellar') {
    for (const [fx, fy] of [[0.3, 0.6], [0.75, 0.75], [0.3, 0.4], [0.6, 0.62], [0.45, 0.8], [0.8, 0.45]]) {
      const a0 = (await k.where()).av; await tap(page, vp.width * fx, vp.height * fy); await page.waitForTimeout(2200);
      const a1 = (await k.where()).av; k.note(`cellar walk tap ${Math.round(vp.width * fx)},${Math.round(vp.height * fy)}: ${a0.x},${a0.y} -> ${a1.x},${a1.y}`);
    }
    await S(page, '53-cellar-walked');
  }
  k.note('errors ' + JSON.stringify(errs.list));
});

test('r13 toast swallow', async ({ page }) => {
  test.setTimeout(120000);
  const k = kit(page, 'r13toast');
  await newGame1(page);
  for (const [x, y] of [[500, 100], [500, 100], [450, 90]]) {
    const a0 = (await k.where()).av; const info = await page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + '.' + (e as HTMLElement).className : null; }, { x, y });
    await tap(page, x, y); await page.waitForTimeout(2500);
    const a1 = (await k.where()).av; k.note(`tap ${x},${y} element ${info} av ${a0.x},${a0.y} -> ${a1.x},${a1.y}`);
    await S(page, '60-toast-tap');
  }
});
