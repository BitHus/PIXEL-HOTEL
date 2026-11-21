// 3e: migration 43 -> 44 (the food stash). Old saves get a serving hatch, the dishes on the menu move into it, an open dish order's plate comes back.
import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, SHOP_TICK_MS } from './config.ts';
import { canPlace, getFurnitureType } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { stepTavern } from './guests.ts';
import { applyChange } from './ledger.ts';
import { createNewPlayer } from './newPlayer.ts';
import { seededRng } from './rng.ts';
import { readSave } from './save.ts';
import { addToStash, platesInStash, stashPieces } from './stash.ts';
import { unloadTap } from './taps.ts';
import { menuOffers, openOrders } from './tavern.ts';
import { tavernWorld } from './tavernTest.ts';

/** A version 43 tavern: no hatch, no stash; `materials` is the bag as the old rules left it (an order had taken its dish out). */
function save43(materials: Record<string, number>, keep?: (s: GameState) => GameState): GameState {
  let s = createNewPlayer(undefined, 0);
  const hatch = stashPieces(s.items, s.tavern.roomId)[0]!;
  s = { ...s, items: s.items.filter((i) => i.uid !== hatch.uid) };
  s = keep ? keep(s) : s;
  const { stash: _s, lastLoaded: _l, ...tavern } = s.tavern;
  return { ...s, player: { ...s.player, materials: { ...s.player.materials, ...materials } }, tavern: tavern as GameState['tavern'] };
}
const load = (s: GameState): GameState => {
  const r = readSave(JSON.stringify({ version: 43, savedAt: 1, state: s }));
  expect(r.ok).toBe(true);
  return (r as { ok: true; state: GameState }).state;
};

describe('migration 43 -> 44 (3e food stash)', () => {
  it('SAVE_VERSION is 44; the tavern gets a serving hatch that stands well, the dishes ON the menu go into it, the others stay in the bag', () => {
    expect(SAVE_VERSION).toBe(44);
    const old = save43({ roasted_turnip: 4, potato_stew: 2 }); // the start menu has roasted turnip on, stew off
    const s = load(old);
    const room = s.rooms.find((r) => r.id === s.tavern.roomId)!;
    const hatches = stashPieces(s.items, room.id);
    expect(hatches).toHaveLength(1);
    const h = hatches[0]!;
    expect(canPlace(room, s.items.filter((i) => i.uid !== h.uid), getFurnitureType('serving_hatch'), h.x, h.y, h.facing)).toBe(true);
    expect(platesInStash(s.tavern.stash, 'roasted_turnip')).toBe(4);
    expect(s.player.materials.roasted_turnip ?? 0).toBe(0);
    expect(s.player.materials.potato_stew).toBe(2);
    expect(menuOffers(s).map((o) => o.id)).toContain('roasted_turnip'); // the menu keeps working
    expect(s.items.length).toBe(old.items.length + 1);
  });

  it('an open dish order gives its plate back (it waits in the stash now); the order stays open', () => {
    // Make a real open dish order with today's rules, then turn it into the version 43 shape (the dish had left the bag).
    let live = createNewPlayer(undefined, 0);
    live = unloadTap(live, live.tavern.taps[0]!.standUid, live.tavern.taps[0]!.slot, 'all', 0)!;
    live = addToStash(applyChange(live, { reason: 'debug', materials: { roasted_turnip: 1 } }, 0)!, 'roasted_turnip', 0)!.state;
    const rng = seededRng(4);
    for (let t = SHOP_TICK_MS; openOrders(live.tavern).length === 0; t += SHOP_TICK_MS) live = stepTavern(live, tavernWorld(live), SHOP_TICK_MS, rng, t).state;
    const g = openOrders(live.tavern)[0]!;
    expect(g.order!.item).toBe('roasted_turnip');
    const old = save43({ roasted_turnip: 0 }, () => ({ ...live, items: live.items.filter((i) => getFurnitureType(i.typeId).stash !== true), tavern: { ...live.tavern, stash: [] } }));
    const s = load(old);
    expect(openOrders(s.tavern).map((x) => x.id)).toEqual([g.id]);
    expect(platesInStash(s.tavern.stash, 'roasted_turnip')).toBe(1); // back to the bag, then into the stash (it is on the menu)
  });

  it('a dish already on the tray for an open order is not given back twice', () => {
    const old = save43({ roasted_turnip: 0 }, (s) => ({ ...s, tavern: { ...s.tavern, tray: [{ item: 'roasted_turnip' }], guests: [{ id: -1, phase: 'order', order: { item: 'roasted_turnip', price: 14 } } as unknown as GameState['tavern']['guests'][number]] } }));
    const s = load(old);
    expect(platesInStash(s.tavern.stash, 'roasted_turnip') + (s.player.materials.roasted_turnip ?? 0)).toBe(0);
    expect(s.tavern.tray).toEqual([{ item: 'roasted_turnip' }]);
  });

  it('a hatch the player keeps in the bag is placed instead of a new one', () => {
    const old = save43({}, (s) => applyChange(s, { reason: 'debug', addFurniture: ['serving_hatch'] }, 0)!);
    const s = load(old);
    expect(s.items.filter((i) => i.typeId === 'serving_hatch')).toHaveLength(1);
    expect(stashPieces(s.items, s.tavern.roomId)).toHaveLength(1);
  });
});
