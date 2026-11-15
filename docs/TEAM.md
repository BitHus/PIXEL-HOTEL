# TEAM HANDOFF (read this first when a new session starts)

Updated 2026-11-15. The main Claude session is the project manager. The user said: keep working on the game until they say stop; Claude decides all SMALL things; ask the user only for BIG ones.

## The team (agent definitions live in ~/.claude/agents/, all model: sonnet)
- lead: plans, writes docs/PLAN-*.md, no production code (tools: Read, Glob, Grep, Write, Edit, WebSearch, WebFetch; no shell, so the manager runs tests).
- coder: logic, data, tests, UI panel logic. Owns shared/, api/, game/, ui/ logic.
- artist: art, CSS, sprites. Owns render/, ui.css, icons, art/icon/light fields, art-src/, client/src/assets/sprites/. Draws pixel art in Aseprite with the Aseprite AI Artist plugin (aseprite@aseprite-ai-artist; Aseprite must be open and connected: call preflight).
- tester (new, ~/.claude/agents/tester.md): runs the game in a browser after each feature round and reports crashes, missing sprites, UI problems; no code changes.
- docs/QUEUE.md (written by the lead): the next coder and artist tasks as ready-to-paste prompts, so no lane waits.
- Aseprite plugin helper agents (also Sonnet): animation-director, palette-smith, pixel-critic, rig-builder.
- Start them with the Agent tool (subagent_type lead / coder / artist) and resume with SendMessage. Running agents do NOT survive a restart: a new session starts them again with a short prompt that points at the docs below.

## How we work
- Coder and artist run in parallel on different files; two coder tasks never run at once. Both use small Edit replacements in shared JSON files, never whole-file rewrites. Keep CRLF where files use it.
- After every batch the manager re-runs `npm test`, `npm run typecheck` and `npm run build` itself (the lead cannot run them), then COMMITS LOCALLY with `git -c user.name=Claude -c user.email=noreply@anthropic.com commit`, ending the message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. NEVER push to GitHub unless the user says so (a push deploys the game). No git identity is configured on this machine on purpose.
- Big decisions go to the user (avatar change, pushing, game balance changes). The lead gives a recommendation with each question.
- Tokens: the user's budget runs low; when they say pause, tell workers to stop at a safe point and write a PAUSE NOTE in docs/PLAN-1B.md.

## Docs map
- docs/PLAN-1B.md: phase 1B task list, order, save versions 24 to 31 reserved per task, risks. (Check its PAUSE NOTE sections.)
- docs/PLAN-SPRITES.md: Aseprite PNG sprite loader plan and workflow (D1-D6 approved).
- docs/PLAN-ART-UPGRADE.md: icons, blocks, floors, walls, models, new items, rounds R1.. of ~5 assets, quality gate (U2-U5 decided yes by the manager; U1 avatar still open).
- docs/ART-STYLE.md: Traveller's Rest + Growtopia mood, Endesga 32, 1 px outline, light top-left. art-src/RAMPS.md: colour ramps.
- CLAUDE.md: the project brief; docs/ROADMAP.md, NEXT-STEPS.md, NOTES.md.

## State (2026-11-15)
- Committed locally (not pushed): batch 1 (furniture split, carpentry, Inn name, save v24), sprite loader + register, batch 2 (T1a taps/register save v25, T1b kitchen zone, tavern sprites).
- Decided: taps are real; hats stay out of clothes packs; Inn score does not change old saves' guest rate; playtest checkpoints CP-1/CP-2 stay in the plan; 9h-1 stays after 9i; Aseprite sprites allowed ahead of step 6 with code-art fallback.
- In progress when this was written: coder on T1c (Taps panel, routing, pour/kitchen-tint wiring, barCoinPoint fix) then art-upgrade R1 loader generalisation; artist on the counter sprite.
- Next in order: K2 (casks/ripening), M-B (doors, connected Inn), 9g, 9i, 9h; art rounds R2.. after each feature round.
- Open for the user: U1 (allow a real pixel avatar, same proportions/layers); pushing to GitHub; the first playtest (about 1 hour, CP-1).
- Ideas not built yet: a tester worker that runs the game in a browser (npm run dev) and reports crashes, missing sprites and layout problems.
- Known small things: CLAUDE.md CURRENT STATE is stale (save version, over 250 lines); parseSpriteName regex lost a backslash; vite assetsInlineLimit is 0; the register/other sprites were never seen in the running game.

## Tools on this PC
- /myoffice (skill) shows all agents; turn on its "Subagents" switch. Finished subagents may stay "thinking" until the idle timeout.
- Game: `npm install` then `npm run dev` in C:\Users\ajren\PIXEL-HOTEL. Deployed version: https://bithus.github.io/pixel-hotel/
