// Room stars (step 9g-3, derived, no save): points from the placed furniture (by value and rank), variety of types and themes, lights,
// rugs, wall items and styles that are not bare, all capped -> 1 to 5 stars and one tip. Shown in the Room panel for the HOTEL room. Pure.

import {
  STAR_LIGHT_CAP, STAR_LIGHT_POINTS, STAR_MAX_PER_TYPE, STAR_RANK_POINTS, STAR_RUG_POINTS, STAR_SCORE_MAX, STAR_STYLE_POINTS, STAR_THEME_CAP,
  STAR_THEME_POINTS, STAR_THRESHOLDS, STAR_VALUE_DIV, STAR_VARIETY_CAP, STAR_VARIETY_POINTS, STAR_WALL_CAP, STAR_WALL_POINTS, START_FLOOR_STYLE, START_WALL_STYLE,
} from './config.ts';
import { getFurnitureType } from './furniture.ts';
import { dominantFloorStyle, type Room } from './room.ts';
import type { FurnitureItem } from './types.ts';

export interface RoomStars {
  /** The capped score (0 to STAR_SCORE_MAX). */
  score: number;
  /** 1 to 5. */
  stars: number;
  /** Points still needed for the next star, or null at 5 stars. */
  toNext: number | null;
  /** One hint in the tavern's voice. */
  tip: string;
}

const isRug = (id: string): boolean => id.includes('rug');

export function roomScore(room: Room, items: readonly FurnitureItem[]): RoomStars {
  const counted = new Map<string, number>();
  const themes = new Set<string>();
  let base = 0;
  let lights = 0;
  let rugs = 0;
  let wall = 0;
  let pieces = 0;
  for (const i of items) {
    if (i.roomId !== room.id) continue;
    pieces++;
    const t = getFurnitureType(i.typeId);
    const n = counted.get(i.typeId) ?? 0;
    counted.set(i.typeId, n + 1);
    if (n >= STAR_MAX_PER_TYPE) continue; // a fourth lamp of one kind adds nothing
    base += STAR_RANK_POINTS[t.rank] + t.baseValue / STAR_VALUE_DIV;
    themes.add(t.theme);
    if (t.light) lights++;
    if (isRug(t.id)) rugs++;
    if (t.wall) wall++;
  }
  const floorStyled = dominantFloorStyle(room) !== START_FLOOR_STYLE;
  const wallStyled = room.wallStyle !== START_WALL_STYLE;
  const score = Math.min(
    STAR_SCORE_MAX,
    base +
      Math.min(STAR_VARIETY_CAP, counted.size * STAR_VARIETY_POINTS) +
      Math.min(STAR_THEME_CAP, themes.size * STAR_THEME_POINTS) +
      Math.min(STAR_LIGHT_CAP, lights * STAR_LIGHT_POINTS) +
      (rugs > 0 ? STAR_RUG_POINTS : 0) +
      Math.min(STAR_WALL_CAP, wall * STAR_WALL_POINTS) +
      (floorStyled ? STAR_STYLE_POINTS : 0) +
      (wallStyled ? STAR_STYLE_POINTS : 0),
  );
  let stars = 1;
  for (let k = 1; k < STAR_THRESHOLDS.length; k++) if (score >= STAR_THRESHOLDS[k]!) stars = k + 1;
  const toNext = stars >= STAR_THRESHOLDS.length ? null : Math.ceil(STAR_THRESHOLDS[stars]! - score);
  const tip =
    pieces === 0 ? 'The room is bare as a bone: bring in a bed, a table, a chair.'
    : lights === 0 ? 'Add a light: a candle, a lantern or a glass lamp.'
    : !wallStyled ? 'The walls are bare: paint them with a wall style.'
    : !floorStyled ? 'The floor is bare: lay a floor style.'
    : rugs === 0 ? 'A rug would warm the floor.'
    : wall === 0 ? 'Hang something on the wall: a clock, a mirror or a banner.'
    : counted.size < 6 ? 'Mix in different kinds of pieces.'
    : stars < STAR_THRESHOLDS.length ? 'Grander pieces and a few more themes will win the next star.'
    : 'A fine home, worthy of a minstrel\'s song.';
  return { score: Math.round(score * 10) / 10, stars, toNext, tip };
}
