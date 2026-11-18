// TESTER RUN 3: name-only start, guide pointers, pour/serve, stove, stack blocks, farm splice dialog, Book, cat, hats.
import { test, expect } from '@playwright/test';
import { debugOn, notes, openSide, poll, saveState, shot, step, watchErrors } from './helpers';

test('run3', async ({ page }) => {
  test.setTimeout(420000);
  const errs = watchErrors(page);
  const vp = page.viewportSize()!;
  const phone = vp.width < 600;
  const state = async (): Promise<any> => (await saveState(page)).state;
  const reload = async (st: any, key: string, version: number): Promise<void> => {
    await page.evaluate(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key, saved: { version, savedAt: Date.now(), state: st } });
    await page.goto('/?e2e');
    await page.getByText('Continue').first().click();
    await page.waitForTimeout(3500);
  };
  const scr = (wx: number, wy: number): Promise<[number, number]> => page.evaluate(({ wx, wy }) => { const h = (window as any).__ph; const p = h.worldToScreen({ x: wx, y: wy }, h.st.shown); return [p.x, p.y] as [number, number]; }, { wx, wy });
  const cam = async (zoom = 1.64): Promise<void> => { await page.evaluate((z) => (window as any).__ph.setCamera({ x: 0, y: 0, zoom: z }, true), zoom); await page.waitForTimeout(400); };
  const tapW = async (wx: number, wy: number): Promise<void> => { await cam(phone ? 1.2 : 1.64); const [x, y] = await scr(wx, wy); await page.mouse.click(x, y); };

  await page.goto('/?e2e');
  await page.waitForTimeout(1500);
  await shot(page, 'r3-00-title');
  await step(page, 'new game name only', async () => {
    await page.getByText('New game').first().click();
    await page.waitForTimeout(500);
    await shot(page, 'r3-01-charmaker');
    expect(await page.getByLabel('Inn name').count()).toBe(0);
    await page.getByLabel('Display name').fill('Tester');
    await page.getByText('Begin your story').click();
    await shot(page, 'r3-02-hotelshape');
    await page.getByRole('button', { name: 'Open my tavern' }).click();
    await page.waitForTimeout(800);
    await shot(page, 'r3-04-intro');
    await page.mouse.click(5, 300); await page.waitForTimeout(500); await page.mouse.click(5, 300);
    await page.waitForTimeout(2500);
    const s = await state();
    notes.push(`note innName=${s.player.innName} gold=${s.player.wallet.gold} mats=${JSON.stringify(s.player.materials)}`);
    expect(s.player.innName).toBe("Tester's Tavern");
  });
  await step(page, 'guide pointer', async () => {
    await page.waitForTimeout(1500);
    await shot(page, 'r3-05-guide');
    notes.push(`note guide-pointer count=${await page.locator('.guide-pointer').count()} on=${await page.locator('.guide-pointer.on').count()}`);
  });

  const base = await saveState(page);
  const st0 = JSON.parse(JSON.stringify(base.state));
  Object.assign(st0.player.materials, { turnip: 6, potato: 4, turnip_seed: 4, potato_seed: 4, root_ale: 4, dirt: 20, planks: 10 });
  st0.player.wallet.gold = 900;
  const hotelR = st0.rooms.find((r: any) => r.kind === 'hotel');
  const bk = JSON.parse(JSON.stringify(st0.items.find((i: any) => i.typeId === 'stove')));
  Object.assign(bk, { uid: st0.nextUid, typeId: 'pet_basket', roomId: hotelR.id, x: 3 * 32 + 16, y: 4 * 32 });
  st0.nextUid += 1; st0.items.push(bk);
  const basketUid = bk.uid;
  st0.hotbar = ['dirt', 'planks', 'turnip_seed', 'potato_seed', ...st0.hotbar.slice(4)];
  await reload(st0, base.key, base.version);
  await debugOn(page);
  await cam(phone ? 1.2 : 1.64);
  await shot(page, 'r3-10-tavern');

  await step(page, 'stove cook + collect', async () => {
    const s = await state();
    const stv = s.items.find((i: any) => i.typeId === 'stove');
    await tapW(stv.x, stv.y - 16);
    await page.getByRole('button', { name: /^Cook/ }).first().waitFor({ timeout: 15000 });
    await shot(page, 'r3-11-stove-panel');
    await page.getByRole('button', { name: /^Cook/ }).first().click(); await page.waitForTimeout(600);
    await shot(page, 'r3-12-cooking');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(24000);
    await tapW(stv.x, stv.y - 16); await page.waitForTimeout(3500);
    await shot(page, 'r3-13-collected');
    expect((await state()).player.materials.roasted_turnip ?? 0).toBeGreaterThan(0);
  });

  await step(page, 'tavern pour + serve', async () => {
    const s0 = await state();
    const g = await poll(page, async () => (await state()).tavern.guests.find((x: any) => x.order), 150000, 1000);
    await shot(page, 'r3-20-guest-ordered');
    await tapW(g.x, g.y - 28); await page.waitForTimeout(3500);
    const uid = s0.items.find((i: any) => i.typeId === 'tap_stand').uid;
    const p = await page.evaluate((u) => { const q = (window as any).__ph.standPoint(u); return q ? [q.x, q.y] : null; }, uid);
    await shot(page, 'r3-21-pourwait');
    if (!p) throw new Error('no stand point');
    await page.mouse.move(p[0], p[1]); await page.mouse.down(); await page.waitForTimeout(1250);
    await shot(page, 'r3-22-pouring');
    await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(700);
    await shot(page, 'r3-23-poured');
    const s = await state();
    notes.push(`note tray=${JSON.stringify(s.tavern.tray)}`);
    expect(s.tavern.tray.length).toBeGreaterThan(0);
    const g2 = s.tavern.guests.find((x: any) => x.order) ?? s.tavern.guests[0];
    await tapW(g2.x, g2.y - 28);
    await poll(page, async () => (await state()).tavern.tray.length === 0, 15000);
    await shot(page, 'r3-24-delivered');
    await page.waitForTimeout(8000);
    await shot(page, 'r3-25-eating');
  });
  notes.push('note errors so far: ' + errs.list.length);

  const goto = async (label: RegExp): Promise<void> => {
    await openSide(page, 'Worlds'); await page.waitForTimeout(400);
    await page.locator('.travel-card', { hasText: label }).first().click();
    await page.waitForTimeout(3500);
  };
  await step(page, 'hotel: stack blocks by tap', async () => {
    await goto(/Hotel room/);
    await cam(phone ? 1.2 : 1.64);
    await shot(page, 'r3-30-hotel');
    const room = await page.evaluate(() => { const r = (window as any).__ph.st.room; return { id: r.id, w: r.w, h: r.h, kind: r.kind }; });
    notes.push(`note room ${JSON.stringify(room)}`);
    await page.locator('.hotbar-slot').first().click();
    await page.waitForTimeout(400);
    const [x, y] = await scr(6 * 32 + 16, 6 * 32 + 16);
    for (let i = 0; i < 3; i++) { await page.mouse.click(x, y); await page.waitForTimeout(1800); }
    await shot(page, 'r3-31-stack3');
    await page.mouse.click(x, y); await page.waitForTimeout(1500);
    const s = await state();
    const hotel = s.rooms.find((r: any) => r.id === room.id);
    notes.push(`note blocks=${JSON.stringify(Object.entries(hotel.blocks ?? {}).slice(0, 4))}`);
    await shot(page, 'r3-32-stack4-refused');
    await page.locator('.hotbar-slot').nth(1).click(); await page.waitForTimeout(300);
    const [x2, y2] = await scr(8 * 32 + 16, 6 * 32 + 16);
    await page.mouse.click(x2, y2); await page.waitForTimeout(1500);
    await page.locator('.hotbar-slot').first().click(); await page.waitForTimeout(300);
    await page.mouse.click(x2, y2); await page.waitForTimeout(1500);
    await page.mouse.move(vp.width / 2, vp.height / 2);
    await shot(page, 'r3-33-mixed-stack');
  });
  await step(page, 'hotel: cat hook', async () => {
    await page.keyboard.press('Escape');
    const r = await page.evaluate(async (u) => JSON.stringify(await (window as any).__ph.api.useItem(u)), basketUid);
    notes.push(`note useItem basket: ${r}`);
    await page.waitForTimeout(4000);
    await cam(phone ? 1.2 : 1.64);
    await shot(page, 'r3-34-cat');
    const r2 = await page.evaluate(async (u) => JSON.stringify(await (window as any).__ph.api.useItem(u)), basketUid);
    notes.push(`note useItem basket again: ${r2}`);
    await page.waitForTimeout(6000);
    await shot(page, 'r3-35-cat-later');
  });

  await step(page, 'farm: plant + splice preview', async () => {
    await goto(/Farm/);
    await page.keyboard.press('Escape');
    const t = async (c: number, r: number): Promise<void> => { const [x, y] = await scr(c * 32 + 16, r * 32 + 16); await page.mouse.click(x, y); await page.waitForTimeout(2500); };
    await shot(page, 'r3-40-farm');
    await page.locator('.hotbar-slot').nth(2).click(); await page.waitForTimeout(400);
    await shot(page, 'r3-41-seed-selected');
    await t(2, 2);
    await shot(page, 'r3-42-planted');
    await page.locator('.hotbar-slot').nth(3).click(); await page.waitForTimeout(400);
    await t(2, 2);
    await page.waitForTimeout(800);
    await shot(page, 'r3-43-splice-dialog');
    notes.push(`note splice rows: ${await page.locator('.splice-row').count()}`);
    await page.getByRole('button', { name: /^Splice$/ }).click().catch(() => notes.push('note no Splice button'));
    await page.waitForTimeout(1500);
    await shot(page, 'r3-44-spliced');
    const s = await state();
    const farm = s.rooms.find((r: any) => r.kind === 'farm');
    notes.push(`note farm plants ${JSON.stringify(farm.plants).slice(0, 250)} seeds ${s.player.materials.turnip_seed}/${s.player.materials.potato_seed}`);
  });

  await step(page, 'book splice tab', async () => {
    await page.keyboard.press('Escape');
    await openSide(page, 'Book');
    await page.waitForTimeout(600);
    await shot(page, 'r3-50-book');
    await page.getByRole('button', { name: /splice/i }).first().click({ timeout: 4000 }).catch(async () => { await page.locator('.book-tab, [role=tab]').last().click(); });
    await page.waitForTimeout(600);
    await shot(page, 'r3-51-book-splice');
    await page.keyboard.press('Escape');
  });

  await step(page, 'hats', async () => {
    const HATS = ['straw_hat', 'hood_coif', 'felt_cap', 'cook_cap', 'feather_cap', 'tavern_keeper_hat', 'fisher_hat', 'flower_crown', 'knight_helm', 'gold_crown', 'sunken_crown_hat'];
    const k = await saveState(page);
    for (const id of HATS) {
      const st = JSON.parse(JSON.stringify(k.state));
      st.look = { ...st.look, hat: id };
      if (st.player.look) st.player.look = { ...st.player.look, hat: id };
      st.player.unlockedClothing = Array.from(new Set([...(st.player.unlockedClothing ?? []), ...HATS]));
      await reload(st, k.key, k.version);
      const clip = { x: Math.max(0, vp.width / 2 - 100), y: Math.max(0, vp.height / 2 - 130), width: 200, height: 300 };
      await page.screenshot({ path: `test-results/${phone ? 'phone' : 'desktop'}-r3-hat-${id}-down.png`, clip });
      await page.mouse.click(vp.width / 2, Math.max(120, vp.height / 2 - 220)); await page.waitForTimeout(450);
      await page.screenshot({ path: `test-results/${phone ? 'phone' : 'desktop'}-r3-hat-${id}-up.png`, clip });
    }
  });
  notes.push('note errors: ' + errs.list.length);
  console.log('\n' + notes.join('\n') + '\nERRS:\n' + errs.list.slice(0, 20).join('\n'));
});
