# WORKER PROMPT TEMPLATE AND LESSONS (the manager reads this at startup; workers are told to read their part)

## Prompt template (every worker prompt, short)
1. Repo C:\Users\ajren\PIXEL-HOTEL (branch main). Read CLAUDE.md + the named docs. State the OWNED files/folders and who else is editing what (re-read a file right before editing it).
2. Objective in the owner's own words (quote them), then numbered tasks in order.
3. Gate: `npm run check` exit code (ignore red in files you did not touch, name them). Commit NOTHING (the manager commits). No deploy, no VPS.
4. What NOT to do (ranked numbers, brief rules, owner decisions, other workers' files).
5. Docs: NEWS 1-3 lines on top, ROADMAP tick, CLAUDE.md/BRIEF when a rule changes.
6. Report: DONE / HOOKS NEEDED / OPEN / PROVEN / NOT SEEN in a browser. Model: sonnet.

## Roles and tools (what exists, use it)
- coder: shared/ + client/ logic. ONE at a time per area (a second only on tools/, server/ or separate files). tools/profile-tavern.ts = frame-time + CPU profile of the tavern.
- artist/animator: ONE Aseprite worker at a time (ONE Aseprite instance). Must follow docs/ART-WORKFLOW.md: palette check, look in the game with `node tools/view-sprite.mjs`, aseprite:pixel-critic pass with a score. Boxy props are bugs.
- tester: Playwright, own worktree/dist, writes e2e + docs/FIXLIST.md only; every bug gets a spec that FAILS until fixed (e2e/run6pan.spec.ts, boot.spec.ts are examples).
- planner/researcher: docs only.

## Lessons (17 Nov)
- Agent definitions (~/.claude*/agents) once pointed at the OLD tree PIXEL-HOTEL-rebased: fixed; the tree is C:\Users\ajren\PIXEL-HOTEL on main.
- No Python on this PC: use node for scripts. Git Bash shell cwd resets each call; use absolute paths.
- A worker's guess-fix is not a fix: have a tester reproduce with numbers first (the pan teleport was the camera + avatar, not the guests).
- Workers that only see Aseprite zooms miss in-game problems: use the viewer.
- Owner's big lines first, then small logical improvements the manager decides itself; ask only for big decisions.
- Ship after every green batch: check -> add -A -> commit -> push -> `POCKETBARREL_HOST=149.245.246.67 bash tools/deploy.sh` -> curl 200 -> rewrite docs/STATUS.md.

## From web research (17 Nov)
- Parallel coders on overlapping files: use Agent isolation worktree (each gets its own git worktree, merge after) instead of sharing the tree. Subagents cannot spawn subagents; multi-agent costs ~15x tokens, so keep prompts tight and workers few.
- Game studio style gates (design -> implement -> review -> done): our npm run check + tester spec per bug is the gate; add a pixel-critic gate for art.
- Aseprite MCP servers exist with art-QA sweeps and screenshot loops; our plugin already has validate, look and pixel-critic: no new install needed.
- Genre lessons: a tavern sim needs a relaxed mode (no pressure), narrative events (rumours board, regulars) and a visible money feedback loop; core systems must be tuned until fun.
