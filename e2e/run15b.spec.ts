// TESTER RUN 15b: phone fishing + skills mining tab (ore_sense). Shots r15-shots/
import { test } from '@playwright/test';
import { kit } from './run6kit';
import { watchErrors, openMore } from './helpers';
const tagOf = (p: any) => (p.viewportSize().width < 600 ? 'phone' : 'desktop');
const S = (p: any, n: string) => p.screenshot({ path: `r15-shots/${tagOf(p)}-${n}.png` });
const tap = async (p: any, x: number, y: number) => { if (tagOf(p) === 'phone') await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };
test('r15b fish + skills', async ({ page }) => {
  test.setTimeout(400000);
  const errs = watchErrors(page); const k = kit(page, 'r15b');
  await k.newGame();
  await page.evaluate(() => localStorage.setItem('pixel-hotel.first-ten', JSON.stringify({ active: false, skipped: true, done: [], tips: [] })));
  await openMore(page, 'Skills'); await page.waitForTimeout(800);
  const tabs = page.locator('.ui-panel.open .tab-btn'); k.note('tabs ' + await tabs.count());
  await tabs.nth(4).click(); await page.waitForTimeout(400); await S(page, '60-skills-mining');
  k.note('mining txt ' + await page.evaluate(() => (document.querySelector('.ui-panel.open') as HTMLElement).innerText.replace(/\s+/g, ' ').slice(0, 300)));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.evaluate(() => (document.querySelector('button[title^="Worlds"]') as HTMLElement).click()); await page.waitForTimeout(600);
  await page.locator('.travel-card', { hasText: /Lakeside/ }).first().click(); await page.waitForTimeout(6500);
  await tap(page, 5, 400); await page.waitForTimeout(500);
  await page.evaluate(() => { const b = document.querySelector('.quest-toast, .guide-card') as HTMLElement | null; b?.click(); });
  const vp = page.viewportSize()!;
  const bar = page.locator('.fish-bar:visible'); let cast = false;
  const pts = tagOf(page) === 'phone' ? [[0.7, 0.33], [0.75, 0.42], [0.6, 0.45], [0.8, 0.5], [0.55, 0.38]] : [[0.75, 0.3], [0.85, 0.4]];
  for (const [fx, fy] of pts) { if (cast) break; await tap(page, vp.width * fx, vp.height * fy); await page.waitForTimeout(3500); cast = (await bar.count()) > 0; k.note(`tap ${fx},${fy} cast ${cast}`); }
  if (cast) {
    let last = ''; let m = 0; const t0 = Date.now(); let reel = 0;
    for (let i = 0; i < 700; i++) {
      await page.waitForTimeout(100);
      if (!(await bar.count())) { k.note('bar gone after ' + (Date.now() - t0)); break; }
      const t = (await page.locator('.fish-text').first().innerText().catch(() => '')) || '';
      if (t !== last) { last = t; m++; if (m < 7) await S(page, `61-fish-${m}`); k.note(`t=${Date.now() - t0} ${t}`); }
      if (/bite|now|!/i.test(t)) await tap(page, vp.width * 0.5, vp.height * 0.85);
      else if (/box|fish|reel|hold/i.test(t)) { reel++; if (reel % 3 === 0) { await page.keyboard.down('Space'); await page.waitForTimeout(220); await page.keyboard.up('Space'); } if (reel === 6) { await S(page, '62-reel'); k.note('bar ' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.fish-bar')].map((e) => { const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; })))); } }
    }
    await page.waitForTimeout(1500); await S(page, '63-after');
  } else await S(page, '64-nocast');
  k.note('errors ' + JSON.stringify(errs.list));
});
