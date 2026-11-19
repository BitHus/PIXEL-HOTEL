// Hit-box measuring + screenshots (debug overlay): node e2e/_hitbox.mjs <port>
import { chromium } from '@playwright/test';
const port = process.argv[2] ?? '4330';
const out = 'C:/Users/ajren/Desktop/PocketBarrel-styletest/hitbox';
const sizes = [['desktop', { width: 1000, height: 700 }, {}], ['phone', { width: 420, height: 760 }, { deviceScaleFactor: 2, hasTouch: true, isMobile: true }]];
const b = await chromium.launch();
for (const [n, vp, o] of sizes) {
  const ctx = await b.newContext({ viewport: vp, ...o });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://localhost:${port}/?e2e`);
  await page.getByText('New game').first().click();
  await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click();
  await page.getByRole('button', { name: 'Open my tavern' }).click();
  await page.waitForTimeout(800);
  await page.mouse.click(5, 300); await page.waitForTimeout(500); await page.mouse.click(5, 300);
  await page.waitForTimeout(3000);
  // Debug on: More -> Settings -> Debug
  await page.getByRole('button', { name: /more/i }).first().click().catch(() => {});
  await page.waitForTimeout(300);
  await page.getByText('Settings', { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(300);
  await page.getByText(/Debug: off/).first().click().catch(() => {});
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  const grown = await page.evaluate(() => window.__tapBoxes?.().map((x) => x.kind + ' ' + Math.round(x.rect.w) + 'x' + Math.round(x.rect.h)).join(', '));
  console.log(n, 'GROWN', grown);
  const boxes = await page.evaluate(() => window.__tapBoxes?.(false, 0).map((x) => ({ k: x.kind, w: Math.round(x.rect.w), h: Math.round(x.rect.h) })));
  const raw = await page.evaluate(() => { const ph = window.__ph; return ph.st.items.filter((i) => i.roomId === ph.st.room.id).map((i) => i.typeId + '@zoom' + ph.st.shown.zoom.toFixed(2)); });
  console.log(n, 'zoom/items', raw.join(' '));
  console.log(n, 'boxes (css px, after growth):', JSON.stringify(boxes));
  await page.screenshot({ path: `${out}/hitbox-${n}.png` });
  console.log(n, 'errors', errs);
  await ctx.close();
}
await b.close();
