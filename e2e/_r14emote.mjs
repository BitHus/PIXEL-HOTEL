import { chromium } from '@playwright/test';
const tag = process.argv[2] ?? 'a';
const base = process.argv[3] ?? 'http://localhost:5199';
const sizes = [['desk',{width:1000,height:700},{}],['phone',{width:420,height:760},{deviceScaleFactor:2,hasTouch:true}],['short',{width:360,height:640},{deviceScaleFactor:2,hasTouch:true}]];
const b = await chromium.launch();
for (const [n,vp,o] of sizes) {
  const ctx = await b.newContext({viewport:vp,...o});
  const page = await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto(base+'/?e2e');
  await page.waitForSelector('.title-btn',{timeout:20000}); await page.waitForTimeout(800);
  await page.getByText('New game').first().click();
  await page.waitForSelector('.charmaker-panel'); await page.waitForTimeout(400);
  await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click();
  await page.waitForSelector('.shape-card'); await page.waitForTimeout(400);
  await page.getByRole('button',{name:'Open my tavern'}).click();
  await page.waitForTimeout(800);
  await page.mouse.click(5,300); await page.waitForTimeout(500); await page.mouse.click(5,300);
  await page.waitForTimeout(5000);
  await page.screenshot({path:`r14-shots/${tag}-${n}-0.png`});
  await page.locator('.more-btn').click(); await page.waitForTimeout(500);
  await page.screenshot({path:`r14-shots/${tag}-${n}-1more.png`});
  await page.locator('.emote-btn').click(); await page.waitForTimeout(500);
  await page.screenshot({path:`r14-shots/${tag}-${n}-2emote.png`});
  console.log(n, await page.evaluate(()=>{const r=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return [Math.round(b.left),Math.round(b.top),Math.round(b.right),Math.round(b.bottom)]};return JSON.stringify({menu:r('.emote-menu'),more:r('.more-btn'),morem:r('.more-menu'),hotbar:r('.hotbar'),orders:r('.orders-strip, .orders-row')})}), errs);
  await ctx.close();
}
await b.close();
