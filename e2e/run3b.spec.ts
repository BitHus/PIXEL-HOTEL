// TESTER RUN 3b: stack taps, farm splice dialog, Book splice tab, stove panel (seeded save).
import { test } from '@playwright/test';
import { debugOn, newGame, notes, openSide, saveState, shot, step, watchErrors } from './helpers';

test('run3b', async ({ page }) => {
  test.setTimeout(300000);
  const errs = watchErrors(page);
  const vp = page.viewportSize()!;
  const phone = vp.width < 600;
  const state = async (): Promise<any> => (await saveState(page)).state;
  const scr = (wx: number, wy: number): Promise<[number, number]> => page.evaluate(({ wx, wy }) => { const h = (window as any).__ph; const p = h.worldToScreen({ x: wx, y: wy }, h.st.shown); return [p.x, p.y] as [number, number]; }, { wx, wy });
  const blocks = (): Promise<string> => page.evaluate(() => JSON.stringify(Object.entries((window as any).__ph.st.room.blocks ?? {}).slice(0, 6)));
  const toastText = (): Promise<string> => page.evaluate(() => (document.querySelector('.toast') as HTMLElement | null)?.innerText ?? '');
  await page.goto('/?e2e');
  await newGame(page);
  const base = await saveState(page);
  const st0 = JSON.parse(JSON.stringify(base.state));
  st0.rooms.find((q: any) => q.kind === "hotel").x = 0; Object.assign(st0.player.materials, { turnip: 6, potato: 4, turnip_seed: 4, potato_seed: 4, dirt: 20, planks: 10 });
  st0.hotbar = ['dirt', 'planks', 'turnip_seed', 'potato_seed', ...st0.hotbar.slice(4)];
  st0.player.wallet.gold = 900;
  await page.evaluate(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key: base.key, saved: { version: base.version, savedAt: Date.now(), state: st0 } });
  await page.goto('/?e2e');
  await page.getByText('Continue').first().click();
  await page.waitForTimeout(3500);
  await debugOn(page);
  const goto = async (label: RegExp): Promise<void> => {
    await openSide(page, 'Worlds'); await page.waitForTimeout(400);
    await page.locator('.travel-card', { hasText: label }).first().click();
    await page.waitForTimeout(3500);
  };

  await step(page, 'stove panel', async () => {
    const s = await state();
    const stv = s.items.find((i: any) => i.typeId === 'stove');
    await page.evaluate(() => (window as any).__ph.setCamera({ x: 0, y: 0, zoom: 1.2 }, true));
    await page.waitForTimeout(400);
    const [x, y] = await scr(stv.x, stv.y - 20);
    await page.mouse.click(x, y);
    await page.waitForTimeout(6000);
    await shot(page, 'r3b-00-stove');
    notes.push(`note stove toast="${await toastText()}" buttons=${await page.locator('button').allInnerTexts().then((a) => a.filter((t) => /cook|brew|craft/i.test(t)).join('/'))}`);
  });

  await step(page, 'hotel stack by tap', async () => {
    await page.keyboard.press('Escape');
    await goto(/Hotel room/);
    await page.evaluate(() => (window as any).__ph.setCamera({ x: 0, y: 0, zoom: 1.4 }, true));
    await page.waitForTimeout(500);
    // walk away first so the avatar does not stand next to the target
    let [wx, wy] = await scr(10 * 32 + 16, 8 * 32 + 16); await page.mouse.click(wx, wy); await page.waitForTimeout(3000);
    await page.locator('.hotbar-slot').first().click(); await page.waitForTimeout(300);
    const [x, y] = await scr(5 * 32 + 16, 5 * 32 + 16);
    for (let i = 1; i <= 4; i++) {
      await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
      await page.waitForTimeout(1500);
      notes.push(`note tap ${i}: blocks=${await blocks()} toast="${await toastText()}"`);
      if (i === 2) await shot(page, 'r3b-10-stack2');
      if (i === 3) await shot(page, 'r3b-11-stack3');
    }
    notes.push('note selectedBlock=' + (await page.evaluate(() => (window as any).__ph.st.selectedBlock)));
    notes.push('note api place on top: ' + (await page.evaluate(async () => JSON.stringify(await (window as any).__ph.api.placeBlock(5, 5, 'dirt')))));
    notes.push('note blocks after api: ' + (await blocks()));
    for (let q = 0; q < 3; q++) notes.push('note api place ' + q + ': ' + (await page.evaluate(async () => { const r = await (window as any).__ph.api.placeBlock(5, 5, 'dirt'); return r.kind + ' ' + (r.reason ?? r.problem ?? ''); })));
    await page.waitForTimeout(500);
    notes.push('note blocks after api x3: ' + (await blocks()));
    await shot(page, 'r3b-14-api-stack');
    await page.mouse.click(x, y); await page.waitForTimeout(1500);
    notes.push('note blocks after tap on stack: ' + (await blocks()) + ' toast=' + (await toastText()));
    await shot(page, 'r3b-12-stack4-refused');
    await page.locator('.hotbar-slot').nth(1).click(); await page.waitForTimeout(300);
    const [x2, y2] = await scr(8 * 32 + 16, 5 * 32 + 16);
    for (const slot of [1, 0, 1]) {
      await page.locator('.hotbar-slot').nth(slot).click(); await page.waitForTimeout(200);
      await page.mouse.click(x2, y2); await page.waitForTimeout(1500);
    }
    await page.mouse.move(5, 5);
    await shot(page, 'r3b-13-mixed-stack');
    notes.push(`note mixed blocks=${await blocks()}`);
    await page.locator('.hotbar-slot').first().click();
  });

  await step(page, 'farm plant + splice', async () => {
    await goto(/Farm/);
    await page.keyboard.press('Escape');
    const soil = await page.evaluate(() => { const r = (window as any).__ph.st.room; const fc = r.floorCells ?? {}; const out: string[] = []; for (const [k, v] of Object.entries(fc)) if (v === 'soil') out.push(k); return { n: out.length, first: out.slice(0, 4), shape: Object.keys(r).join(',') }; });
    notes.push(`note soil ${JSON.stringify(soil)}`);
    await shot(page, 'r3b-20-farm');
    const k = (soil.first[0] ?? '2,2').split(',').map(Number);
    const [c, r] = [k[0], k[1]];
    const t = async (): Promise<void> => { const [x, y] = await scr(c * 32 + 16, r * 32 + 16); await page.mouse.click(x, y); await page.waitForTimeout(7000); };
    await page.locator('.hotbar-slot').nth(2).click(); await page.waitForTimeout(300);
    await t();
    notes.push('note plants after tap: ' + (await page.evaluate(() => JSON.stringify((window as any).__ph.st.room.plants))) + ' sel=' + (await page.evaluate(() => (window as any).__ph.st.selectedBlock)) + ' toast=' + (await toastText()));
    await shot(page, 'r3b-21-planted');
    await page.locator('.hotbar-slot').nth(3).click(); await page.waitForTimeout(300);
    await t();
    await shot(page, 'r3b-22-splice-dialog');
    notes.push(`note splice rows=${await page.locator('.splice-row').count()} dialog=${(await page.locator('.confirm, .confirm-card, .panel').allInnerTexts()).join(' || ').slice(0, 300).replace(/\n/g, ' ')}`);
    await page.getByRole('button', { name: /^Splice$/ }).click().catch(() => notes.push('note no Splice button'));
    await page.waitForTimeout(1500);
    await shot(page, 'r3b-23-spliced');
    const s = await state();
    notes.push(`note dialogs=${await page.locator('.confirm-overlay, .confirm, .modal').count()} plants=${JSON.stringify(s.rooms.find((q: any) => q.kind === 'farm').plants).slice(0, 250)} seeds=${s.player.materials.turnip_seed}/${s.player.materials.potato_seed}`);
  });

  await step(page, 'book splice tab', async () => {
    await page.keyboard.press('Escape');
    await openSide(page, 'Book');
    await page.waitForTimeout(700);
    await shot(page, 'r3b-30-book');
    const tabs = await page.locator('button').allInnerTexts();
    notes.push(`note buttons: ${tabs.filter((t) => t.trim()).slice(0, 30).join(' | ')}`);
    const tab = page.locator('[title*="plice" i], [aria-label*="plice" i], .book-tab:last-child, .tab-btn:last-child').first();
    await tab.dispatchEvent('click');
    await page.waitForTimeout(700);
    await shot(page, 'r3b-31-book-splice');
  });
  notes.push('note errors: ' + errs.list.length);
  console.log('\n' + notes.join('\n') + '\nERRS:\n' + errs.list.slice(0, 20).join('\n'));
});
