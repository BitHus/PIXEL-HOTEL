import { chromium } from '@playwright/test';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 1000, height: 700 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:4263/?e2e'); await page.waitForTimeout(1500);
await page.getByText('New game').first().click(); await page.getByLabel('Display name').fill('T'); await page.getByText('Begin your story').click();
await page.getByRole('button', { name: 'Open my tavern' }).click(); await page.waitForTimeout(800); await page.mouse.click(5, 300); await page.waitForTimeout(500); await page.mouse.click(5, 300); await page.waitForTimeout(3000);
await page.mouse.click(965, 262); await page.waitForTimeout(600);
await page.screenshot({ path: 'r14-shots/desktop-80-more.png' });
await page.locator('button', { hasText: /Skills/ }).first().click(); await page.waitForTimeout(800);
await page.screenshot({ path: 'r14-shots/desktop-81-skills.png' });
console.log(await page.evaluate(() => { const t=document.querySelector('.panel-tabs'); return t?JSON.stringify([...t.children].map(c=>{const r=c.getBoundingClientRect();return [c.title||c.textContent,Math.round(r.left),Math.round(r.right)]})):'notabs'; }));
const tabs = page.locator(".ui-panel.open .tab-btn, .ui-panel.open .panel-tabs button"); const n = await tabs.count(); console.log('tabs', n);
if (n > 3) { await tabs.nth(3).click(); await page.waitForTimeout(400); await page.screenshot({ path: 'r14-shots/desktop-82-skills-tab4.png' }); }
const learn = page.locator('.ui-panel.open button', { hasText: /Learn/ }).first(); console.log('learn btns', await learn.count());
console.log('errs', JSON.stringify(errs)); await b.close();
