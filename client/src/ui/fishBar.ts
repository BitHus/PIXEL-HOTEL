// The fishing bar (step 9f, docs/UI-REFERENCE.md "Lakeside"): a framed bar above the hotbar while the
// line is out. It says what the bobber is doing ("Waiting for a bite...", "Bite! Tap now!", "Keep
// the box on the fish!"). In the reel it is a Stardew-style bar: a fish icon swims back and forth
// along a track and a green catch box follows it; HOLD pushes the box to the right and it falls
// back to the left by itself. Under the track a catch bar fills while the fish is in the box (its
// border takes the colour of the fish's rank). The big Hold button, the track itself and Space
// all hold (they react on the press and the release, not on a click). ✗ stops. The bar only shows;
// the rules are in shared/src/fishing.ts and the session is run by lakeside/lakesideScreen.ts.

import { FISH_BAR, FISH_REEL_FULL, type FishPhase, type Rank } from '@pixel-hotel/shared';
import { el, textButton, typing } from './dom.ts';
import { pixelIcon } from './pixelIcons.ts';
import { setRank } from './rank.ts';

export interface FishBarHooks {
  /** The hold began (true) or ended (false): the button, the track or Space. */
  onHold(on: boolean): void;
  onStop(): void;
}

/** What the reel shows: positions in bar units (0 to FISH_BAR), the catch bar (0 to FISH_REEL_FULL). */
export interface ReelView {
  fishPos: number;
  boxPos: number;
  boxSize: number;
  fill: number;
}

export interface FishBar {
  readonly el: HTMLElement;
  /** True while the bar shows. */
  readonly shown: boolean;
  show(on: boolean): void;
  /** The bobber state: phase and the fish's rank (its colour on the catch bar), and the reel while a fish is hooked. */
  set(phase: FishPhase, rank: Rank, reel?: ReelView, feedback?: { catching: boolean; draining: boolean; tension: number }): void;
}

const TEXT: Record<FishPhase, string> = {
  wait: 'Waiting for a bite...',
  bite: 'Bite! Tap now!',
  reel: 'Keep the box on the fish!',
  done: '',
};

export function createFishBar(parent: HTMLElement, hooks: FishBarHooks): FishBar {
  const root = el('div', 'frame fish-bar');
  root.hidden = true;
  const text = el('div', 'fish-text', TEXT.wait);
  const stop = textButton('✗', () => hooks.onStop(), 'small fish-stop');
  stop.title = 'Stop fishing';
  stop.setAttribute('aria-label', 'Stop fishing');
  const head = el('div', 'fish-head');
  head.append(text, stop);

  // The track: the catch box and the fish.
  const track = el('div', 'fish-track');
  const box = el('div', 'fish-box');
  const fish = el('div', 'fish-fish');
  fish.appendChild(pixelIcon('fish'));
  track.append(box, fish);
  const meter = el('div', 'fish-meter');
  const fill = el('div', 'fish-fill');
  meter.appendChild(fill);

  // Hold: on the press and the release, so every push counts and a held finger keeps pushing.
  let holding = false;
  const hold = (on: boolean): void => {
    if (on === holding) return;
    holding = on;
    tap.classList.toggle('held', on);
    hooks.onHold(on);
  };
  const tap = el('button', 'btn fish-tap');
  tap.type = 'button';
  tap.append(pixelIcon('fish'), el('span', 'fish-tap-text', 'Hold!'));
  for (const target of [tap, track] as HTMLElement[]) {
    target.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      target.setPointerCapture?.(e.pointerId);
      hold(true);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) target.addEventListener(type, () => hold(false));
  }
  tap.addEventListener('click', (e) => e.preventDefault());
  tap.addEventListener('contextmenu', (e) => e.preventDefault());

  root.append(head, track, meter, tap);
  parent.appendChild(root);

  const keyHold = (e: KeyboardEvent, on: boolean): void => {
    if (root.hidden || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
    if (e.key === ' ') {
      if (!e.repeat) hold(on);
      e.preventDefault();
    }
  };
  window.addEventListener('keydown', (e) => {
    keyHold(e, true);
    if (!root.hidden && e.key === 'Escape' && !e.repeat) hooks.onStop();
  });
  window.addEventListener('keyup', (e) => keyHold(e, false));
  window.addEventListener('blur', () => hold(false));

  const pct = (v: number): string => `${Math.max(0, Math.min(100, (v / FISH_BAR) * 100))}%`;

  return {
    el: root,
    get shown() {
      return !root.hidden;
    },
    show(on) {
      root.hidden = !on;
      parent.classList.toggle('fishing', on);
      if (!on) hold(false);
      if (on) this.set('wait', 'common');
    },
    set(phase, rank, reel, feedback) {
      text.textContent = TEXT[phase];
      root.dataset.phase = phase;
      const inReel = phase === 'reel' && reel !== undefined;
      track.hidden = !inReel;
      meter.hidden = !inReel;
      tap.classList.toggle('on', phase === 'bite');
      tap.disabled = phase === 'wait' || phase === 'done';
      tap.querySelector('.fish-tap-text')!.textContent = phase === 'bite' ? 'Tap!' : 'Hold!';
      setRank(meter, null, inReel ? rank : null);
      setRank(track, null, inReel ? rank : null);
      if (!inReel) {
        track.classList.remove('catching', 'draining');
        return;
      }
      box.style.left = pct(reel.boxPos - reel.boxSize / 2);
      box.style.width = pct(reel.boxSize);
      fish.style.left = pct(reel.fishPos);
      fill.style.width = `${Math.max(0, Math.min(100, (reel.fill / FISH_REEL_FULL) * 100))}%`;
      // The box goes green while the fish is inside it.
      const f = feedback ?? { catching: Math.abs(reel.fishPos - reel.boxPos) <= reel.boxSize / 2, draining: false, tension: 0 };
      track.classList.toggle('catching', f.catching);
      track.classList.toggle('draining', f.draining);
      track.style.setProperty('--tension', f.tension.toFixed(2));
    },
  };
}
