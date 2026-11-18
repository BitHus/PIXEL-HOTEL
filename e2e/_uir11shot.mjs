import { chromium } from '@playwright/test';
const tag = process.argv[2] ?? 'a';
const only = process.argv[3];
const sizes = [['desktop',{width:1000,height:700},{}],['phone',{width:420,height:760},{deviceScaleFactor:2,hasTouch:true}]];
const b = await chromium.launch();
for (const [n,vp,o] of sizes) {
  if (only && only !== n) continue;
  const ctx = await b.newContext({viewport:vp,...o});
  const page = await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  const out = (s) => page.screenshot({path:`test-results/uir11/${tag}-${n}-${s}.png`});
  await page.goto('http://localhost:4192/?e2e');
  await page.waitForSelector('.title-btn',{timeout:20000}); await page.waitForTimeout(800);
  await out('title');
  await page.getByText('New game').first().click();
  await page.waitForSelector('.charmaker-panel'); await page.waitForTimeout(600);
  await out('maker');
  await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click();
  await page.waitForSelector('.shape-card'); await page.waitForTimeout(600);
  await out('shape');
  await page.getByRole('button',{name:'Open my tavern'}).click();
  await page.waitForTimeout(800);
  await page.mouse.click(5,300); await page.waitForTimeout(500); await page.mouse.click(5,300);
  await page.waitForTimeout(3500);
  const ph = (body) => page.evaluate((b) => new Function('h', `return (async()=>{ ${b} })()`)(window.__ph), body);
  await ph(`h.setCamera({x:0,y:0,zoom:1.4}, true)`); await page.waitForTimeout(500);
  const tap = async (type) => {
    const p = await ph(`const it=h.st.items.find(i=>i.typeId==='${type}'||i.type==='${type}'); if(!it) return null; return h.worldToScreen({x:it.x,y:it.y-16}, h.st.shown)`);
    if (!p) { console.log('no', type); return false; }
    await page.mouse.click(p.x,p.y); await page.waitForTimeout(500); return true;
  };
  const closeP = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); };
  console.log(n, await ph(`return JSON.stringify(h.st.items.map(i=>[i.typeId??i.type,Math.round(i.x),Math.round(i.y)]))`));
  await out('tavern');
  if (await tap('register')) { await page.waitForTimeout(9000); await out('bar'); const tb=page.locator('.tap-levels-open').first(); if (await tb.isVisible().catch(()=>false)) { await page.locator('.menu-panel .tab-btn').first().click().catch(()=>{}); await page.waitForTimeout(300); await out('bar-serve'); } await closeP(); }
  for (const [type,name,sel] of [['tap_stand','taps'],['brewing_barrel','brewing'],['stove','cooking']]) {
    if (await tap(type)) { await page.waitForTimeout(9000); await out(name); await closeP(); await page.waitForTimeout(500); }
  }
  const openSide = async (title) => {
    const bt = page.locator(`button[title^="${title}"]`).first();
    if (!(await bt.isVisible())) { await page.locator('button.more-btn').dispatchEvent('click'); await page.waitForTimeout(300); if (title==='Room') await out('more'); }
    await bt.dispatchEvent('click'); await page.waitForTimeout(500);
  };
  for (const [t,name] of [['Room','room'],['Book','book'],['Catalog','catalog'],['Settings','settings'],['Avatar','avatar'],['Skills','skills']]) { await openSide(t); await out(name); await closeP(); }
  // quests: button?
  const q = page.locator('button[title^="Quest"]').first(); if (await q.isVisible().catch(()=>false)) { await q.dispatchEvent('click'); await page.waitForTimeout(500); await out('quests'); await closeP(); }
  console.log(n, errs);
  await ctx.close();
}
await b.close();
