// TESTER RUN 5: tutorial start/continue, phone layout, counter_ext buy/place, wall items, ST3 stairs, farm splice, Book Splice tab, camera follow.
import { test, expect } from '@playwright/test';
import { notes, openSide, saveState, shot, step, watchErrors } from './helpers';

test('run5', async ({ page }) => {
  test.setTimeout(420000);
  const errs = watchErrors(page);
  const phone = page.viewportSize()!.width < 600;
  const vp = page.viewportSize()!;
  const state = async (): Promise<any> => (await saveState(page)).state;
  // run an async body with h = window.__ph
  const ph = <T>(body: string): Promise<T> => page.evaluate((b) => new Function('h', `return (async()=>{ ${b} })()`)((window as any).__ph), body) as Promise<T>;
  const av = (): Promise<{ x: number; y: number; level?: number }> => ph('const a=h.st.avatar; return {x:a.x,y:a.y,level:a.level}');
  const scr = (wx: number, wy: number): Promise<[number, number]> => page.evaluate(({ wx, wy }) => { const h = (window as any).__ph; const p = h.worldToScreen({ x: wx, y: wy }, h.st.shown); return [p.x, p.y] as [number, number]; }, { wx, wy });
  const camOn = async (z = phone ? 1.2 : 1.64): Promise<void> => {
    const a = await av();
    await page.evaluate(({ z, a, w, h }) => (window as any).__ph.setCamera({ x: a.x - w / 2 / z, y: a.y - 20 - h / 2 / z, zoom: z }, true), { z, a, w: vp.width, h: vp.height });
    await page.waitForTimeout(400);
  };
  const overflow = (): Promise<string[]> => page.evaluate(() => {
    const out: string[] = []; const W = innerWidth, H = innerHeight;
    document.querySelectorAll('button, [class*=panel], [class*=card], [class*=chip], [class*=sign]').forEach((e) => {
      const r = (e as HTMLElement).getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const nm = `${(e as HTMLElement).className || e.tagName}|${(e as HTMLElement).title || (e.textContent ?? '').slice(0, 15)}`;
      if (r.right > W + 1 || r.left < -1 || r.bottom > H + 1) out.push(`OFF ${nm} ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
      else if (e.tagName === 'BUTTON' && (r.width < 40 || r.height < 40)) out.push(`SMALL ${nm} ${Math.round(r.width)}x${Math.round(r.height)}`);
    });
    return out.slice(0, 15);
  });
  const guideText = async (): Promise<string> => (await page.locator('[class*=first-ten]').allTextContents()).join(' | ').slice(0, 200);

  // ---- tutorial: new game starts it
  await page.goto('/?e2e');
  await page.getByText('New game').first().click();
  await page.getByLabel('Display name').fill('Tester');
  await shot(page, 'r5-00-charmaker');
  await page.getByText('Begin your story').click();
  await page.getByRole('button', { name: 'Open my tavern' }).click();
  await page.waitForTimeout(800);
  await page.mouse.click(5, 300); await page.waitForTimeout(500); await page.mouse.click(5, 300);
  await page.waitForTimeout(3000);
  await shot(page, 'r5-01-tutorial-start');
  await step(page, 'tutorial start', async () => {
    notes.push(`note guide text: ${await guideText()}; pointers ${await page.locator('.guide-pointer').count()}`);
    notes.push('note layout issues after intro: ' + JSON.stringify(await overflow()));
  });
  await step(page, 'tutorial progress by walking', async () => {
    const a0 = await av(); await camOn();
    const [x, y] = await scr(a0.x + 96, a0.y + 32); await page.mouse.click(x, y);
    await page.waitForTimeout(2500);
    await shot(page, 'r5-02-after-walk');
    notes.push('note guide after walk: ' + (await guideText()));
  });
  const base = await saveState(page);
  await page.goto('/?e2e'); await page.waitForTimeout(3000);
  await shot(page, 'r5-03-title');
  await page.getByText('Continue').first().click();
  await page.waitForTimeout(500); await shot(page, 'r5-04-continue-fade');
  await page.waitForTimeout(3500); await shot(page, 'r5-05-continued');
  await step(page, 'tutorial continue resumes', async () => {
    notes.push('note guide after continue: ' + (await guideText()));
    notes.push('note layout issues after continue: ' + JSON.stringify(await overflow()));
  });

  // ---- seed
  const s0 = await state();
  Object.assign(s0.player.materials, { turnip: 6, potato: 4, turnip_seed: 6, potato_seed: 6, root_ale: 4, dirt: 40, planks: 20, stone: 20 });
  s0.player.wallet.gold = 3000;
  s0.hotbar = ['dirt', 'planks', 'turnip_seed', 'potato_seed', 'stone', ...s0.hotbar.slice(5)];
  await page.evaluate(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key: base.key, saved: { version: base.version, savedAt: Date.now(), state: s0 } });
  await page.goto('/?e2e'); await page.waitForTimeout(3000);
  await page.getByText('Continue').first().click(); await page.waitForTimeout(4000);
  await shot(page, 'r5-06-seeded');

  await step(page, 'sign + orders strip', async () => {
    const sign = page.locator('.open-sign').first();
    notes.push(`note sign text "${(await sign.textContent())?.trim()}" box ${JSON.stringify(await sign.boundingBox())}`);
    await sign.click(); await page.waitForTimeout(600); await shot(page, 'r5-07-closed');
    notes.push(`note closed=${(await state()).tavern.closed}`);
    await sign.click(); await page.waitForTimeout(400);
    await page.waitForTimeout(70000);
    await shot(page, 'r5-08-orders-strip');
    notes.push(`note guests ${(await state()).tavern.guests.length}; strip html ${((await page.locator('[class*=orders]').first().innerHTML().catch(() => '')) || 'none').slice(0, 120)}`);
  });

  await step(page, 'stove/barrel states', async () => {
    const s = await state();
    const stv = s.items.find((i: any) => i.typeId === 'stove'); const bar = s.items.find((i: any) => i.typeId === 'brewing_barrel');
    await camOn(); await shot(page, 'r5-10-machines-idle');
    const c = await ph<boolean>(`return await h.api.startCook(${stv.uid}, 'roasted_turnip', 2)`);
    const b = await ph<boolean>(`return await h.api.startBrew(${bar.uid}, 'root_ale')`);
    notes.push(`note startCook ${c} startBrew ${b}`);
    await page.waitForTimeout(3000); await shot(page, 'r5-11-machines-busy');
    await page.waitForTimeout(24000); await shot(page, 'r5-12-stove-ready');
  });

  await step(page, 'counter_ext buy via catalog UI', async () => {
    await openSide(page, 'Catalog'); await page.waitForTimeout(600);
    const search = page.locator('input[type=search], input[placeholder*="earch"], .catalog-panel input').first();
    if (await search.count()) await search.fill('extension');
    await page.waitForTimeout(500); await shot(page, 'r5-20-catalog-search');
    await page.getByText(/Bar extension/i).first().click({ timeout: 4000 });
    await page.waitForTimeout(500); await shot(page, 'r5-21-catalog-card');
    await page.getByRole('button', { name: /^Buy/ }).first().click({ timeout: 4000 });
    await page.waitForTimeout(500); await shot(page, 'r5-22-confirm');
    await page.getByRole('button', { name: /^(Buy|Yes|Confirm|OK)/ }).last().click({ timeout: 3000 }).catch(() => undefined);
    await page.waitForTimeout(800); await shot(page, 'r5-23-bought');
    const s = await state();
    notes.push(`note gold ${s.player.wallet.gold}; ext items ${JSON.stringify(s.items.filter((i: any) => i.typeId === 'counter_ext').map((i: any) => ({ uid: i.uid, room: i.roomId, x: i.x, y: i.y })))}`);
    await page.keyboard.press('Escape');
  });

  await step(page, 'counter_ext place valid + invalid', async () => {
    const s = await state();
    const ctr = s.items.find((i: any) => i.typeId === 'counter');
    const ext = s.items.find((i: any) => i.typeId === 'counter_ext');
    notes.push(`note counter ${JSON.stringify(ctr && { x: ctr.x, y: ctr.y, f: ctr.facing })} ext ${JSON.stringify(ext && { uid: ext.uid, room: ext.roomId, x: ext.x, y: ext.y })}`);
    if (!ext) throw new Error('no ext item owned');
    const bad = await ph<any>(`return await h.api.placeItem(${ext.uid}, {center:{x:${ctr.x - 40},y:${ctr.y + 300}}, facing:'down', snap:true})`);
    notes.push(`note place far: ${JSON.stringify(bad).slice(0, 120)}`);
    outer: for (const dx of [-64, -32, 32, 64, 96]) for (const f of ['down', 'up', 'right']) {
      const r = await ph<any>(`return await h.api.placeItem(${ext.uid}, {center:{x:${ctr.x + dx},y:${ctr.y - 16}}, facing:'${f}', snap:true})`);
      if (JSON.stringify(r).includes('"ok":true') || (await state()).items.some((i: any) => i.uid === ext.uid && i.roomId != null)) { notes.push(`note ext placed dx ${dx} facing ${f}: ${JSON.stringify(r).slice(0, 100)}`); break outer; }
    }
    await camOn(); await page.waitForTimeout(500); await shot(page, 'r5-24-ext-placed');
    const s2 = await state();
    notes.push(`note ext after: ${JSON.stringify(s2.items.filter((i: any) => i.typeId === 'counter_ext').map((i: any) => ({ x: i.x, y: i.y, f: i.facing, room: i.roomId })))}`);
  });

  await step(page, 'wall items', async () => {
    const r = await ph<any>(`return await h.api.buyCatalog('banner')`);
    notes.push(`note buy banner ${JSON.stringify(r).slice(0, 80)}`);
    const s = await state();
    const bn = s.items.filter((i: any) => i.typeId === 'banner').pop();
    if (!bn) throw new Error('no banner');
    notes.push(`note banner item ${JSON.stringify({ uid: bn.uid, x: bn.x, y: bn.y, room: bn.roomId })}`);
    for (const [x, y] of [[200, -40], [200, -20], [200, -60], [300, -30]]) {
      const p = await ph<any>(`return await h.api.placeItem(${bn.uid}, {center:{x:${x},y:${y}}, facing:'down', snap:true})`);
      notes.push(`note wall place (${x},${y}): ${JSON.stringify(p).slice(0, 90)}`);
    }
    await page.evaluate(() => (window as any).__ph.setCamera({ x: 100, y: 0, zoom: 2 }, true)); await page.waitForTimeout(500);
    await shot(page, 'r5-30-wall');
  });

  await step(page, 'ST3 stairs', async () => {
    const a = await av();
    const c = Math.floor(a.x / 32) + 3, r = Math.floor(a.y / 32);
    const res: string[] = [];
    for (let i = 0; i < 3; i++) for (let k = 0; k <= i; k++) res.push(JSON.stringify(await ph<any>(`return await h.api.placeBlock(${c + i}, ${r}, 'dirt')`)).slice(0, 40));
    notes.push('note stairs place: ' + res.join(' '));
    await camOn(); await shot(page, 'r5-31-stairs');
    const w = await ph<any>(`const p = await h.api.walk({x:${(c + 2) * 32 + 16}, y:${r * 32 + 16}}); return p && p.length`);
    notes.push(`note walk onto top step path len ${w}`);
    await page.waitForTimeout(5000);
    const a2 = await av(); notes.push(`note avatar after stairs ${JSON.stringify(a2)} target ${(c + 2) * 32 + 16},${r * 32 + 16}`);
    await shot(page, 'r5-32-on-stairs');
    const w2 = await ph<any>(`const p = await h.api.walk({x:${(c + 3) * 32 + 16}, y:${r * 32 + 16}}); return p && p.length`);
    notes.push(`note walk beyond top step ${w2}`);
  });

  await step(page, 'camera follow', async () => {
    const a0 = await av();
    await ph(`await h.api.walk({x:${a0.x + 160}, y:${a0.y + 40}}); return 1`);
    await page.waitForTimeout(3500);
    const a = await av(); const [sx, sy] = await scr(a.x, a.y - 20);
    notes.push(`note follow: avatar screen ${Math.round(sx)},${Math.round(sy)} vs centre ${vp.width / 2},${vp.height / 2}`);
    await shot(page, 'r5-33-follow');
  });

  await step(page, 'farm splice', async () => {
    await openSide(page, 'Worlds'); await page.waitForTimeout(400); await shot(page, 'r5-40-worlds');
    await page.locator('.travel-card', { hasText: /farm/i }).first().click(); await page.waitForTimeout(4000);
    await shot(page, 'r5-41-farm');
    const room = await ph<any>(`return await h.api.getRoom(await h.api.currentRoomId())`);
    const soil = Object.entries(room.floorCells ?? {}).filter(([, v]) => v === 'soil').map(([k]) => k);
    notes.push(`note soil cells ${soil.slice(0, 4)} count ${soil.length}`);
    const [c, r] = soil.length ? String(soil[0]).split(/[,:_]/).map(Number) : [2, 2];
    const p1 = await ph<any>(`return await h.api.plantSeed(${c}, ${r}, 'turnip_seed')`);
    notes.push('note plant ' + JSON.stringify(p1).slice(0, 100));
    const pv = await ph<any>(`return await h.api.previewSplice(${c}, ${r}, 'potato_seed')`);
    notes.push('note preview ' + JSON.stringify(pv).slice(0, 200));
    await page.keyboard.press('4'); await page.waitForTimeout(300);
    await camOn(2);
    const [sx, sy] = await scr(c * 32 + 16, r * 32 + 16);
    await page.mouse.click(sx, sy); await page.waitForTimeout(1500);
    await shot(page, 'r5-42-splice-dialog');
    notes.push('note dialog: ' + (await page.locator('[class*=confirm], [class*=dialog], [class*=splice]').allTextContents()).join(' | ').slice(0, 250));
    const btn = page.getByRole('button', { name: /mix|splice|yes|ok/i }).first();
    if (await btn.count()) { await btn.click().catch(() => undefined); await page.waitForTimeout(1200); await shot(page, 'r5-43-spliced'); }
  });

  await step(page, 'Book Splice tab', async () => {
    await openSide(page, 'Book'); await page.waitForTimeout(800); await shot(page, 'r5-50-book');
    await page.getByRole('button', { name: /^Splice/i }).first().click({ timeout: 4000 }); await page.waitForTimeout(600);
    await shot(page, 'r5-51-book-splice');
    notes.push('note book overflow: ' + JSON.stringify(await overflow()));
    await page.keyboard.press('Escape');
  });

  await step(page, 'settings + build menus', async () => {
    await openSide(page, 'Settings'); await page.waitForTimeout(500); await shot(page, 'r5-60-settings');
    notes.push('note settings overflow ' + JSON.stringify(await overflow()));
    await page.keyboard.press('Escape');
    await openSide(page, 'Build'); await page.waitForTimeout(500); await shot(page, 'r5-61-build');
    await page.keyboard.press('Escape');
  });
  notes.push(`note errors: ${errs.list.length}`);
  console.log('\n' + notes.join('\n') + '\nERRS:\n' + errs.list.slice(0, 20).join('\n'));
  expect(errs.list.filter((e) => /pageerror/.test(e))).toEqual([]);
});
