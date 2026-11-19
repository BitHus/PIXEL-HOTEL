import { chromium } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({viewport:{width:420,height:760}});
const page = await ctx.newPage();
await page.goto('http://localhost:5199/?e2e');
await page.waitForSelector('.title-btn'); await page.getByText('New game').first().click();
await page.waitForSelector('.charmaker-panel'); await page.getByLabel('Display name').fill('T');
await page.getByText('Begin your story').click(); await page.waitForSelector('.shape-card');
await page.getByRole('button',{name:'Open my tavern'}).click(); await page.waitForTimeout(800); await page.mouse.click(5,300); await page.waitForTimeout(500); await page.mouse.click(5,300); await page.waitForTimeout(2000);
await page.evaluate(()=>document.querySelector('.more-menu .more-item')?.classList.add('glow'));
const xs=[];for(let i=0;i<12;i++){xs.push(await page.evaluate(()=>{const e=document.querySelector('.more-btn');const c=getComputedStyle(e);return c.animationName+' '+c.animationDuration+' '+c.backgroundColor}));await page.waitForTimeout(300)}
console.log(xs.join('\n'));
await b.close();
