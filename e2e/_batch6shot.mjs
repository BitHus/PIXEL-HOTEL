import { chromium } from '@playwright/test';
const out = process.argv[2];
const combos = [['wood_planks','brick'],['stone_tiles','plaster'],['red_carpet','wood_panels']];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1000, height: 700 } });
const page = await ctx.newPage();
await page.goto('http://localhost:4280/');
await page.getByText('New game').first().click();
await page.getByLabel('Display name').fill('Tester');
await page.getByText('Begin your story').click();
await page.getByRole('button', { name: 'Next' }).click().catch(()=>{});
await page.getByRole('button', { name: 'Open my tavern' }).click();
await page.waitForTimeout(800);
await page.mouse.click(5, 300); await page.waitForTimeout(500); await page.mouse.click(5, 300);
await page.waitForTimeout(2500);
for (const [i, [f, w]] of combos.entries()) {
  await page.evaluate(([f, w]) => {
    for (let k = 0; k < localStorage.length; k++) {
      const key = localStorage.key(k); try { const v = JSON.parse(localStorage.getItem(key)); if (v.state && v.state.rooms) {
        const rooms = v.state.rooms; for (const r of Object.values(rooms)) { if (r.kind === 'shop' || r.kind === 'hotel') { r.floorStyle = f; r.wallStyle = w; r.floorCells = undefined; } }
        localStorage.setItem(key, JSON.stringify(v)); } } catch {}
    }
  }, [f, w]);
  await page.reload(); await page.waitForTimeout(800); await page.getByText('Continue').first().click();
  await page.mouse.click(5, 300); await page.waitForTimeout(500); await page.mouse.click(5, 300);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/game_${f}_${w}.png` });
}
await b.close();
