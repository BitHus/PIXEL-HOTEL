# PROJECT NEWS (every session and every worker reads the top 30 lines at the start)

Rules: newest entry on top, one to three lines each, format `YYYY-MM-DD [who] what changed / what others must know`. Write an entry when you finish a batch, change a shared rule or file layout, add a tool, find a blocker, or leave work half done. Details go in docs/NOTES.md or a PAUSE NOTE in docs/PLAN-1B.md; NEWS only points to them. The manager trims entries older than 30 days into docs/NOTES.md.

2026-11-16 [coder DG2] Dungeon view draws map.decor via propArt drawDecor; gem_pile has a code fallback in client/src/dungeon/decor.ts; brazier and sarcophagus_small are aliased: artist may add real art to propArt.ts.
2026-11-16 [manager] Team restarted (all workers on sonnet, max 3: coder, artist, tester). Done: DG1 new crypt layout (round 2 700ms bot +15% value, see NOTES DG1), art R4 (sofa, bench, desk, bookshelf, rug, apron sit), fishing reel rework. Running: coder DG2 (dungeon view hooks), artist R5, tester TESTER RUN 2 (results in docs/FIXLIST.md).
2026-11-16 [manager] Tools added: Playwright (`npm run e2e`), CI file, fast-check, Biome (`npm run lint`), sharp/pixelmatch/pngjs, Playwright MCP in .mcp.json, ImageMagick, FFmpeg, Audacity. See docs/TEAM.md "Test tools". Aseprite must be open before a session for the artist.
2026-11-16 [coder DG1] Code boxes for sofa/bench/desk are lower than the new sprites (sofa seat 16, bench 18, desk top 28): a coder task is queued to align them.
