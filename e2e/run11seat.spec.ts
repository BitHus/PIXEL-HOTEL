// TESTER RUN 11 seating: puts a long table, a table, chairs on every side, a bench, a sofa and bar stools in the tavern,
// sits the player on each seat and shoots it close up. Shots r11-shots/seat-*. Config e2e/run11live.config.ts (matches run11).
import { test } from '@playwright/test';
import * as fs from 'fs';
import { kit } from './run6kit';
import { watchErrors } from './helpers';

fs.mkdirSync('r11-shots', { recursive: true });

test('r11 seating', async ({ page }) => {
  test.setTimeout(480000);
  const errs = watchErrors(page); const k = kit(page, 'r11seat');
  await page.goto('/?e2e'); await page.waitForTimeout(1500);
  await k.newGame();
  const base = await k.state();
  const room = base.rooms.find((r: any) => r.kind === 'shop');
  const owner = base.items[0].ownerId;
  let uid = Math.max(...base.items.map((i: any) => i.uid)) + 1;
  const C = (col: number) => col * 32; // left edge
  const add: any[] = [];
  const mk = (typeId: string, x: number, y: number, facing: string) => { add.push({ uid: uid++, typeId, ownerId: owner, roomId: room.id, x, y, facing, onItemUid: null }); };
  // long table (4 x 1) cols 5-8 row 3
  mk('long_table', C(5) + 64, C(4), 'down');
  mk('chair', C(4) + 16, C(4), 'right'); mk('chair', C(9) + 16, C(4), 'left');
  mk('chair', C(6) + 16, C(3), 'down'); mk('chair', C(7) + 16, C(5), 'up');
  mk('bar_stool', C(8) + 16, C(5), 'up'); mk('bar_stool', C(5) + 16, C(3), 'down');
  // table (2 x 1) cols 6-7 row 8? use row 6 + bench below, sofa left
  mk('table', C(6) + 32, C(7), 'down');
  mk('bench', C(6) + 32, C(8), 'up');
  mk('sofa', C(1) + 48, C(4), 'down');
  // bar stools at the counter front (counter cols 2-4 row 7)
  mk('bar_stool', C(2) + 16, C(9), 'up'); mk('bar_stool', C(3) + 16, C(9), 'up');
  await k.patchAndContinue((s) => { s.items.push(...add); });
  await page.waitForTimeout(500);
  await k.ph(`h.setCamera({x:0,y:0,zoom:2},true); return 1`); await page.waitForTimeout(400);
  await page.screenshot({ path: 'r11-shots/seat-00-layout.png' });
  const items = await k.ph<any>(`return h.st.items.filter(i=>i.roomId===${room.id}).map(i=>({uid:i.uid,t:i.typeId,x:i.x,y:i.y,f:i.facing}))`);
  k.note('items ' + JSON.stringify(items));
  const seats = items.filter((i: any) => /^(chair|bar_stool|bench|sofa)$/.test(i.t) && i.uid >= add[0].uid - 0);
  await page.mouse.click(220, 159); await page.waitForTimeout(400);
  for (const it of seats) {
    await page.keyboard.press('Escape');
    await k.ph(`h.setCamera({x:${it.x}-333,y:${it.y}-233,zoom:1.5},true); return 1`); await page.waitForTimeout(300);
    const sp = await k.toScreen(it.x, it.y - 12); await page.mouse.click(sp.x, sp.y);
    await page.waitForTimeout(6500);
    await k.ph(`h.setCamera({x:${it.x}-125,y:${it.y}-90,zoom:4},true); return 1`); await page.waitForTimeout(400);
    const av = await k.ph<any>(`const a=h.st.avatar; return {x:Math.round(a.x),y:Math.round(a.y),f:a.facing,zoom:h.st.shown.zoom}`);
    k.note(`sit ${it.t} uid${it.uid} item(${it.x},${it.y},${it.f}) -> avatar ${JSON.stringify(av)}`);
    await page.screenshot({ path: `r11-shots/seat-${it.t}-${it.uid}-${it.f}.png` });
  }
  k.note('errors ' + JSON.stringify(errs.list));
});
