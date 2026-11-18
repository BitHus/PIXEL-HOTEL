import { chromium } from '@playwright/test';
const tag = process.argv[2];
const sizes = [['desktop',{width:1000,height:700},{}],['phone',{width:420,height:760},{deviceScaleFactor:2,hasTouch:true}]];
const b = await chromium.launch();
for (const [n,vp,o] of sizes) {
  const ctx = await b.newContext({viewport:vp,...o});
  const page = await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://localhost:4192/');
  await page.getByText('New game').first().click();
  await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click();
  await page.getByRole('button',{name:'Next'}).click();
  await page.getByRole('button',{name:'Open my tavern'}).click();
  await page.waitForTimeout(800);
  await page.mouse.click(5,300); await page.waitForTimeout(500); await page.mouse.click(5,300);
  await page.waitForTimeout(3000);
  await page.screenshot({path:`test-results/uir/${tag}-${n}-tavern.png`});
  // select a hotbar slot, trigger a toast
  await page.locator('.hotbar-slot').first().click().catch(()=>{});
  await page.waitForTimeout(400);
  await page.screenshot({path:`test-results/uir/${tag}-${n}-slot.png`});
  const bag = page.locator('.hotbar-bag'); 
  await page.mouse.click(vp.width/2, vp.height/2); await page.waitForTimeout(300);
  await page.screenshot({path:`test-results/uir/${tag}-${n}-toast.png`});
  console.log(n, errs);
  await ctx.close();
}
await b.close();
