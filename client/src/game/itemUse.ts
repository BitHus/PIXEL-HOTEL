// Usable furniture in play mode (step 9g-2): a tap on a lamp, fire, music box, clock, mirror, pet basket or a pastime piece.
// The rules are shared/src/itemUse.ts (through GameAPI.useItem); this only shows the result.

import type { FurnitureItem, GameAPI, ItemsResult } from '@pixel-hotel/shared';
import type { Panels } from '../ui/panels.ts';
import type { Sound } from '../audio/sound.ts';

export interface ItemUseDeps {
  api: GameAPI;
  applyItems(next: ItemsResult): boolean;
  toast(text: string): void;
  sound: Sound;
  panels: Panels;
}

/** Returns the handler for a tap on a usable piece. */
export function createItemUse(d: ItemUseDeps): (item: FurnitureItem) => void {
  return (item) => {
    void d.api.useItem(item.uid).then(async (r) => {
      if (!r) return;
      d.toast(r.text);
      switch (r.kind) {
        case 'toggle':
        case 'fire':
          d.sound.play('click');
          // The light follows the item's on/off state: re-read the items so the atmosphere redraws.
          d.applyItems(await d.api.getItems());
          break;
        case 'music':
          d.sound.playTune(r.notes);
          break;
        case 'mirror':
          d.panels.show('avatar');
          break;
        case 'darts':
          d.sound.play(r.score >= 50 ? 'found' : 'pop');
          break;
        case 'dice':
          d.sound.play('clink');
          break;
        case 'pet':
          if (r.adopted) d.sound.play('found');
          break;
        case 'clock':
          break;
      }
    });
  };
}
