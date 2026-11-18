# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stack.spec.ts >> tap twice on one cell stacks the block
- Location: e2e\stack.spec.ts:5:1

# Error details

```
Error: after tap 1

expect(received).toBe(expected) // Object.is equality

Expected: 1
Received: 0
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - generic:
    - status:
      - generic: "Dirt block: tap a free cell to place it. Tap a block to punch it."
    - generic:
      - generic [ref=f1e4]:
        - generic [ref=f1e5]:
          - generic "Gold" [ref=f1e6]: "100"
          - 'generic "Gems: you find them by playing" [ref=f1e173]': "0"
        - 'generic "Level 1: 0 of 15 xp for level 2" [ref=f1e307]'
      - 'button "Tavern is open: tap to close" [ref=f1e308] [cursor=pointer]':
        - generic [ref=f1e412]: OPEN
    - generic: Tester
    - generic:
      - button "Catalog (C)" [ref=f1e413] [cursor=pointer]
      - button "Build (B)" [ref=f1e601] [cursor=pointer]
      - button "Dungeon" [ref=f1e782] [cursor=pointer]
      - button "More" [ref=f1e1014] [cursor=pointer]
    - text: "?"
    - generic:
      - generic:
        - button "Serve" [ref=f1e1128] [cursor=pointer]
        - button "Menu" [ref=f1e1195] [cursor=pointer]
      - generic [ref=f1e1362]:
        - heading "Bar" [level=2] [ref=f1e1363]
        - generic [ref=f1e1365]:
          - generic [ref=f1e1366]:
            - generic [ref=f1e1368]:
              - generic [ref=f1e1369]:
                - generic [ref=f1e1370]: Root ale
                - generic [ref=f1e1371]: 7/12
              - img "7 of 12 mugs" [ref=f1e1372]
            - button "Taps" [ref=f1e1385] [cursor=pointer]
          - generic [ref=f1e1386] [cursor=pointer]:
            - generic [ref=f1e1388]: Roasted turnip ×0
            - generic [ref=f1e1390]:
              - button "-" [ref=f1e1391]
              - generic "14 gold" [ref=f1e1392]: "14"
              - button "+" [ref=f1e1559]
            - 'button "Roasted turnip: on the menu" [pressed] [ref=f1e1560]': "On"
          - generic [ref=f1e1561] [cursor=pointer]:
            - generic [ref=f1e1563]: Root ale ×7
            - generic [ref=f1e1565]:
              - button "-" [ref=f1e1566]
              - generic "9 gold" [ref=f1e1567]: "9"
              - button "+" [ref=f1e1734]
            - 'button "Root ale: on the menu" [pressed] [ref=f1e1735]': "On"
        - button "Close" [ref=f1e1736] [cursor=pointer]: ✗
    - generic [ref=f1e1737]:
      - button "1 6" [ref=f1e1738] [cursor=pointer]:
        - generic: "1"
        - generic: "6"
      - button "2" [ref=f1e1739] [cursor=pointer]
      - button "3" [ref=f1e1740] [cursor=pointer]
      - button "4" [ref=f1e1741] [cursor=pointer]
      - button "5" [ref=f1e1742] [cursor=pointer]
      - button "6" [ref=f1e1743] [cursor=pointer]
      - generic [aria-hidden]: Dirt block x6
      - button "Bag (I)" [ref=f1e1744] [cursor=pointer]
```

# Test source

```ts
  1  | // Stack by tap (TESTER RUN 3 finding 1): with a block selected, tap 1 places, tap 2 on the SAME cell stacks on top (never removes).
  2  | import { test, expect } from '@playwright/test';
  3  | import { newGame, watchErrors } from './helpers';
  4  | 
  5  | test('tap twice on one cell stacks the block', async ({ page }) => {
  6  |   test.setTimeout(120000);
  7  |   const errs = watchErrors(page);
  8  |   await newGame(page);
  9  |   const k = await page.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i)!; try { const v = JSON.parse(localStorage.getItem(key)!); if (v.state) return { key, v }; } catch { /* skip */ } } return null; });
  10 |   k!.v.state.player.materials.dirt = 6;
  11 |   await page.evaluate(({ key, v }) => localStorage.setItem(key, JSON.stringify(v)), k!);
  12 |   await page.goto('/?e2e');
  13 |   await page.getByText('Continue').first().click();
  14 |   await page.waitForTimeout(3500);
  15 |   await page.mouse.click(5, 300); // skip the intro
  16 |   await page.waitForTimeout(800);
  17 |   await page.keyboard.press('1');
  18 |   await page.waitForTimeout(300);
  19 |   const info = await page.evaluate(() => { const s = (window as any).__ph.st; return { sel: s.selectedBlock, shown: s.shown, w: s.room.w, h: s.room.h, av: { x: s.avatar.x, y: s.avatar.y } }; });
  20 |   expect(info.sel).toBe('dirt');
  21 |   // find a free floor cell 3 cells from the avatar, in view
  22 |   const cell = await page.evaluate(() => {
  23 |     const h = (window as any).__ph; const s = h.st;
  24 |     const cx = Math.floor(s.avatar.x / 32), cy = Math.floor(s.avatar.y / 32);
  25 |     for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [-2, -2], [2, -2], [-3, 1], [3, 1]]) {
  26 |       const c = cx + dx, r = cy + dy;
  27 |       const p = h.worldToScreen({ x: c * 32 + 16, y: r * 32 + 16 }, s.shown);
  28 |       if (p.x > 20 && p.x < innerWidth - 20 && p.y > 20 && p.y < innerHeight - 100) return { c, r, p };
  29 |     }
  30 |     return null;
  31 |   });
  32 |   const stackOf = (c: number, r: number) => page.evaluate(([c, r]) => { const b = (window as any).__ph.st.room.blocks; const v = b && b[`${c},${r}`]; return v ? (Array.isArray(v) ? v.length : 1) : 0; }, [cell!.c, cell!.r]);
  33 |   for (const want of [1, 2, 3]) {
  34 |     await page.mouse.click(cell!.p.x, cell!.p.y);
  35 |     await page.waitForTimeout(1800);
> 36 |     expect(await stackOf(cell!.c, cell!.r), `after tap ${want}`).toBe(want);
     |                                                                  ^ Error: after tap 1
  37 |   }
  38 |   console.log(errs.list.join('\n'));
  39 | });
  40 | 
```