// RUN 5 fixes (coder): tutorial count follows the text, catalog search over all tabs, 44 px Skip and OPEN sign, farm plant by tap,
// hint chip never over a panel, Book splice hint, first frames after Continue (screens saved for a look).
import { test, expect } from '@playwright/test';
import { openSide, saveState, shot, watchErrors } from './helpers';

test('run5 fixes', async ({ page }) => {
  test.setTimeout(180000);
  const errs = watchErrors(page);
  const phone = page.viewportSize()!.width < 600;
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
  s0.player.materials.turnip_seed = 6;
  s0.player.wallet.gold = 3000;
  s0.hotbar = ['turnip_seed', ...s0.hotbar.slice(1)];
  // The tutorial with steps done OUT OF ORDER (walk and stove, not the register): the card must show step 2.
  await page.evaluate(({ key, saved }) => {
    localStorage.setItem(key, JSON.stringify(saved));
    localStorage.setItem('pixel-hotel.first-ten', JSON.stringify({ active: true, skipped: false, done: ['walk', 'stove'], tips: [] }));
  }, { key: base.key, saved: { version: base.version, savedAt: Date.now(), state: s0 } });
  await page.goto('/?e2e'); await page.waitForTimeout(2500);

  // Continue: frames for a look at the fade-in (no black frame).
  await page.getByText('Continue').first().click();
  for (let i = 0; i < 6; i++) { await shot(page, `fix-continue-${i}`); await page.waitForTimeout(120); }
  await page.waitForTimeout(2500);

  // 1. Count and text agree.
  const card = page.locator('.first-ten');
  await expect(card).toBeVisible();
  expect(await card.locator('.first-ten-count').textContent()).toBe('2/18');
  const text = (await card.locator('.first-ten-text').textContent()) ?? '';
  expect(text).toContain('register');
  if (phone) {
    expect(text).toBe('Tap the register');
    await card.click(); await page.waitForTimeout(300);
    expect(await card.locator('.first-ten-text').textContent()).toContain('serve, set prices, sell');
  }
  // 2. Touch sizes.
  const skip = await card.locator('.first-ten-skip').boundingBox();
  expect(skip!.height).toBeGreaterThanOrEqual(44);
  expect(skip!.width).toBeGreaterThanOrEqual(44);
  const sign = await page.locator('.open-sign').boundingBox();
  expect(sign!.height).toBeGreaterThanOrEqual(44);
  expect(sign!.width).toBeGreaterThanOrEqual(44);
  await shot(page, 'fix-01-card');
  if (phone) await card.click();

  // 3. Catalog search over every tab: on the Home tab "extension" finds the Bar extension (Tavern tab).
  await openSide(page, 'Catalog'); await page.waitForTimeout(500);
  await page.locator('.catalog-search-input').fill('extension'); await page.waitForTimeout(300);
  await expect(page.locator('.catalog-panel .shop-card:not([hidden])', { hasText: /extension/i }).first()).toBeVisible();
  await shot(page, 'fix-02-search');
  await page.locator('.catalog-search-input').fill(''); await page.keyboard.press('Escape');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);

  // 4. Farm: plant by a tap on a soil cell in view.
  await openSide(page, 'Worlds'); await page.waitForTimeout(500);
  await page.locator('.travel-card', { hasText: /farm/i }).first().click(); await page.waitForTimeout(3500);
  await ph('h.setCamera({ x: 0, y: 0, zoom: 1.6 }, true)'); await page.waitForTimeout(500);
  await page.keyboard.press('1'); await page.waitForTimeout(300);
  const chipOn = await page.locator('.hint-chip.on').count();
  const [cx, cy] = await page.evaluate(() => { const h = (window as any).__ph; const p = h.worldToScreen({ x: 3 * 32 + 16, y: 2 * 32 + 16 }, h.st.shown); return [p.x, p.y]; });
  await page.mouse.click(cx, cy);
  let planted = 0;
  for (let i = 0; i < 16 && planted === 0; i++) {
    await page.waitForTimeout(500);
    planted = await page.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { try { const v = JSON.parse(localStorage.getItem(localStorage.key(i)!)!); if (v.state) return Object.keys(v.state.rooms.find((r: any) => r.kind === 'farm').plants ?? {}).length; } catch { /* skip */ } } return -1; });
  }
  await shot(page, 'fix-03-planted');
  expect(planted).toBeGreaterThan(0);

  // 5. Book: splice hint, and the hint chip never shows over the open panel.
  await page.keyboard.press('1'); await page.waitForTimeout(200); await page.keyboard.press('1'); await page.waitForTimeout(200);
  await openSide(page, 'Book'); await page.waitForTimeout(600);
  await page.locator('.tab-btn[aria-label*="plice" i]').first().dispatchEvent('click'); await page.waitForTimeout(400);
  await expect(page.locator('.book-splice-hint')).toBeVisible();
  expect(await page.locator('.hint-chip.on').count()).toBe(0);
  await shot(page, 'fix-04-book');
  console.log(`chip on after seed select: ${chipOn}; planted ${planted}`);
  expect(errs.list.filter((e) => !/favicon/.test(e))).toEqual([]);
});
