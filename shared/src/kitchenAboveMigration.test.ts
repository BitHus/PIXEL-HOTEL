// KITCHEN-ABOVE (SAVE 42): a save 41 tavern loads with the kitchen on top, the modular bar, nothing lost.
import { describe, expect, it } from 'vitest';
import { SAVE_VERSION } from './config.ts';
import { canPlace, footprintRect, getFurnitureType } from './furniture.ts';
import { readSave } from './save.ts';
import { mainShiftOf, roomAnnex } from './room.ts';
import { save41Start } from './tavernTest.ts';

describe('migration 41 -> 42', () => {
  for (const shape of ['square_shop', 'long', 'l_shape', 'plus', 'wide_hall']) {
    it(`${shape}: the annex goes on top, the main floor moves down, the old kitchen pieces move into the new annex, every piece stands well, nothing is lost`, () => {
      const old = save41Start(shape, 0);
      const r = readSave(JSON.stringify({ version: 41, savedAt: 1, state: old }));
      expect(SAVE_VERSION).toBe(43);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const s = r.state;
      const room = s.rooms.find((x) => x.id === s.tavern.roomId)!;
      expect(room.annexAbove).toBe(true);
      const a = roomAnnex(room)!;
      expect(a.y).toBe(0);
      const dy = mainShiftOf(room);
      // the table kept its place on the main floor, moved down by the annex height
      const t0 = old.items.find((i) => i.typeId === 'table')!;
      expect(s.items.find((i) => i.uid === t0.uid)).toMatchObject({ x: t0.x, y: t0.y + dy });
      // the counter is bar pieces now; stove and barrel are in the new annex (or the bag, never lost)
      expect(s.items.filter((i) => i.typeId === 'bar')).toHaveLength(3);
      for (const id of ['stove', 'brewing_barrel']) {
        const it2 = s.items.find((i) => i.typeId === id)!;
        if (it2.roomId === null) continue;
        const f = footprintRect(it2, getFurnitureType(id));
        expect(f.x >= a.x && f.y >= a.y && f.x + f.w <= a.x + a.w && f.y + f.h <= a.y + a.h, `${shape} ${id}`).toBe(true);
      }
      for (const i of s.items.filter((x) => x.roomId === room.id && x.onItemUid === null && !getFurnitureType(x.typeId).wall && x.typeId !== 'bar')) {
        const rest = s.items.filter((o) => o.uid !== i.uid && o.onItemUid !== i.uid);
        expect(canPlace(room, rest, getFurnitureType(i.typeId), i.x, i.y, i.facing), `${shape} ${i.typeId}`).toBe(true);
      }
      expect(s.items.length).toBe(old.items.length + 2); // two more bar pieces, nothing gone
      expect(s.tavern.taps.reduce((n, t) => n + t.mugs, 0) + (s.player.materials.root_ale ?? 0)).toBe(7);
    });
  }
});
