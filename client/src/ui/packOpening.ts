// Opening a pack and selling a spare (step BG8): ask first (confirmBuy, in gems), play the pop, float what came above the
// head (BG3 popups, rank colours, sparkle) and say in a toast what is new ("New!" with a Wear it button) and what is a
// spare ("Spare x2"). Rendering and wiring only; the rules and the numbers come from the API.

import { RANKS, getClothing, type GameAPI, type PackFind, type PackType, type Rank } from '@pixel-hotel/shared';
import { confirmBuy } from './confirmBuy.ts';
import type { GainPopups } from './gainPopups.ts';
import { packIconUrl } from './itemIcon.ts';
import { playPackPop } from './packPop.ts';
import type { Toast } from './toast.ts';

export interface PackFlowDeps {
  ui: HTMLElement;
  api: GameAPI;
  popups: GainPopups;
  toast: Toast;
  /** Puts a piece of clothing on the avatar and refreshes the Avatar panel. */
  wear(clothingId: string): void;
  /** Refreshes the bag, the wallet and the panels after the change. */
  refresh(): Promise<void>;
}

/** The rarest rank among the finds (for the burst's colour). */
export function bestRank(finds: readonly PackFind[]): Rank {
  return finds.reduce<Rank>((best, f) => (RANKS.indexOf(f.rank) > RANKS.indexOf(best) ? f.rank : best), 'common');
}

/** The toast for a pack's finds: new pieces (the rarest gets the Wear it button), spares, or just what went in the bag. */
export function packToast(pack: PackType, finds: readonly PackFind[]): { text: string; wear: string | null } {
  const clothes = finds.filter((f) => f.kind === 'clothing');
  if (clothes.length === 0) return { text: `${pack.name}: ${finds.length} things are in your bag.`, wear: null };
  const fresh = clothes.filter((f) => f.isNew).sort((a, b) => RANKS.indexOf(b.rank) - RANKS.indexOf(a.rank));
  // Several spares of the same piece in one pack say the highest count once.
  const spares = new Map<string, number>();
  for (const f of clothes) if (!f.isNew) spares.set(f.id, Math.max(spares.get(f.id) ?? 0, f.copies));
  const parts: string[] = [];
  if (fresh.length > 0) parts.push(`New! ${fresh.map((f) => f.name).join(', ')}.`);
  for (const [id, copies] of spares) parts.push(`Spare x${copies}: ${getClothing(id)?.name ?? id}.`);
  return { text: parts.join(' '), wear: fresh[0]?.id ?? null };
}

export function createPackFlow(d: PackFlowDeps): { open(pack: PackType): Promise<void>; sell(clothingId: string): Promise<void> } {
  let busy = false;
  return {
    async open(pack) {
      if (busy) return;
      const gems = (await d.api.getPlayer()).wallet.gems;
      const sure = await confirmBuy(d.ui, {
        name: pack.name,
        detail: `Gives ${pack.rolls} things. The odds are on the card. Duplicates are possible: extra clothes are kept as spares.`,
        price: pack.gemPrice,
        image: packIconUrl(pack.icon),
        gold: gems,
        currency: 'gems',
        title: 'Open this pack?',
        yes: 'Open',
      });
      if (!sure) return;
      busy = true;
      try {
        const res = await d.api.openPack(pack.id);
        if (!res) {
          d.toast('Not enough gems.');
          return;
        }
        await playPackPop(d.ui, packIconUrl(pack.icon), bestRank(res.finds));
        d.popups.show(res.gains);
        const t = packToast(pack, res.finds);
        const wear = t.wear;
        d.toast(t.text, wear ? { label: 'Wear it', run: () => d.wear(wear) } : undefined);
        await d.refresh();
      } finally {
        busy = false;
      }
    },
    async sell(clothingId) {
      const paid = await d.api.sellSpare(clothingId, 1);
      const name = getClothing(clothingId)?.name ?? clothingId;
      d.toast(paid === null ? 'You have no spare of that.' : `Sold a spare ${name} for ${paid} gold.`);
      if (paid !== null) await d.refresh();
    },
  };
}

