import { chromium } from '@playwright/test';
const tag = process.argv[2] || 'a';
const sizes = [['desktop',{width:1000,height:700},{}],['phone',{width:420,height:760},{deviceScaleFactor:2,hasTouch:true}]];
const b = await chromium.launch();
for (const [n,vp,o] of sizes) {
  const ctx = await b.newContext({viewport:vp,...o});
  const page = await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://localhost:4301/');
  await page.waitForSelector('.title-screen', {timeout: 20000});
  await page.waitForTimeout(800);
  await page.screenshot({path:`ui6-shots/${tag}-${n}-title-new.png`});
  await page.getByText('New game').first().click();
  await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click();
  await page.screenshot({path:'ui6-shots/dbg.png'}); await page.getByRole('button',{name:'Next'}).click({timeout:3000}).catch(()=>{});
  await page.getByRole('button',{name:'Open my tavern'}).click({timeout:5000,force:true}).catch(()=>{});
  await page.waitForTimeout(800);
  await page.mouse.click(5,300); await page.waitForTimeout(500); await page.mouse.click(5,300);
  await page.waitForTimeout(2500);
  await page.screenshot({path:`ui6-shots/${tag}-${n}-tavern.png`});
  const cat = page.locator('button[aria-label="Catalog"], .side-buttons button').first();
  await cat.click().catch(e=>console.log('cat',e.message));
  await page.waitForTimeout(600);
  await page.screenshot({path:`ui6-shots/${tag}-${n}-panel.png`});
  // reload: title with a save
  await page.reload();
  await page.waitForSelector('.title-screen', {timeout: 20000});
  await page.waitForTimeout(800);
  await page.screenshot({path:`ui6-shots/${tag}-${n}-title-save.png`});
  await page.getByText('Settings').first().click();
  await page.waitForTimeout(300);
  await page.screenshot({path:`ui6-shots/${tag}-${n}-title-settings.png`});
  console.log(n, errs);
  await ctx.close();
}
await b.close();
