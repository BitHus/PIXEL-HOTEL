// TESTER RUN 2: stove, barrel, taps Load, hold-pour end to end, build, kitchen tint, farm, dungeon, offline catch-up.
import { test, expect } from '@playwright/test';
import { debugOn, newGame, notes, openSide, poll, saveState, shot, step, watchErrors } from './helpers';

test('run2', async ({ page }) => {
  test.setTimeout(540000);
  const errs = watchErrors(page);
  const vp = page.viewportSize()!;
  const state = async (): Promise<any> => (await saveState(page)).state;
  const reload = async (st: any, key: string, version: number): Promise<void> => {
    await page.evaluate(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key, saved: { version, savedAt: Date.now(), state: st } });
    await page.goto('/?e2e');
    await page.getByText('Continue').first().click();
    await page.waitForTimeout(3500);
  };
  let farmMode = false; const inFarm = (): boolean => farmMode;
  const scr0 = (wx: number, wy: number): Promise<[number, number]> => page.evaluate(({ wx, wy }) => { const h = (window as any).__ph; const p = h.worldToScreen({ x: wx, y: wy }, h.st.shown); return [p.x, p.y] as [number, number]; }, { wx, wy });
  const scr = async (wx: number, wy: number): Promise<[number, number]> => { if (!inFarm()) { await page.evaluate(() => (window as any).__ph.setCamera({ x: 0, y: 0, zoom: 1.64 }, true)); await page.waitForTimeout(150); } return scr0(wx, wy); };
  const tapW = async (wx: number, wy: number): Promise<void> => { if (!inFarm()) await page.evaluate(() => (window as any).__ph.setCamera({ x: 0, y: 0, zoom: 1.64 }, true)); await page.waitForTimeout(150); const [x, y] = await scr(wx, wy); await page.mouse.click(x, y); };

  await newGame(page);
  const base = await saveState(page);
  const st0 = JSON.parse(JSON.stringify(base.state));
  Object.assign(st0.player.materials, { turnip: 6, potato: 4, carrot: 3, turnip_seed: 6, root_ale: 4 });
  st0.player.wallet.gold = 800;
  const stove = st0.items.find((i: any) => i.typeId === 'stove');
  const prep = JSON.parse(JSON.stringify(stove));
  Object.assign(prep, { uid: st0.nextUid, typeId: 'prep_table', x: stove.x + 80, y: stove.y });
  st0.nextUid += 1;
  st0.items.push(prep);
  await reload(st0, base.key, base.version);
  await debugOn(page);
  const cam = async (): Promise<void> => { await page.evaluate(() => (window as any).__ph.setCamera({ x: 0, y: 0, zoom: 1.64 }, true)); await page.waitForTimeout(600); };
  await cam();
  await shot(page, 'r2-00-seeded');

  await step(page, 'stove: cook roasted turnip, wait, collect', async () => {
    await tapW(240, 96 - 16);
    await page.waitForTimeout(2500);
    await shot(page, 'r2-10-stove-panel');
    await page.getByRole('button', { name: /^Cook/ }).first().click();
    await page.waitForTimeout(800);
    await shot(page, 'r2-11-cooking');
    const s = await state();
    notes.push(`note cooks after Cook: ${JSON.stringify(s.tavern.cooks)} turnips ${s.player.materials.turnip}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(25000);
    await tapW(240, 96 - 16);
    await page.waitForTimeout(3500);
    await shot(page, 'r2-12-collected');
    const s2 = await state();
    notes.push(`note after collect: cooks ${s2.tavern.cooks.length}, roasted_turnip ${s2.player.materials.roasted_turnip}`);
    expect(s2.player.materials.roasted_turnip ?? 0).toBeGreaterThan(0);
  });

  await step(page, 'barrel: brew root ale', async () => {
    await page.keyboard.press('Escape');
    await tapW(496, 64 - 16);
    await page.waitForTimeout(2500);
    await shot(page, 'r2-20-brew-panel');
    await page.getByRole('button', { name: /^Brew/ }).first().click();
    await page.waitForTimeout(800);
    await shot(page, 'r2-21-brewing');
    const s = await state();
    notes.push(`note brews: ${JSON.stringify(s.tavern.brews)}`);
    expect(s.tavern.brews.length).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
  });

  await step(page, 'taps: Load root ale on tap 2', async () => {
    await tapW(80, 96 - 38);
    await page.waitForTimeout(2500);
    await shot(page, 'r2-30-taps-before');
    const load = page.getByRole('button', { name: /Load|Fill/ });
    notes.push(`note load buttons: ${await load.count()}`);
    await load.last().click();
    await page.waitForTimeout(800);
    await shot(page, 'r2-31-taps-after');
    const s = await state();
    notes.push(`note taps: ${JSON.stringify(s.tavern.taps)} bag ale ${s.player.materials.root_ale}`);
    await page.keyboard.press('Escape');
  });

  await step(page, 'hold-pour end to end', async () => {
    const g = await poll(page, async () => (await state()).tavern.guests.find((x: any) => x.order), 150000, 1000);
    await tapW(g.x, g.y - 28);
    await page.waitForTimeout(3500);
    const sp = await page.evaluate(() => { const p = (window as any).__ph.standPoint(9); return p ? [p.x, p.y] : null; });
    notes.push(`note stand point ${JSON.stringify(sp)}`);
    await shot(page, 'r2-40-pourwait');
    await page.mouse.move(sp[0], sp[1]);
    await page.mouse.down();
    await page.waitForTimeout(1200);
    await shot(page, 'r2-41-pouring');
    await page.waitForTimeout(250);
    await page.mouse.up();
    await page.waitForTimeout(700);
    await shot(page, 'r2-42-poured');
    const s = await state();
    notes.push(`note tray: ${JSON.stringify(s.tavern.tray)}`);
    expect(s.tavern.tray.length).toBeGreaterThan(0);
    const g2 = s.tavern.guests.find((x: any) => x.order) ?? s.tavern.guests[0];
    await tapW(g2.x, g2.y - 28);
    await poll(page, async () => (await state()).tavern.tray.length === 0, 15000);
    await shot(page, 'r2-43-delivered');
  });

  await step(page, 'build: kitchen tint, prep table, move + rotate', async () => {
    await page.keyboard.press('b');
    await page.waitForTimeout(700);
    await shot(page, 'r2-50-build-tint');
    const s = await state();
    const pt = s.items.find((i: any) => i.typeId === 'prep_table');
    const [fx, fy] = await scr(pt.x, pt.y - 16);
    const [tx, ty] = await scr(pt.x + 32, pt.y + 32 - 16);
    await page.mouse.move(fx, fy); await page.mouse.down();
    await page.mouse.move(tx, ty, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(600);
    await shot(page, 'r2-51-build-moved');
    const a = (await state()).items.find((i: any) => i.typeId === 'prep_table');
    notes.push(`note prep before ${pt.x},${pt.y} after ${a.x},${a.y}`);
    await page.locator('button[title="Rotate"]').click().catch(() => notes.push('note no Rotate button'));
    await page.waitForTimeout(400);
    await shot(page, 'r2-52-build-rotated');
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.keyboard.press('b');
  });

  const goto = async (label: RegExp): Promise<void> => {
    await openSide(page, 'Worlds');
    await page.waitForTimeout(400);
    await page.locator('.travel-card', { hasText: label }).first().click();
    await page.waitForTimeout(3000);
  };

  await step(page, 'farm: plant 3 turnips, unripe punch', async () => {
    await goto(/Farm/); farmMode = true;
    await shot(page, 'r2-60-farm');
    const res = await page.evaluate(async () => {
      const api = (window as any).__ph.api;
      const out: string[] = [];
      for (const c of [2, 3, 4]) { let r: any = null; for (let t = 0; t < 12; t++) { r = await api.plantSeed(c, 2, 'turnip_seed'); if (r.kind !== 'walk') break; await new Promise((x) => setTimeout(x, 1000)); } out.push(JSON.stringify(r)); }
      out.push('hit ' + JSON.stringify(await api.hitPlant(2, 2)));
      return out;
    });
    notes.push(`note plant: ${res.join(' | ')}`);
    await page.waitForTimeout(2500);
    await shot(page, 'r2-61-farm-planted');
  });

  await step(page, 'farm: ripe plant, harvest', async () => {
    const k = await saveState(page);
    const s = k.state;
    const farm = s.rooms.find((r: any) => r.kind === 'farm');
    notes.push(`note plants: ${JSON.stringify(farm.plants).slice(0, 300)}`);
    for (const c of Object.keys(farm.plants)) for (const f of Object.keys(farm.plants[c])) if (typeof farm.plants[c][f] === 'number' && farm.plants[c][f] > 1e12) farm.plants[c][f] -= 3600_000;
    await reload(s, k.key, k.version);
    await shot(page, 'r2-62-farm-ripe');
    const res = await page.evaluate(async () => { const api = (window as any).__ph.api; return JSON.stringify(await api.hitPlant(2, 2)); });
    await page.waitForTimeout(800);
    const s2 = await state();
    notes.push(`note harvest: ${res} turnip ${s2.player.materials.turnip} seed ${s2.player.materials.turnip_seed}`);
    await shot(page, 'r2-63-farm-harvest');
  });

  await step(page, 'dungeon: enter, look, fight', async () => {
    await goto(/Dungeon/); farmMode = true;
    await page.getByRole('button', { name: /Enter for/ }).click().catch(() => notes.push('note no Enter button'));
    await page.waitForTimeout(3000);
    await page.waitForTimeout(2000);
    await shot(page, 'r2-70-dungeon');
    for (let i = 0; i < 8; i++) {
      await page.mouse.click(vp.width / 2 + 90 * Math.cos(i), vp.height / 2 + 90 * Math.sin(i));
      await page.waitForTimeout(1200);
    }
    await shot(page, 'r2-71-dungeon-after');
    const s = await state();
    notes.push(`note run: ${s.run ? JSON.stringify(Object.keys(s.run)).slice(0, 200) : 'none'}`);
    const btns = await page.locator('button:visible').allTextContents();
    notes.push(`note dungeon visible buttons: ${JSON.stringify(btns.filter((t) => t.trim()).slice(0, 20))}`);
  });

  await step(page, 'offline catch-up: 3 h away', async () => {
    const k = await saveState(page);
    const s = k.state;
    notes.push(`note before: room ${s.currentRoomId} guests ${s.tavern.guests.length} brews ${JSON.stringify(s.tavern.brews).slice(0, 160)} gold ${s.player.wallet.gold}`);
    const H = 3 * 3600_000;
    s.tavern.updatedAt -= H;
    for (const b of s.tavern.brews) for (const f of Object.keys(b)) if (typeof b[f] === 'number' && b[f] > 1e12) b[f] -= H;
    s.run = null;
    await reload(s, k.key, k.version);
    await shot(page, 'r2-80-offline');
    const s2 = await state();
    notes.push(`note after: room ${s2.currentRoomId} guests ${s2.tavern.guests.length} ${JSON.stringify(s2.tavern.guests.map((g: any) => [g.phase, g.order?.item]))} mess ${s2.tavern.mess.length} brews ${JSON.stringify(s2.tavern.brews).slice(0, 160)} gold ${s2.player.wallet.gold}`);
  });

  console.log(`\n${notes.join('\n')}\nERRORS: ${JSON.stringify(errs.list)}`);
});
