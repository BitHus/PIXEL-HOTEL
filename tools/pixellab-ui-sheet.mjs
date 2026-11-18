// Usage: node tools/pixellab-ui-sheet.mjs <out.png>  -> contact sheet (4x nearest) of art-src/pixellab/ui on a dark backdrop,
// with a mock panel built by 9-slice (NINE below = the insets the ui worker should use).
import fs from 'fs'; import { PNG } from 'pngjs';
const d = 'art-src/pixellab/ui/'; const L = (n) => PNG.sync.read(fs.readFileSync(d + n + '.png'));
const FX = Number(process.env.FX||0), FY = Number(process.env.FY||0);
export const NINE = { panel_dark: 16, panel_parchment: 20 };
const W = 382, H = 312, S = 4; const cv = new PNG({ width: W, height: H });
for (let i = 0; i < W * H; i++) { cv.data[i * 4] = 0x26; cv.data[i * 4 + 1] = 0x2b; cv.data[i * 4 + 2] = 0x44; cv.data[i * 4 + 3] = 255; }
const blit = (s, x0, y0, sx = 0, sy = 0, w = s.width, h = s.height, dx = w, dy = h) => { // nearest stretch of src rect into dest rect
  for (let y = 0; y < dy; y++) for (let x = 0; x < dx; x++) { const px = sx + Math.min(w - 1, Math.floor(x * w / dx)), py = sy + Math.min(h - 1, Math.floor(y * h / dy)); const i = (py * s.width + px) * 4; if (s.data[i + 3] < 128) continue; const X = x0 + x, Y = y0 + y; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; s.data.copy(cv.data, (Y * W + X) * 4, i, i + 4); }
};
const nine = (s, x0, y0, w, h, b) => { const sw = s.width, sh = s.height;
  for (const [sx, dxs, sw2, dw] of [[0, 0, b, b], [b, b, sw - 2 * b, w - 2 * b], [sw - b, w - b, b, b]]) for (const [sy, dys, sh2, dh] of [[0, 0, b, b], [b, b, sh - 2 * b, h - 2 * b], [sh - b, h - b, b, b]]) blit(s, x0 + dxs, y0 + dys, sx, sy, sw2, sh2, dw, dh); };
nine(L('panel_dark'), 6, 6, 214, 130, NINE.panel_dark);
nine(L('panel_parchment'), 228, 6, 126, 130, NINE.panel_parchment);
blit(L('tab_active'), 22, 20); blit(L('tab_inactive'), 114, 20);
blit(L('btn_pill'), 22, 64); blit(L('btn_pill_pressed'), 22 + 106, 64 + 1);
blit(L('btn_pill_disabled'), 22, 100);
blit(L('btn_pill'), 244, 60); blit(L('btn_pill_disabled'), 244, 100);
blit(L('btn_round'), 6, 146); blit(L('btn_round_pressed'), 76, 146); blit(L('btn_round_disabled'), 146, 146);
blit(L('sign_open_s'), 218, 146); blit(L('sign_closed_s'), 218 + 82, 146);
blit(L('bar_frame'), 6, 216); const f = L('bar_fill'); blit(f, 6 + FX, 216 + FY, 0, 0, f.width, f.height, Math.floor(f.width * 0.62), f.height);
blit(L('bar_frame'), 6, 244);
const ic = ['icon_coin', 'icon_gem', 'icon_book', 'icon_hammer', 'icon_swords', 'icon_more', 'icon_bag', 'icon_close', 'icon_plus', 'icon_minus'];
ic.forEach((n, i) => blit(L(n + '_s'), 6 + i * 34, 274));
const o = new PNG({ width: W * S, height: H * S });
for (let y = 0; y < H * S; y++) for (let x = 0; x < W * S; x++) cv.data.copy(o.data, (y * W * S + x) * 4, (Math.floor(y / S) * W + Math.floor(x / S)) * 4, (Math.floor(y / S) * W + Math.floor(x / S)) * 4 + 4);
fs.mkdirSync(process.argv[2].replace(/[\\/][^\\/]*$/, ''), { recursive: true }); fs.writeFileSync(process.argv[2], PNG.sync.write(o)); console.log('wrote', process.argv[2]);
