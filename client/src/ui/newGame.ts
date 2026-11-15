// A new game (step 7b): character creation, then the room shapes, full screen in the UI style.
// 1) The character: the avatar large in the middle, turning slowly (down, right, up, left), the
//    look pickers and a display name (DISPLAY_NAME_MAX letters, digits and spaces; no real names
//    asked).
// 2) The hotel room shape, then the shop shape: cards with a small top-down preview of each.
// Resolves with the choice; the GameAPI checks it again (createPlayer).

import {
  DEFAULT_INN_NAME,
  DISPLAY_NAME_MAX,
  LOOK_COLORS,
  START_LOOK,
  borderRects,
  cleanDisplayName,
  cleanInnName,
  createRoom,
  doorRect,
  floorRects,
  roomBoundsRect,
  selectableClothing,
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
export function createAvatarPreview(scale: number): { el: HTMLCanvasElement; setLook(look: AvatarLook): void; turn(d: number): void; stop(): void } {
  const canvas = el('canvas', 'avatar-preview');
  let look: AvatarLook = { ...START_LOOK };
  let k = 0;
  const draw = (): void => drawAvatarOnCanvas(canvas, look, TURNS[k % TURNS.length]!, scale);
  // A manual turn (the arrows under the preview) pauses the slow auto-turn for a while.
  let pausedUntil = 0;
  const timer = window.setInterval(() => {
    if (Date.now() < pausedUntil) return;
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
    turn(d) {
      k = (k + d + TURNS.length * 4) % TURNS.length;
      pausedUntil = Date.now() + 4000;
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

/** A random look from the free choices (UI only: the pick is validated again by createPlayer). */
function randomLook(base: AvatarLook): AvatarLook {
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]!;
  const style = (slot: 'hair' | 'top' | 'bottoms'): string => pick(selectableClothing(slot)).id;
  return {
    ...base,
    skin: pick(LOOK_COLORS.skin),
    hair: pick(LOOK_COLORS.hair),
    shirt: pick(LOOK_COLORS.top),
    legs: pick(LOOK_COLORS.bottoms),
    shoes: pick(LOOK_COLORS.shoes),
    hairStyle: style('hair'),
    top: style('top'),
    bottoms: style('bottoms'),
  };
}

/**
 * Character creation. Resolves with the name and look. Layout (docs/UI-REFERENCE.md): the avatar
 * preview always in view (phone: fixed at the top, about 35% of the screen height; desktop: on the
 * left), turning slowly and updated the moment a choice is tapped; under it (desktop: on the right)
 * the name, the tabs (Body, Hair, Top, Bottoms, Shoes) with one tab's pickers, and Done, always
 * visible at the bottom.
 */
function makeCharacter(parent: HTMLElement): Promise<{ name: string; innName: string; look: AvatarLook }> {
  return new Promise((resolve) => {
    const s = el('div', 'charmaker');
    parent.appendChild(s);
    let look: AvatarLook = { ...START_LOOK };
    const preview = createAvatarPreview(4);
    const pickers = createLookPickers((next) => {
      look = next;
      preview.setLook(next);
    });
    pickers.setLook(look);
    const name = el('input', 'chat-input name-input');
    name.maxLength = DISPLAY_NAME_MAX;
    name.placeholder = 'Your name';
    name.autocomplete = 'off';
    name.setAttribute('aria-label', 'Display name');
    // MB-1: the Inn's name, the same character rules; left empty it becomes the default.
    const inn = el('input', 'chat-input name-input inn-name-input');
    inn.maxLength = DISPLAY_NAME_MAX;
    inn.placeholder = DEFAULT_INN_NAME;
    inn.autocomplete = 'off';
    inn.setAttribute('aria-label', 'Inn name');
    const problem = el('div', 'panel-info newgame-problem');
    const done = textButton('Begin your story', () => {
      const clean = cleanDisplayName(name.value);
      if (!clean) {
        problem.textContent = `Pick a name: up to ${DISPLAY_NAME_MAX} letters, digits and spaces.`;
        name.focus();
        return;
      }
      const innClean = cleanInnName(inn.value);
      if (!innClean) {
        problem.textContent = `Pick an Inn name: up to ${DISPLAY_NAME_MAX} letters, digits and spaces.`;
        inn.focus();
        return;
      }
      preview.stop();
      s.remove();
      resolve({ name: clean, innName: innClean, look });
    }, 'newgame-next primary');
    name.addEventListener('keydown', (e) => e.key === 'Enter' && done.click());
    inn.addEventListener('keydown', (e) => e.key === 'Enter' && done.click());
    const stage = el('div', 'charmaker-stage');
    // The stage: a candle-lit tavern corner (CSS, skin.css) with the avatar on a rug, turn arrows and a dice.
    const turnLeft = textButton('◀', () => preview.turn(-1), 'turn-btn small');
    turnLeft.setAttribute('aria-label', 'Turn left');
    const turnRight = textButton('▶', () => preview.turn(1), 'turn-btn small');
    turnRight.setAttribute('aria-label', 'Turn right');
    const dice = textButton('Surprise me', () => {
      look = randomLook(look);
      pickers.setLook(look);
      preview.setLook(look);
    }, 'dice-btn small');
    const controls = el('div', 'charmaker-turn');
    controls.append(turnLeft, dice, turnRight);
    stage.append(el('h2', 'charmaker-title plate', 'Make your character'), el('div', 'stage-rug'), preview.el, controls);
    // The tabs sit on the panel's top edge, like in every panel.
    const side = el('div', 'charmaker-side');
    const panel = el('div', 'frame charmaker-panel');
    const choices = el('div', 'charmaker-choices');
    choices.append(pickers.body);
    const names = el('div', 'name-card inset');
    const field = (label: string, input: HTMLInputElement): HTMLElement => {
      const f = el('label', 'name-field');
      f.append(el('span', 'name-label', label), input);
      return f;
    };
    names.append(field('You', name), field('Your inn', inn));
    panel.append(names, problem, el('div', 'divider'), choices, done);
    side.append(pickers.tabs, panel);
    s.append(stage, side);
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
    frame.append(el('h2', 'panel-title plate', title), el('div', 'panel-info', 'You can grow it later with room upgrades.'), grid, next);
    s.appendChild(frame);
  });
}

/** The whole new-game setup: character, then the hotel shape, then the shop shape. */
export async function runNewGameSetup(parent: HTMLElement): Promise<NewPlayerChoice> {
  const { name, innName, look } = await makeCharacter(parent);
  const hotelShape = await pickShape(parent, 'hotel', 'Pick your hotel room', 'Next');
  const shopShape = await pickShape(parent, 'shop', 'Pick your tavern', 'Open my tavern');
  return { name, innName, look, hotelShape, shopShape };
}
