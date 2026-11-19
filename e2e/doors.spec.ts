// Owner bug 19 Nov: 'ALL DOORS DO NOTHING'. Probe: new game, find the tavern doors, click on them like a player.
import { test, expect, type Page } from '@playwright/test';
import { newGame } from './helpers';

async function doors(page: Page): Promise<{ id: string; x: number; y: number }[]> {
  return page.evaluate(async () => {
    const m = await import('/src/game/doorGoal.ts');
    const h = (window as any).__ph;
    const out: Record<string, { id: string; x: number; y: number }> = {};
    for (let r = 0; r < 40; r++) for (let c = 0; c < 40; c++) {
      const id = m.doorGoalAt(h.st.room, { x: c * 32 + 16, y: r * 32 + 16 });
      if (id && !out[id]) out[id] = { id, x: c * 32 + 32, y: r * 32 + 16 };
    }
    return Object.values(out);
  });
}

const info = (page: Page) => page.evaluate(() => { const h = (window as any).__ph; return { kind: h.st.room.kind, x: Math.round(h.st.avatar.x), y: Math.round(h.st.avatar.y), s: h.st.avatar.state, path: h.st.path.length, pd: h.st.pendingDoor, mk: [Math.round(h.st.marked?.x), Math.round(h.st.marked?.y)], goal: h.st.goal && [Math.round(h.st.goal.x), Math.round(h.st.goal.y)], z: h.st.shown.zoom, panel: document.querySelector(".ui-panel.open") ? 1 : 0, toast: document.querySelector('.toast')?.textContent ?? '' }; });

async function goThrough(page: Page, id: string, hold: boolean, dy = 0): Promise<string> {
  const from = (await info(page)).kind;
  for (let i = 0; i < 10; i++) {
    const d = (await doors(page)).find((x) => x.id === id);
    if (!d) return 'nodoor';
    d.y += dy;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    const s = await page.evaluate((p) => { const h = (window as any).__ph; return h.worldToScreen(p, h.st.shown); }, d);
    const vp = page.viewportSize()!;
    const box = { x0: 70, x1: vp.width - 90, y0: 50, y1: vp.height - 170 };
    const inside = s.x >= box.x0 && s.x <= box.x1 && s.y >= box.y0 && s.y <= box.y1;
    const cx = vp.width / 2, cy = vp.height / 2;
    const x = inside ? s.x : Math.max(box.x0, Math.min(box.x1, cx + (s.x - cx) * 0.6));
    const y = inside ? s.y : Math.max(box.y0, Math.min(box.y1, cy + (s.y - cy) * 0.6));
    if (inside && hold) { await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up(); }
    else if (vp.width < 600) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
    await page.waitForTimeout(100);
    console.log(id, inside ? 'DOOR' : 'toward', i, Math.round(x), Math.round(y), JSON.stringify(await info(page)));
    await page.waitForTimeout(2600);
    const now = await info(page);
    if (now.kind !== from) return now.kind;
    if (inside) console.log('  stayed', JSON.stringify(now));
  }
  await page.screenshot({ path: 'test-results-doors/stuck-' + id + '.png' });
  return from;
}

test('walk through every door', async ({ page }) => {
  test.setTimeout(240000);
  await page.goto('/?e2e');
  await newGame(page);
  await page.goto('/?e2e');
  await page.getByText(/Continue/i).first().click().catch(() => undefined);
  await page.waitForTimeout(3000);
  await page.mouse.click(5, 300);
  await page.waitForTimeout(1000);
  const hold = (page.viewportSize()?.width ?? 0) >= 600;
  if (process.env.ART) { expect(await goThrough(page, 'tavern_to_suite', false, -40)).toBe('hotel'); return; }
  expect(await goThrough(page, 'tavern_to_suite', false)).toBe('hotel');
  expect(await goThrough(page, 'suite_to_tavern', hold)).toBe('shop');
  expect(await goThrough(page, 'tavern_to_garden', false)).toBe('farm');
  expect(await goThrough(page, 'garden_to_tavern', false)).toBe('shop');
});
