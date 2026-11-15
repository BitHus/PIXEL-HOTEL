// Inn doors (step MB-2/MB-3, stub B1): code-drawn doorways in the back wall band. Three looks keyed by the door id prefix:
// 'suite' = wood door with a small star, 'tavern' = oak double door with a warm glow, 'garden' = arched gate with leaves.
// Rendering only. Palette from shared/palette.ts. door.x = centre of the doorway, door.y = the foot of the back wall band
// (world px), door.w = 64. Unknown ids get the suite look. The returned Container is added to `layer`; its children
// 'glow' (warm arrival light, hidden until arrivalLight() is called) can be driven every frame.

import { Container, Graphics } from 'pixi.js';
import { PALETTE } from '@pixel-hotel/shared';

export type InnDoor = { id: string; x: number; y: number; w: number };
export type InnDoorLook = 'suite' | 'tavern' | 'garden';

const H = 52; // door height in art px (the band is 64 px tall)
const OUT = PALETTE[6]; // dark warm outline

export function innDoorLook(id: string): InnDoorLook {
  if (id.startsWith('tavern') || id.startsWith('shop')) return 'tavern';
  if (id.startsWith('garden') || id.startsWith('farm')) return 'garden';
  return 'suite';
}

function frame(g: Graphics, w: number, fill: string, hi: string, topRound: boolean): void {
  // outline, then body; light from the top-left (left and top edge lighter)
  g.rect(-w / 2 - 2, -H - 2, w + 4, H + 2).fill(OUT);
  g.rect(-w / 2, -H, w, H).fill(fill);
  g.rect(-w / 2, -H, w, 2).fill(hi);
  g.rect(-w / 2, -H, 2, H).fill(hi);
  if (topRound) {
    // cut the two top corners into an arch
    for (let i = 0; i < 6; i++) {
      g.rect(-w / 2 - 2, -H - 2 + i, 6 - i, 1).fill(PALETTE[5]);
      g.rect(w / 2 - 4 + i, -H - 2 + i, 6 - i, 1).fill(PALETTE[5]);
    }
  }
}

function drawSuite(g: Graphics, w: number): void {
  frame(g, w, PALETTE[4], PALETTE[3], false);
  for (const x of [-w / 4, w / 4]) g.rect(x - 1, -H + 2, 1, H - 2).fill(PALETTE[5]); // plank seams
  g.rect(-w / 2 + 6, -H + 6, w - 12, H - 14).fill(PALETTE[5]).rect(-w / 2 + 8, -H + 8, w - 16, H - 18).fill(PALETTE[4]);
  // small star: plus with a bright centre
  const sy = -H + 18;
  g.rect(-1, sy - 4, 3, 9).fill(PALETTE[10]).rect(-4, sy - 1, 9, 3).fill(PALETTE[10]).rect(0, sy, 1, 1).fill(PALETTE[11]);
  g.rect(w / 2 - 12, -H / 2 + 6, 3, 3).fill(PALETTE[10]); // knob
}

function drawTavern(g: Graphics, w: number): void {
  frame(g, w, PALETTE[5], PALETTE[4], false);
  g.rect(-1, -H, 2, H).fill(OUT); // centre gap
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -w / 2 + 3 : 3;
    g.rect(x0, -H + 4, w / 2 - 6, 3).fill(PALETTE[6]); // iron straps
    g.rect(x0, -H / 2 + 2, w / 2 - 6, 3).fill(PALETTE[6]);
    g.rect(x0 + 2, -H + 12, w / 2 - 10, H - 20).fill(PALETTE[4]).rect(x0 + 2, -H + 12, w / 2 - 10, 2).fill(PALETTE[3]);
    g.rect(s < 0 ? -6 : 3, -H / 2 - 2, 3, 3).fill(PALETTE[10]); // handles
  }
  // warm glow from a lantern above
  g.rect(-3, -H - 8, 7, 6).fill(PALETTE[9]).rect(-2, -H - 7, 5, 4).fill(PALETTE[11]).rect(0, -H - 10, 1, 2).fill(OUT);
}

function drawGarden(g: Graphics, w: number): void {
  frame(g, w, PALETTE[13], PALETTE[12], true);
  g.rect(-w / 2 + 6, -H + 8, w - 12, H - 8).fill(PALETTE[14]); // dark opening of green
  for (let x = -w / 2 + 8; x < w / 2 - 6; x += 6) g.rect(x, -H + 8, 2, H - 8).fill(PALETTE[13]); // slats
  // leaves climbing the left side and over the top
  const leaves: [number, number][] = [[-w / 2 - 1, -10], [-w / 2 + 2, -22], [-w / 2 - 1, -34], [-w / 2 + 6, -H - 1], [-8, -H - 3], [6, -H], [w / 2 - 3, -26]];
  for (const [x, y] of leaves) g.rect(x, y, 5, 4).fill(PALETTE[12]).rect(x + 1, y + 3, 3, 1).fill(PALETTE[14]);
  g.rect(w / 2 - 14, -H / 2, 3, 3).fill(PALETTE[11]); // latch
}

export function drawInnDoor(layer: Container, door: InnDoor): Container {
  const c = new Container();
  c.label = `inn-door:${door.id}`;
  c.eventMode = 'none';
  c.position.set(door.x, door.y);
  // arrival light: a warm soft block on the floor in front of the door, hidden until used
  const glow = new Graphics();
  glow.label = 'glow';
  glow.rect(-door.w / 2, 0, door.w, 12).fill(PALETTE[11]).rect(-door.w / 2 + 8, 12, door.w - 16, 6).fill(PALETTE[11]);
  glow.alpha = 0;
  const body = new Graphics();
  const look = innDoorLook(door.id);
  if (look === 'tavern') drawTavern(body, door.w);
  else if (look === 'garden') drawGarden(body, door.w);
  else drawSuite(body, door.w);
  c.addChild(body, glow);
  layer.addChild(c);
  return c;
}

/** Warm arrival light: t = 0..1 over the arrival; fades from 0.5 to 0 (stepwise, 4 levels, no smooth blur). */
export function arrivalLight(door: Container, t: number): void {
  const glow = door.getChildByLabel('glow');
  if (!glow) return;
  const clamped = Math.max(0, Math.min(1, t));
  glow.alpha = Math.round((1 - clamped) * 4) / 8;
}
