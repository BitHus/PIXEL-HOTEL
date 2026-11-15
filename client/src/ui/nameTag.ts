// The name tag above an avatar (step 9g-1, Settings -> Name tags). One HTML plate (.nametag in ui.css) placed in screen px each frame.

import type { Point } from '@pixel-hotel/shared';
import { el } from './dom.ts';

export interface NameTag {
  setEnabled(on: boolean): void;
  /** `at`: screen point just under the avatar's feet (null hides the tag, e.g. in the dungeon). */
  update(name: string, at: Point | null): void;
}

export function createNameTag(parent: HTMLElement, enabled: boolean): NameTag {
  const tag = el('div', 'nametag own');
  tag.hidden = true;
  parent.appendChild(tag);
  let on = enabled;
  let shownName = '';
  return {
    setEnabled(v) {
      on = v;
      if (!on) tag.hidden = true;
    },
    update(name, at) {
      if (!on || !at || name === '') {
        tag.hidden = true;
        return;
      }
      if (name !== shownName) {
        tag.textContent = name;
        shownName = name;
      }
      tag.hidden = false;
      // The plate hangs below the feet: its transform puts the bottom edge at the point, so move it down by its own height.
      tag.style.left = `${Math.round(at.x)}px`;
      tag.style.top = `${Math.round(at.y + tag.offsetHeight)}px`;
    },
  };
}
