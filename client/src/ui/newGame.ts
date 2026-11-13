// A new game (step 7b): character creation, then the room shapes, full screen in the UI style.
// 1) The character: the avatar large in the middle, turning slowly (down, right, up, left), the
//    look pickers and a display name (DISPLAY_NAME_MAX letters, digits and spaces; no real names
//    asked).
// 2) The hotel room shape, then the shop shape: cards with a small top-down preview of each.
// Resolves with the choice; the GameAPI checks it again (createPlayer).

import {
  DISPLAY_NAME_MAX,
  START_LOOK,
  borderRects,
  cleanDisplayName,
  createRoom,
  doorRect,
  floorRects,
  roomBoundsRect,
  shapesFor,
  wallBands,
  type AvatarLook,
  type NewPlayerChoice,
  type RoomKind,
  type RoomShape,
} from '@pixel-hotel/shared';
import { drawAvatarOnCanvas, type Facing3 } from '../render/avatarParts.ts';
import { BARE_FLOOR_BASE, BARE_WALL_COLOR, BORDER_COLOR } from '../render/bareStyles.ts';
import { el, textButton } from './dom.ts';
import { createLookPickers } from './lookPickers.ts';

/** The preview turns to the next facing this often, ms. */
const TURN_MS = 900;
const TURNS: (Facing3 | 'left')[] = ['down', 'right', 'up', 'left'];

/** A turning avatar preview on a canvas (scale canvas px per art px). */
export function createAvatarPreview(scale: number): { el: HTMLCanvasElement; setLook(look: AvatarLook): void; stop(): void } {
  const canvas = el('canvas', 'avatar-preview');
  let look: AvatarLook = { ...START_LOOK };
  let k = 0;
  const draw = (): void => drawAvatarOnCanvas(canvas, look, TURNS[k % TURNS.length]!, scale);
  const timer = window.setInterval(() => {
    k++;
    draw();
  }, TURN_MS);
  draw();
  return {
    el: canvas,
    setLook(next) {
      look = next;
      draw();
    },
    stop: () => window.clearInterval(timer),
  };
}

/** A small top-down picture of a room shape (level 1): floor, back walls, borders and the door. */
export function shapePreview(shape: RoomShape, kind: RoomKind, maxW: number, maxH: number): HTMLCanvasElement {
  const room = createRoom(0, kind, 1, 0, shape.id);
  const b = roomBoundsRect(room);
  const s = Math.min(maxW / b.w, maxH / b.h);
  const canvas = el('canvas', 'shape-preview');
  canvas.width = Math.round(b.w * s);
  canvas.height = Math.round(b.h * s);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const fill = (r: { x: number; y: number; w: number; h: number }, c: string): void => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round((r.x - b.x) * s), Math.round((r.y - b.y) * s), Math.ceil(r.w * s), Math.ceil(r.h * s));
    };
    for (const r of floorRects(room)) fill(r, BARE_FLOOR_BASE);
    fill(doorRect(room), BARE_FLOOR_BASE);
    for (const r of wallBands(room)) fill(r, BARE_WALL_COLOR);
    for (const r of borderRects(room)) fill(r, BORDER_COLOR);
  }
  return canvas;
}

function screen(parent: HTMLElement): HTMLElement {
  const s = el('div', 'newgame');
  parent.appendChild(s);
  return s;
}

/** Character creation. Resolves with the name and look. */
function makeCharacter(parent: HTMLElement): Promise<{ name: string; look: AvatarLook }> {
  return new Promise((resolve) => {
    const s = screen(parent);
    const frame = el('div', 'frame newgame-frame');
    let look: AvatarLook = { ...START_LOOK };
    const preview = createAvatarPreview(4);
    const pickers = createLookPickers((next) => {
      look = next;
      preview.setLook(next);
    });
    pickers.setLook(look);
    const name = el('input', 'chat-input name-input');
    name.maxLength = DISPLAY_NAME_MAX;
    name.placeholder = 'Your name in the game';
    name.autocomplete = 'off';
    name.setAttribute('aria-label', 'Display name');
    const problem = el('div', 'panel-info newgame-problem');
    const done = textButton('Next', () => {
      const clean = cleanDisplayName(name.value);
      if (!clean) {
        problem.textContent = `Pick a name: up to ${DISPLAY_NAME_MAX} letters, digits and spaces.`;
        name.focus();
        return;
      }
      preview.stop();
      s.remove();
      resolve({ name: clean, look });
    }, 'newgame-next');
    name.addEventListener('keydown', (e) => e.key === 'Enter' && done.click());
    const left = el('div', 'newgame-avatar');
    const stage = el('div', 'avatar-stage');
    stage.appendChild(preview.el);
    left.append(stage, name, problem);
    const right = el('div', 'newgame-pickers');
    right.appendChild(pickers.el);
    const body = el('div', 'newgame-body');
    body.append(left, right);
    frame.append(el('h2', 'panel-title', 'Make your character'), body, done);
    s.appendChild(frame);
  });
}

/** Picks one shape for a room kind from preview cards. */
function pickShape(parent: HTMLElement, kind: RoomKind, title: string, button: string): Promise<string> {
  return new Promise((resolve) => {
    const s = screen(parent);
    const frame = el('div', 'frame newgame-frame');
    const grid = el('div', 'shape-grid');
    const shapes = shapesFor(kind).filter((x) => kind === 'hotel' || x.shopStart);
    let chosen = shapes[0]?.id ?? '';
    const cards = shapes.map((shape) => {
      const card = el('button', 'shape-card');
      card.type = 'button';
      card.append(shapePreview(shape, kind, 140, 104), el('span', 'shape-name', shape.name));
      card.addEventListener('click', () => {
        chosen = shape.id;
        for (const [id, c] of cards) c.classList.toggle('selected', id === chosen);
      });
      grid.appendChild(card);
      return [shape.id, card] as const;
    });
    for (const [id, c] of cards) c.classList.toggle('selected', id === chosen);
    const next = textButton(button, () => {
      s.remove();
      resolve(chosen);
    }, 'newgame-next');
    frame.append(el('h2', 'panel-title', title), el('div', 'panel-info', 'You can grow it later with room upgrades.'), grid, next);
    s.appendChild(frame);
  });
}

/** The whole new-game setup: character, then the hotel shape, then the shop shape. */
export async function runNewGameSetup(parent: HTMLElement): Promise<NewPlayerChoice> {
  const { name, look } = await makeCharacter(parent);
  const hotelShape = await pickShape(parent, 'hotel', 'Pick your hotel room', 'Next');
  const shopShape = await pickShape(parent, 'shop', 'Pick your shop', 'Open my shop');
  return { name, look, hotelShape, shopShape };
}
