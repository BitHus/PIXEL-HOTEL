// TESTER RUN 4: tap from the avatar position. Title, guide, tavern pour/serve, stove, barrel, sign, counter_ext, farm splice, stairs, wall items, hold-walk.
import { test, expect } from '@playwright/test';
import { debugOn, notes, openSide, poll, saveState, shot, step, watchErrors } from './helpers';

test('run4', async ({ page }) => {
  test.setTimeout(480000);
  const errs = watchErrors(page);
  const phone = page.viewportSize()!.width < 600;
  if (!phone) await page.setViewportSize({ width: 1280, height: 720 });
  const vp = page.viewportSize()!;
  const state = async (): Promise<any> => (await saveState(page)).state;
  const reload = async (st: any, key: string, version: number): Promise<void> => {
    await page.evaluate(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key, saved: { version, savedAt: Date.now(), state: st } });
    await page.goto('/?e2e');
    await shot(page, 'r4-continue-screen');
    await page.getByText('Continue').first().click();
    await page.waitForTimeout(3500);
  };
  const scr = (wx: number, wy: number): Promise<[number, number]> => page.evaluate(({ wx, wy }) => { const h = (window as any).__ph; const p = h.worldToScreen({ x: wx, y: wy }, h.st.shown); return [p.x, p.y] as [number, number]; }, { wx, wy });
  const av = (): Promise<{ x: number; y: number }> => page.evaluate(() => { const a = (window as any).__ph.st.avatar; return { x: a.x, y: a.y }; });
  const camOn = async (zoom: number): Promise<void> => {
    const a = await av();
    await page.evaluate(({ z, a, w, h }) => (window as any).__ph.setCamera({ x: a.x - w / 2 / z, y: a.y - 20 - h / 2 / z, zoom: z }, true), { z: zoom, a, w: vp.width, h: vp.height });
    await page.waitForTimeout(400);
  };
  const Z = phone ? 1.2 : 1.64;
  // tap a world point, with the camera centred on the avatar first
  const tapW = async (wx: number, wy: number): Promise<void> => { await camOn(Z); const [x, y] = await scr(wx, wy); await page.mouse.click(x, y); };

  await page.goto('/?e2e');
  await page.waitForTimeout(1500);
  await shot(page, 'r4-00-title');
  await step(page, 'new game', async () => {
    await page.getByText('New game').first().click();
    await page.getByLabel('Display name').fill('Tester');
    await page.getByText('Begin your story').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Open my tavern' }).click();
    await page.waitForTimeout(800);
    await page.mouse.click(5, 300); await page.waitForTimeout(500); await page.mouse.click(5, 300);
    await page.waitForTimeout(3000);
    await shot(page, 'r4-01-after-intro');
    notes.push(`note guide-ish elements: ${(await page.locator('[class*=guide], [class*=quest-card]').evaluateAll((els) => els.map((e) => e.className + ':' + (e as HTMLElement).innerText.slice(0, 40)))).join(' | ').slice(0, 300)}`);
  });
  await page.waitForTimeout(500);
  const base = await saveState(page);
  const st0 = JSON.parse(JSON.stringify(base.state));
  Object.assign(st0.player.materials, { turnip: 6, potato: 4, turnip_seed: 4, potato_seed: 4, root_ale: 4, dirt: 20, planks: 20, stone: 20 });
  st0.player.wallet.gold = 900;
  st0.hotbar = ['dirt', 'planks', 'turnip_seed', 'potato_seed', ...st0.hotbar.slice(4)];
  await reload(st0, base.key, base.version);
  await debugOn(page);
  await camOn(Z);
  await shot(page, 'r4-10-tavern');

  await step(page, 'hold-walk + camera centre', async () => {
    const a0 = await av();
    const [px, py] = await scr(a0.x + 100, a0.y + 20);
    await page.mouse.move(px, py); await page.mouse.down();
    await page.waitForTimeout(120);
    const a1 = await av();
    await page.waitForTimeout(500);
    const a2 = await av();
    await page.mouse.up();
    notes.push(`note hold-walk moved after 120ms: ${Math.round(Math.hypot(a1.x - a0.x, a1.y - a0.y))}px, after 620ms: ${Math.round(Math.hypot(a2.x - a0.x, a2.y - a0.y))}px`);
    await page.waitForTimeout(2500);
    const a3 = await av();
    const [sx, sy] = await scr(a3.x, a3.y - 20);
    notes.push(`note avatar on screen ${Math.round(sx)},${Math.round(sy)} vs centre ${vp.width / 2},${vp.height / 2} (camera not forced here)`);
    await shot(page, 'r4-11-holdwalk');
  });

  await step(page, 'stove cold -> cook -> ready', async () => {
    const s = await state();
    const stv = s.items.find((i: any) => i.typeId === 'stove');
    await shot(page, 'r4-12-stove-cold');
    await tapW(stv.x, stv.y - 16);
    await page.getByRole('button', { name: /^Cook/ }).first().waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: /^Cook/ }).first().click(); await page.waitForTimeout(600);
    await page.keyboard.press('Escape');
    await camOn(Z);
    await page.waitForTimeout(3000);
    await shot(page, 'r4-13-stove-cooking');
    await page.waitForTimeout(24000);
    await shot(page, 'r4-14-stove-ready');
    await tapW(stv.x, stv.y - 16); await page.waitForTimeout(3500);
    await shot(page, 'r4-15-collected');
    expect((await state()).player.materials.roasted_turnip ?? 0).toBeGreaterThan(0);
  });

  await step(page, 'barrel brew + collect', async () => {
    const s = await state();
    const b = s.items.find((i: any) => i.typeId === 'brewing_barrel');
    await shot(page, 'r4-16-barrel-idle');
    await tapW(b.x, b.y - 16);
    await page.getByRole('button', { name: /^Brew/ }).first().waitFor({ timeout: 15000 });
    await shot(page, 'r4-17-barrel-panel');
    await page.getByRole('button', { name: /^Brew/ }).first().click(); await page.waitForTimeout(800);
    await shot(page, 'r4-18-brewing');
    await page.keyboard.press('Escape');
    notes.push(`note brews=${JSON.stringify((await state()).tavern.brews ?? 'none').slice(0, 160)}`);
  });

  await step(page, 'open/closed sign', async () => {
    await page.locator('.open-sign').first().click();
    await page.waitForTimeout(600);
    await shot(page, 'r4-19-closed');
    const t = (await state()).tavern;
    notes.push(`note after click: open=${t.open} closed=${t.closed}`);
    await page.locator('.open-sign').first().click();
    await page.waitForTimeout(400);
  });

  await step(page, 'tavern pour + serve', async () => {
    const s0 = await state();
    const g = await poll(page, async () => (await state()).tavern.guests.find((x: any) => x.order), 150000, 1000);
    await shot(page, 'r4-20-guest-ordered');
    await tapW(g.x, g.y - 28); await page.waitForTimeout(3500);
    const uid = s0.items.find((i: any) => i.typeId === 'tap_stand').uid;
    await camOn(Z);
    const p = await page.evaluate((u) => { const q = (window as any).__ph.standPoint(u); return q ? [q.x, q.y] : null; }, uid);
    await shot(page, 'r4-21-pourwait');
    if (!p) throw new Error('no stand point');
    await page.mouse.move(p[0], p[1]); await page.mouse.down(); await page.waitForTimeout(1250);
    await shot(page, 'r4-22-pouring');
    await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(700);
    await shot(page, 'r4-23-poured');
    const s = await state();
    notes.push(`note tray=${JSON.stringify(s.tavern.tray)}`);
    expect(s.tavern.tray.length).toBeGreaterThan(0);
    const g2 = s.tavern.guests.find((x: any) => x.order) ?? s.tavern.guests[0];
    await tapW(g2.x, g2.y - 28);
    await poll(page, async () => (await state()).tavern.tray.length === 0, 15000);
    await shot(page, 'r4-24-delivered');
    await page.waitForTimeout(8000);
    await shot(page, 'r4-25-eating-plates');
  });
  notes.push('note errors so far: ' + errs.list.length);
  console.log('\n' + notes.join('\n') + '\nERRS:\n' + errs.list.slice(0, 20).join('\n'));
});
