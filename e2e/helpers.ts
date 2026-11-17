import { expect, type Page } from '@playwright/test';

export interface Errs { list: string[] }

export function watchErrors(page: Page): Errs {
  const e: Errs = { list: [] };
  page.on('pageerror', (x) => e.list.push(`pageerror: ${x.message}`));
  page.on('console', (m) => { if (m.type() === 'error') e.list.push(`console: ${m.text()}`); });
  page.on('requestfailed', (r) => e.list.push(`requestfailed: ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) e.list.push(`http ${r.status()}: ${r.url()}`); });
  return e;
}

export const shot = (page: Page, name: string): Promise<unknown> =>
  page.screenshot({ path: `test-results/${test_project(page)}-${name}.png` });

function test_project(page: Page): string {
  const v = page.viewportSize();
  return v && v.width < 600 ? 'phone' : 'desktop';
}

/** Title, New game, name, pick shapes, skip the intro. */
export async function newGame(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByText('New game').first().click();
  await page.getByLabel('Display name').fill('Tester');
  await shot(page, '01-charmaker');
  await page.getByText('Begin your story').click();
  await shot(page, '02-hotelshape');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Open my tavern' }).click();
  await page.waitForTimeout(800);
  await shot(page, '03-intro');
  await page.mouse.click(5, 300); // intro skip: any tap
  await page.waitForTimeout(500);
  await page.mouse.click(5, 300);
  await page.waitForTimeout(2500);
}

export async function saveState(page: Page): Promise<any> {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (/^pixel.*save|save/i.test(k) && !/backup/i.test(k)) {
        try { const v = JSON.parse(localStorage.getItem(k)!); if (v.state) return { key: k, ...v }; } catch { /* skip */ }
      }
    }
    return null;
  });
}
export { expect };

export interface Cam { zoom: number; cx: number; cy: number }

/** Opens a side button by its tooltip (on a phone through the More menu). */
export async function openSide(page: Page, title: string): Promise<void> {
  const b = page.locator(`button[title^="${title}"]`).first();
  if (!(await b.isVisible())) await page.locator('button.more-btn').dispatchEvent('click');
  await b.dispatchEvent('click');
}

export async function debugOn(page: Page, followOff = true): Promise<void> {
  await openSide(page, 'Settings');
  const dbg = page.getByRole('button', { name: /Debug: off/ });
  await dbg.dispatchEvent('click');
  if (followOff) {
    const f = page.getByRole('button', { name: /Camera:/i });
    if ((await f.count()) && /Locked/i.test((await f.first().textContent()) ?? '')) await f.first().dispatchEvent('click');
  }
  await page.keyboard.press('Escape');
}

/** Taps a free floor point and reads the world coords and zoom from the debug label: gives screen -> world. */
export async function calibrate(page: Page, sx: number, sy: number): Promise<Cam> {
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(150);
  const t = (await page.locator('.debug-label').textContent()) ?? '';
  const m = /x (-?\d+)\s+y (-?\d+)\s+zoom ([\d.]+)x/.exec(t.replace(/\n/g, ' '));
  if (!m) throw new Error('no debug label: ' + t);
  const zoom = Number(m[3]);
  // the label floors the world coords, so this is within 1 world px
  return { zoom, cx: Number(m[1]) + 0.5 - sx / zoom, cy: Number(m[2]) + 0.5 - sy / zoom };
}
export const toScreen = (c: Cam, wx: number, wy: number): [number, number] => [(wx - c.cx) * c.zoom, (wy - c.cy) * c.zoom];

export const notes: string[] = [];
/** A route step that never aborts the route: failures are logged (and screenshotted) for the report. */
export async function step(page: Page, name: string, fn: () => Promise<void>): Promise<boolean> {
  try {
    await fn();
    notes.push(`ok   ${name}`);
    return true;
  } catch (e) {
    notes.push(`FAIL ${name}: ${String((e as Error).message).split('\n')[0]}`);
    await shot(page, `fail-${name.replace(/\W+/g, '-')}`).catch(() => undefined);
    return false;
  }
}
export async function poll<T>(page: Page, fn: () => Promise<T | null | false | undefined>, ms: number, every = 500): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('poll timeout');
    await page.waitForTimeout(every);
  }
}
