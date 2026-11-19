// Owner bug 19 Nov: "I can't walk in the cellar." Enter the cellar by its door and tap-walk.
import { test, expect } from '@playwright/test';
import { newGame } from './helpers';

test('walk in the cellar', async ({ page }) => {
  test.setTimeout(150000);
  await page.goto('/?e2e');
  await newGame(page);
  await page.goto('/?e2e');
  await page.getByText(/Continue/i).first().click().catch(() => undefined);
  await page.waitForTimeout(3000);
  await page.mouse.click(5, 300);
  await page.waitForTimeout(1000);
  await page.evaluate(async () => {
    const h = (window as any).__ph;
    const a = h.api;
    a.commit({ ...a.state, player: { ...a.state.player, level: 2, wallet: { ...a.state.player.wallet, gold: 5000 } } });
    await a.buildCellar();
    await h.late.useDoor('tavern_to_cellar');
  });
  await page.waitForTimeout(2500);
  const info = () => page.evaluate(() => { const h = (window as any).__ph; return { room: h.st.room.kind, av: { x: h.st.avatar.x, y: h.st.avatar.y, s: h.st.avatar.state }, path: h.st.path.length, cam: { ...h.st.camera }, shown: { ...h.st.shown } }; });
  const a0 = await info();
  console.log('A0', JSON.stringify(a0));
  expect(a0.room).toBe('cellar');
  const vp = page.viewportSize() ?? { width: 1280, height: 720 };
  await page.screenshot({ path: 'test-results/cellar0.png' });
  await page.mouse.click(vp.width / 2 + 40, vp.height / 2 + 60);
  await page.waitForTimeout(1500);
  const a1 = await info();
  console.log('A1', JSON.stringify(a1));
  await page.screenshot({ path: 'test-results/cellar1.png' });
  expect(Math.hypot(a1.av.x - a0.av.x, a1.av.y - a0.av.y)).toBeGreaterThan(10);
});

test('walk in the cellar: many taps, panels', async ({ page }) => {
  test.setTimeout(150000);
  await page.goto('/?e2e');
  await newGame(page);
  await page.goto('/?e2e');
  await page.getByText(/Continue/i).first().click().catch(() => undefined);
  await page.waitForTimeout(3000);
  await page.mouse.click(5, 300);
  await page.waitForTimeout(1000);
  await page.evaluate(async () => {
    const h = (window as any).__ph;
    const a = h.api;
    a.commit({ ...a.state, player: { ...a.state.player, level: 2, wallet: { ...a.state.player.wallet, gold: 5000 } } });
    await a.buildCellar();
    await h.late.useDoor('tavern_to_cellar');
  });
  await page.waitForTimeout(2500);
  const pos = () => page.evaluate(() => { const h = (window as any).__ph; return { x: Math.round(h.st.avatar.x), y: Math.round(h.st.avatar.y), s: h.st.avatar.state, p: h.st.path.length, open: h.st.room.kind, po: document.querySelector('.ui-panel.open, .panel.open') ? 1 : 0 }; });
  const log: string[] = [];
  for (const [dx, dy] of [[-150, 150], [200, 120], [-100, -40], [250, 200], [0, 220]]) {
    await page.mouse.click(500 + dx, 350 + dy);
    await page.waitForTimeout(1800);
    log.push(JSON.stringify(await pos()));
  }
  console.log('LOG\n' + log.join('\n'));
  await page.screenshot({ path: 'test-results/cellar2.png' });
});
