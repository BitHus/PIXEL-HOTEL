// MG-3: the dig mine in a real browser: enter at level 3 (no lantern), see the cave, dig a block (state + picture change), leave.
import { expect, test } from '@playwright/test';
import { newGame, saveState, watchErrors } from './helpers';

test('dig mine: enter, dig, leave', async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watchErrors(page);
  await page.goto('/?e2e');
  await newGame(page);
  // Level 3 through the save (the mine opens there), then continue.
  const saved = await saveState(page);
  saved.state.player.level = 3;
  saved.state.player.xp = 40;
  await page.evaluate(([k, v]) => localStorage.setItem(k as string, JSON.stringify(v)), [saved.key, { version: saved.version, savedAt: saved.savedAt, state: saved.state }]);
  await page.goto('/?e2e');
  await page.getByText('Continue').first().click({ timeout: 20000 }).catch(() => undefined);
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(2500);
  const ph = <T>(body: string): Promise<T> => page.evaluate((b) => new Function('h', `return (async()=>{ ${b} })()`)((window as any).__ph), body) as Promise<T>;

  await ph(`h.late.enterMineAsked(); return 1`);
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /^Enter/ }).click({ timeout: 5000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/mg3-dig-1-enter.png' });
  const run = await ph<{ dig: boolean; lantern: unknown; player: { x: number; y: number }; floor: number; max: number } | null>(
    `const r = (await h.api.getRun())?.run; return r ? { dig: !!r.dig, lantern: r.lanternEndsAt, player: { x: r.player.x, y: r.player.y }, floor: r.floor, max: r.maxFloors } : null`,
  );
  expect(run).toMatchObject({ dig: true, lantern: null, floor: 1, max: 10 });

  // Dig the dirt/stone next to the spawn pocket: find the nearest solid block with an open neighbour and tap it through the API.
  const target = await ph<{ c: number; r: number } | null>(`
    const r = (await h.api.getRun()).run; const W = r.map.cols;
    const bc = Math.floor(r.player.x / 32), br = Math.floor(r.player.y / 32);
    let best = null, bd = 1e9;
    for (let i = 0; i < r.dig.kinds.length; i++) {
      const k = r.dig.kinds[i]; if (!k || k === 'bedrock' || k === 'mithril') continue;
      const c = i % W, row = (i - c) / W;
      const open = [[1,0],[-1,0],[0,1],[0,-1]].some(([dc, dr]) => r.dig.kinds[(row + dr) * W + c + dc] === '');
      const d = Math.hypot(c - bc, row - br); if (open && d < bd) { bd = d; best = { c, r: row }; }
    }
    return best;`);
  expect(target).not.toBeNull();
  for (let k = 0; k < 30; k++) {
    await ph(`await h.api.dungeonInput({ t: 'click_dig', c: ${target!.c}, r: ${target!.r} }); return 1`);
    await page.waitForTimeout(450);
    const left = await ph<string>(`return (await h.api.getRun()).run.dig.kinds[${target!.r} * 48 + ${target!.c}]`);
    if (left === '') break;
  }
  await page.screenshot({ path: 'test-results/mg3-dig-2-dug.png' });
  expect(await ph<string>(`return (await h.api.getRun()).run.dig.kinds[${target!.r} * 48 + ${target!.c}]`)).toBe('');

  await page.getByRole('button', { name: /^Leave/ }).first().click({ timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/mg3-dig-3-leave.png' });
  expect(errs.list.filter((e) => !/favicon/.test(e))).toEqual([]);
});
