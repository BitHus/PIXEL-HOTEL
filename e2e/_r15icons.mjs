import { chromium } from '@playwright/test';
const tag = process.argv[2] ?? 'a';
const base = process.argv[3] ?? 'http://localhost:5173';
const only = process.argv[4];
const sizes = [['d1000',{width:1000,height:700},{}],['d1280',{width:1280,height:720},{}],['d1920',{width:1920,height:1080},{}],['d1280x2',{width:1280,height:720},{deviceScaleFactor:2}],['phone',{width:420,height:760},{deviceScaleFactor:2,hasTouch:true}],['short',{width:360,height:640},{deviceScaleFactor:2,hasTouch:true}]].filter(s=>!only||only.split(',').includes(s[0]));
const b = await chromium.launch();
for (const [n,vp,o] of sizes) {
  const ctx = await b.newContext({viewport:vp,...o});
  const page = await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto(base+'/?e2e'); if (process.env.BEFORE) await page.addStyleTag({content:':root:not(#r15){--side-scale:1 !important;--side-icon:32px !important;--side-btn:calc(44px * var(--ui-s)) !important}'});
  await page.waitForSelector('.title-btn',{timeout:20000}); await page.waitForTimeout(800);
  await page.getByText('New game').first().click();
  await page.waitForSelector('.charmaker-panel'); await page.waitForTimeout(400);
  await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click();
  await page.waitForSelector('.shape-card'); await page.waitForTimeout(400);
  await page.getByRole('button',{name:'Open my tavern'}).click();
  await page.waitForTimeout(800);
  await page.mouse.click(5,300); await page.waitForTimeout(500); await page.mouse.click(5,300);
  await page.waitForTimeout(4000);
  await page.screenshot({path:`r15-shots/${tag}-${n}-0hud.png`});
  await page.locator('.more-btn').click(); await page.waitForTimeout(500);
  await page.screenshot({path:`r15-shots/${tag}-${n}-1more.png`});
  await page.keyboard.press('Escape'); await page.mouse.click(5,300);
  const cat = page.locator('.icon-btn[aria-label*="atalog"], .icon-btn[title*="atalog"]').first();
  if (await cat.count()) { await cat.click(); await page.waitForTimeout(600); await page.screenshot({path:`r15-shots/${tag}-${n}-2catalog.png`}); await page.keyboard.press('Escape'); }
  console.log(n, await page.evaluate(()=>{const r=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return [Math.round(b.left),Math.round(b.top),Math.round(b.right),Math.round(b.bottom)]};return JSON.stringify({sb:r('.side-buttons'),hotbar:r('.hotbar'),info:r('.info-panel, .info'),orders:r('.orders-strip'),sign:r('.open-sign')})}), errs);
  await ctx.close();
}
await b.close();
