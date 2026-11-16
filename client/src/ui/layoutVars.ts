// Keeps two CSS variables on the UI root up to date, so panels can sit fully clear of the info
// panel and always end above the hotbar (ui.css): --info-h (the info panel's height) and --bar-h
// (the height of the hotbar, or of the run bag that takes its place in the dungeon).

import { watchSizeClass } from './layout.ts';

export function watchLayout(root: HTMLElement, info: HTMLElement, bars: readonly HTMLElement[]): void {
  watchSizeClass(root, document.documentElement); // the size class (layout.ts) sets data-size, read by sizes.css
  const apply = (): void => {
    const infoH = info.offsetHeight;
    if (infoH > 0) root.style.setProperty('--info-h', `${infoH}px`);
    // The info panel's width: the first-ten goal card (firstTenGuide.ts) keeps clear of it.
    const infoW = info.offsetWidth;
    if (infoW > 0) root.style.setProperty('--info-w', `${infoW}px`);
    const barH = Math.max(0, ...bars.map((b) => b.offsetHeight));
    // A hidden hotbar (while placing) keeps the last height: no panel is open then anyway.
    if (barH > 0) root.style.setProperty('--bar-h', `${barH}px`);
  };
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(apply);
    for (const e of [info, ...bars]) ro.observe(e);
  }
  window.addEventListener('resize', apply);
  apply();
}
