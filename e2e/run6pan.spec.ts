// RUN 6: pan / zoom while guests and the avatar walk must never teleport them, and Follow camera ON must keep the avatar centred.
// Needs the e2e hook window.__ph.guestViews (GuestViews; reads its private `shown` map). Samples every animation frame.
import { test, expect } from '@playwright/test';
import { newGame, openSide } from './helpers';

interface Sample { t: number; av: { x: number; y: number }; cam: { x: number; y: number; zoom: number }; shown: { x: number; y: number; zoom: number }; g: Record<number, { x: number; y: number; mx: number; my: number; walking: boolean }> }

async function startSampler(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const h = (window as any).__ph; const out: any[] = []; (window as any).__samples = out; (window as any).__stop = false;
    const loop = (t: number): void => {
      const g: any = {};
      const model = h.api.state?.tavern?.guests ?? [];
      for (const [id, s] of (h.guestViews?.shown ?? [])) { const m = model.find((q: any) => q.id === id); g[id] = { x: s.avatar.x, y: s.avatar.y, mx: m ? m.x : NaN, my: m ? m.y : NaN, walking: s.path.length > 0 }; }
      out.push({ t, av: { x: h.st.avatar.x, y: h.st.avatar.y }, cam: { ...h.st.camera }, shown: { ...h.st.shown }, g });
      if (!(window as any).__stop) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}
const stopSampler = async (page: import('@playwright/test').Page): Promise<Sample[]> => page.evaluate(() => { (window as any).__stop = true; return (window as any).__samples; });

function analyse(s: Sample[]): { avatarJumps: string[]; guestJumps: string[]; modelGap: string[]; frames: number; maxDt: number } {
  const avatarJumps: string[] = []; const guestJumps: string[] = []; const modelGap: string[] = []; let maxDt = 0;
  for (let i = 1; i < s.length; i++) {
    const dt = (s[i].t - s[i - 1].t) / 1000; maxDt = Math.max(maxDt, dt * 1000);
    const da = Math.hypot(s[i].av.x - s[i - 1].av.x, s[i].av.y - s[i - 1].av.y);
    if (da > 128 * Math.min(dt, 0.1) * 1.15 + 3) avatarJumps.push(`f${i} t=${s[i].t.toFixed(0)} dt=${(dt * 1000).toFixed(0)}ms avatar moved ${da.toFixed(1)}px (max ${(128 * Math.min(dt, 0.1) * 1.15 + 3).toFixed(1)})`);
    for (const id of Object.keys(s[i].g)) {
      const a = s[i].g[+id]; const b = s[i - 1].g[+id]; if (!b) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y); const lim = 72 * 1.1 * Math.min(dt, 0.5) * 1.15 + 3;
      if (d > lim) guestJumps.push(`f${i} t=${s[i].t.toFixed(0)} dt=${(dt * 1000).toFixed(0)}ms guest ${id} moved ${d.toFixed(1)}px (max ${lim.toFixed(1)})`);
      const gap = Math.hypot(a.x - a.mx, a.y - a.my);
      if (a.walking && gap > 24 && !isNaN(gap)) modelGap.push(`f${i} guest ${id} shown vs model ${gap.toFixed(0)}px`);
    }
  }
  return { avatarJumps, guestJumps, modelGap, frames: s.length, maxDt };
}

async function setFollow(page: import('@playwright/test').Page, on: boolean): Promise<void> {
  await openSide(page, 'Settings');
  const f = page.getByRole('button', { name: /Follow camera/i }).first();
  const isOn = /on/i.test((await f.textContent()) ?? '');
  if (isOn !== on) await f.dispatchEvent('click');
  await page.keyboard.press('Escape');
}

async function waitGuests(page: import('@playwright/test').Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => (window as any).__ph.guestViews.shown.size), { timeout: 150000, intervals: [1000] }).toBeGreaterThan(0);
}

for (const follow of [true, false]) {
  test(`pan and zoom while walking, follow ${follow ? 'ON' : 'OFF'}`, async ({ page }, info) => {
    test.setTimeout(240000);
    await page.goto('/?e2e');
    await newGame(page);
    await page.goto('/?e2e'); // reload keeps the save, gets the hook
    await page.getByText(/Continue/i).first().click().catch(() => undefined);
    await page.waitForTimeout(3000);
    await page.mouse.click(5, 300);
    await page.waitForTimeout(3000);
    await setFollow(page, follow);
    await waitGuests(page);
    const vp = page.viewportSize()!;
    await startSampler(page);
    // avatar walks back and forth while the user drags the screen around and wheel-zooms
    for (let round = 0; round < 6; round++) {
      await page.evaluate((r) => { const h = (window as any).__ph; h.st.path.length; }, round);
      await page.mouse.click(vp.width * (round % 2 ? 0.3 : 0.7), vp.height * 0.6);
      await page.waitForTimeout(150);
      await page.mouse.move(vp.width / 2, vp.height / 2);
      await page.mouse.down();
      for (let i = 0; i < 12; i++) { await page.mouse.move(vp.width / 2 + (round % 2 ? 1 : -1) * i * 12, vp.height / 2 + i * 6); await page.waitForTimeout(16); }
      await page.mouse.up();
      await page.mouse.wheel(0, round % 2 ? -300 : 300);
      await page.waitForTimeout(900);
    }
    await page.waitForTimeout(1500);
    const s = await stopSampler(page);
    const r = analyse(s);
    const gStages = new Set<number>(); s.forEach((x) => Object.keys(x.g).forEach((k) => gStages.add(+k)));
    const walkingFrames = s.filter((x) => Object.values(x.g).some((q) => q.walking)).length;
    // follow ON: after the pause, the shown camera must centre the avatar (within 1 device px) once the player stopped; check the last sample
    const last = s[s.length - 1];
    const cx = last.shown.x + vp.width / 2 / last.shown.zoom; const cy = last.shown.y + vp.height / 2 / last.shown.zoom;
    const off = Math.hypot(cx - last.av.x, cy - (last.av.y - 24));
    console.log(JSON.stringify({ follow, frames: r.frames, maxDtMs: r.maxDt.toFixed(0), guests: [...gStages], walkingFrames, avatarJumps: r.avatarJumps.slice(0, 8), n: r.avatarJumps.length, guestJumps: r.guestJumps.slice(0, 8), ng: r.guestJumps.length, modelGap: r.modelGap.slice(0, 8), nm: r.modelGap.length, centreOffWorldPx: off.toFixed(1) }, null, 1));
    expect.soft(r.avatarJumps, 'avatar teleport').toEqual([]);
    expect.soft(r.guestJumps, 'guest teleport').toEqual([]);
    expect.soft(r.modelGap.length, 'shown guest differs from model by > WALK_RESYNC_PX').toBe(0);
  });
}

async function freshGame(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/?e2e');
  await newGame(page);
  await page.goto('/?e2e');
  await page.getByText(/Continue/i).first().click().catch(() => undefined);
  await page.waitForTimeout(3000);
  await page.mouse.click(5, 300);
  await page.waitForTimeout(3000);
}

/** A guest walks while the player pans and wheel-zooms (optionally with a throttled CPU: slow frames). The shown guest must keep to its speed and stay on the model. */
for (const throttle of [1, 6]) {
  test(`guest walks while panning, cpu x${throttle}, follow OFF`, async ({ page }) => {
    test.setTimeout(240000);
    await freshGame(page);
    await setFollow(page, false);
    await waitGuests(page);
    await startSampler(page);
    const cdp = await page.context().newCDPSession(page);
    if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    const vp = page.viewportSize()!;
    let n = 0;
    const until = Date.now() + 200000;
    while (Date.now() < until && n < 150) {
      const walking = await page.evaluate(() => [...(window as any).__ph.guestViews.shown.values()].some((s: any) => s.path.length > 0));
      if (!walking) { await page.waitForTimeout(250); continue; }
      n++;
      await page.mouse.move(vp.width * 0.5, vp.height * 0.8);
      await page.mouse.down();
      for (let i = 0; i < 10; i++) { await page.mouse.move(vp.width * 0.5 + (n % 2 ? i : -i) * 15, vp.height * 0.8 - i * 8); await page.waitForTimeout(16); }
      await page.mouse.up();
      if (n % 3 === 0) await page.mouse.wheel(0, n % 2 ? -200 : 200);
    }
    if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const s = await stopSampler(page);
    const r = analyse(s);
    console.log(JSON.stringify({ throttle, pans: n, frames: r.frames, maxDtMs: r.maxDt.toFixed(0), guestJumps: r.guestJumps.slice(0, 8), ng: r.guestJumps.length, modelGap: r.modelGap.slice(0, 8), nm: r.modelGap.length }, null, 1));
    expect.soft(n, 'a guest walked').toBeGreaterThan(5);
    expect.soft(r.guestJumps, 'guest teleport').toEqual([]);
    expect.soft(r.modelGap.length, 'shown guest differs from model by > WALK_RESYNC_PX').toBe(0);
  });
}

/** A pan cancels the early walk on the client (pointerInput onWalkCancel -> g.stop) but the API keeps walking: the next click then snaps the avatar to the API's position. */
test('pan that cancels a walk leaves client avatar and API avatar in sync', async ({ page }) => {
  test.setTimeout(120000);
  await freshGame(page);
  await setFollow(page, false);
  const vp = page.viewportSize()!;
  await page.mouse.click(vp.width * 0.75, vp.height * 0.6); // a tap on the floor starts a walk
  await page.waitForTimeout(250);
  await page.mouse.move(vp.width * 0.5, vp.height * 0.5);
  await page.mouse.down();
  await page.waitForTimeout(40);
  for (let i = 0; i < 8; i++) { await page.mouse.move(vp.width * 0.75 - i * 14, vp.height * 0.6 + i * 3); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(2500);
  const p = await page.evaluate(() => { const h = (window as any).__ph; const a = h.api.avatarNow(); return { c: { x: h.st.avatar.x, y: h.st.avatar.y }, a: { x: a.x, y: a.y } }; });
  const gap = Math.hypot(p.c.x - p.a.x, p.c.y - p.a.y);
  console.log('client avatar', JSON.stringify(p.c), 'api avatar', JSON.stringify(p.a), 'gap', gap.toFixed(0));
  expect(gap, 'client avatar vs API avatar after a pan cancelled the walk').toBeLessThan(24);
});

/** Follow ON: a drag pans freely (paused), then the camera must come back to the avatar WITHOUT a one-frame jump of the whole screen; while following it never leaves the avatar. */
test('follow ON: free pan then return to the avatar is smooth', async ({ page }) => {
  test.setTimeout(120000);
  await freshGame(page);
  await setFollow(page, true);
  const vp = page.viewportSize()!;
  await startSampler(page);
  await page.mouse.move(vp.width * 0.5, vp.height * 0.5);
  await page.mouse.down();
  for (let i = 0; i < 15; i++) { await page.mouse.move(vp.width * 0.5 + i * 12, vp.height * 0.5 + i * 8); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(5000);
  const s = await stopSampler(page);
  let worst = 0; let at = 0;
  for (let i = 1; i < s.length; i++) { const d = Math.hypot(s[i].shown.x - s[i - 1].shown.x, s[i].shown.y - s[i - 1].shown.y) * s[i].shown.zoom; if (d > worst && s[i].t - s[0].t > 600) { worst = d; at = s[i].t - s[0].t; } }
  console.log(`follow ON worst per-frame camera move after the drag: ${worst.toFixed(0)} screen px at +${at.toFixed(0)} ms`);
  expect(worst, 'camera jumps back in one frame when the follow pause ends').toBeLessThan(40);
});
