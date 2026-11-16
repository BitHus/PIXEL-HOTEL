import { describe, expect, it } from 'vitest';
import { PET_NAME_MAX, SAVE_BACKUP_KEY, STAR_THRESHOLDS } from './config.ts';
import { getFurnitureType, FURNITURE_TYPES } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { clockText, cleanPetName, isOn, isUsable, renamePet, TUNES, useItem } from './itemUse.ts';
import { arrangeState, createNewPlayer } from './newPlayer.ts';
import { rollDice, throwDarts } from './pastimes.ts';
import { isPurring, petTap, spawnPet, stepPet, type PetBrain, type PetWorld } from './pet.ts';
import { roomScore } from './roomScore.ts';
import { MIGRATIONS, peekSave, readSave, saveKey, toSaveText } from './save.ts';
import { seededRng } from './rng.ts';
import type { FurnitureItem } from './types.ts';

const fresh = (): GameState => createNewPlayer(undefined, 1);
let nextUid = 5000;
const put = (s: GameState, typeId: string, roomId: number | null, x = 100, y = 100): GameState => {
  const item: FurnitureItem = { uid: nextUid++, typeId, ownerId: s.player.id, roomId, x, y, facing: 'down', onItemUid: null };
  return { ...s, items: [...s.items, item] };
};
const lastUid = (s: GameState): number => s.items[s.items.length - 1]!.uid;

describe('usable furniture (9g-2)', () => {
  it('lamps and the fireplace carry a use; the new pieces exist in the catalog', () => {
    expect(getFurnitureType('stone_fireplace').use).toBe('fire');
    expect(getFurnitureType('glass_lamp').use).toBe('toggle');
    expect(getFurnitureType('lantern_post').use).toBe('toggle');
    for (const id of ['wall_clock', 'wall_mirror', 'music_box', 'pet_basket', 'dice_cup', 'bard_stool', 'dartboard']) {
      const t = getFurnitureType(id);
      expect(isUsable(t)).toBe(true);
      expect(t.inCatalog).toBe(true);
    }
    for (const t of FURNITURE_TYPES) if (t.tune) expect(TUNES[t.tune]).toBeDefined();
  });

  it('a toggle flips on/off and the state persists through a save', () => {
    const s0 = put(fresh(), 'glass_lamp', 1);
    const uid = lastUid(s0);
    expect(isOn(s0.items.find((i) => i.uid === uid)!)).toBe(true);
    const off = useItem(s0, uid, 600, seededRng(1))!;
    expect(off.result).toMatchObject({ kind: 'toggle', on: false });
    expect(off.state.items.find((i) => i.uid === uid)!.on).toBe(false);
    const loaded = readSave(toSaveText(off.state, 2));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(isOn(loaded.state.items.find((i) => i.uid === uid)!)).toBe(false);
    const on = useItem(loaded.state, uid, 600, seededRng(1))!;
    expect(on.result).toMatchObject({ kind: 'toggle', on: true });
  });

  it('refuses unplaced items and pieces without a use', () => {
    const s = fresh();
    expect(useItem(s, 999999, 0, seededRng(1))).toBeNull();
    const inBag = put(s, 'glass_lamp', null);
    expect(useItem(inBag, lastUid(inBag), 0, seededRng(1))).toBeNull();
    const chair = put(s, 'chair', 1);
    expect(useItem(chair, lastUid(chair), 0, seededRng(1))).toBeNull();
  });

  it('the music box and the bard stool return their tunes', () => {
    const s = put(put(fresh(), 'music_box', 1), 'bard_stool', 2);
    const a = useItem(s, s.items[s.items.length - 2]!.uid, 0, seededRng(1))!.result;
    const b = useItem(s, lastUid(s), 0, seededRng(1))!.result;
    expect(a).toMatchObject({ kind: 'music', tune: 'hearth_waltz' });
    expect(b).toMatchObject({ kind: 'music', tune: 'bard_ballad' });
    expect(a.kind === 'music' && a.notes.length).toBeGreaterThan(3);
  });

  it('the wall clock uses the time that is passed in', () => {
    const s = put(fresh(), 'wall_clock', 1);
    const at = (m: number): string => (useItem(s, lastUid(s), m, seededRng(1))!.result as { text: string }).text;
    expect(at(15 * 60 + 30)).toBe('Half past three in the afternoon');
    expect(at(12 * 60)).toBe('High noon');
    expect(at(0)).toBe('Midnight, the witching hour');
    expect(clockText(7 * 60 + 45)).toBe('A quarter to eight in the morning');
    expect(clockText(21 * 60 + 5)).toBe("Nine o'clock at night");
  });

  it('the mirror asks for the Avatar panel', () => {
    const s = put(fresh(), 'wall_mirror', 1);
    expect(useItem(s, lastUid(s), 0, seededRng(1))!.result.kind).toBe('mirror');
  });

  it('the pet basket adopts the cat once; the name can be changed', () => {
    const s = put(fresh(), 'pet_basket', 1);
    expect(s.player.pet).toBeNull();
    const a = useItem(s, lastUid(s), 0, seededRng(3))!;
    expect(a.result).toMatchObject({ kind: 'pet', adopted: true });
    expect(a.state.player.pet?.name).toBeTruthy();
    const b = useItem(a.state, lastUid(s), 0, seededRng(4))!;
    expect(b.result).toMatchObject({ adopted: false });
    expect(b.state.player.pet).toEqual(a.state.player.pet);
    expect(renamePet(a.state, 'Sir Biscuit')!.player.pet).toEqual({ name: 'Sir Biscuit' });
    expect(renamePet(s, 'Kit')).toBeNull(); // no cat yet
    expect(cleanPetName('')).toBeNull();
    expect(cleanPetName('x'.repeat(PET_NAME_MAX + 1))).toBeNull();
    expect(cleanPetName('bad<name>')).toBeNull();
  });

  it('darts and dice are deterministic for a fixed rng and touch no state', () => {
    expect(throwDarts(seededRng(7))).toEqual(throwDarts(seededRng(7)));
    expect(rollDice(seededRng(7))).toEqual(rollDice(seededRng(7)));
    const s = put(put(fresh(), 'dartboard', 2), 'dice_cup', 2);
    for (const uid of s.items.slice(-2).map((i) => i.uid)) {
      const r = useItem(s, uid, 0, seededRng(5))!;
      expect(r.state).toBe(s);
    }
    for (let k = 1; k < 40; k++) {
      const d = rollDice(seededRng(k)).dice;
      expect(d.every((n) => n >= 1 && n <= 6)).toBe(true);
      const sc = throwDarts(seededRng(k)).score;
      expect(sc).toBeGreaterThanOrEqual(0);
      expect(sc).toBeLessThanOrEqual(50);
    }
  });
});

describe('the cat (9g-2)', () => {
  const world: PetWorld = { player: { x: 300, y: 300 }, basket: { x: 120, y: 120 }, free: (p) => p.x > 0 && p.x < 600 && p.y > 0 && p.y < 600 };
  const run = (seed: number, steps = 600): PetBrain[] => {
    const rng = seededRng(seed);
    let b = spawnPet({ x: 130, y: 130 }, 0);
    const out: PetBrain[] = [];
    for (let t = 0; t < steps; t++) {
      b = stepPet(b, 100, t * 100, rng, world);
      out.push(b);
    }
    return out;
  };

  it('is deterministic for a fixed rng and clock', () => {
    expect(run(11)).toEqual(run(11));
  });

  it('stays on free ground and uses every mode over time', () => {
    const modes = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      for (const b of run(seed, 1500)) {
        expect(world.free(b)).toBe(true);
        modes.add(b.mode);
      }
    }
    expect([...modes].sort()).toEqual(['follow', 'sit', 'sleep', 'walk']);
  });

  it('sleeps in the basket and a tap wakes it and makes it purr', () => {
    const rng = seededRng(2);
    const asleep = [1, 2, 3, 4, 5, 6].flatMap((k) => run(k, 1500)).find((b) => b.mode === 'sleep')!;
    expect(Math.hypot(asleep.x - 120, asleep.y - 120)).toBeLessThan(5);
    const tapped = petTap(asleep, 1000, rng);
    expect(tapped.mode).toBe('sit');
    expect(isPurring(tapped, 1500)).toBe(true);
    expect(isPurring(tapped, 1000 + 99999)).toBe(false);
  });

  it('follows the player when following', () => {
    let b: PetBrain = { ...spawnPet({ x: 50, y: 50 }, 0), mode: 'follow', untilMs: 100_000 };
    const d0 = Math.hypot(300 - b.x, 300 - b.y);
    for (let t = 0; t < 20; t++) b = stepPet(b, 100, t * 100, seededRng(1), world);
    expect(Math.hypot(300 - b.x, 300 - b.y)).toBeLessThan(d0);
  });
});

describe('save 28 migration (9g-2)', () => {
  it('27 -> 28 adds Player.pet = null and the on state of lamps and fires, nothing else', () => {
    const s = put(put(put(fresh(), 'glass_lamp', 1), 'stone_fireplace', 1), 'chair', 1);
    const old = JSON.parse(JSON.stringify(s)) as unknown as { player: Record<string, unknown> };
    delete old.player.pet;
    const r = readSave(JSON.stringify({ version: 27, savedAt: 9, state: old }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.player.pet).toBeNull();
    const by = (t: string): FurnitureItem => r.state.items.find((i) => i.typeId === t)!;
    expect(by('glass_lamp').on).toBe(true);
    expect(by('stone_fireplace').on).toBe(true);
    expect(by('chair').on).toBeUndefined();
    expect(r.state.items.length).toBe(s.items.length);
    expect(typeof MIGRATIONS[27]).toBe('function');
  });

  it('keeps an existing off state and a damaged pet field is refused', () => {
    const s = put(fresh(), 'glass_lamp', 1);
    const old = JSON.parse(JSON.stringify(s)) as unknown as { items: Record<string, unknown>[] };
    old.items[old.items.length - 1]!.on = false;
    const r = readSave(JSON.stringify({ version: 27, savedAt: 9, state: old }));
    expect(r.ok && r.state.items.find((i) => i.typeId === 'glass_lamp')!.on).toBe(false);
    const bad = JSON.parse(JSON.stringify(fresh())) as unknown as { player: Record<string, unknown> };
    bad.player.pet = 5;
    expect(readSave(JSON.stringify({ version: 28, savedAt: 9, state: bad })).ok).toBe(false);
  });
});

describe('room stars (9g-3)', () => {
  const hotel = (s: GameState) => s.rooms.find((r) => r.id === s.player.hotelRoomId)!;
  const score = (s: GameState) => roomScore(hotel(s), s.items);
  const base = (): GameState => {
    const s = arrangeState(fresh());
    return { ...s, items: s.items.filter((i) => i.roomId !== s.player.hotelRoomId) };
  };
  const id = (s: GameState): number => s.player.hotelRoomId;
  const setRoom = (s: GameState, patch: Record<string, unknown>): GameState => ({ ...s, rooms: s.rooms.map((r) => (r.id === id(s) ? { ...r, ...patch } : r)) });

  it('an empty bare room is 1 star with the "bare as a bone" tip', () => {
    const r = score(base());
    expect(r.stars).toBe(1);
    expect(r.tip).toMatch(/bare as a bone/);
    expect(r.toNext).toBeGreaterThan(0);
  });

  it('is monotone: adding pieces never lowers the score; stars stay 1 to 5; the score is capped', () => {
    let s = base();
    let last = 0;
    const types = FURNITURE_TYPES.filter((t) => t.placeIn !== 'shop' && !t.noPickup).map((t) => t.id);
    for (let k = 0; k < 120; k++) {
      s = put(s, types[k % types.length]!, id(s));
      const r = score(s);
      expect(r.score).toBeGreaterThanOrEqual(last);
      expect(r.stars).toBeGreaterThanOrEqual(1);
      expect(r.stars).toBeLessThanOrEqual(STAR_THRESHOLDS.length);
      expect(r.score).toBeLessThanOrEqual(100);
      last = r.score;
    }
  });

  it('a fourth piece of one type adds nothing', () => {
    let s = base();
    for (let k = 0; k < 3; k++) s = put(s, 'glass_lamp', id(s));
    const three = score(s).score;
    s = put(s, 'glass_lamp', id(s));
    expect(score(s).score).toBe(three);
  });

  it('only counts this room', () => {
    const b = base();
    const s = put(b, 'glass_lamp', b.player.shopRoomId);
    expect(score(s).score).toBe(score(b).score);
  });

  it('each tip appears in turn: light, walls, floor, rug, wall item, variety', () => {
    let s = put(base(), 'chair', base().player.hotelRoomId);
    expect(score(s).tip).toMatch(/Add a light/);
    s = put(s, 'glass_lamp', id(s));
    expect(score(s).tip).toMatch(/walls are bare/);
    s = setRoom(s, { wallStyle: 'plank' });
    expect(score(s).tip).toMatch(/floor is bare/);
    s = setRoom(s, { floorStyle: 'plank' });
    expect(score(s).tip).toMatch(/rug/);
    s = put(s, 'rug', id(s));
    expect(score(s).tip).toMatch(/wall/);
    s = put(s, 'wall_clock', id(s));
    expect(score(s).tip).toMatch(/different kinds/);
  });

  it('a decorated room reaches more stars than a bare one', () => {
    let s = base();
    for (const t of ['glass_lamp', 'rug', 'wall_clock', 'wall_mirror', 'stone_fireplace', 'chair', 'writing_desk', 'potted_flowers']) s = put(s, t, id(s));
    s = setRoom(setRoom(s, { wallStyle: 'plank' }), { floorStyle: 'plank' });
    expect(score(s).stars).toBeGreaterThan(score(base()).stars);
  });
});

describe('peekSave (title screen hook)', () => {
  const store = (init: Record<string, string>) => (k: string): string | null => init[k] ?? null;

  it('no save: nothing exists', () => {
    expect(peekSave(store({}))).toMatchObject({ exists: false, canContinue: false });
  });

  it('a made character can continue; the card has name, Inn and level', () => {
    const s = { ...fresh(), playerCreated: true };
    const p = peekSave(store({ [saveKey()]: toSaveText(s, 77) }));
    expect(p).toMatchObject({ exists: true, canContinue: true, version: 29, savedAt: 77, playerName: s.player.name, innName: s.player.innName, level: 1 });
  });

  it('a save before the character was made is not continuable', () => {
    const p = peekSave(store({ [saveKey()]: toSaveText({ ...fresh(), playerCreated: false }, 1) }));
    expect(p.exists).toBe(true);
    expect(p.canContinue).toBe(false);
  });

  it('finds an older versioned save and the backup, and reports a damaged one', () => {
    const s = { ...fresh(), playerCreated: true };
    const old = JSON.parse(JSON.stringify(s)) as unknown as { player: Record<string, unknown> };
    delete old.player.pet;
    expect(peekSave(store({ [saveKey(27)]: JSON.stringify({ version: 27, savedAt: 5, state: old }) }))).toMatchObject({ exists: true, canContinue: true, version: 27 });
    expect(peekSave(store({ [SAVE_BACKUP_KEY]: toSaveText(s, 5) })).canContinue).toBe(true);
    expect(peekSave(store({ [saveKey()]: '{nope' }))).toMatchObject({ exists: true, canContinue: false, problem: 'bad_json' });
  });
});
