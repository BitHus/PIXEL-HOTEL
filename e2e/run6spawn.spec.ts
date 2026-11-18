// TESTER RUN 6 spawn and look: first minutes, tavern guest spawn, worlds, dungeon seeds. Writes JSON + shots to test-results-r6/r6/.
import { test } from '@playwright/test';
import * as fs from 'fs';
import { saveState, watchErrors } from './helpers';

const OUT = 'r6-shots';
fs.mkdirSync(OUT, { recursive: true });

test('r6 first minutes and tavern', async ({ page }) => {
  test.setTimeout(420000);
  const errs = watchErrors(page);
  const tag = page.viewportSize()!.width < 600 ? 'phone' : 'desktop';
  const sh = (n: string) => page.screenshot({ path: `${OUT}/${tag}-${n}.png` });
  const ph = <T>(body: string): Promise<T> => page.evaluate((b) => new Function('h', `return (async()=>{ ${b} })()`)((window as any).__ph), body) as Promise<T>;
  await page.goto('/?e2e');
  await page.waitForTimeout(1500); await sh('a0-title');
  await page.getByText('New game').first().click();
  await page.getByLabel('Display name').fill('Tester');
  await sh('a1-char');
  await page.getByText('Begin your story').click();
  await page.getByRole('button', { name: 'Open my tavern' }).click();
  await page.waitForTimeout(800); await sh('a2-intro');
  await page.mouse.click(5, 300); await page.waitForTimeout(500); await page.mouse.click(5, 300);
  const log: any[] = [];
  const t0 = Date.now();
  for (let i = 0; i < 300; i++) {
    await page.waitForTimeout(500);
    const t = Math.round((Date.now() - t0) / 1000);
    const snap = await ph<any>(`const v = await h.api.getTavern(); const a = h.st.avatar; return { guests: v.guests.map(g => ({id:g.id,x:Math.round(g.x),y:Math.round(g.y),ph:g.phase,seated:g.seated,seat:g.seat,hasOrder:!!g.order})), tray: v.tray.length, av:{x:Math.round(a.x),y:Math.round(a.y)} }`).catch(() => null);
    if (snap) log.push({ t, ...snap });
    if ([4, 10, 20, 30, 45, 60, 90, 120, 150, 180, 210, 240].includes(t)) await sh(`b-t${t}`);
  }
  fs.writeFileSync(`${OUT}/${tag}-tavern-log.json`, JSON.stringify(log));
  const s = (await saveState(page)).state;
  fs.writeFileSync(`${OUT}/${tag}-state.json`, JSON.stringify(s));
  fs.writeFileSync(`${OUT}/${tag}-errs.json`, JSON.stringify(errs.list));
});

test('r6 dungeon runs and worlds', async ({ page }) => {
  test.setTimeout(900000);
  const errs = watchErrors(page);
  const tag = page.viewportSize()!.width < 600 ? 'phone' : 'desktop';
  const sh = (n: string) => page.screenshot({ path: `${OUT}/${tag}-${n}.png` });
  const ph = <T>(body: string): Promise<T> => page.evaluate((b) => new Function('h', `return (async()=>{ ${b} })()`)((window as any).__ph), body) as Promise<T>;
  await page.goto('/?e2e');
  await page.getByText('New game').first().click();
  await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click();
  await page.getByRole('button', { name: 'Open my tavern' }).click();
  await page.waitForTimeout(800);
  await page.mouse.click(5, 300); await page.waitForTimeout(500); await page.mouse.click(5, 300);
  await page.waitForTimeout(2500);
  const base = await saveState(page);
  const s0 = JSON.parse(JSON.stringify(base.state));
  s0.player.wallet.gold = 5000; s0.player.level = 8; s0.player.xp = 99999;
  await page.evaluate(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key: base.key, saved: { version: base.version, savedAt: Date.now(), state: s0 } });
  await page.goto('/?e2e'); await page.waitForTimeout(3000);
  await page.getByText('Continue').first().click(); await page.waitForTimeout(4000);
  await sh('c0-after-continue');
  const rooms = 0;
  fs.writeFileSync(`${OUT}/${tag}-rooms.json`, JSON.stringify(rooms));
  for (const w of ['farm', 'lakeside']) {
    try {
      await ph<any>(`await h.late.travelTo('${w}'); return 1`);
      await page.waitForTimeout(4500); await sh(`d-${w}`);
      await ph<any>(`await h.late.travelTo('shop'); return 1`);
      await page.waitForTimeout(2500);
    } catch (e) { fs.appendFileSync(`${OUT}/${tag}-notes.txt`, `world ${w} fail ${e}\n`); }
  }
  const results: any[] = [];
  for (let n = 0; n < 12; n++) {
    if (tag === 'phone' && n >= 3 && n < 11) continue;
    const place = n === 11 ? 'mine' : 'crypt';
    await ph<any>(`h.late.${place === 'mine' ? 'enterMineAsked' : 'enterDungeonAsked'}(); return 1`); await page.waitForTimeout(700); await page.getByRole('button', { name: /^Enter/ }).click({ timeout: 5000 }).catch(() => null); await page.waitForTimeout(3000);
    const run: any = await ph<any>(`const r = await h.api.getRun(); return r ? JSON.parse(JSON.stringify(r.run)) : null`);
    if (!run) { await sh('fail-start-'+n); results.push({ n, fail: 'start null' }); await page.waitForTimeout(1000); continue; }
    await page.waitForTimeout(2500);
    const m = run.map; const W = m.cols, H = m.rows;
    const fl = (c: number, r: number) => c >= 0 && r >= 0 && c < W && r < H && m.blocks[r * W + c] === 'floor';
    const bx = (v: number) => Math.floor(v / 32);
    const issues: string[] = [];
    const solidSet = new Set<number>((m.decor ?? []).filter((d: any) => d.solid).map((d: any) => d.r * W + d.c));
    const seen = new Set<number>(); const q = [[bx(m.spawn.x), bx(m.spawn.y)]]; seen.add(q[0][1] * W + q[0][0]);
    while (q.length) { const [c, r] = q.pop()!; for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = c + dc, nr = r + dr; if (fl(nc, nr) && !solidSet.has(nr * W + nc) && !seen.has(nr * W + nc)) { seen.add(nr * W + nc); q.push([nc, nr]); } } }
    const reach = (c: number, r: number) => seen.has(r * W + c);
    if (!fl(bx(m.spawn.x), bx(m.spawn.y))) issues.push('spawn not on floor');
    if (!fl(m.exit.c, m.exit.r)) issues.push(`exit not on floor ${m.exit.c},${m.exit.r}`); else if (!reach(m.exit.c, m.exit.r)) issues.push('exit unreachable');
    const decor = m.decor ?? [];
    const kinds: Record<string, number> = {};
    for (const d of decor) { kinds[d.kind] = (kinds[d.kind] ?? 0) + 1; if (!d.solid && !fl(d.c, d.r)) issues.push(`nonsolid decor ${d.kind} on wall ${d.c},${d.r}`); if (d.c === m.exit.c && d.r === m.exit.r) issues.push(`decor ${d.kind} on exit`); if (d.c === bx(m.spawn.x) && d.r === bx(m.spawn.y)) issues.push(`decor ${d.kind} on spawn`); }
    const chestInfo = run.chests.map((c: any) => ({ k: c.kind, m: c.mimic, c: bx(c.x), r: bx(c.y) }));
    for (const c of run.chests) { const cc = bx(c.x), rr = bx(c.y); if (!fl(cc, rr)) issues.push(`chest ${c.kind} off floor ${cc},${rr}`); else if (!reach(cc, rr)) issues.push(`chest ${c.kind} unreachable ${cc},${rr}`); const d = decor.find((d: any) => d.c === cc && d.r === rr); if (d) issues.push(`chest ${c.kind} overlaps decor ${d.kind} at ${cc},${rr}`); }
    for (const e of run.enemies) { const cc = bx(e.x), rr = bx(e.y); if (!fl(cc, rr)) issues.push(`enemy ${e.kind} off floor ${cc},${rr}`); const d = decor.find((d: any) => d.c === cc && d.r === rr); if (d && d.solid) issues.push(`enemy ${e.kind} in solid ${d.kind}`); }
    const gates = decor.filter((d: any) => /gate/.test(d.kind));
    results.push({ n, place, seed: run.seed, cols: W, rows: H, rooms: m.rooms.length, kinds, chestInfo, enemies: run.enemies.map((e: any) => e.kind).reduce((a: any, k: string) => (a[k] = (a[k] ?? 0) + 1, a), {}), gates: gates.length, issues, spawn: m.spawn, exit: m.exit });
    await sh(`e${n}-${place}-seed${run.seed}-spawn`);
    const targets: { label: string; x: number; y: number }[] = [];
    run.chests.slice(0, 2).forEach((c: any, i: number) => targets.push({ label: `chest${i}`, x: c.x, y: c.y + 24 }));
    const doneK = new Set<string>();
    for (const d of decor) { if (doneK.has(d.kind) || targets.length > 8) continue; doneK.add(d.kind); const adj = [[0, 1], [1, 0], [-1, 0], [0, -1]].find(([a, b]) => fl(d.c + a, d.r + b) && reach(d.c + a, d.r + b)); if (adj) targets.push({ label: d.kind, x: (d.c + adj[0]) * 32 + 16, y: (d.r + adj[1]) * 32 + 16 }); }
    if (place === 'crypt') targets.push({ label: 'exit', x: m.exit.c * 32 + 16, y: m.exit.r * 32 + 16 });
    if (n < 6 || place === 'mine') {
      for (const t of targets.slice(0, n < 3 ? 9 : 4)) {
        await ph(`return await h.api.dungeonInput({t:'click_point', x:${t.x}, y:${t.y}})`);
        for (let k = 0; k < 40; k++) { await page.waitForTimeout(500); const p = await ph<any>(`const r = await h.api.getRun(); return r ? {x: r.run.player.x, y: r.run.player.y, hp: r.run.player.hp} : null`); if (!p || Math.hypot(p.x - t.x, p.y - t.y) < 24 || p.hp <= 0) break; }
        await sh(`e${n}-${place}-seed${run.seed}-${t.label}`);
      }
    }
    await page.getByRole('button', { name: place === 'mine' ? /^Leave/ : /^Abandon/ }).first().click({ timeout: 3000 }).catch(() => null); await page.waitForTimeout(800); await sh(`e${n}-confirm`); await page.getByRole('button', { name: /^(Abandon|Yes|OK|Give up|Leave|Confirm)/ }).last().click({ timeout: 2000 }).catch(() => null);
    await page.waitForTimeout(1500); await sh(`e${n}-after-end`);
    await page.keyboard.press('Escape');
    const btn = page.locator('button', { hasText: /Back to the tavern/i }).first(); if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => null);
    await page.waitForTimeout(1500);
    fs.writeFileSync(`${OUT}/${tag}-dungeon-results.json`, JSON.stringify(results, null, 1));
  }
  fs.writeFileSync(`${OUT}/${tag}-errs2.json`, JSON.stringify(errs.list));
});

test('r6 tutorial play', async ({ page }) => {
  test.setTimeout(420000);
  const errs = watchErrors(page);
  const tag = page.viewportSize()!.width < 600 ? 'phone' : 'desktop';
  const sh = (n: string) => page.screenshot({ path: `${OUT}/${tag}-t${n}.png` });
  const ph = <T>(body: string): Promise<T> => page.evaluate((b) => new Function('h', `return (async()=>{ ${b} })()`)((window as any).__ph), body) as Promise<T>;
  const notes: string[] = [];
  const card = async () => (await page.locator('.first-ten-text').innerText().catch(() => '-')) + ' | ' + (await page.locator('.first-ten-count').innerText().catch(() => '-'));
  await page.goto('/?e2e');
  await page.getByText('New game').first().click();
  await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click();
  await page.getByRole('button', { name: 'Open my tavern' }).click();
  await page.waitForTimeout(800);
  await page.mouse.click(5, 300); await page.waitForTimeout(500); await page.mouse.click(5, 300);
  await page.waitForTimeout(3500);
  notes.push('card0 ' + await card());
  const ring = page.locator('.guide-ring').first();
  const rb = await ring.boundingBox();
  if (rb) { await page.mouse.click(rb.x + rb.width / 2, rb.y + rb.height / 2); await page.waitForTimeout(1500); await sh('1-menu'); }
  notes.push('after register ' + await card());
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  // wait for a guest with an order
  let g: any = null;
  for (let i = 0; i < 100 && !g; i++) { await page.waitForTimeout(500); g = await ph<any>(`const v = await h.api.getTavern(); return v.guests.find(g => g.order && g.seated) ? JSON.parse(JSON.stringify(v.guests.find(g => g.order && g.seated))) : null`); }
  notes.push('guest with order ' + JSON.stringify(g && { id: g.id, order: g.order, x: g.x, y: g.y }));
  await sh('2-guest-order'); notes.push('card ' + await card());
  const tap = async (wx: number, wy: number) => { const p = await ph<any>(`return h.worldToScreen({x:${wx},y:${wy}}, h.st.shown)`); await page.mouse.click(p.x, p.y); };
  if (g) {
    await tap(g.x, g.y - 20); await page.waitForTimeout(500);
    const stand = await ph<any>(`const it = (await h.api.getState?.()) ; return null`).catch(() => null);
    const uid = await ph<any>(`return h.tapStands ? JSON.stringify(h.tapStands()) : null`).catch(() => null);
    notes.push('stands ' + uid);
    const sp = await ph<any>(`const s = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /save/i.test(k) && !/backup/i.test(k)))).state; const it = s.items.find(i => i.typeId === 'tap_stand'); return h.standPoint(it.uid)`);
    notes.push('standPoint ' + JSON.stringify(sp));
    for (let k = 0; k < 25; k++) { await page.waitForTimeout(500); const st = await ph<any>(`return h.st.tavern ? 1 : 0`).catch(() => 0); const av = await ph<any>(`const a = h.st.avatar; return {x:a.x,y:a.y}`); if (Math.hypot(av.x - 80, av.y - 128) < 70) break; }
    await sh('3-at-taps');
    if (sp) { await page.mouse.move(sp.x, sp.y); await page.mouse.down(); await page.waitForTimeout(1250); await sh('4-pouring'); await page.waitForTimeout(150); await page.mouse.up(); }
    await page.waitForTimeout(800); await sh('5-poured'); notes.push('after pour ' + await card());
    await tap(g.x, g.y - 20); await page.waitForTimeout(2500); await sh('6-serving');
    // watch coins auto collect
    for (let k = 0; k < 60; k++) {
      await page.waitForTimeout(1000);
      const v = await ph<any>(`const v = await h.api.getTavern(); const gg = v.guests.find(x => x.id === ${g.id}); return { ph: gg && gg.phase, mess: v.mess.length, tray: v.tray.length }`);
      const gold = await ph<any>(`return (await h.api.getPlayer?.())?.wallet?.gold ?? null`).catch(() => null);
      if (k % 5 === 0) notes.push(`t${k} ${JSON.stringify(v)} gold ${gold}`);
      if (k === 10) await sh('7-eating');
      if (!v.ph || v.ph === 'leave') { await sh('8-leaving'); break; }
    }
    await page.waitForTimeout(1500); await sh('9-after');
    notes.push('after coins ' + await card());
    const gold = await ph<any>(`const s = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /save/i.test(k) && !/backup/i.test(k)))).state; return s.player.wallet.gold + ' mat ' + JSON.stringify(s.player.materials) + ' mess ' + JSON.stringify(s.tavern?.mess)`);
    notes.push('gold ' + gold);
  }
  fs.writeFileSync(`${OUT}/${tag}-tutorial-notes.txt`, notes.join('\n'));
  fs.writeFileSync(`${OUT}/${tag}-errs3.json`, JSON.stringify(errs.list));
});

test('r6 continue reloads throttled and farm overview', async ({ page }) => {
  test.setTimeout(300000);
  const errs = watchErrors(page);
  const tag = page.viewportSize()!.width < 600 ? 'phone' : 'desktop';
  const sh = (n: string) => page.screenshot({ path: `${OUT}/${tag}-${n}.png` });
  const ph = <T>(body: string): Promise<T> => page.evaluate((b) => new Function('h', `return (async()=>{ ${b} })()`)((window as any).__ph), body) as Promise<T>;
  await page.goto('/?e2e');
  await page.getByText('New game').first().click();
  await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click();
  await page.getByRole('button', { name: 'Open my tavern' }).click();
  await page.waitForTimeout(800);
  await page.mouse.click(5, 300); await page.waitForTimeout(500); await page.mouse.click(5, 300);
  await page.waitForTimeout(2500);
  const cdp = await page.context().newCDPSession(page);
  const notes: string[] = [];
  for (const rate of [1, 4, 6]) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    for (let i = 0; i < 3; i++) {
      await page.reload();
      await page.getByText('Continue').first().click();
      // sample very fast frames after Continue: look for a purple/black canvas
      const samples: string[] = [];
      for (let k = 0; k < 8; k++) {
        const p = `${OUT}/${tag}-cont-r${rate}-${i}-${k}.png`;
        await page.screenshot({ path: p });
        const px = await page.evaluate(() => { const c = document.querySelector('canvas') as HTMLCanvasElement | null; if (!c) return 'nocanvas'; const g = document.createElement('canvas'); g.width = 4; g.height = 4; const x = g.getContext('2d')!; x.drawImage(c, 0, 0, 4, 4); const d = x.getImageData(0, 0, 4, 4).data; let r = 0, gg = 0, b = 0; for (let j = 0; j < 16; j++) { r += d[j * 4]; gg += d[j * 4 + 1]; b += d[j * 4 + 2]; } return [r / 16, gg / 16, b / 16].map(Math.round).join(','); }).catch(() => 'err');
        samples.push(px);
        await page.waitForTimeout(250);
      }
      notes.push(`rate ${rate} try ${i}: ${samples.join(' | ')}`);
    }
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.reload(); await page.getByText('Continue').first().click(); await page.waitForTimeout(3000);
  await ph<any>(`await h.late.travelTo('farm'); return 1`); await page.waitForTimeout(4000);
  await ph<any>(`h.setCamera({ x: 0, y: 0, zoom: ${tag === 'phone' ? 0.8 : 1.2} }, true); return 1`); await page.waitForTimeout(600); await sh('f-farm-overview');
  await ph<any>(`await h.late.travelTo('lakeside'); return 1`); await page.waitForTimeout(4000);
  await ph<any>(`h.setCamera({ x: 0, y: 0, zoom: ${tag === 'phone' ? 0.8 : 1.2} }, true); return 1`); await page.waitForTimeout(600); await sh('f-lake-overview');
  fs.writeFileSync(`${OUT}/${tag}-continue-notes.txt`, notes.join('\n'));
  fs.writeFileSync(`${OUT}/${tag}-errs4.json`, JSON.stringify(errs.list));
});
