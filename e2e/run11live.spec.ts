// TESTER RUN 11 (manager label RUN 10 b): live walk of the frame / hitbox / spacing round. Shots r11-shots/.
// Run ONE project at a time: npx playwright test -c e2e/run11live.config.ts --project=desktop (then phone). baseURL via PB_URL.
import { test } from '@playwright/test';
import * as fs from 'fs';
import { kit } from './run6kit';
import { watchErrors, openSide, openMoreMenu } from './helpers';

fs.mkdirSync('r11-shots', { recursive: true });
const tagOf = (page: any) => (page.viewportSize().width < 600 ? 'phone' : 'desktop');
const S = (page: any, n: string) => page.screenshot({ path: `r11-shots/${tagOf(page)}-${n}.png` });

test('r11 live walk', async ({ page }) => {
  test.setTimeout(480000);
  const errs = watchErrors(page); const k = kit(page, 'r11');
  const phone = tagOf(page) === 'phone';
  // title without a save
  await page.goto('/?e2e'); await page.waitForTimeout(6000); await S(page, '01-title-nosave');
  await k.newGame(); await S(page, '02-tavern');
  // spacing: item cells in the starter tavern
  const sp = await k.ph<any>(`const r=h.st.room; return {zoom:h.st.shown.zoom, items:h.st.items.filter(i=>i.roomId===r.id).map(i=>i.typeId+'@'+Math.floor(i.x/32)+','+Math.floor((i.y-1)/32))}`);
  k.note('spacing ' + JSON.stringify(sp));
  // panel checks (frame 24 px, narrow panels): overflow detection inside open panels
  const overflow = () => page.evaluate(() => {
    const p = document.querySelector('.ui-panel') as HTMLElement | null; if (!p) return 'no panel';
    const pr = p.getBoundingClientRect(); const bad: string[] = [];
    p.querySelectorAll('*').forEach((e) => { const r = (e as HTMLElement).getBoundingClientRect(); if (r.width && (r.right > pr.right + 1 || r.left < pr.left - 1)) bad.push(e.tagName + '.' + (e as HTMLElement).className + ' ' + (e.textContent || '').slice(0, 20)); });
    return `panel ${Math.round(pr.left)},${Math.round(pr.top)} ${Math.round(pr.width)}x${Math.round(pr.height)} sw>cw:${p.scrollWidth > p.clientWidth} overflowing:${bad.slice(0, 4).join(' | ')}`;
  });
  const closeP = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); };
  // Bar panel: tap the register
  const reg = await k.ph<any>(`const i=h.st.items.find(i=>i.typeId==='register'); return h.worldToScreen({x:i.x,y:i.y-14},h.st.shown)`);
  await page.mouse.click(reg.x, reg.y); await page.waitForTimeout(2500); await S(page, '10-bar-panel'); k.note('bar ' + await overflow());
  await closeP();
  await page.locator('button[title^="Bag"]').first().dispatchEvent('click'); await page.waitForTimeout(600); await S(page, '11-bag'); k.note('bag ' + await overflow()); await closeP();
  await openSide(page, 'Catalog'); await page.waitForTimeout(600); await S(page, '12-catalog'); k.note('catalog ' + await overflow());
  const tabs = page.locator('.ui-panel [role=tab], .ui-panel .tab, .ui-panel .tabs button');
  const nt = await tabs.count(); k.note('catalog tabs ' + nt);
  for (let i = 0; i < Math.min(nt, 8); i++) { await tabs.nth(i).dispatchEvent('click'); await page.waitForTimeout(350); await S(page, `13-catalog-tab${i}`); }
  await closeP();
  for (const lab of ['Skills', 'Room', 'Settings', 'Book', 'Avatar', 'Quests']) {
    await openMoreMenu(page); if (lab === 'Skills') await S(page, '14-more');
    await page.locator(`.more-menu button[title^="${lab}"]`).first().dispatchEvent('click'); await page.waitForTimeout(600);
    await S(page, '15-' + lab); k.note(lab + ' ' + await overflow());
    const x = page.locator('.panel-close:visible').first(); const b = await x.boundingBox().catch(() => null);
    k.note(lab + ' X ' + JSON.stringify(b)); await x.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(300);
  }
  // hitbox: from the sprite centre outwards (4 directions), a panel opening = forgiven
  const targets = ['stove', 'brewing_barrel', 'register', 'tap_stand'];
  for (const t of targets) {
    const res: string[] = [];
    for (const [dx, dy, dn] of [[1, 0, 'R'], [-1, 0, 'L'], [0, -1, 'U'], [0, 1, 'D']] as const) {
      let last = -1;
      for (const r of [0, 14, 28, 42, 56, 70]) {
        await closeP();
        const p = await k.ph<any>(`const i=h.st.items.find(i=>i.typeId==='${t}'); return h.worldToScreen({x:i.x,y:i.y-14},h.st.shown)`);
        await page.mouse.click(p.x + dx * r, p.y + dy * r); await page.waitForTimeout(1600);
        if (await page.locator('.ui-panel:visible').count()) last = r; else if (r > 0) break;
      }
      res.push(dn + ':' + last);
    }
    k.note(`hitbox ${t} (css px from sprite centre, -1 = never, zoom ${sp.zoom.toFixed(2)}) ` + res.join(' '));
  }
  await closeP(); await S(page, '20-after-hitbox');
  // rooms
  for (const room of ['Farm', 'Lakeside', 'Hotel']) {
    await closeP(); await openMoreMenu(page);
    await page.locator('.more-menu button[title^="Worlds"]').first().dispatchEvent('click'); await page.waitForTimeout(500);
    await page.locator('.travel-card', { hasText: new RegExp(room) }).first().click(); await page.waitForTimeout(6500);
    await S(page, '30-' + room);
  }
  // title with a save
  await page.goto('/?e2e'); await page.waitForTimeout(6000); await S(page, '40-title-save');
  k.note('errors ' + JSON.stringify(errs.list));
});
