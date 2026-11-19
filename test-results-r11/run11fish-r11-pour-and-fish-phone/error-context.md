# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: run11fish.spec.ts >> r11 pour and fish
- Location: e2e\run11fish.spec.ts:12:1

# Error details

```
Test timeout of 540000ms exceeded.
```

```
Error: locator.dispatchEvent: Test timeout of 540000ms exceeded.
Call log:
  - waiting for locator('.more-menu button[title^="Worlds"]').first()

```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - generic:
    - generic: Warm in here. I like it.
    - generic:
      - generic [ref=f1e4]:
        - generic [ref=f1e5]:
          - generic "Gold" [ref=f1e6]: "109"
          - 'generic "Gems: you find them by playing" [ref=f1e173]': "0"
        - 'generic "Level 1: 0 of 15 xp for level 2" [ref=f1e307]'
      - 'button "Tavern is open: tap to close" [ref=f1e308] [cursor=pointer]':
        - generic [ref=f1e412]: OPEN
    - generic: Tester
    - generic:
      - button "Catalog (C)" [ref=f1e413] [cursor=pointer]
      - button "Build (B)" [ref=f1e601] [cursor=pointer]
      - button "Dungeon" [ref=f1e782] [cursor=pointer]
      - 'button "Worlds: travel" [ref=f1e1014] [cursor=pointer]'
      - generic:
        - button "More" [ref=f1e1176] [cursor=pointer]
        - generic [ref=f1e1290]:
          - 'button "Workshop: crafting and the Blacksmith" [ref=f1e1291] [cursor=pointer]': Workshop
          - 'button "Book: everything you found (J)" [ref=f1e1385] [cursor=pointer]': Book
          - 'button "Skills: spend your skill points" [ref=f1e1502] [cursor=pointer]': Skills
          - button "Room" [ref=f1e1608] [cursor=pointer]
          - button "Avatar" [ref=f1e1712] [cursor=pointer]
          - button "Chat (Enter)" [ref=f1e1889] [cursor=pointer]: Chat
          - button "Settings" [ref=f1e1976] [cursor=pointer]
          - button "Emote" [ref=f1e2078] [cursor=pointer]
          - 'button "Look around: drag to pan the room" [ref=f1e2245] [cursor=pointer]': Look around
    - text: "?"
    - status "First steps, 4/21" [ref=f1e2327]:
      - generic [ref=f1e2328]: Pinch with two fingers to zoom
      - button "Skip the first steps" [ref=f1e2352] [cursor=pointer]: ×
    - generic:
      - button "Tap the guest to serve"
    - list "Open orders":
      - listitem "Tap to pour this order (at a table)" [ref=f1e2353] [cursor=pointer]:
        - generic: T
    - generic [ref=f1e2354]:
      - button "Empty slot" [ref=f1e2355] [cursor=pointer]
      - button "Empty slot" [ref=f1e2356] [cursor=pointer]
      - button "Empty slot" [ref=f1e2357] [cursor=pointer]
      - button "Empty slot" [ref=f1e2358] [cursor=pointer]
      - button "Empty slot" [ref=f1e2359] [cursor=pointer]
      - button "Empty slot" [ref=f1e2360] [cursor=pointer]
      - button "Bag (I)" [ref=f1e2361] [cursor=pointer]
```

# Test source

```ts
  1  | // TESTER RUN 11: pouring UI states (hold, perfect window, over, tray, coins) and fishing UI states (cast, bite, reel, catch, result).
  2  | // Shots r11-shots/{desktop,phone}-pour-* and -fish-*. One browser, one project at a time (config e2e/run11live.config.ts).
  3  | import { test } from '@playwright/test';
  4  | import * as fs from 'fs';
  5  | import { kit } from './run6kit';
  6  | import { watchErrors, openMoreMenu } from './helpers';
  7  | 
  8  | fs.mkdirSync('r11-shots', { recursive: true });
  9  | const tagOf = (page: any) => (page.viewportSize().width < 600 ? 'phone' : 'desktop');
  10 | const S = (page: any, n: string) => page.screenshot({ path: `r11-shots/${tagOf(page)}-${n}.png` });
  11 | 
  12 | test('r11 pour and fish', async ({ page }) => {
  13 |   test.setTimeout(540000);
  14 |   const errs = watchErrors(page); const k = kit(page, 'r11fish');
  15 |   await page.goto('/?e2e'); await page.waitForTimeout(1500);
  16 |   await k.newGame();
  17 |   // ---- pouring
  18 |   let g: any = null;
  19 |   for (let i = 0; i < 60 && !g && !process.env.NOPOUR; i++) { await page.waitForTimeout(2000); g = (await k.state()).tavern.guests.find((x: any) => x.order); }
  20 |   k.note('guest order ' + !!g);
  21 |   if (g) {
  22 |     await S(page, 'pour-00-order-marker');
  23 |     const uid = (await k.state()).items.find((i: any) => i.typeId === 'tap_stand').uid;
  24 |     const p = await k.toScreen(g.x, g.y - 28); await page.mouse.click(p.x, p.y); await page.waitForTimeout(3500);
  25 |     await S(page, 'pour-01-waiting-at-taps');
  26 |     const sp = await k.ph<any>(`return h.standPoint(${uid})`);
  27 |     await page.mouse.move(sp.x, sp.y); await page.mouse.down();
  28 |     await page.waitForTimeout(450); await S(page, 'pour-02-hold-early');
  29 |     await page.waitForTimeout(550); await S(page, 'pour-03-hold-nearperfect');
  30 |     await page.waitForTimeout(100); await S(page, 'pour-04-hold-late');
  31 |     await page.waitForTimeout(300); await S(page, 'pour-05-hold-over');
  32 |     await page.mouse.up(); await page.waitForTimeout(400); await S(page, 'pour-06-released');
  33 |     await page.waitForTimeout(1200); await S(page, 'pour-07-tray');
  34 |     const st = await k.state(); k.note('tray ' + JSON.stringify(st.tavern.tray));
  35 |     const g2 = st.tavern.guests.find((x: any) => x.order) ?? st.tavern.guests[0];
  36 |     const p2 = await k.toScreen(g2.x, g2.y - 28); await page.mouse.click(p2.x, p2.y);
  37 |     await page.waitForTimeout(2500); await S(page, 'pour-08-carrying');
  38 |     await page.waitForTimeout(5000); await S(page, 'pour-09-delivered');
  39 |     await page.waitForTimeout(25000); await S(page, 'pour-10-coins');
  40 |   }
  41 |   // ---- fishing
  42 |   await openMoreMenu(page);
> 43 |   await page.locator('.more-menu button[title^="Worlds"]').first().dispatchEvent('click'); await page.waitForTimeout(500);
     |                                                                    ^ Error: locator.dispatchEvent: Test timeout of 540000ms exceeded.
  44 |   await page.locator('.travel-card', { hasText: /Lakeside/ }).first().click(); await page.waitForTimeout(6500);
  45 |   await page.mouse.click(5, 300); await page.waitForTimeout(500);
  46 |   await S(page, 'fish-00-lakeside');
  47 |   const vp = page.viewportSize()!;
  48 |   const bar = page.locator('.fish-bar:visible');
  49 |   let cast = false;
  50 |   for (const fy of [0.28, 0.2, 0.38, 0.5]) for (const fx of [0.85, 0.75, 0.9, 0.6]) {
  51 |     if (cast) break;
  52 |     await page.mouse.click(vp.width * fx, vp.height * fy); await page.waitForTimeout(900);
  53 |     cast = (await bar.count()) > 0;
  54 |     if (cast) k.note(`cast at ${fx},${fy}`);
  55 |   }
  56 |   k.note('cast ' + cast);
  57 |   if (cast) {
  58 |     let last = ''; let n = 0; let reel = 0;
  59 |     for (let i = 0; i < 600; i++) {
  60 |       await page.waitForTimeout(100);
  61 |       if (!(await bar.count())) { await S(page, 'fish-90-barGone'); break; }
  62 |       const t = (await page.locator('.fish-text').first().innerText().catch(() => '')) || '';
  63 |       if (/bite|now/i.test(t) && t !== last) await page.mouse.click(vp.width * 0.5, vp.height * 0.8);
  64 |       if (t !== last) { last = t; n++; await S(page, `fish-${String(n).padStart(2, '0')}-${t.replace(/[^a-z]/gi, '').slice(0, 12)}`); k.note('phase text: ' + t); }
  65 |       if (/bite|now/i.test(t)) { await page.mouse.click(vp.width * 0.4, vp.height * 0.8); }
  66 |       if (/box|fish/i.test(t) && !/bite/i.test(t)) {
  67 |         reel++; if (reel % 3 === 0) { await page.keyboard.down('Space'); await page.waitForTimeout(220); await page.keyboard.up('Space'); }
  68 |         if (reel === 6 || reel === 20) await S(page, `fish-reel-${reel}`);
  69 |       }
  70 |     }
  71 |     await page.waitForTimeout(1500); await S(page, 'fish-95-after');
  72 |   }
  73 |   k.note('errors ' + JSON.stringify(errs.list));
  74 | });
  75 | 
```