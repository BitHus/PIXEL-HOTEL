import { chromium } from '@playwright/test';
const tag = process.argv[2] ?? 'a';
const sizes = [['desk',{width:1000,height:700},{}],['phone',{width:420,height:760},{deviceScaleFactor:2,hasTouch:true}],['short',{width:360,height:640},{deviceScaleFactor:2,hasTouch:true}]];
const b = await chromium.launch();
for (const [n,vp,o] of sizes) {
  const ctx = await b.newContext({viewport:vp,...o});
  const page = await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  const out = (s) => page.screenshot({path:`r13-shots/${tag}-${n}-${s}.png`});
  await page.goto('http://localhost:5173/?e2e');
  await page.waitForSelector('.title-btn',{timeout:20000}); await page.waitForTimeout(800);
  await page.getByText('New game').first().click();
  await page.waitForSelector('.charmaker-panel'); await page.waitForTimeout(400);
  await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click();
  await page.waitForSelector('.shape-card'); await page.waitForTimeout(400);
  await page.getByRole('button',{name:'Open my tavern'}).click();
  await page.waitForTimeout(800);
  await page.mouse.click(5,300); await page.waitForTimeout(500); await page.mouse.click(5,300);
  await page.waitForTimeout(6000);
  await out('1');
  await page.waitForTimeout(5000);
  await out('2');
  console.log(n, await page.evaluate(()=>{const c=document.querySelector('.first-ten');return c?JSON.stringify([c.hidden,c.getBoundingClientRect(),c.textContent]):'none'}), errs);
  await ctx.close();
}
await b.close();
