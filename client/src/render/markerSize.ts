// R13 (owner 19 Nov): the tiny markers over guests, the mugs and dishes on tables and the mugs on the waiter's tray were "a bit too small".
// One place for the scales. Whole pixels only (the icon sprites are drawn at a whole px size).
/** Order marker over a guest (css px): the drink dot and the dish icon (was 10 and 14, about +20%). */
export const ORDER_DOT_PX = 12;
export const ORDER_DISH_PX = 16;
/** A dish or mug lying on a table spot (was 14, about +15%). */
export const TABLE_DISH_PX = 16;
/** The waiter's tray: mug icon scale (32 px icon; was 0.5 = 16 px, now 0.75 = 24 px, 1.5x) and the gap between mugs (was 10, three side by side). */
export const TRAY_MUG_SCALE = 0.75;
export const TRAY_MUG_GAP = 16;
