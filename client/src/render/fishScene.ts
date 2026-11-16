// FISH SCENE (ART-2, artist): two small DOM pieces for the fishing UI, no rules. Styles: ui/fishingUi.css.
//
//  createFishScene()   a water strip (3 depth bands, drifting waves, ring ripples) with the bobber on it.
//    scene.el                the element (.fx-scene); put it in the fishing panel
//    scene.setState('wait' | 'nibble' | 'bite')   bobber float / small nibbles (dips of 1-3 px) / the hook (big dip, "!" and fast rings)
//    scene.setBobberX(0..1)  where the bobber sits along the strip
//    scene.swimFish(fishId | colors, xFrac, facing, speed01)   shows a fish swimming under the bobber (optional)
//    scene.hideFish()
//
//  catchPopup(parent, { name, rank, cm?, colors, ms? })   a framed card: the fish at 4x, "CAUGHT!", the name in its
//    rank colour, the size; it pops in (260 ms, stepped) and floats away after `ms` (default 1800).

import type { Rank } from '@pixel-hotel/shared';
import { createFishSprite, type FishSprite } from './fishSprite.ts';

export type BobberState = 'wait' | 'nibble' | 'bite';

export interface FishScene {
  readonly el: HTMLElement;
  setState(s: BobberState): void;
  setBobberX(frac: number): void;
  swimFish(colors: readonly string[], xFrac: number, facing: 'left' | 'right', speed: number): void;
  hideFish(): void;
}

const div = (cls: string): HTMLElement => {
  const d = document.createElement('div');
  d.className = cls;
  return d;
};

export function createFishScene(): FishScene {
  const el = div('fx-scene');
  el.dataset.state = 'wait';
  const w1 = div('fx-wave w1');
  const w2 = div('fx-wave w2');
  const ring1 = div('fx-ring');
  const ring2 = div('fx-ring r2');
  const bobber = div('fx-bobber');
  bobber.dataset.state = 'wait';
  const bang = div('fx-bang');
  el.append(w1, w2, ring1, ring2, bobber, bang);
  let fish: FishSprite | null = null;

  const setX = (frac: number): void => {
    const p = `${Math.round(Math.max(0.04, Math.min(0.96, frac)) * 1000) / 10}%`;
    for (const e of [bobber, ring1, ring2, bang]) e.style.left = p;
  };
  setX(0.5);

  return {
    el,
    setState(s) {
      el.dataset.state = s;
      bobber.dataset.state = s;
    },
    setBobberX: setX,
    swimFish(colors, xFrac, facing, speed) {
      if (!fish) {
        fish = createFishSprite(colors);
        fish.el.style.top = '44px';
        el.insertBefore(fish.el, bobber);
      }
      fish.paint(colors[0] ?? 'orange', colors[1] ?? 'gold');
      fish.face(facing);
      fish.speed(speed);
      fish.el.hidden = false;
      fish.el.style.left = `calc(${Math.round(xFrac * 1000) / 10}% - 24px)`;
    },
    hideFish() {
      if (fish) fish.el.hidden = true;
    },
  };
}

export interface CatchInfo {
  name: string;
  rank: Rank;
  cm?: number;
  colors: readonly string[];
  ms?: number;
}

/** The catch card. Returns a function that removes it at once. */
export function catchPopup(parent: HTMLElement, info: CatchInfo): () => void {
  const card = div('frame fx-catch');
  card.dataset.rank = info.rank;
  const fish = createFishSprite(info.colors);
  fish.face('right');
  fish.speed(0.4);
  const title = div('fx-catch-title');
  title.textContent = 'CAUGHT!';
  const name = div(`fx-catch-name rank-name rank-${info.rank}`);
  name.textContent = info.name;
  card.append(fish.el, title, name);
  if (info.cm !== undefined) {
    const size = div('fx-catch-size');
    size.textContent = `${info.cm} cm`;
    card.appendChild(size);
  }
  parent.appendChild(card);
  const remove = (): void => card.remove();
  window.setTimeout(() => {
    card.classList.add('out');
    window.setTimeout(remove, 260);
  }, info.ms ?? 1800);
  return remove;
}
