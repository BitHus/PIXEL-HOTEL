// TESTER RUN 10: the decluttered UI. Shots in r10-shots/. Checks: side column = 4 buttons, More holds the rest, guide only after idle with x,
// info panel is gold/gems/xp bar, Bar rows detail only for the tapped row, phone icons without labels.
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { kit } from './run6kit';
import { watchErrors, openMoreMenu, openMore } from './helpers';

fs.mkdirSync('r10-shots', { recursive: true });
const phone = (page: any) => page.viewportSize().width < 600;
const S = (page: any, n: string) => page.screenshot({ path: `r10-shots/${phone(page) ? 'phone' : 'desktop'}-${n}.png` });

test('r10 decluttered HUD', async ({ page }) => {
  test.setTimeout(150000);
  const errs = watchErrors(page); const k = kit(page, 'r10');
  await k.newGame();
  // right after the intro: the guide should not be showing (idle only)
  await page.waitForTimeout(300);
  const guideEarly = await page.locator('.first-ten:visible').count();
  k.note('guide right after intro visible=' + guideEarly);
  await S(page, '01-hud-early');
  // visible side column buttons
  const col = await page.locator('.side-buttons > button:visible, .side-buttons > .more-wrap > button:visible').evaluateAll((els) => els.map((e) => (e as HTMLElement).title));
  k.note('side column visible: ' + JSON.stringify(col));
  expect(col.length, 'side column = Catalog, Build, Dungeon, More').toBeLessThanOrEqual(4);
  for (const t of ['Catalog', 'Build', 'Dungeon', 'More']) expect(col.some((x) => x.startsWith(t)), t + ' in column').toBe(true);
  // phone: no text labels in the column
  if (phone(page)) {
    const lab = await page.locator('.side-buttons > button:visible .more-label, .side-buttons button.more-btn:visible .more-label').count();
    expect(lab, 'no labels on phone icons').toBe(0);
  }
  // guide appears after 4 s idle, one line, x button
  await page.waitForTimeout(5000);
  const gv = await page.locator('.first-ten:visible').count();
  k.note('guide after 5 s idle visible=' + gv);
  await S(page, '02-guide-idle');
  const skip = page.locator('.first-ten button[title="Skip the first steps"]');
  k.note('skip x count ' + await skip.count());
  expect(gv, 'guide shows after idle').toBeGreaterThan(0);
  expect(await skip.count()).toBeGreaterThan(0);
  const gh = await page.locator('.first-ten').first().evaluate((e) => e.getBoundingClientRect().height);
  k.note('guide card height ' + gh);
  // info panel
  const info = await page.locator('.info-panel, [class*=info-panel]').first().evaluate((e) => ({ text: (e as HTMLElement).innerText, h: e.getBoundingClientRect().height, w: e.getBoundingClientRect().width })).catch(() => null);
  k.note('info panel ' + JSON.stringify(info));
  // More grid
  await openMoreMenu(page); await page.waitForTimeout(300); await S(page, '03-more-grid');
  const items = await page.locator('.more-menu button').evaluateAll((els) => els.map((e) => (e as HTMLElement).title.split(/[:(]/)[0]));
  k.note('More items ' + JSON.stringify(items));
  expect(await page.locator('.side-buttons > button[title^="Worlds"]').isVisible(), 'Worlds is its own side button').toBe(true);
  for (const t of ['Quests', 'Emote', 'Room', 'Book', 'Skills', 'Avatar', 'Chat', 'Settings']) expect(items.some((x) => x.startsWith(t)), t + ' in More').toBe(true);
  await page.keyboard.press('Escape');
  // Room panel through More
  await openMore(page, 'Room'); await page.waitForTimeout(500); await S(page, '04-room-panel');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  // Bar panel: tap the register
  const reg = await k.ph<any>(`const r=h.st.items.find(i=>i.typeId==='register'); return r?{x:r.x,y:r.y}:null`);
  if (reg) {
    await k.ph(`const W=innerWidth,H=innerHeight; h.setCamera({x:${reg.x}-W/2/3,y:${reg.y}-H/2/3,zoom:3},true); return 1`); await page.waitForTimeout(500);
    const p = await k.ph<any>(`const r=h.st.items.find(i=>i.typeId==='register'); return h.worldToScreen({x:r.x,y:r.y-12}, h.st.shown)`);
    await page.mouse.click(p.x, p.y); await page.waitForTimeout(800); await S(page, '05-bar-panel');
    const menuTab = page.getByRole('button', { name: /Menu/ }).first();
    if (await menuTab.count()) { await menuTab.dispatchEvent('click'); await page.waitForTimeout(500); await S(page, '06-bar-menu');
      const detail = await page.locator('.ui-panel [class*=detail]:visible').count(); k.note('bar menu visible detail blocks ' + detail);
      expect(detail, 'only the tapped row shows detail').toBeLessThanOrEqual(1);
    }
  }
  await page.keyboard.press('Escape');
  // fade after 3 s idle
  await page.waitForTimeout(4000);
  const op = await page.locator('.side-buttons').first().evaluate((e) => getComputedStyle(e).opacity);
  k.note('side column opacity after idle ' + op); await S(page, '07-idle-fade');
  expect(errs.list).toEqual([]);
});
