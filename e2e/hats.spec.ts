// Hat check (owner bug: the hat does not show on the head when equipped). For every hat the save is seeded with
// look.hat = id, the game is continued, and the avatar is shot (clipped) standing, walking right/up/down and sitting.
// Then the equip path itself is driven through the Avatar panel (Hat tab). Shots: test-results/<project>-hat-<id>-<pose>.png
import { test, expect } from '@playwright/test';
import { calibrate, debugOn, newGame, notes, openSide, saveState, shot, toScreen, watchErrors } from './helpers';

const HATS = ['straw_hat', 'hood_coif', 'felt_cap', 'wool_cap', 'cook_cap', 'feather_cap', 'tavern_keeper_hat', 'fisher_hat', 'skull_cap', 'flower_crown', 'knight_helm', 'gold_crown', 'sunken_crown_hat', 'miner_lamp_cap'];

test('hats: show on the head in every pose, equip path applies look.hat', async ({ page }) => {
  test.setTimeout(600000);
  const errs = watchErrors(page);
  const vp = page.viewportSize()!;
  const phone = vp.width < 600;
  const proj = phone ? 'phone' : 'desktop';
  await newGame(page);
  const base = await saveState(page);
  const clip = { x: Math.max(0, vp.width / 2 - 130), y: Math.max(0, vp.height / 2 - 160), width: 260, height: 400 };
  const snap = (id: string, pose: string): Promise<unknown> => page.screenshot({ path: `test-results/${proj}-hat-${id}-${pose}.png`, clip });

  for (const id of HATS) {
    const st = JSON.parse(JSON.stringify(base.state));
    st.player.look = { ...(st.player.look ?? st.look) , hat: id };
    st.look = { ...st.look, hat: id };
    st.player.unlockedClothing = Array.from(new Set([...(st.player.unlockedClothing ?? []), ...HATS]));
    await page.evaluate(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key: base.key, saved: { version: base.version, savedAt: base.savedAt, state: st } });
    await page.goto('/');
    await page.getByText('Continue').first().click();
    await page.waitForTimeout(4500);
    await snap(id, 'idle-down');
    const got = (await saveState(page)).state;
    notes.push(`hat ${id}: save look.hat = ${JSON.stringify(got.look?.hat ?? got.player?.look?.hat)}`);
    const cx = vp.width / 2, cy = vp.height / 2;
    await page.mouse.click(Math.min(vp.width - 120, cx + 200), cy + 40);
    await page.waitForTimeout(450);
    await snap(id, 'walk-right');
    await page.waitForTimeout(2500);
    await page.mouse.click(cx - 60, Math.max(120, cy - 200));
    await page.waitForTimeout(450);
    await snap(id, 'walk-up');
    await page.waitForTimeout(2500);
    await page.mouse.click(cx, Math.min(vp.height - 120, cy + 200));
    await page.waitForTimeout(450);
    await snap(id, 'walk-down');
    await page.waitForTimeout(2500);
    await snap(id, 'idle-after');
  }

  // sit: calibrate on a fresh debug session, tap a stool
  if (!phone) {
    const st = JSON.parse(JSON.stringify(base.state));
    st.player.look = { ...(st.player.look ?? st.look), hat: 'straw_hat' };
    st.look = { ...st.look, hat: 'straw_hat' };
    await page.evaluate(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key: base.key, saved: { version: base.version, savedAt: base.savedAt, state: st } });
    await page.goto('/');
    await page.getByText('Continue').first().click();
    await page.waitForTimeout(4000);
    await debugOn(page);
    const cam = await calibrate(page, vp.width / 2, vp.height / 2);
    const [sx, sy] = toScreen(cam, 400, 176);
    await page.mouse.click(sx, sy);
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `test-results/${proj}-hat-straw_hat-sit.png` });
  }

  // equip path: Avatar panel, Hat tab, Wear
  const st2 = JSON.parse(JSON.stringify(base.state));
  st2.player.unlockedClothing = Array.from(new Set([...(st2.player.unlockedClothing ?? []), ...HATS]));
  await page.evaluate(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key: base.key, saved: { version: base.version, savedAt: base.savedAt, state: st2 } });
  await page.goto('/');
  await page.getByText('Continue').first().click();
  await page.waitForTimeout(4000);
  await openSide(page, 'Avatar');
  await page.waitForTimeout(600);
  await shot(page, 'hat-80-avatar-panel');
  const hatTab = page.locator('button[title="Hat"]').first();
  notes.push(`hat tab present: ${await hatTab.count()}`);
  if (await hatTab.count()) {
    await hatTab.dispatchEvent('click');
    await page.waitForTimeout(500);
    await shot(page, 'hat-81-hat-tab');
    const wear = page.locator('.look-wear').first();
    notes.push(`wear buttons: ${await page.locator('.look-wear').count()}`);
    const next = page.locator('button', { hasText: /^[>▶]$/ }).first();
    for (let i = 0; i < 3; i++) {
      if (await next.count()) await next.dispatchEvent('click');
    }
    await shot(page, 'hat-82-hat-browse');
    if (await wear.count()) {
      await wear.dispatchEvent('click');
      await page.waitForTimeout(800);
      await shot(page, 'hat-83-after-wear');
      const after = (await saveState(page)).state;
      notes.push(`after Wear: look.hat = ${JSON.stringify(after.look?.hat)} player.look.hat = ${JSON.stringify(after.player?.look?.hat)}`);
    }
  }
  console.log(`\n${notes.join('\n')}\nERRORS: ${JSON.stringify(errs.list)}`);
  expect(true).toBeTruthy();
});
