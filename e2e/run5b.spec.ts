// TESTER RUN 5 part 2: UI-driven checks (counter_ext, stairs by mouse, farm plant + splice dialog, Book tabs).
import { test, expect } from '@playwright/test';
import { notes, openSide, saveState, shot, step, watchErrors } from './helpers';

test('run5b', async ({ page }) => {
  test.setTimeout(300000);
  const errs = watchErrors(page);
  const phone = page.viewportSize()!.width < 600;
  const vp = page.viewportSize()!;
  const state = async (): Promise<any> => (await saveState(page)).state;
  const ph = <T>(body: string): Promise<T> => page.evaluate((b) => new Function('h', `return (async()=>{ ${b} })()`)((window as any).__ph), body) as Promise<T>;
  const av = (): Promise<{ x: number; y: number; level?: number }> => ph('const a=h.st.avatar; return {x:a.x,y:a.y,level:a.level}');
  const scr = (wx: number, wy: number): Promise<[number, number]> => page.evaluate(({ wx, wy }) => { const h = (window as any).__ph; const p = h.worldToScreen({ x: wx, y: wy }, h.st.shown); return [p.x, p.y] as [number, number]; }, { wx, wy });
  const camOn = async (z = phone ? 1.5 : 2): Promise<void> => {
    const a = await av();
    await page.evaluate(({ z, a, w, h }) => (window as any).__ph.setCamera({ x: a.x - w / 2 / z, y: a.y - 20 - h / 2 / z, zoom: z }, true), { z, a, w: vp.width, h: vp.height });
    await page.waitForTimeout(400);
  };
  const tapCell = async (c: number, r: number): Promise<void> => { await camOn(); const [x, y] = await scr(c * 32 + 16, r * 32 + 16); await page.mouse.click(x, y); };

  await page.goto('/?e2e');
  await page.getByText('New game').first().click();
  await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click();
  await page.getByRole('button', { name: 'Open my tavern' }).click();
  await page.waitForTimeout(800);
  await page.mouse.click(5, 300); await page.waitForTimeout(500); await page.mouse.click(5, 300);
  await page.waitForTimeout(3000);
  const base = await saveState(page);
  const s0 = JSON.parse(JSON.stringify(base.state));
  Object.assign(s0.player.materials, { turnip_seed: 6, potato_seed: 6, dirt: 40, planks: 20, stone: 20 });
  s0.player.wallet.gold = 3000;
  s0.hotbar = ['dirt', 'planks', 'turnip_seed', 'potato_seed', 'stone', ...s0.hotbar.slice(5)];
  await page.evaluate(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key: base.key, saved: { version: base.version, savedAt: Date.now(), state: s0 } });
  await page.goto('/?e2e'); await page.waitForTimeout(3000);
  await page.getByText('Continue').first().click(); await page.waitForTimeout(4000);

  await step(page, 'counter_ext: buy, place near counter, refuse far', async () => {
    notes.push('note buy: ' + JSON.stringify(await ph<any>(`return await h.api.buyCatalog('counter_ext')`)).slice(0, 100));
    const s = await state();
    const ctr = s.items.find((i: any) => i.typeId === 'counter'); const ext = s.items.find((i: any) => i.typeId === 'counter_ext');
    notes.push(`note counter ${JSON.stringify({ x: ctr.x, y: ctr.y, f: ctr.facing })} ext ${JSON.stringify(ext && { uid: ext.uid, room: ext.roomId })}`);
    const room = await ph<any>(`return await h.api.getRoom(await h.api.currentRoomId())`);
    notes.push(`note room ${room.w}x${room.h}`);
    const far = await ph<any>(`return await h.api.placeItem(${ext.uid}, {center:{x:${ctr.x},y:${ctr.y + 200}}, facing:'down', snap:true})`);
    notes.push('note far placement: ' + JSON.stringify(far).slice(0, 60));
    let ok = '';
    for (const [dx, dy] of [[-32, 0], [32, 0], [64, 0], [-64, 0], [0, -32], [96, 0]]) for (const f of ['down', 'right', 'up', 'left']) {
      await ph<any>(`return await h.api.placeItem(${ext.uid}, {center:{x:${ctr.x + dx - 16},y:${ctr.y + dy - 16}}, facing:'${f}', snap:true})`);
      const it = (await state()).items.find((i: any) => i.uid === ext.uid);
      if (it.roomId != null) { ok = `dx ${dx} dy ${dy} ${f} at ${it.x},${it.y}`; break; }
    }
    notes.push('note ext placed: ' + (ok || 'NEVER (counter xy was ' + ctr.x + ',' + ctr.y + ')'));
    await camOn(phone ? 1.2 : 1.64); await page.waitForTimeout(500); await shot(page, 'r5b-01-ext');
    // catalog search by UI
    await openSide(page, 'Catalog'); await page.waitForTimeout(500);
    const tabs = await page.locator('.catalog-panel [role=tab], .catalog-tabs button, .tab-btn').evaluateAll((l) => l.map((e) => (e as HTMLElement).title || (e as HTMLElement).getAttribute('aria-label') || e.textContent));
    notes.push('note catalog tabs ' + JSON.stringify(tabs));
    await page.keyboard.press('Escape');
  });

  await step(page, 'stairs by mouse (ST3)', async () => {
    const a = await av(); const c = Math.floor(a.x / 32), r = Math.floor(a.y / 32) - 3;
    for (let i = 0; i < 3; i++) for (let k = 0; k <= i; k++) await ph(`return await h.api.placeBlock(${c + i + 2}, ${r}, 'dirt')`);
    const b = await state(); const room = b.rooms?.find?.((x: any) => x.id === b.currentRoomId) ?? null;
    await camOn(); await shot(page, 'r5b-02-stairs');
    notes.push('note blocks row: ' + JSON.stringify(await ph<any>(`const rm = await h.api.getRoom(await h.api.currentRoomId()); return [${c + 2},${c + 3},${c + 4}].map(cc => (rm.blocks[cc + ',${r}'] || rm.blocks[${r} + ',' + cc] || []).length + ':' + JSON.stringify(Object.keys(rm.blocks).slice(0,2)))`)));
    for (const [cc, lbl] of [[c + 2, '1'], [c + 3, '2'], [c + 4, '3']] as [number, string][]) {
      await page.evaluate(() => undefined); await tapCell(cc, r); await page.waitForTimeout(3500);
      const q = await av(); notes.push(`note after tap step ${lbl}: avatar ${Math.round(q.x)},${Math.round(q.y)} level ${q.level}`);
    }
    await camOn(); await shot(page, 'r5b-03-on-top');
  });

  await step(page, 'farm: plant by tap, splice dialog by tap', async () => {
    await openSide(page, 'Worlds'); await page.waitForTimeout(500);
    await page.locator('.travel-card', { hasText: /farm/i }).first().click(); await page.waitForTimeout(4000);
    await page.keyboard.press('3'); await page.waitForTimeout(300);
    await tapCell(2, 2); await page.waitForTimeout(4000);
    await shot(page, 'r5b-10-planted');
    const f = await ph<any>(`return JSON.stringify(await h.api.getFarm()).slice(0,200)`);
    notes.push('note farm after plant tap: ' + f);
    await page.keyboard.press('4'); await page.waitForTimeout(300);
    await tapCell(2, 2); await page.waitForTimeout(2500);
    await shot(page, 'r5b-11-splice-tap');
    notes.push('note dialogs: ' + (await page.locator('.modal, .confirm, [class*=dialog], [class*=splice], [class*=confirm]').allTextContents()).join(' | ').slice(0, 300));
    const btns = await page.getByRole('button').allTextContents();
    notes.push('note buttons: ' + btns.filter((t) => t.trim()).slice(0, 14).join(' | '));
  });

  await step(page, 'Book tabs', async () => {
    await openSide(page, 'Book'); await page.waitForTimeout(700);
    const tabs = page.locator('.tab-btn');
    const n = await tabs.count(); const names: string[] = [];
    for (let i = 0; i < n; i++) names.push((await tabs.nth(i).getAttribute('aria-label')) ?? '');
    notes.push('note book tabs ' + names.join(','));
    const sp = page.locator('.tab-btn[aria-label*="plice" i]').first();
    await sp.dispatchEvent('click'); await page.waitForTimeout(500);
    await shot(page, 'r5b-20-book-splice');
    notes.push('note splice cards ' + await page.locator('.book-card').count());
    await page.keyboard.press('Escape');
  });
  console.log('\n' + notes.join('\n') + '\nERRS:\n' + errs.list.slice(0, 20).join('\n'));
  expect(errs.list.filter((e) => /pageerror/.test(e))).toEqual([]);
});
