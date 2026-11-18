// TESTER RUN 7: kitchen annex, fixed tavern shape, square table, cellar door, farm art. Shots + notes in r6kc-shots/ (tag r7).
// Run: npx playwright test -c e2e/run7.config.ts   (needs `npm run build` and a preview on port 4210)
import { test, expect } from '@playwright/test';
import { kit, doorSpot } from './run6kit';
import { watchErrors } from './helpers';

const zoomOut = async (page: any) => { await page.mouse.move(400, 350); await page.mouse.wheel(0, 800); await page.waitForTimeout(1500); };
const toastText = (page: any): Promise<string> => page.evaluate(() => [...document.querySelectorAll('[class*=toast], [class*=hint]')].map((e) => (e as HTMLElement).innerText).join(' | '));

test('r7 A new game: only the hotel shape is picked, tavern is fixed with annex and square table', async ({ page }) => {
  test.setTimeout(120000);
  const errs = watchErrors(page); const k = kit(page, 'A');
  await page.goto('/?e2e'); await page.waitForTimeout(1200);
  await page.getByText('New game').first().click();
  await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click(); await k.sh('01-hotelshape');
  expect(await page.getByRole('button', { name: 'Next' }).count(), 'no second shape step').toBe(0);
  await page.getByRole('button', { name: 'Open my tavern' }).click();
  await page.waitForTimeout(800); await page.mouse.click(5, 300); await page.waitForTimeout(500); await page.mouse.click(5, 300); await page.waitForTimeout(3500);
  const s = await k.state(); const room = s.rooms.find((r: any) => r.id === s.player.shopRoomId);
  k.note(`room ${room.shape} ${room.w}x${room.h}`);
  expect(room.shape).toBe('square_shop');
  const items = s.items.filter((i: any) => i.roomId === room.id);
  expect(items.some((i: any) => i.typeId === 'round_table'), 'round table retired').toBe(false);
  expect(items.find((i: any) => i.typeId === 'table'), 'square table').toBeTruthy();
  expect(items.filter((i: any) => i.typeId === 'bar_stool').length).toBe(3);
  for (const t of ['stove', 'brewing_barrel']) { const it = items.find((i: any) => i.typeId === t); expect(it.y, `${t} stands in the annex (below the main floor)`).toBeGreaterThanOrEqual(352); }
  await zoomOut(page); await k.sh('02-tavern-overview');
  expect(errs.list).toEqual([]);
});

test('r7 B walk through the kitchen doorway, no loading, cook at the stove', async ({ page }) => {
  test.setTimeout(120000);
  const errs = watchErrors(page); const k = kit(page, 'B');
  await k.newGame(); await zoomOut(page);
  const w0 = await k.where(); const id = w0.id;
  const walk = async (x: number, y: number) => { await k.clickWorld(x, y); for (let j = 0; j < 20; j++) { await page.waitForTimeout(300); const a = (await k.where()).av; if (Math.hypot(a.x - x, a.y - y) < 6) break; } return (await k.where()).av; };
  await walk(64, 290); await k.sh('01-before-door');
  const a1 = await walk(64, 340); await k.sh('02-in-doorway'); expect(a1.y).toBeGreaterThan(330);
  const a2 = await walk(64, 410); await k.sh('03-inside'); expect(Math.hypot(a2.x - 64, a2.y - 410), 'reached the annex inside').toBeLessThan(8);
  expect((await k.where()).id, 'same room, no switch').toBe(id);
  await k.clickWorld(140, 372); await page.waitForTimeout(2500); await k.sh('04-stove-panel');
  expect(await page.locator('text=Roasted turnip').first().isVisible(), 'cooking panel').toBe(true);
  await page.keyboard.press('Escape');
  const a3 = await walk(64, 290); expect(a3.y, 'back out through the doorway').toBeLessThan(300);
  expect(errs.list).toEqual([]);
});

test('r7 C guests seat at the square table', async ({ page }) => {
  test.setTimeout(240000);
  const errs = watchErrors(page); const k = kit(page, 'C');
  await k.newGame(); await zoomOut(page);
  let n = 0;
  for (let i = 0; i < 9 && n < 1; i++) { await page.waitForTimeout(15000); n = await k.ph<number>('return h.guestViews?.size ?? 0'); }
  await page.waitForTimeout(15000);
  await k.sh('01-table-guests'); k.note('guestViews ' + n);
  const px = await k.toScreen(464, 224);
  await page.screenshot({ path: `r6kc-shots/${k.tag}-C-02-table-crop.png`, clip: { x: Math.max(0, px.x - 120), y: Math.max(0, px.y - 120), width: 240, height: 200 } });
  expect(errs.list).toEqual([]);
});

test('r7 D cellar door: level 1 explains, level 2 offers to build for 300 gold', async ({ page }) => {
  test.setTimeout(240000);
  const errs = watchErrors(page); const k = kit(page, 'D');
  await k.newGame(); await zoomOut(page);
  const w0 = await k.where(); const cd = doorSpot(w0, 'tavern_to_cellar')!;
  const p = await k.toScreen(cd.x, cd.y + 20); await page.mouse.click(p.x, p.y);
  let t = ''; for (let j = 0; j < 40 && !/no cellar/i.test(t); j++) { await page.waitForTimeout(250); t = await toastText(page); }
  await k.sh('01-door-l1'); k.note('toast l1: ' + t);
  expect(t, 'level 1 toast mentions the cellar and the level').toMatch(/no cellar yet.*level 2/i);
  expect((await k.where()).kind).toBe('shop');
  await k.patchAndContinue((s: any) => { s.player.level = 2; s.player.xp = Math.max(s.player.xp, 200); s.player.wallet.gold = 800; });
  await zoomOut(page);
  const w1 = await k.where(); const cd2 = doorSpot(w1, 'tavern_to_cellar')!;
  const p2 = await k.toScreen(cd2.x, cd2.y + 20); await page.mouse.click(p2.x, p2.y);
  await page.waitForTimeout(4500); await k.sh('02-dialog-l2');
  const body = await page.locator('body').innerText();
  expect(body, 'confirm dialog names the cellar').toMatch(/cellar/i); expect(body).toMatch(/300/);
  await page.getByRole('button', { name: /^Build/ }).first().click(); await page.waitForTimeout(1500); await k.sh('03-built');
  const s = await k.state(); expect(s.player.cellarRoomId, 'cellar built').toBeDefined(); expect(s.player.wallet.gold).toBe(500);
  await k.clickWorld(cd2.x, cd2.y + 20); for (let j = 0; j < 40 && (await k.where()).kind !== 'cellar'; j++) await page.waitForTimeout(300);
  await page.waitForTimeout(1500); await k.sh('04-cellar'); expect((await k.where()).kind).toBe('cellar');
  expect(errs.list).toEqual([]);
});

test('r7 E farm art in the catalog Home tab', async ({ page }) => {
  test.setTimeout(120000);
  const errs = watchErrors(page); const k = kit(page, 'E');
  await k.newGame();
  const b = page.locator('button[title^="Catalog"]').first();
  if (!(await b.isVisible())) await page.locator('button.more-btn').dispatchEvent('click');
  await b.dispatchEvent('click'); await page.waitForTimeout(800); await k.sh('01-catalog');
  const home = page.getByRole('button', { name: /^Home/ }).first(); if (await home.count()) await home.click(); await page.waitForTimeout(500);
  await k.sh('02-home-tab');
  const txt = await page.locator('body').innerText(); k.note('has Scarecrow ' + /scarecrow/i.test(txt) + ' hay ' + /straw bale/i.test(txt) + ' barrel ' + /farm barrel/i.test(txt));
  expect(txt).toMatch(/scarecrow/i);
  expect(errs.list).toEqual([]);
});
