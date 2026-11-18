import { chromium } from '@playwright/test';
const tag = process.argv[2] ?? 'p';
const sizes = [['desktop',{width:1000,height:700},{}],['phone',{width:420,height:760},{deviceScaleFactor:2,hasTouch:true}]];
const b = await chromium.launch();
for (const [n,vp,o] of sizes) {
  const ctx = await b.newContext({viewport:vp,...o});
  const page = await ctx.newPage();
  const out = (s) => page.screenshot({path:`test-results/uir11/${tag}-${n}-${s}.png`});
  await page.goto('http://localhost:4192/?e2e');
  await page.waitForSelector('.title-btn',{timeout:20000});
  await page.getByText('New game').first().click();
  await page.getByLabel('Display name').fill('Tester');
  await page.getByText('Begin your story').click();
  await page.getByRole('button',{name:'Open my tavern'}).click();
  await page.waitForTimeout(800);
  await page.mouse.click(5,300); await page.waitForTimeout(500); await page.mouse.click(5,300);
  await page.waitForTimeout(3500);
  const ph = (body) => page.evaluate((b) => new Function('h', `return (async()=>{ ${b} })()`)(window.__ph), body);
  const tap = async (type) => {
    const p0 = await ph(`const it=h.st.items.find(i=>(i.typeId??i.type)==='${type}'); return [it.x,it.y]`); const z=1.4; await ph(`h.setCamera({x:${p0[0]-(vp.width/2)/z},y:${p0[1]-(vp.height*0.55)/z},zoom:${z}}, true)`); await page.waitForTimeout(500);
    const p = await ph(`const it=h.st.items.find(i=>(i.typeId??i.type)==='${type}'); return h.worldToScreen({x:it.x,y:it.y-16}, h.st.shown)`);
    await page.mouse.click(p.x,p.y);
  };
  const waitPanel = async (sel) => { try { await page.waitForSelector(sel+':not([hidden])',{state:'visible',timeout:30000}); await page.waitForTimeout(600); return true; } catch { console.log(n,'no',sel); return false; } };
  const esc = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(500); };
  await tap('register'); if (await waitPanel('.menu-panel')) { await out('bar-serve'); await page.locator('.menu-panel .tab-btn').nth(1).click(); await page.waitForTimeout(400); await out('bar-menu'); const t=page.locator('.tap-levels-open'); if (await t.isVisible().catch(()=>false)) { await t.click(); if (await waitPanel('.taps-panel')) await out('taps'); } await esc(); }
  await tap('brewing_barrel'); if (await waitPanel('.brewing-panel')) { await out('brewing'); await esc(); }
  await tap('stove'); if (await waitPanel('.cooking-panel')) { await out('cooking'); await esc(); }
  const q = page.locator('button[title^="Quest"]').first(); if (await q.isVisible().catch(()=>false)) { await q.dispatchEvent('click'); await page.waitForTimeout(600); await out('quests'); await esc(); }
  await ctx.close();
}
await b.close();
