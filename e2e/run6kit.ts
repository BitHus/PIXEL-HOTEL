// TESTER RUN 6 kitchen, cellar, camera lock, auto-collect, guests, markers. Notes + shots to r6kc-shots/.
import { type Page } from '@playwright/test';
import * as fs from 'fs';
import { saveState, watchErrors } from './helpers';

const OUT = 'r6kc-shots';
fs.mkdirSync(OUT, { recursive: true });
const DOORS = JSON.parse(fs.readFileSync('shared/data/innDoors.json', 'utf8'));
export const doorSpot = (r: any, id: string): any => {
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
