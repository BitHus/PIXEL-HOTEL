// TESTER RUN 8: new game, open annex compact start, first serve, cellar door l1, Lantern Dark panels, dig mine, orders rail + OPEN sign.
// Shots in r8-shots/. Run: npx playwright test -c e2e/run8.config.ts
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { kit, doorSpot } from './run6kit';
import { watchErrors } from './helpers';

fs.mkdirSync('r8-shots', { recursive: true });
const phone = (page: any) => page.viewportSize().width < 600;
const S = (page: any, n: string) => page.screenshot({ path: `r8-shots/${phone(page) ? 'phone' : 'desktop'}-${n}.png` });
const side = async (page: any, title: string) => {
  const b = page.locator(`button[title^="${title}"]`).first();
  if (!(await b.isVisible())) await page.locator('button.more-btn').dispatchEvent('click');
  await b.dispatchEvent('click'); await page.waitForTimeout(700);
};

test('r8 A new game flow and tavern first view', async ({ page }) => {
  test.setTimeout(120000);
  const errs = watchErrors(page); const k = kit(page, 'r8A');
  await page.goto('/?e2e'); await page.waitForTimeout(1500); await S(page, 'A-01-title');
  await page.getByText('New game').first().click(); await page.waitForTimeout(500); await S(page, 'A-02-charmaker');
  await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click(); await page.waitForTimeout(500); await S(page, 'A-03-hotelshape');
  await page.getByRole('button', { name: 'Open my tavern' }).click(); await page.waitForTimeout(1200); await S(page, 'A-04-intro');
  await page.waitForTimeout(6000); await S(page, 'A-05-after-intro-6s');
  await page.waitForTimeout(6000); await S(page, 'A-06-first-view');
  k.note('body after intro: ' + (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300));
  expect(errs.list).toEqual([]);
});

test('r8 B intro skip tap leaves no panel (known open)', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/?e2e'); await page.waitForTimeout(1200);
  await page.getByText('New game').first().click(); await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click(); await page.getByRole('button', { name: 'Open my tavern' }).click();
  await page.waitForTimeout(1200);
  const w = page.viewportSize()!; await page.mouse.click(w.width / 2, w.height / 2); await page.waitForTimeout(2500); await S(page, 'B-01-after-skip-center');
  const body = await page.locator('body').innerText();
  expect(body.includes('Guests order what is on the menu'), 'Bar panel opened by intro-skip tap').toBe(false);
});

test('r8 C cold serve of the first guest, UI only (timed)', async ({ page }) => {
  test.setTimeout(240000);
  const errs = watchErrors(page); const k = kit(page, 'r8C');
  await k.newGame(); await S(page, 'C-01-start');
  const t0 = Date.now(); const el = () => Math.round((Date.now() - t0) / 1000);
  const guest = async () => (await k.state()).tavern.guests.find((x: any) => x.order);
  let g: any = null;
  for (let i = 0; i < 60 && !g; i++) { await page.waitForTimeout(2000); g = await guest(); }
  k.note(`guest with an order after ${el()}s ${JSON.stringify(g)}`); await S(page, 'C-02-guest');
  expect(g, 'a guest with an order within 2 min').toBeTruthy();
  const uid = (await k.state()).items.find((i: any) => i.typeId === 'tap_stand').uid;
  const p = await k.toScreen(g.x, g.y - 28); await page.mouse.click(p.x, p.y); await page.waitForTimeout(3500); await S(page, 'C-03-tapped-guest');
  const sp = await k.ph<any>(`return h.standPoint(${uid})`); k.note('stand point ' + JSON.stringify(sp));
  expect(sp).toBeTruthy();
  await page.mouse.move(sp.x, sp.y); await page.mouse.down(); await page.waitForTimeout(1250); await S(page, 'C-04-pouring');
  await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(800); await S(page, 'C-05-poured');
  const st = await k.state(); k.note('tray ' + JSON.stringify(st.tavern.tray));
  expect(st.tavern.tray.length, 'mug on tray').toBeGreaterThan(0);
  const g2 = st.tavern.guests.find((x: any) => x.order) ?? st.tavern.guests[0];
  const p2 = await k.toScreen(g2.x, g2.y - 28); await page.mouse.click(p2.x, p2.y);
  for (let i = 0; i < 20 && (await k.state()).tavern.tray.length; i++) await page.waitForTimeout(1000);
  k.note(`delivered at ${el()}s tray left ${(await k.state()).tavern.tray.length}`); await S(page, 'C-06-delivered');
  await page.waitForTimeout(25000); await S(page, 'C-07-eating');
  k.note('gold now ' + (await k.state()).player.wallet.gold);
  expect(errs.list).toEqual([]);
});

test('r8 D cellar door l1 and Lantern Dark panels', async ({ page }) => {
  test.setTimeout(180000);
  const errs = watchErrors(page); const k = kit(page, 'r8D');
  await k.newGame();
  for (const [t, n] of [['Catalog', 'catalog'], ['Bag', 'bag'], ['Skills', 'skills'], ['More', 'more']] as const) {
    const b = page.locator(`button[title^="${t}"]`).first();
    if (await b.count()) { await side(page, t); await S(page, `D-${n}`); await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
    else k.note('no button ' + t);
  }
  const reg = await k.ph<any>(`const i=h.st.items.find(i=>i.typeId==='register'); return i?{x:i.x,y:i.y}:null`);
  if (reg) { const p = await k.toScreen(reg.x, reg.y - 10); await page.mouse.click(p.x, p.y); await page.waitForTimeout(1200); await S(page, 'D-barpanel'); }
  expect(errs.list).toEqual([]);
});

test('r8 E dig mine entry and digging', async ({ page }) => {
  test.setTimeout(180000);
  const errs = watchErrors(page); const k = kit(page, 'r8E');
  await k.newGame();
  await k.patchAndContinue((s: any) => { s.player.level = 3; s.player.xp = Math.max(s.player.xp, 400); });
  await k.ph(`h.late.enterMineAsked(); return 1`); await page.waitForTimeout(900); await S(page, 'E-01-enter-dialog');
  await page.getByRole('button', { name: /^Enter/ }).click({ timeout: 5000 }); await page.waitForTimeout(3500); await S(page, 'E-02-cave');
  const t = await k.ph<any>(`const r=(await h.api.getRun()).run; const W=r.map.cols; const bc=Math.floor(r.player.x/32), br=Math.floor(r.player.y/32); let best=null,bd=1e9; for(let i=0;i<r.dig.kinds.length;i++){const kd=r.dig.kinds[i]; if(!kd||kd==='bedrock'||kd==='mithril')continue; const c=i%W,row=(i-c)/W; const open=[[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>r.dig.kinds[(row+b)*W+c+a]===''); const d=Math.hypot(c-bc,row-br); if(open&&d<bd){bd=d;best={c,r:row}}} return best`);
  k.note('target ' + JSON.stringify(t));
  for (let j = 0; j < 14; j++) { await k.ph(`await h.api.dungeonInput({t:'click_dig',c:${t.c},r:${t.r}}); return 1`); await page.waitForTimeout(450); }
  await S(page, 'E-03-dug');
  expect(errs.list.filter((e) => !/favicon/.test(e))).toEqual([]);
});

test('r8 F orders rail and OPEN sign', async ({ page }) => {
  test.setTimeout(240000);
  const errs = watchErrors(page); const k = kit(page, 'r8F');
  await k.newGame();
  for (let i = 0; i < 14; i++) { await page.waitForTimeout(5000); if (await k.ph<number>('return h.guestViews?.size ?? 0')) break; }
  await page.waitForTimeout(25000); await S(page, 'F-01-rail');
  expect(errs.list).toEqual([]);
});

test('r8 G cellar door at level 1 explains, no room switch', async ({ page }) => {
  test.setTimeout(120000);
  const errs = watchErrors(page); const k = kit(page, 'r8G');
  await k.newGame();
  if (phone(page)) { await page.keyboard.press('Escape'); await page.waitForTimeout(500); await page.evaluate(() => (window as any).__ph.setCamera({ x: -40, y: -150, zoom: 0.7 }, true)); await page.waitForTimeout(1500); }
  else { await page.mouse.move(400, 350); await page.mouse.wheel(0, 800); await page.waitForTimeout(1500); }
  const w0 = await k.where(); const cd = doorSpot(w0, 'tavern_to_cellar')!;
  const p = await k.toScreen(cd.x, cd.y); await page.mouse.click(p.x, p.y);
  let t = ''; for (let j = 0; j < 40 && !/no cellar/i.test(t); j++) { await page.waitForTimeout(250); t = await page.evaluate(() => [...document.querySelectorAll('[class*=toast], [class*=hint]')].map((e) => (e as HTMLElement).innerText).join(' | ')); }
  await S(page, 'G-01-cellar-door-l1'); k.note('toast: ' + t);
  expect(t).toMatch(/no cellar yet/i); expect((await k.where()).kind).toBe('shop');
  expect(errs.list).toEqual([]);
});
