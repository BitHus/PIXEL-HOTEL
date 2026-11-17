// Stack by tap (TESTER RUN 3 finding 1): with a block selected, tap 1 places, tap 2 on the SAME cell stacks on top (never removes).
import { test, expect } from '@playwright/test';
import { newGame, watchErrors } from './helpers';

test('tap twice on one cell stacks the block', async ({ page }) => {
  test.setTimeout(120000);
  const errs = watchErrors(page);
  await newGame(page);
  const k = await page.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i)!; try { const v = JSON.parse(localStorage.getItem(key)!); if (v.state) return { key, v }; } catch { /* skip */ } } return null; });
  k!.v.state.player.materials.dirt = 6;
  await page.evaluate(({ key, v }) => localStorage.setItem(key, JSON.stringify(v)), k!);
  await page.goto('/?e2e');
  await page.getByText('Continue').first().click();
  await page.waitForTimeout(3500);
  await page.mouse.click(5, 300); // skip the intro
  await page.waitForTimeout(800);
  await page.keyboard.press('1');
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => { const s = (window as any).__ph.st; return { sel: s.selectedBlock, shown: s.shown, w: s.room.w, h: s.room.h, av: { x: s.avatar.x, y: s.avatar.y } }; });
  expect(info.sel).toBe('dirt');
  // find a free floor cell 3 cells from the avatar, in view
  const cell = await page.evaluate(() => {
    const h = (window as any).__ph; const s = h.st;
    const cx = Math.floor(s.avatar.x / 32), cy = Math.floor(s.avatar.y / 32);
    for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [-2, -2], [2, -2], [-3, 1], [3, 1]]) {
      const c = cx + dx, r = cy + dy;
      const p = h.worldToScreen({ x: c * 32 + 16, y: r * 32 + 16 }, s.shown);
      if (p.x > 20 && p.x < innerWidth - 20 && p.y > 20 && p.y < innerHeight - 100) return { c, r, p };
    }
    return null;
  });
  const stackOf = (c: number, r: number) => page.evaluate(([c, r]) => { const b = (window as any).__ph.st.room.blocks; const v = b && b[`${c},${r}`]; return v ? (Array.isArray(v) ? v.length : 1) : 0; }, [cell!.c, cell!.r]);
  for (const want of [1, 2, 3]) {
    await page.mouse.click(cell!.p.x, cell!.p.y);
    await page.waitForTimeout(1800);
    expect(await stackOf(cell!.c, cell!.r), `after tap ${want}`).toBe(want);
  }
  console.log(errs.list.join('\n'));
});
