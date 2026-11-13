// Avatar panel: the same look pickers as character creation (step 7b; tabs Body, Hair, Top,
// Bottoms, Shoes after 7b), with the free and unlocked clothing
// only. A small preview turns slowly; the avatar in the room updates at once.

import type { AvatarLook } from '@pixel-hotel/shared';
import { el } from './dom.ts';
import { createLookPickers } from './lookPickers.ts';
import { createAvatarPreview } from './newGame.ts';

export interface AvatarPanel {
  readonly el: HTMLElement;
  setLook(look: AvatarLook, unlocked?: readonly string[]): void;
}

export function createAvatarPanel(parent: HTMLElement, onChange: (look: AvatarLook) => void): AvatarPanel {
  const panel = el('div', 'frame panel avatar-panel');
  const preview = createAvatarPreview(2);
  const pickers = createLookPickers((look) => {
    preview.setLook(look);
    onChange(look);
  });
  const stage = el('div', 'avatar-stage small');
  stage.appendChild(preview.el);
  panel.append(el('h2', 'panel-title', 'Avatar'), stage, pickers.el);
  parent.appendChild(panel);
  return {
    el: panel,
    setLook(look, unlocked) {
      preview.setLook(look);
      pickers.setLook(look, unlocked);
    },
  };
}
