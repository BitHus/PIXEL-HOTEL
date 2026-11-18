// TESTER RUN 6 kitchen, cellar, camera lock, auto-collect, guests, markers. Notes + shots to r6kc-shots/.
import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import { saveState, watchErrors } from './helpers';

const OUT = 'r6kc-shots';
fs.mkdirSync(OUT, { recursive: true });
const DOORS = JSON.parse(fs.readFileSync('shared/data/innDoors.json', 'utf8'));
const doorSpot = (r: any, id: string): any => {
  const d = (DOORS.rooms[r.kind]?.[r.shape]?.[r.lvl - 1] ?? []).find((x: any) => x.id === id);
  return d ? { x: d.col * 32 + (d.w * 32) / 2, y: d.row * 32 + 12 } : null;
};

export function kit(page: Page, name: string) {
  const tag = page.viewportSize()!.width < 600 ? 'phone' : 'desktop';
  const notes: string[] = [];
  const note = (s: string) => { notes.push(s); fs.writeFileSync(`${OUT}/${tag}-${name}-notes.txt`, notes.join('\n')); };
  const sh = (n: string) => page.screenshot({ path: `${OUT}/${tag}-${name}-${n}.png` });
  const ph = <T>(body: string): Promise<T> => page.evaluate((b) => new Function('h', `return (async()=>{ ${b} })()`)((window as any).__ph), body) as Promise<T>;
  const where = () => ph<any>(`const r=h.st.room; const a=h.st.avatar; return {kind:r.kind,id:r.id,lvl:r.level,shape:r.shape,w:r.w,h:r.h,av:{x:Math.round(a.x),y:Math.round(a.y)},items:h.st.items.filter(i=>i.roomId===r.id).map(i=>i.typeId+'@'+i.x+','+i.y)}`);
  const toScreen = (x: number, y: number) => ph<{ x: number; y: number }>(`return h.worldToScreen({x:${x},y:${y}}, h.st.shown)`);
  const clickWorld = async (x: number, y: number) => { const p = await toScreen(x, y); await page.mouse.click(p.x, p.y); return p; };
  const state = async () => (await saveState(page)).state;
  const newGame = async () => {
    await page.goto('/?e2e');
    await page.waitForTimeout(1200);
    await page.getByText('New game').first().click();
    await page.getByLabel('Display name').fill('Tester');
    await page.getByText('Begin your story').click();
    await page.getByRole('button', { name: 'Open my tavern' }).click();
    await page.waitForTimeout(800);
    await page.mouse.click(5, 300); await page.waitForTimeout(500); await page.mouse.click(5, 300);
    await page.waitForTimeout(3500);
  };
  /** Rewrite the save (mutate fn) and Continue. */
  const patchAndContinue = async (fn: (s: any) => void) => {
    const base = await saveState(page);
    const s = JSON.parse(JSON.stringify(base.state)); fn(s);
    await page.evaluate(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key: base.key, saved: { version: base.version, savedAt: Date.now(), state: s } });
    await page.goto('/?e2e'); await page.waitForTimeout(2500);
    await page.getByText('Continue').first().click(); await page.waitForTimeout(4500);
  };
  return { tag, note, sh, ph, where, toScreen, clickWorld, state, newGame, patchAndContinue };
}

const SAMPLER = `
window.__samp = []; const h = window.__ph; let last = performance.now();
const loop = (t) => { const a = h.st.avatar; const s = h.worldToScreen({x:a.x,y:a.y}, h.st.shown);
  window.__samp.push({t, dt: t-last, sx: s.x, sy: s.y, cx: h.st.shown.x, cy: h.st.shown.y, ax: a.x, ay: a.y, room: h.st.room.kind}); last = t;
  if (!window.__stop) requestAnimationFrame(loop); }; requestAnimationFrame(loop);`;

test('r6kc A camera lock, drag pan, ease back (tavern)', async ({ page }) => {
  test.setTimeout(240000);
  const errs = watchErrors(page);
  const k = kit(page, 'cam');
  await k.newGame();
  await k.sh('a-start');
  await page.evaluate(SAMPLER);
  const W = page.viewportSize()!.width, H = page.viewportSize()!.height;
  await page.mouse.click(W * 0.7, H * 0.75);
  await page.waitForTimeout(2800);
  const s1: any[] = await page.evaluate(`window.__samp`);
  const mov = s1.filter((f, i) => i > 0 && (Math.abs(f.ax - s1[i - 1].ax) + Math.abs(f.ay - s1[i - 1].ay)) > 0.3);
  const off = mov.map((f) => Math.hypot(f.sx - W / 2, f.sy - H / 2));
  k.note(`walk frames ${mov.length}, max offset of avatar from screen centre ${Math.max(0, ...off).toFixed(1)} px, avg ${(off.reduce((a, b) => a + b, 0) / Math.max(1, off.length)).toFixed(1)}`);
  await k.sh('b-after-walk');
  await page.evaluate(`window.__samp = []`);
  const c0: any = await page.evaluate(`({x:window.__ph.st.shown.x,y:window.__ph.st.shown.y})`);
  await page.mouse.move(W * 0.5, H * 0.5); await page.mouse.down(); await page.mouse.move(W * 0.5 + 120, H * 0.5 + 60, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(300);
  const c1: any = await page.evaluate(`({x:window.__ph.st.shown.x,y:window.__ph.st.shown.y})`);
  k.note(`still drag pan: camera moved ${(c1.x - c0.x).toFixed(1)}, ${(c1.y - c0.y).toFixed(1)} (expect nonzero)`);
  await k.sh('c-panned');
  await page.evaluate(`window.__samp = []`);
  await page.mouse.click(W * 0.3, H * 0.6);
  await page.waitForTimeout(2200);
  const s2: any[] = await page.evaluate(`window.__samp`);
  let worst = 0; for (let i = 1; i < s2.length; i++) worst = Math.max(worst, Math.hypot(s2[i].cx - s2[i - 1].cx, s2[i].cy - s2[i - 1].cy));
  const settle = s2.find((f) => Math.hypot(f.sx - W / 2, f.sy - H / 2) < 1.5);
  k.note(`ease back: worst camera step per frame ${worst.toFixed(1)} world px, first frame centred at ${settle ? Math.round(settle.t - s2[0].t) : 'never'} ms`);
  await k.sh('d-eased');
  await page.mouse.click(W * 0.8, H * 0.7); await page.waitForTimeout(250);
  await page.evaluate(`window.__samp = []`);
  await page.mouse.move(W * 0.5, H * 0.5); await page.mouse.down(); await page.mouse.move(W * 0.5 - 100, H * 0.5, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(600);
  const s3: any[] = await page.evaluate(`window.__samp`);
  const mv = s3.filter((f, i) => i > 0 && Math.abs(f.ax - s3[i - 1].ax) + Math.abs(f.ay - s3[i - 1].ay) > 0.3);
  k.note(`drag while walking: ${mv.length} moving frames, max centre offset ${Math.max(0, ...mv.map((f) => Math.hypot(f.sx - W / 2, f.sy - H / 2))).toFixed(1)} px`);
  await page.evaluate(`window.__stop = true`);
  expect(errs.list).toEqual([]);
});

test('r6kc B kitchen, cellar, build cellar at level 2', async ({ page }) => {
  test.setTimeout(300000);
  const errs = watchErrors(page);
  const k = kit(page, 'rooms');
  await k.newGame();
  const w0 = await k.where();
  const kd = doorSpot(w0, 'tavern_to_kitchen')!;
  const cd = doorSpot(w0, 'tavern_to_cellar')!;
  k.note('tavern door spots kitchen ' + JSON.stringify(kd) + ' cellar ' + JSON.stringify(cd));
  await k.clickWorld(cd.x, cd.y); await page.waitForTimeout(2500);
  const w1 = await k.where(); k.note('tap cellar door at level 1 (no cellar): room ' + w1.kind); await k.sh('a-cellar-door-l1');
  await k.clickWorld(kd.x, kd.y); await page.waitForTimeout(3500);
  const w2 = await k.where(); k.note('tap kitchen door: room ' + w2.kind + ' ' + JSON.stringify(w2)); await k.sh('b-kitchen');
  await page.waitForTimeout(2000); await k.sh('b2-kitchen-settled');
  for (const t of ['stove', 'brewing_barrel']) {
    const it = w2.items.find((i: string) => i.startsWith(t + '@'));
    if (!it) { k.note(`kitchen has no ${t}`); continue; }
    const [x, y] = it.split('@')[1].split(',').map(Number);
    await k.clickWorld(x, y - 16); await page.waitForTimeout(2500); await k.sh(`c-${t}-panel`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  }
  const bd = doorSpot(w2, 'kitchen_to_tavern');
  k.note('kitchen_to_tavern spot ' + JSON.stringify(bd));
  if (bd) { await k.clickWorld(bd.x, bd.y); await page.waitForTimeout(3500); const w3 = await k.where(); k.note('back: room ' + w3.kind); await k.sh('d-back-tavern'); }
  await k.patchAndContinue((s) => { s.player.level = 2; s.player.xp = Math.max(s.player.xp, 200); s.player.wallet.gold = 800; });
  const w4 = await k.where(); k.note('after continue ' + w4.kind + ' lvl ' + (await k.state()).player.level);
  await k.sh('e-before-room-panel');
  const more = page.locator('button.more-btn');
  if (await more.isVisible().catch(() => false)) await more.dispatchEvent('click');
  await page.waitForTimeout(400); await k.sh('e2-side');
  const titles = await page.locator('button[title]').evaluateAll((bs) => bs.map((b) => b.getAttribute('title')));
  k.note('buttons: ' + JSON.stringify(titles));
  expect(errs.list).toEqual([]);
});
