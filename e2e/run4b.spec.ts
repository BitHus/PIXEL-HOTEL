// TESTER RUN 4 part 2: camera follow, counter_ext purchase + placement, stairs, wall items, farm splice, Book.
import { test, expect } from '@playwright/test';
import { debugOn, notes, openSide, saveState, shot, step, watchErrors } from './helpers';

test('run4b', async ({ page }) => {
  test.setTimeout(420000);
  const errs = watchErrors(page);
  const phone = page.viewportSize()!.width < 600;
  if (!phone) await page.setViewportSize({ width: 1280, height: 720 });
  const vp = page.viewportSize()!;
  const state = async (): Promise<any> => (await saveState(page)).state;
  const scr = (wx: number, wy: number): Promise<[number, number]> => page.evaluate(({ wx, wy }) => { const h = (window as any).__ph; const p = h.worldToScreen({ x: wx, y: wy }, h.st.shown); return [p.x, p.y] as [number, number]; }, { wx, wy });
  const av = (): Promise<{ x: number; y: number; level?: number }> => page.evaluate(() => { const a = (window as any).__ph.st.avatar; return { x: a.x, y: a.y, level: a.level }; });
  const Z = phone ? 1.2 : 1.64;
  const camOn = async (zoom = Z): Promise<void> => {
    const a = await av();
    await page.evaluate(({ z, a, w, h }) => (window as any).__ph.setCamera({ x: a.x - w / 2 / z, y: a.y - 20 - h / 2 / z, zoom: z }, true), { z: zoom, a, w: vp.width, h: vp.height });
    await page.waitForTimeout(400);
  };
  const tapW = async (wx: number, wy: number): Promise<void> => { await camOn(); const [x, y] = await scr(wx, wy); await page.mouse.click(x, y); };
  const goto = async (label: RegExp): Promise<void> => {
    await openSide(page, 'Worlds'); await page.waitForTimeout(400);
    await page.locator('.travel-card', { hasText: label }).first().click();
    await page.waitForTimeout(3500);
  };

  await page.goto('/?e2e');
  await page.getByText('New game').first().click();
  await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click();
  await page.getByRole('button', { name: 'Open my tavern' }).click();
  await page.waitForTimeout(800);
  await page.mouse.click(5, 300); await page.waitForTimeout(500); await page.mouse.click(5, 300);
  await page.waitForTimeout(3000);
  const base = await saveState(page);
  const st0 = JSON.parse(JSON.stringify(base.state));
  Object.assign(st0.player.materials, { turnip: 6, potato: 4, turnip_seed: 4, potato_seed: 4, root_ale: 4, dirt: 40, planks: 20, stone: 20 });
  st0.player.wallet.gold = 2000;
  st0.hotbar = ['dirt', 'planks', 'turnip_seed', 'potato_seed', 'stone', ...st0.hotbar.slice(5)];
  await page.evaluate(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key: base.key, saved: { version: base.version, savedAt: Date.now(), state: st0 } });
  await page.goto('/?e2e');
  await page.waitForTimeout(3500);
  await shot(page, 'r4b-00-continue-screen');
  await page.getByText('Continue').first().click();
  await page.waitForTimeout(4000);

  await step(page, 'camera follow centred', async () => {
    const a0 = await av();
    const [px, py] = await scr(a0.x + 120, a0.y + 40);
    await page.mouse.click(px, py);
    await page.waitForTimeout(2500);
    const a = await av();
    const [sx, sy] = await scr(a.x, a.y - 20);
    notes.push(`note follow-on: avatar screen ${Math.round(sx)},${Math.round(sy)} centre ${vp.width / 2},${vp.height / 2}`);
    await shot(page, 'r4b-01-follow');
  });

  await step(page, 'catalog: buy counter_ext', async () => {
    await openSide(page, 'Catalog');
    await page.waitForTimeout(600);
    await shot(page, 'r4b-02-catalog');
    const search = page.locator('.catalog-panel input, input[type=search], input[placeholder*="earch"]').first();
    if (await search.count()) await search.fill('extension');
    await page.waitForTimeout(500);
    await shot(page, 'r4b-03-catalog-search');
    const card = page.locator('.catalog-panel, .panel').getByText(/Bar extension/i).first();
    await card.click({ timeout: 4000 });
    await page.waitForTimeout(500);
    await shot(page, 'r4b-04-catalog-card');
    notes.push('note buttons: ' + (await page.getByRole('button').allTextContents()).filter((t) => /buy|place|yes|confirm|\d/i.test(t)).slice(0, 8).join(' | '));
  });
  await step(page, 'buy confirm', async () => {
    const buy = page.getByRole('button', { name: /^Buy/ }).first();
    await buy.click({ timeout: 4000 });
    await page.waitForTimeout(500);
    await shot(page, 'r4b-05-confirm');
    const yes = page.getByRole('button', { name: /^(Buy|Yes|Confirm|OK)/ }).last();
    await yes.click({ timeout: 3000 }).catch(() => undefined);
    await page.waitForTimeout(800);
    await shot(page, 'r4b-06-bought');
    const s = await state();
    notes.push(`note gold ${s.player.wallet.gold}; counter_ext in inv: ${JSON.stringify(s.items.filter((i: any) => i.typeId === 'counter_ext').map((i: any) => ({ uid: i.uid, roomId: i.roomId })))}`);
  });
  console.log('\n' + notes.join('\n') + '\nERRS:\n' + errs.list.slice(0, 20).join('\n'));
});
