// TESTER RUN 6 part 2: build the cellar, zoomed camera lock, guests one by one, hands-on pour, auto-collect, old piles, tutorial, quests.
import { test, expect } from '@playwright/test';
import { watchErrors } from './helpers';
import { kit, doorSpot } from './run6kit';

const SAMPLER = `
window.__samp = []; const h = window.__ph; let last = performance.now();
const loop = (t) => { const a = h.st.avatar; const s = h.worldToScreen({x:a.x,y:a.y}, h.st.shown);
  window.__samp.push({t, dt: t-last, sx: s.x, sy: s.y, cx: h.st.shown.x, cy: h.st.shown.y, ax: a.x, ay: a.y, room: h.st.room.kind}); last = t;
  if (!window.__stop) requestAnimationFrame(loop); }; requestAnimationFrame(loop);`;

test('r6kc C build the cellar at level 2', async ({ page }) => {
  test.setTimeout(300000);
  const errs = watchErrors(page);
  const k = kit(page, 'cellar');
  await k.newGame();
  await k.patchAndContinue((s) => { s.player.level = 1; s.player.wallet.gold = 800; });
  // level 1: button must be disabled
  await page.locator('button[title="Room"]').first().dispatchEvent('click'); await page.waitForTimeout(600);
  await k.sh('a-room-panel-l1');
  const b1 = page.getByRole('button', { name: /Build the cellar/ });
  k.note('level 1: build button disabled = ' + (await b1.isDisabled()));
  await page.keyboard.press('Escape');
  await k.patchAndContinue((s) => { s.player.level = 2; s.player.xp = 400; });
  await page.locator('button[title="Room"]').first().dispatchEvent('click'); await page.waitForTimeout(600);
  await k.sh('b-room-panel-l2');
  const g0 = (await k.state()).player.wallet.gold;
  await page.getByRole('button', { name: /Build the cellar/ }).click(); await page.waitForTimeout(800);
  await k.sh('c-confirm');
  const confirm = page.getByRole('button', { name: /^Build for/i }).first();
  k.note('confirm dialog button visible = ' + (await confirm.isVisible().catch(() => false)));
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await page.waitForTimeout(1500);
  const s1 = await k.state();
  k.note(`gold ${g0} -> ${s1.player.wallet.gold}, cellarRoomId ${s1.player.cellarRoomId}`);
  await k.sh('d-after-build');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  const wc = await k.where(); k.note('after build room: ' + wc.kind + ' items ' + JSON.stringify(wc.items)); await k.sh('d2-cellar-after-escape');
  const bk = doorSpot(wc, 'cellar_to_tavern'); k.note('cellar_to_tavern ' + JSON.stringify(bk));
  if (bk) { await k.clickWorld(bk.x, bk.y); await page.waitForTimeout(3500); }
  const w = await k.where(); k.note('then in ' + w.kind);
  const cd = doorSpot(w, 'tavern_to_cellar')!;
  await k.clickWorld(cd.x, cd.y); await page.waitForTimeout(3500);
  const w2 = await k.where(); k.note('cellar door: room ' + w2.kind + ' ' + JSON.stringify(w2)); await k.sh('e-cellar');
  const rack = w2.items.find((i: string) => /rack|keg/.test(i));
  if (rack) { const [x, y] = rack.split('@')[1].split(',').map(Number); await k.clickWorld(x, y - 12); await page.waitForTimeout(2500); await k.sh('f-rack-panel'); }
  else k.note('no rack item in cellar: ' + JSON.stringify(w2.items));
  expect(errs.list).toEqual([]);
});

test('r6kc D camera lock when zoomed in', async ({ page }) => {
  test.setTimeout(240000);
  const errs = watchErrors(page);
  const k = kit(page, 'camz');
  await k.newGame();
  const W = page.viewportSize()!.width, H = page.viewportSize()!.height;
  await page.mouse.move(W / 2, H / 2);
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(80); }
  await page.waitForTimeout(1200);
  const z: any = await page.evaluate(`({z:window.__ph.st.shown.zoom,dpr:devicePixelRatio})`);
  k.note('zoom after wheel ' + JSON.stringify(z));
  const i0 = (a: any[], f: any) => { const i = a.indexOf(f); return i > 0 && Math.abs(f.ax - a[i - 1].ax) + Math.abs(f.ay - a[i - 1].ay) > 0.3; };
  const trace = (a: any[]) => a.filter((f: any, i: number) => i % 4 === 0).map((f: any) => Math.round(Math.hypot(f.sx - W / 2, f.sy - H / 2)) + (i0(a, f) ? "m" : "s")).join(" ");
  await page.evaluate(SAMPLER);
  await page.mouse.click(W * 0.75, H * 0.8); await page.waitForTimeout(3000);
  const s1: any[] = await page.evaluate(`window.__samp`);
  const mov = s1.filter((f, i) => i > 0 && Math.abs(f.ax - s1[i - 1].ax) + Math.abs(f.ay - s1[i - 1].ay) > 0.3);
  const off = mov.map((f) => Math.hypot(f.sx - W / 2, f.sy - H / 2));
  k.note(`ZOOMED walk: ${mov.length} moving frames, max offset ${Math.max(0, ...off).toFixed(1)} px, avg ${(off.reduce((a, b) => a + b, 0) / Math.max(1, off.length)).toFixed(1)}`);
  k.note('trace walk1 (offset px, m=moving s=still, every 4th frame): ' + trace(s1));
  await k.sh('a-walk');
  await page.evaluate(`window.__samp = []`);
  const c0: any = await page.evaluate(`({x:window.__ph.st.shown.x,y:window.__ph.st.shown.y})`);
  await page.mouse.move(W * 0.5, H * 0.5); await page.mouse.down(); await page.mouse.move(W * 0.5 + 140, H * 0.5 + 80, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(400);
  const c1: any = await page.evaluate(`({x:window.__ph.st.shown.x,y:window.__ph.st.shown.y})`);
  k.note(`ZOOMED still drag: camera moved ${(c1.x - c0.x).toFixed(1)}, ${(c1.y - c0.y).toFixed(1)}`);
  await k.sh('b-panned');
  await page.evaluate(`window.__samp = []`);
  await page.mouse.click(W * 0.3, H * 0.4); await page.waitForTimeout(2500);
  const s2: any[] = await page.evaluate(`window.__samp`);
  let worst = 0; for (let i = 1; i < s2.length; i++) worst = Math.max(worst, Math.hypot(s2[i].cx - s2[i - 1].cx, s2[i].cy - s2[i - 1].cy));
  const settle = s2.find((f) => Math.hypot(f.sx - W / 2, f.sy - H / 2) < 1.5);
  const mv2 = s2.filter((f, i) => i > 0 && Math.abs(f.ax - s2[i - 1].ax) + Math.abs(f.ay - s2[i - 1].ay) > 0.3);
  k.note(`ZOOMED ease back: worst camera step ${worst.toFixed(1)} world px/frame, centred after ${settle ? Math.round(settle.t - s2[0].t) : 'never'} ms; max avatar offset after centred: ${Math.max(0, ...s2.filter((f) => settle && f.t > settle.t && mv2.length).map((f) => Math.hypot(f.sx - W / 2, f.sy - H / 2))).toFixed(1)}`);
  k.note('trace walk2: ' + trace(s2));
  await k.sh('c-eased');
  // drag during walk
  await page.mouse.click(W * 0.8, H * 0.7); await page.waitForTimeout(300);
  await page.evaluate(`window.__samp = []`);
  await page.mouse.move(W * 0.5, H * 0.5); await page.mouse.down(); await page.mouse.move(W * 0.5 - 150, H * 0.5, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(500);
  const s3: any[] = await page.evaluate(`window.__samp`);
  const mv3 = s3.filter((f, i) => i > 0 && Math.abs(f.ax - s3[i - 1].ax) + Math.abs(f.ay - s3[i - 1].ay) > 0.3);
  k.note(`ZOOMED drag while walking: ${mv3.length} moving frames, max offset ${Math.max(0, ...mv3.map((f) => Math.hypot(f.sx - W / 2, f.sy - H / 2))).toFixed(1)} px`);
  await page.evaluate(`window.__stop = true`);
  expect(errs.list).toEqual([]);
});

test('r6kc E guests one by one, pour, auto-collect, markers', async ({ page }) => {
  test.setTimeout(420000);
  const errs = watchErrors(page);
  const k = kit(page, 'serve');
  await k.newGame();
  const arrivals: string[] = [];
  const seen = new Set<number>();
  let messMax = 0; let lastMessSeen = 0; const t0 = Date.now();
  let served = 0; let goldStart: number | null = null;
  for (let i = 0; i < 400 && Date.now() - t0 < 300000; i++) {
    await page.waitForTimeout(500);
    const t = Math.round((Date.now() - t0) / 100) / 10;
    const v: any = await k.ph(`const v = await h.api.getTavern(); const r = await h.api.getPlayer?.(); return { g: v.guests.map(g=>({id:g.id,x:Math.round(g.x),y:Math.round(g.y),ph:g.phase,seated:g.seated,o:g.order?g.order.item:null,grp:g.groupId})), mess: v.mess.length, coins: v.mess.reduce((a,m)=>a+m.coins,0), tray: v.tray.length, av: {x:h.st.avatar.x,y:h.st.avatar.y}, gold: h.api.state?.player?.wallet?.gold ?? null }`).catch(() => null);
    if (!v) continue;
    if (goldStart === null) goldStart = v.gold;
    for (const g of v.g) if (!seen.has(g.id)) { seen.add(g.id); arrivals.push(`t=${t}s guest ${g.id} grp ${g.grp} at ${g.x},${g.y}`); }
    messMax = Math.max(messMax, v.mess);
    if (v.mess > 0) lastMessSeen = t;
    const want = v.g.find((g: any) => g.seated && g.o && g.ph === 'order');
    if (want && v.tray === 0 && served < 2) {
      await k.sh(`a-order-t${t}`);
      const dom: any = await page.evaluate(`({ bubbles: [...document.querySelectorAll('.order-bubble')].filter(b=>!b.hidden).map(b=>{const r=b.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)]}), chips: document.querySelectorAll('.orders-strip .orders-chip, .orders-strip button[data-state]').length, strip: !!document.querySelector('.orders-strip:not([hidden])') })`);
      k.note(`t=${t}s order markers ${JSON.stringify(dom)}`);
      // tap guest: walks to the taps and waits
      await k.clickWorld(want.x, want.y - 20);
      let stg = ''; for (let j = 0; j < 60; j++) { await page.waitForTimeout(250); stg = await k.ph('return h.api.walkState?.task?.stage ?? "none"'); if (stg === 'pourwait') break; }
      k.note('stage before pour ' + stg + ' after ' + 'poll');
      const stand: any = await k.ph(`const u=h.st.items.find(i=>i.typeId==='tap_stand'); return u? h.standPoint(u.uid):null`);
      k.note('stand screen point ' + JSON.stringify(stand));
      if (stand) { await page.mouse.move(stand.x, stand.y); await page.mouse.down(); await page.waitForTimeout(700); await k.sh(`b-pouring-t${t}`); await page.waitForTimeout(700); await page.mouse.up(); await page.waitForTimeout(600); await k.sh(`c-poured-t${t}`); }
      const tray: any = await k.ph(`return (await h.api.getTavern()).tray`);
      k.note('tray after pour ' + JSON.stringify(tray));
      const gnow: any = await k.ph(`const v = await h.api.getTavern(); return v.guests.find(g=>g.id===${want.id})`);
      if (gnow) { await k.clickWorld(gnow.x, gnow.y - 20); await page.waitForTimeout(3000); await k.sh(`d-carry-t${t}`); }
      served++;
    }
    if (served >= 2 && v.g.length === 0 && t > 60) break;
  }
  const st = await k.state();
  k.note('ARRIVALS\n' + arrivals.join('\n'));
  k.note(`gold ${goldStart} -> ${st.player.wallet.gold}; mess max ${messMax}; last mess seen t=${lastMessSeen}; final mess ${st.tavern.mess.length}`);
  expect(errs.list).toEqual([]);
});

test('r6kc F guest spawn dense', async ({ page }) => {
  test.setTimeout(120000);
  const errs = watchErrors(page);
  const k = kit(page, 'spawn');
  await k.newGame();
  const log: string[] = [];
  const t0 = Date.now();
  const shots = new Set<number>();
  for (let i = 0; i < 120; i++) {
    const t = (Date.now() - t0) / 1000;
    const v: any = await k.ph('const v = await h.api.getTavern(); return v.guests.map(g=>[g.id,Math.round(g.x),Math.round(g.y),g.phase,Math.round(g.waitMs),g.path.length])').catch(() => []);
    if (v.length) log.push(t.toFixed(2) + ' ' + JSON.stringify(v));
    for (const sec of [1, 2, 4, 6, 8, 10, 12]) if (t >= sec && !shots.has(sec)) { shots.add(sec); await k.sh('t' + sec); }
    await page.waitForTimeout(200);
  }
  k.note(log.filter((_, i) => i % 3 === 0).join(String.fromCharCode(10)));
  expect(errs.list).toEqual([]);
});

const CARD = "(() => { const c = document.querySelector('.first-ten'); return c ? c.innerText.split(String.fromCharCode(10)).join(' ').slice(0, 140) : 'NO CARD'; })()";

test('r6kc G tutorial flow with kitchen door and old piles', async ({ page }) => {
  test.setTimeout(400000);
  const errs = watchErrors(page);
  const k = kit(page, 'tut');
  await k.newGame();
  const log = async (tag: string) => k.note(tag + ' | ' + (await page.evaluate(CARD)));
  await log('start');
  const w = await k.where();
  const reg = w.items.find((i: string) => i.startsWith('register@'))!; const [rx, ry] = reg.split('@')[1].split(',').map(Number);
  await k.clickWorld(rx, ry - 16); await page.waitForTimeout(1800); await log('after register tap'); await k.sh('a-register-panel');
  await page.keyboard.press('Escape'); await page.waitForTimeout(500); await log('after panel closed');
  // serve the first order
  let done = false;
  for (let i = 0; i < 200 && !done; i++) {
    await page.waitForTimeout(500);
    const v: any = await k.ph('const v = await h.api.getTavern(); return v.guests.map(g=>({id:g.id,x:g.x,y:g.y,ph:g.phase,seated:g.seated,o:g.order?1:0}))').catch(() => []);
    const want = v.find((g: any) => g.seated && g.o && g.ph === 'order');
    if (!want) continue;
    await k.clickWorld(want.x, want.y - 20); await log('guest tapped');
    for (let j = 0; j < 60; j++) { await page.waitForTimeout(250); if ((await k.ph('return h.api.walkState?.task?.stage ?? "none"')) === 'pourwait') break; }
    await log('at taps (pourwait)'); await k.sh('b-pourwait');
    const stand: any = await k.ph(`const u=h.st.items.find(i=>i.typeId==='tap_stand'); return h.standPoint(u.uid)`);
    await page.mouse.move(stand.x, stand.y); await page.mouse.down(); await page.waitForTimeout(1300); await page.mouse.up(); await page.waitForTimeout(500);
    await log('after pour');
    const g2: any = await k.ph(`const v = await h.api.getTavern(); return v.guests.find(g=>g.id===${want.id})`);
    await k.clickWorld(g2.x, g2.y - 20); await page.waitForTimeout(2500); await log('after carry');
    done = true;
  }
  const g0 = (await k.state()).player.wallet.gold;
  for (let i = 0; i < 70; i++) { await page.waitForTimeout(1000); if ((await k.state()).player.wallet.gold > g0) break; }
  await log('after coins (gold ' + g0 + ' -> ' + (await k.state()).player.wallet.gold + ')'); await k.sh('c-after-coins');
  await page.waitForTimeout(3000); await log('3s later'); await k.sh('c2-kitchen-step');
  // RUN 7: the kitchen is an annex of the tavern now (no room switch): walk through the doorway at x 64 and tap the barrel inside.
  await k.clickWorld(64, 290); await page.waitForTimeout(3000); await k.clickWorld(64, 340); await page.waitForTimeout(1500); await log('in doorway'); await k.sh('d-annex');
  await k.clickWorld(16, 368); await page.waitForTimeout(2500); await log('barrel tapped'); await k.sh('e-barrel-panel');
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  // old piles: inject a mess pile at the table seat and Continue
  await k.patchAndContinue((s) => {
    const t = s.items.find((i: any) => i.typeId === 'table'); const seat = 0;
    s.tavern.mess.push({ id: 9001, seatUid: t.uid, seatIndex: seat, x: t.x, y: t.y - 20, coins: 7, gems: 0, dish: 'root_ale' });
    s.tavern.nextMessId = Math.max(s.tavern.nextMessId ?? 0, 9002);
  });
  const gA = (await k.state()).player.wallet.gold;
  const mA: any = await k.ph('return (await h.api.getTavern()).mess.length');
  k.note(`OLD PILE after Continue: mess ${mA}, gold ${gA}`);
  await page.waitForTimeout(4000);
  const mB: any = await k.ph('return (await h.api.getTavern()).mess.length');
  k.note(`OLD PILE 4 s later: mess ${mB}, gold ${(await k.state()).player.wallet.gold}`); await k.sh('f-old-pile');
  // quests panel
  const q = page.locator('button[title^="Quests"]').first(); await q.dispatchEvent('click'); await page.waitForTimeout(800); await k.sh('g-quests');
  k.note('quests panel text: ' + (await page.evaluate(`document.body.innerText.slice(0,0)`)));
  expect(errs.list).toEqual([]);
});

// BUG SPECS: each of these FAILS while the bug exists (RUN 6 kitchen/cellar in docs/FIXLIST.md).
test('r6kc H bug: first-steps card must not cover the cellar door', async ({ page }) => {
  test.setTimeout(120000);
  const k = kit(page, 'bugH');
  await k.newGame();
  await page.waitForSelector('.orders-strip:not([hidden])', { timeout: 60000 }); await page.waitForTimeout(1000);
  const w = await k.where(); const d = doorSpot(w, 'tavern_to_cellar')!;
  const tl = await k.toScreen(d.x - 32, -64); const br = await k.toScreen(d.x + 32, 0);
  const r: any = await page.evaluate('(() => { const c = document.querySelector(".first-ten"); if (!c) return null; const b = c.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; })()');
  k.note('door art rect ' + JSON.stringify([tl, br]) + ', card ' + JSON.stringify(r)); await k.sh('door-vs-card');
  expect(r, 'card present').not.toBeNull();
  const ox = Math.max(0, Math.min(br.x, r.x + r.w) - Math.max(tl.x, r.x)); const oy = Math.max(0, Math.min(br.y, r.y + r.h) - Math.max(tl.y, r.y));
  const share = (ox * oy) / ((br.x - tl.x) * (br.y - tl.y));
  expect(share, 'share of the kitchen door art hidden under the first-steps card (cellar door)').toBeLessThan(0.3);
});

// r6kc I (kitchen door hint mentioned the garden) retired in RUN 7: there is no kitchen room or door any more.

test('r6kc J bug: keg rack panel text must not wrap one word per line', async ({ page }) => {
  test.setTimeout(200000);
  const k = kit(page, 'bugJ');
  await k.newGame();
  await k.patchAndContinue((s) => { s.player.level = 2; s.player.xp = 400; s.player.wallet.gold = 800; });
  await page.locator('button[title="Room"]').first().dispatchEvent('click'); await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Build the cellar/ }).click(); await page.waitForTimeout(600);
  await page.getByRole('button', { name: /^Build for/i }).first().click(); await page.waitForTimeout(1500);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  const w = await k.where(); const rack = w.items.find((i: string) => i.startsWith('keg_rack@'))!; const [x, y] = rack.split('@')[1].split(',').map(Number);
  await k.clickWorld(x, y - 12); await page.waitForTimeout(2500); await k.sh('rack-panel');
  const widths: number[] = await page.evaluate(`[...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /No brewed drink/.test(e.textContent || '')).map(e => e.getBoundingClientRect().width)`);
  k.note('widths ' + JSON.stringify(widths));
  expect(widths.length).toBeGreaterThan(0);
  expect(Math.min(...widths), 'the "No brewed drink in your bag" line is a narrow column').toBeGreaterThan(150);
});
