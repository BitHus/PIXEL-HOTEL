// MISCLICK-PROOF (owner 19 Nov): PC hover highlights the stove with its action tag; the phone shows the context button near a usable thing.
// Shots misclick-shots/. Run: npx playwright test e2e/misclick.spec.ts
import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import { kit } from './run6kit';

fs.mkdirSync('misclick-shots', { recursive: true });

test('hover tag on the stove (desktop) / context button near it (phone)', async ({ page }) => {
  test.setTimeout(180000);
  const k = kit(page, 'misclick');
  await k.newGame();
  await k.ph(`if (h.st.room.kind !== 'shop') await h.late.openRoomKind('shop'); return 1`);
  await page.waitForTimeout(2500);
  const stove = await k.ph<{ x: number; y: number; uid: number }>(`const s=h.st.items.find(i=>i.typeId==='stove'&&i.roomId===h.st.room.id); return {x:s.x,y:s.y,uid:s.uid}`);
  const p = await k.toScreen(stove.x, stove.y - 12);
  if (k.tag === 'desktop') {
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'misclick-shots/desktop-hover-stove.png' });
    const tag = await page.locator('.interact-hl:not([hidden]) .interact-tag').textContent();
    expect(['Cook', 'Collect']).toContain(tag);
    expect(await page.evaluate(() => document.querySelector('canvas')!.style.cursor)).toBe('pointer');
    // Away from everything: no highlight.
    await page.mouse.move(5, 690);
    await page.waitForTimeout(200);
    await expect(page.locator('.interact-hl')).toBeHidden();
  } else {
    // Walk next to the stove; the context button names its action.
    await page.mouse.click(p.x, p.y + 30);
    await page.waitForTimeout(3000);
    await page.keyboard.press('Escape');
    await k.ph(`h.st.avatar = { ...h.st.avatar, x: ${stove.x}, y: ${stove.y + 40} }; h.st.path = []; return 1`);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'misclick-shots/phone-context-button.png' });
    const btn = page.locator('.ctx-btn');
    k.note('coarse=' + await page.evaluate(() => matchMedia('(pointer: coarse)').matches) + ' panel=' + await k.ph('return h.st.lookAround') + ' av=' + JSON.stringify(await k.ph('return {x:h.st.avatar.x,y:h.st.avatar.y}')) + ' stove=' + JSON.stringify(stove));
    const shown = await btn.isVisible();
    k.note(`ctx visible=${shown} text=${shown ? await btn.textContent() : ''}`);
    expect(shown).toBe(true);
    expect(['Cook', 'Collect', 'Brew', 'Taps', 'Menu', 'Sit']).toContain(await btn.textContent());
    await page.screenshot({ path: 'misclick-shots/phone-button-shown.png' });
    k.note('at button: ' + await page.evaluate(() => { const b = document.querySelector('.ctx-btn')!.getBoundingClientRect(); const e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2) as HTMLElement; return e.tagName + '.' + e.className + ' parent ' + (e.parentElement?.className ?? ''); }));
    await btn.click({ timeout: 5000 }).catch((e) => k.note('click failed: ' + String(e).slice(0, 400)));
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'misclick-shots/phone-after-button.png' });
    k.note('panel after button: ' + await page.locator('.panel:not([hidden]) h2, .panel:not([hidden]) .panel-title').first().textContent({ timeout: 2000 }).catch(() => 'none'));
  }
});
