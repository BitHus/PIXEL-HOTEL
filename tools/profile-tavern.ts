// OWN-4 (a): frame-time and CPU profile of the tavern with guests (Chromium, production build served on :4173).
// Run: npm run build && npm run preview -w client -- --port 4173 (other terminal), then: npx tsx tools/profile-tavern.ts [phone]
import { chromium } from '@playwright/test';

const phone = process.argv.includes('phone');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: phone ? { width: 420, height: 760 } : { width: 1000, height: 700 }, deviceScaleFactor: phone ? 2 : 1, hasTouch: phone });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/?e2e');
await page.getByText('New game').first().click();
await page.getByLabel('Display name').fill('Prof');
await page.getByText('Begin your story').click();
await page.getByRole('button', { name: 'Next' }).click();
await page.getByRole('button', { name: 'Open my tavern' }).click();
await page.waitForTimeout(800);
await page.mouse.click(5, 300);
await page.waitForTimeout(500);
await page.mouse.click(5, 300);
await page.waitForTimeout(2500);
// Guests now: the arrival timer to zero a few times.
await page.evaluate('window.__ph.api.state.tavern.nextGuestInMs = 0');
await page.waitForTimeout(25_000);
// Per-call cost of the API clock and the save (long tasks are what makes a tap feel ignored).
await page.evaluate('(function(){var a=window.__ph.api;window.__cost={};["update","save","getTavern"].forEach(function(n){var f=a[n];window.__cost[n]=[];a[n]=function(){var t=performance.now();var r=f.apply(a,arguments);window.__cost[n].push(performance.now()-t);return r;};});window.__lt=[];new PerformanceObserver(function(l){l.getEntries().forEach(function(e){window.__lt.push(e.duration);});}).observe({entryTypes:["longtask"]});})()');
const cdp = await ctx.newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
const stats = async (label: string, act: () => Promise<void>): Promise<void> => {
  await page.evaluate('(function(){var w=window;w.__ft=[];w.__run=true;var last=performance.now();var tick=function(t){w.__ft.push(t-last);last=t;if(w.__run)requestAnimationFrame(tick);};requestAnimationFrame(tick);})()');
  await cdp.send('Profiler.start');
  await act();
  const prof = (await cdp.send('Profiler.stop')).profile;
  const ft = (await page.evaluate('(function(){window.__run=false;return window.__ft.slice(2);})()')) as number[];
  ft.sort((a, b) => a - b);
  const avg = ft.reduce((a, b) => a + b, 0) / ft.length;
  const q = (p: number): number => ft[Math.min(ft.length - 1, Math.floor(ft.length * p))]!;
  console.log(`\n== ${label}: frames ${ft.length}, avg ${avg.toFixed(1)} ms, p50 ${q(0.5).toFixed(1)}, p95 ${q(0.95).toFixed(1)}, p99 ${q(0.99).toFixed(1)}, max ${ft[ft.length - 1]!.toFixed(1)}, >33ms ${ft.filter((x) => x > 33).length}`);
  // Self time per function.
  const self = new Map<number, number>();
  const dt = prof.timeDeltas ?? [];
  const samples = prof.samples ?? [];
  samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (dt[i] ?? 0)));
  const byFn = new Map<string, number>();
  for (const n of prof.nodes) {
    const key = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`;
    byFn.set(key, (byFn.get(key) ?? 0) + (self.get(n.id) ?? 0));
  }
  // Inclusive time per function (a sample counts once for every function on its stack).
  const parent = new Map<number, number>();
  for (const n of prof.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const byId = new Map(prof.nodes.map((n) => [n.id, n]));
  const incl = new Map<string, number>();
  samples.forEach((id, i) => {
    const seen = new Set<string>();
    for (let cur: number | undefined = id; cur !== undefined; cur = parent.get(cur)) {
      const cf = byId.get(cur)!.callFrame;
      const key = `${cf.functionName || '(anon)'} ${cf.url.split('/').pop()}:${cf.lineNumber}:${cf.columnNumber}`;
      if (!seen.has(key)) { seen.add(key); incl.set(key, (incl.get(key) ?? 0) + (dt[i] ?? 0)); }
    }
  });
  console.log('  inclusive:');
  for (const [k, v] of [...incl.entries()].filter(([k]) => !k.startsWith('(root)') && !k.startsWith('(program)')).sort((a, b) => b[1] - a[1]).slice(0, 22)) console.log(`  ${(v / 1000).toFixed(0).padStart(6)} ms  ${k}`);
  const total = [...byFn.values()].reduce((a, b) => a + b, 0);
  for (const [k, v] of [...byFn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`  ${(v / 1000).toFixed(0).padStart(6)} ms ${(100 * v / total).toFixed(1).padStart(5)}%  ${k}`);
};
await stats('idle tavern with guests (8 s)', () => page.waitForTimeout(8000));
await stats('walk the avatar (hold + drag, 8 s)', async () => {
  const w = phone ? 420 : 1000;
  const h = phone ? 760 : 700;
  await page.mouse.move(w * 0.3, h * 0.6);
  await page.mouse.down();
  for (let i = 0; i < 200; i++) {
    const a = i / 20;
    await page.mouse.move(w * 0.5 + Math.cos(a) * w * 0.2, h * 0.6 + Math.sin(a) * h * 0.1);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
});
const cost = (await page.evaluate('JSON.stringify({c:window.__cost,lt:window.__lt})')) as string;
const parsed = JSON.parse(cost) as { c: Record<string, number[]>; lt: number[] };
for (const [n, v] of Object.entries(parsed.c)) console.log(`api.${n}: calls ${v.length}, avg ${(v.reduce((a, b) => a + b, 0) / Math.max(1, v.length)).toFixed(2)} ms, max ${Math.max(0, ...v).toFixed(1)} ms`);
console.log(`long tasks (>50ms): ${parsed.lt.length}, max ${Math.max(0, ...parsed.lt).toFixed(0)} ms`);
await browser.close();
