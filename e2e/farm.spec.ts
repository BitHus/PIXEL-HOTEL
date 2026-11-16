// Farm render check (TESTER RUN 2 finding 4): soil patch and planted crops are drawn.
import { test } from '@playwright/test';
import { newGame, openSide, shot, watchErrors } from './helpers';

test('farm draws soil and plants', async ({ page }) => {
  test.setTimeout(120000);
  const errs = watchErrors(page);
  await newGame(page);
  const k = await page.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i)!; try { const v = JSON.parse(localStorage.getItem(key)!); if (v.state) return { key, v }; } catch { /* skip */ } } return null; });
  const st = k!.v.state; st.player.materials.turnip_seed = 6;
  await page.evaluate(({ key, v }) => localStorage.setItem(key, JSON.stringify(v)), k!);
  await page.goto('/?e2e');
  await page.getByText('Continue').first().click();
  await page.waitForTimeout(3500);
  await openSide(page, 'Worlds');
  await page.waitForTimeout(400);
  await page.locator('.travel-card', { hasText: /Farm/ }).first().click();
  await page.waitForTimeout(3500);
  await shot(page, 'farm-a-arrive');
  await page.evaluate(() => (window as any).__ph.setCamera({ x: 0, y: 0, zoom: 1.6 }, true)); await page.waitForTimeout(600);
  await page.keyboard.press('1');
  for (const c of [2, 3, 4]) { await page.mouse.click((c * 32 + 16) * 1.6, 80 * 1.6); await page.waitForTimeout(2500); }
  await page.waitForTimeout(2500);
  await page.evaluate(() => (window as any).__ph.setCamera({ x: 0, y: 0, zoom: 1.6 }, true)); await page.waitForTimeout(800);
  await shot(page, 'farm-b-planted');
  const info = await page.evaluate(() => { const h = (window as any).__ph; const s = h.st; return JSON.stringify({ shown: s.shown, rk: s.room?.kind, floorSoil: Object.entries(s.room?.floorCells ?? {}).slice(0, 4), save: (() => { for (let i = 0; i < localStorage.length; i++) { try { const v = JSON.parse(localStorage.getItem(localStorage.key(i)!)!); if (v.state) { const f = v.state.rooms.find((r: any) => r.kind === 'farm'); return JSON.stringify(f.plants) + ' seeds ' + v.state.player.materials.turnip_seed; } } catch { /* skip */ } } return ''; })(), w: s.room?.w, h: s.room?.h, avatar: s.avatar?.pos ?? s.avatarPos }); }); console.log(info);
  console.log(errs.list.join('\n'));
});
