// TEMPORARY contact sheet for A15 (deleted after the screenshot).
import { Application, Container } from 'pixi.js';
import { generateFloor, generateMine, PALETTE } from '@pixel-hotel/shared';
import { drawBlocks, drawChest, drawEnemy, drawExit, drawRock } from './dungeon/dungeonArt.ts';

const params = new URLSearchParams(location.search);
const Z = Number(params.get('z') ?? 3);
const app = new Application();
await app.init({ width: 1400, height: 900, background: PALETTE[25], antialias: false, roundPixels: true, resolution: 1 });
document.body.appendChild(app.canvas);
const root = new Container();
root.scale.set(Z);
app.stage.addChild(root);
const plan = generateFloor(12345, 2, 2);
const map = plan.map;
const cx = Math.floor(map.spawn.x / 32), cy = Math.floor(map.spawn.y / 32);
const blocks = drawBlocks(map, 'crypt', 0);
const view = new Container();
view.addChild(blocks);
view.x = -(cx - 6) * 32; view.y = -(cy - 3) * 32;
const mask = new Container();
root.addChild(view);
const props = new Container();
root.addChild(props);
let x = 8;
const row = (y: number): number => y;
void mask; void row;
const enemies: Array<[any, boolean, number]> = [['slime', false, 0], ['slime', false, 1], ['skeleton', false, 0], ['bat', false, 0], ['bat', false, 1], ['bone_king', false, 0], ['slime', true, 0]];
for (const [k, m, ph] of enemies) { const e = drawEnemy(k, m, false, ph); e.position.set(x + 16, 250 / Z * 1 + 0); e.y = 292; props.addChild(e); x += 56; }
const ch = [drawChest('wooden', 0), drawChest('wooden', 1), drawChest('golden', 0), drawChest('golden', 1)];
ch.forEach((c, i) => { c.position.set(x + i * 40 + 10, 292); props.addChild(c); });
const ex = drawExit(0); ex.position.set(x + 190, 292); props.addChild(ex);
const rk = drawRock('copper', 3); rk.position.set(x + 240, 292); props.addChild(rk);
props.y = 0; props.x = 0;
if (Z >= 3) { view.y += 0; }
(window as any).__ready = true;
