#!/usr/bin/env node
// Sprite viewer: shows a sprite IN CONTEXT in the real game renderer (docs/ART-WORKFLOW.md).
//   node tools/view-sprite.mjs furniture <typeId> [--facing right|up|down] [--zoom 3] [--out file.png]   (tavern, default)
//   node tools/view-sprite.mjs dungeon <propKind> --dungeon-seed N [--zoom 3] [--out file.png]
//   node tools/view-sprite.mjs prop <propKind> [--scan 40]        (finds a dungeon seed that has the prop, then shows it)
//   flags: --tavern (furniture in the tavern, default for kind furniture), --size 160x128 (crop in art px), --rebuild
// It builds a PRIVATE copy of the client into tools/out/dist-view (never the normal dist, never a dev server),
// serves it on a free port, plays a throw-away new game in headless Chromium and screenshots around the sprite.
// Output: crop, divided down to art px, scaled up by --zoom with nearest neighbour. Default tools/out/view-<kind>-<id>.png.
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = join(root, 'tools', 'out');
const dist = join(outRoot, 'dist-view');

// ---- args
const argv = process.argv.slice(2);
const pos = [];
const opt = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    if (['tavern', 'rebuild'].includes(k)) opt[k] = true;
    else opt[k] = argv[++i];
  } else pos.push(a);
}
let [kind, id] = pos;
if (!kind || !id) {
  console.error('usage: node tools/view-sprite.mjs <furniture|dungeon|prop> <id> [--dungeon-seed N | --tavern] [--facing right|up] [--zoom 3] [--out path.png]');
  process.exit(1);
}
if (kind === 'prop') kind = 'dungeon';
const zoom = Math.max(1, Math.round(Number(opt.zoom ?? 3)));
const [cropW, cropH] = String(opt.size ?? '160x128').split('x').map(Number);
const dungeonMode = kind === 'dungeon';
const seed = opt['dungeon-seed'] !== undefined ? Number(opt['dungeon-seed']) : null;
if (dungeonMode && seed === null && opt.scan === undefined) opt.scan = '40';
const out = resolve(opt.out ?? join(outRoot, `view-${kind}-${id}${opt.facing ? '-' + opt.facing : ''}.png`));
mkdirSync(dirname(out), { recursive: true });

// ---- private build (rebuilt when any source is newer than it)
function newest(dir, acc = { t: 0 }) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) newest(p, acc);
    else acc.t = Math.max(acc.t, statSync(p).mtimeMs);
  }
  return acc.t;
}
const stamp = join(dist, 'index.html');
const src = Math.max(newest(join(root, 'client', 'src')), newest(join(root, 'shared', 'src')), newest(join(root, 'shared', 'data')));
if (opt.rebuild || !existsSync(stamp) || statSync(stamp).mtimeMs < src) {
  console.log('building private copy ->', dist);
  try {
    execSync(`npx vite build --outDir "${dist}" --emptyOutDir`, { cwd: join(root, 'client'), stdio: 'pipe' });
  } catch (e) {
    console.error('build failed (another worker may be mid-edit):\n' + String(e.stdout ?? '').slice(-1500) + String(e.stderr ?? '').slice(-1500));
    process.exit(3);
  }
}

// ---- static server on a free port
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
const server = createServer((req, res) => {
  const p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let f = join(dist, p === '/' ? 'index.html' : p);
  if (!f.startsWith(dist) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (x) => errs.push(x.message));

async function newGame() {
  await page.goto(base + '?e2e');
  await page.getByText('New game').first().click();
  await page.getByLabel('Display name').fill('Viewer');
  await page.getByText('Begin your story').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Open my tavern' }).click();
  await page.waitForTimeout(800);
  await page.mouse.click(5, 300);
  await page.waitForTimeout(500);
  await page.mouse.click(5, 300);
  await page.waitForTimeout(2000);
  await page.waitForFunction(() => window.__ph, null, { timeout: 15000 });
}

/** Crops a screenshot region (CSS px) and writes it as art px * zoom. `S` = device px per art px on screen. */
async function writeCrop(cx, cy, S) {
  const w = cropW * S;
  const h = cropH * S;
  const x = Math.max(0, Math.round(cx - w / 2));
  const y = Math.max(0, Math.round(cy - h / 2));
  const cw = Math.min(w, 960 - x);
  const ch = Math.min(h, 640 - y);
  const shot = PNG.sync.read(await page.screenshot({ clip: { x, y, width: cw, height: ch } }));
  const aw = Math.floor(cw / S);
  const ah = Math.floor(ch / S);
  const png = new PNG({ width: aw * zoom, height: ah * zoom });
  for (let py = 0; py < ah * zoom; py++) {
    for (let px = 0; px < aw * zoom; px++) {
      const sx = Math.floor(px / zoom) * S + (S >> 1);
      const sy = Math.floor(py / zoom) * S + (S >> 1);
      const si = (sy * shot.width + sx) * 4;
      const di = (py * png.width + px) * 4;
      for (let k = 0; k < 4; k++) png.data[di + k] = shot.data[si + k];
    }
  }
  writeFileSync(out, PNG.sync.write(png));
  console.log(`wrote ${out} (${png.width}x${png.height}, ${aw}x${ah} art px at ${zoom}x)`);
}

let code = 0;
try {
  await newGame();
  if (!dungeonMode) {
    // Furniture in the tavern: give one, place it on the first free spot near the middle, reload, centre the camera on it.
    const r = await page.evaluate(async ({ typeId, facing }) => {
      const api = window.__ph.api;
      const tavern = api.state.rooms.find((x) => x.kind === 'shop');
      if (!tavern) return { err: 'no tavern room found' };
      api.debugGiveFurniture([typeId]);
      const inv = await api.getInventory();
      const it = (inv.furniture).filter((f) => f.typeId === typeId).pop();
      if (!it) return { err: 'item not in the bag (unknown typeId?)' };
      const cells = [];
      for (let y = 0; y < tavern.h; y += 32) for (let x = 0; x < tavern.w; x += 32) cells.push({ x: x + 16, y: y + 16 });
      const mid = { x: tavern.w / 2, y: tavern.h / 2 };
      cells.sort((a, b) => Math.hypot(a.x - mid.x, a.y - mid.y) - Math.hypot(b.x - mid.x, b.y - mid.y));
      for (const c of cells) {
        const res = await api.placeItem(it.uid, { center: c, facing: facing ?? 'down', snap: true });
        if (res) { const placed = res.find((f) => f.uid === it.uid) ?? null; return { uid: it.uid, at: placed ? { x: placed.x, y: placed.y } : c, roomId: tavern.id }; }
      }
      return { err: 'no free spot accepted the item (surface/wall pieces need a host; place by hand)' };
    }, { typeId: id, facing: opt.facing });
    if (r.err) throw new Error(r.err);
    await page.reload();
    await page.getByText('Continue').first().click({ timeout: 20000 }).catch(() => undefined);
    await page.waitForFunction(() => window.__ph, null, { timeout: 20000 });
    await page.waitForTimeout(3500);
    await page.mouse.click(5, 300); // skip intro camera
    await page.waitForTimeout(400);
    const info = await page.evaluate(({ z, at }) => {
      const ph = window.__ph;
      const cam = { x: at.x - 480 / z, y: at.y - 24 - 320 / z, zoom: z };
      ph.setCamera(cam, true);
      return cam;
    }, { z: zoom, at: r.at });
    // follow camera may pull the view back: set it again right before the shot
    await page.evaluate(({ z, at }) => window.__ph.setCamera({ x: at.x - 480 / z, y: at.y - 24 - 320 / z, zoom: z }, true), { z: zoom, at: r.at });
    await page.waitForTimeout(60);
    // zoom == device px per art px here, so the crop is already art * zoom: use S = zoom and zoom 1 resample.
    const keep = zoom;
    await writeCropDirect(r.at, info);
    void keep;
  } else {
    // Dungeon: pick the seed (rng override), enter, teleport the player next to the first matching prop, wait for the view.
    const tryOne = async (s, shoot) => {
      await page.evaluate((n) => { // rngInt(1, 2^31-1) = n
        const r = (n - 1 + 0.5) / (2 ** 31 - 1);
        const api = window.__ph.api;
        window.__realRng = api.rng;
        api.rng = () => r;
      }, s);
      await page.locator('button[title^="Dungeon"]').first().dispatchEvent('click');
      await page.getByRole('button', { name: /^Enter$/ }).click();
      await page.waitForTimeout(600);
      const found = await page.evaluate(({ k }) => {
        const api = window.__ph.api;
        api.rng = window.__realRng;
        const run = api.state.run;
        const dec = (run.map.decor ?? []).filter((d) => d.kind === k);
        const kinds = [...new Set((run.map.decor ?? []).map((d) => d.kind))];
        return { seed: run.seed, n: dec.length, kinds, first: dec[0] ?? null };
      }, { k: id });
      return found;
    };
    let found = null;
    if (seed !== null) {
      found = await tryOne(seed);
      if (!found.n) { console.error(`seed ${seed} has no "${id}". Kinds on that floor: ${found.kinds.join(', ')}`); code = 2; }
    } else {
      const max = Number(opt.scan);
      for (let s = 1; s <= max; s++) {
        found = await tryOne(s);
        if (found.n) break;
        // leave the floor so the next seed can start: reload keeps the save, drop the run
        await page.evaluate(() => { const a = window.__ph.api; a.state.run = null; });
        await page.reload();
        await page.getByText('Continue').first().click({ timeout: 20000 }).catch(() => undefined);
        await page.waitForFunction(() => window.__ph, null, { timeout: 20000 });
        await page.waitForTimeout(2500);
        await page.mouse.click(5, 300);
        await page.waitForTimeout(400);
      }
      if (!found?.n) { console.error(`no "${id}" in seeds 1..${max}. Last floor kinds: ${found?.kinds.join(', ')}`); code = 2; }
      else console.log(`found "${id}" on --dungeon-seed ${found.seed}`);
    }
    if (!code) {
      // Teleport to the nearest floor block beside the prop (kept in sync because step() reads state.run each tick).
      await page.evaluate(({ d }) => {
        const api = window.__ph.api;
        const run = api.state.run;
        const m = run.map;
        const at = (c, r) => (c >= 0 && r >= 0 && c < m.cols && r < m.rows ? m.blocks[r * m.cols + c] : 'wall');
        const cand = [[0, 1], [0, 2], [1, 1], [-1, 1], [0, -1], [1, 0], [-1, 0], [0, 3]].find(([dc, dr]) => at(d.c + dc, d.r + dr) === 'floor') ?? [0, 1];
        run.player.x = (d.c + cand[0]) * 32 + 16;
        run.player.y = (d.r + cand[1]) * 32 + 16;
        run.player.hp = run.player.maxHp = 999;
        run.enemies = [];
      }, { d: found.first });
      await page.waitForTimeout(1500);
      // The camera follows the player: the prop is at (prop - player) * 2 from the screen centre.
      const rel = await page.evaluate(({ d }) => {
        const run = window.__ph.api.state.run;
        return { dx: d.c * 32 + 16 - run.player.x, dy: d.r * 32 + 32 - run.player.y };
      }, { d: found.first });
      await writeCrop(480 + rel.dx * 2, 320 + rel.dy * 2 - 8, 2);
    }
  }
} catch (e) {
  console.error('FAILED:', e.message);
  code = 1;
}
if (errs.length) console.log('page errors:', errs.slice(0, 3).join(' | '));
await browser.close();
server.close();
process.exit(code);

/** Tavern: the camera zoom is exactly `zoom`, one art px = zoom CSS px, so the crop is the final picture. */
async function writeCropDirect(at, cam) {
  const sx = (at.x - cam.x) * zoom;
  const sy = (at.y - 24 - cam.y) * zoom;
  const w = cropW * zoom;
  const h = cropH * zoom;
  const x = Math.max(0, Math.round(sx - w / 2));
  const y = Math.max(0, Math.round(sy - h / 2));
  const clip = { x, y, width: Math.min(w, 960 - x), height: Math.min(h, 640 - y) };
  writeFileSync(out, await page.screenshot({ clip }));
  console.log(`wrote ${out} (${clip.width}x${clip.height}, tavern at ${zoom}x)`);
}
