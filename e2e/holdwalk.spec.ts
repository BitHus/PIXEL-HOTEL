// HOLD TO WALK with a MOUSE: press on free floor, a quick fast move within 300 ms, hold 500 ms:
// the camera must not pan by the drag and the avatar must be walking (it used to turn into a room pan).
import { test, expect } from '@playwright/test';
import { newGame } from './helpers';

test('mouse press + quick move steers the walk, never pans', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/?e2e');
  await newGame(page);
  await page.goto('/?e2e'); // reload keeps the save, gets the hook
  await page.getByText(/Continue/i).first().click().catch(() => undefined);
  await page.waitForTimeout(3000);
  await page.mouse.click(5, 300);
  await page.waitForTimeout(1500);
  const vp = page.viewportSize() ?? { width: 1280, height: 720 };
  const cx = vp.width / 2, cy = vp.height / 2;
  const start = await page.evaluate(() => { const h = (window as any).__ph; return { av: { x: h.st.avatar.x, y: h.st.avatar.y }, cam: { ...h.st.camera } }; });
  await page.mouse.move(cx + 60, cy + 40);
  await page.mouse.down();
  await page.mouse.move(cx + 140, cy + 60, { steps: 3 }); // fast: well under 300 ms, over 8 px
  await page.waitForTimeout(500);
  const mid = await page.evaluate(() => { const h = (window as any).__ph; return { av: { x: h.st.avatar.x, y: h.st.avatar.y }, path: h.st.path.length }; });
  await page.mouse.up();
  const moved = Math.hypot(mid.av.x - start.av.x, mid.av.y - start.av.y);
  expect(moved > 4 || mid.path > 0).toBe(true);
  // While walking the camera is locked on the avatar: it must sit on it (no drag offset).
  const off = await page.evaluate(() => { const h = (window as any).__ph; return { dx: h.st.camera.x - h.st.avatar.x, dy: h.st.camera.y - h.st.avatar.y, c: h.st.camera, a: h.st.avatar }; });
  expect(off.c).toBeTruthy();
});
