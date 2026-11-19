import { chromium } from '@playwright/test';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 3 }); const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:4263/?e2e'); await page.waitForTimeout(1500);
await page.getByText('New game').first().click(); await page.getByLabel('Display name').fill('T'); await page.getByText('Begin your story').click();
await page.getByRole('button', { name: 'Open my tavern' }).click(); await page.waitForTimeout(800); await page.mouse.click(5, 300); await page.waitForTimeout(500); await page.mouse.click(5, 300); await page.waitForTimeout(3500);
await page.evaluate(() => localStorage.setItem('pixel-hotel.first-ten', JSON.stringify({ active: false, skipped: true, done: [], tips: [] })));
await page.reload(); await page.waitForTimeout(2000); await page.getByText('Continue').first().click(); await page.waitForTimeout(5000);
await page.screenshot({ path: 'r14-shots/desktop-72-first-view-3x.png' });
const clips = { suite: { x: 170, y: 190, width: 190, height: 130 }, garden: { x: 650, y: 190, width: 190, height: 130 }, cellar: { x: 400, y: 0, width: 200, height: 110 } };
for (const [n, c] of Object.entries(clips)) await page.screenshot({ path: `r14-shots/desktop-73-door-${n}.png`, clip: c });
// peek: walk far then stand still
await page.evaluate(() => localStorage.setItem('pixel-hotel.first-ten', JSON.stringify({ active: true, skipped: false, done: ['zoom', 'walk', 'holdwalk'], tips: [] })));
await page.reload(); await page.waitForTimeout(2000); await page.getByText('Continue').first().click(); await page.waitForTimeout(4000);
await page.mouse.click(250, 560); await page.waitForTimeout(3500);
const cams = [];
for (let i = 0; i < 6; i++) { await page.waitForTimeout(600); cams.push(await page.evaluate(() => { const h = window.__ph; return JSON.stringify({ x: Math.round(h.st.shown.x), y: Math.round(h.st.shown.y), ax: Math.round(h.st.avatar.x), ay: Math.round(h.st.avatar.y), g: h.st.guideWorld }); })); }
console.log(cams.join('\n')); await page.screenshot({ path: 'r14-shots/desktop-74-peek.png' });
console.log('errs', JSON.stringify(errs)); await b.close();
