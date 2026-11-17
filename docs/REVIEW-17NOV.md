# REVIEW 17 NOV: commit 8cc2c17 (read-only review, no fixes made)

Scope: quests (questBoard.ts, quests.json, progressApi.ts, questPanel.ts, save 33), crypt Abandon, PourFx.syncTapStates, plantViews sparkle, server/ (http, accounts, rateLimit, saves, admin), tools/ops/*, tools/deploy.sh server step.
Two quest findings (1, 4) were reproduced with a throwaway vitest file (deleted again). The rest is read from the code; where a claim depends on the host OS it says so.

Clean (checked, nothing found): SAVE 33 migration and isGameState (no data loss; hintsDone kept), purity of questBoard.ts (time and zone are passed in, no Date.now / Math.random), the quest reward goes through applyChange (reason 'quest'), abandon is deterministic and guarded by status 'active' and place 'crypt', all SQL is parameterised, session tokens are server-made (no fixation) and stored hashed, bodies are size-capped (4 KB / PB_SAVE_MAX_BYTES), nginx overwrites X-Forwarded-For so PB_TRUST_PROXY=1 is not a bypass as configured, ufw allows OpenSSH before enable.

## HIGH

### 1. Daily quests can be claimed again and again (clock or time-zone flip; also an honest traveller) - REPRODUCED
- shared/src/questBoard.ts:204-205 (the `keep` filter) and :132 (progress has only a lower time bound).
- A claim on day B drops every `daily:A:*` claim. Back on day A (time zone changed, device clock set back, or a flight west over midnight) the rows of A are unclaimed again and still complete, so they pay again; that claim drops B's claims, and so on. Entries stamped "tomorrow" also count for "today" because questProgress only checks `e.at >= sinceMs`.
- Reproduction: ledger entries at 00:30 UTC on 18 Nov, then claim the dailies alternately with `now` = 00:30 and 23:30 the day before: 3 cycles paid 276 gold with no new play (one cycle should be the cap).
- Fix: drop a dated claim only when its day is older than today by 2 or more days (compare day indices, never "not today"); add the upper bound `e.at < sinceMs + 86_400_000` for dailies. When the server becomes authoritative, the day must come from the server clock, not from a client tzOffset without limits (clamp to -840..720).
- Severity: high for the rule (unbounded gold, breaks the 75 a day cap the test asserts); in today's LocalGameAPI the player owns the save anyway, so not urgent before P5.

### 2. The ledger is never trimmed and quests now depend on all of it: saves grow without end, the cloud save stops at 1 MB
- shared/src/ledger.ts (no cap anywhere; grep finds no slice/trim), shared/src/questBoard.ts:187 (achievements count from `at >= 0`), server/src/config.ts:36 (saveMaxBytes 1_000_000), tools/ops/nginx conf:25 (1m).
- One entry is about 95 to 120 bytes of JSON (measured 95). Every coin tap, plant, harvest, tap load, order, sale writes one. At an ESTIMATED 400 entries per hour the save passes 1 MB after roughly 20 to 25 hours of play: from then on every PUT /api/save answers 413 and the cloud save silently stays old. localStorage holds the save plus one backup, so the browser quota (about 5 MB) follows later.
- Before this commit the ledger could have been trimmed freely; now a trim would wipe achievement progress, so the fix needs a decision.
- Fix: keep counters for achievements in GameState.quests (or fold old entries into per-reason totals when trimming), then cap the ledger (for example the last 2000 entries or 7 days). Measure a real long save first to confirm the rate.
- Severity: high for cloud saves (flag is off today), medium for local.

## MEDIUM

### 3. A death or an Abandon counts as "bring your bag home"
- shared/src/dungeon/bank.ts:88 writes reason 'dungeon_bank' for status 'dead' too (note "dungeon run dead"); quests.json d_run, run_5, run_25, ml_run count reason 'dungeon_bank'; the new Abandon (step.ts:136) makes it instant.
- Scenario: start a run, press Abandon, confirm: d_run pays 20 gold for a 10 gold key (free under 10 gold), and run_5 / run_25 / ml_run tick without playing.
- Fix: count only left runs (a `noteIncludes: "left"` field in QuestDef, or a separate ledger reason 'dungeon_lost' for dead runs). The same applies to the mine only in the sense that Leave at once gives d_mine 20 gold for free each day (by design? decide).

### 4. Reaching level 3 re-rolls the day's quests - REPRODUCED
- shared/src/questBoard.ts:99-111: the pool depends on the level, and so does the whole 30-day history chain.
- Level 2 and level 3 give different dailies on 259 of the next 365 days. Example 17 Nov 2026: level 2 = d_fish2, d_run, d_serve12; level 3 = d_fish2, d_serve12, d_cook3. A player who levels up mid-day loses the row in progress and gets a new claimable one (more than 3 claims that day).
- Fix: build the history chain with the full pool (level-free) and only swap out a gated quest at the end, or fix the day's set at the first board of the day (store the ids for today's key in GameState.quests).

### 5. Ripe sparkle is never shown (dead hook)
- client/src/farm/plantViews.ts:45, 96, 171-174: `sparkle` is declared, set to null and animated, but no line ever creates the Sprite (checked in the commit and in the working tree). plants/ripe_sparkle.png exists and is unused; the commit message and NEWS say the sparkle is in.
- Fix: create the Sprite in paint() when the stage is full and spriteFrames('plants','ripe','sparkle',32) exists; destroy it otherwise.

### 6. Client and server SAVE_VERSION can drift: every cloud upload refused
- tools/deploy.sh:13 always deploys the client; the server only with DEPLOY_SERVER=1 (line 19). server/src/saves.ts:40 uses the server's own shared readSave: a save with a higher version = 'too_new' (409).
- Scenario: a SAVE_VERSION bump like this commit's 32 -> 33 deployed the normal way: the server still knows 32 and refuses all uploads until someone remembers the server deploy. GitHub Pages pushes have the same effect.
- Fix: /api/health returns the server's SAVE_VERSION and deploy.sh compares it with the built client's (fail or warn); or deploy the server by default once it is live.

### 7. Ops scripts are not executable in git (mode 100644)
- `git ls-files -s tools/ops tools/deploy.sh`: all 100644. pocketbarrel-backup.service:9 ExecStart runs backup-db.sh directly; OPS.md 8 runs set-password.sh directly.
- From a Windows Git Bash deploy it works by accident (MSYS reports files with a shebang as executable, so tar ships 755). From Linux, macOS or CI the files arrive 644: the nightly backup fails with 203/EXEC (only visible in the journal) and there are no backups.
- Fix: `git update-index --chmod=+x` on the .sh files, or `ExecStart=/usr/bin/env bash /opt/pocketbarrel/current/tools/ops/backup-db.sh`.

### 8. Off-box backup mirrors deletions
- tools/ops/backup-db.sh:21 `rsync -a --delete-after "$DIR/" "$REMOTE"`.
- Scenario: the VPS is lost and rebuilt (or the backup dir is emptied); the first timer run backs up the new empty database (sqlite3 creates a missing file, integrity "ok") and --delete removes every old backup on the remote, exactly the ones needed for the restore. The same happens for files past PB_BACKUP_KEEP: the remote never holds more history than the box.
- Fix: no --delete (prune the remote with its own, longer rule), and refuse to back up when the DB file is missing or has no accounts table.

### 9. First server deploy that fails leaves `current` pointing at itself
- tools/deploy.sh:24: `PREV=$(readlink -f /opt/pocketbarrel/current || true)`. When `current` does not exist yet, GNU readlink -f still prints the path and exits 0, so PREV = /opt/pocketbarrel/current. On a failed health check the rollback runs `ln -sfn /opt/pocketbarrel/current /opt/pocketbarrel/current`: a symlink loop.
- OPS.md 3 describes exactly this case (first run before the unit exists: "it just reports the failure"); after it, step 4 `systemctl enable --now` fails (WorkingDirectory cannot be resolved) until the next deploy.
- Fix: `PREV=$(readlink /opt/pocketbarrel/current 2>/dev/null || true)` and roll back only if `[ -d "$PREV" ]`; else remove the link.
- Related, same line (lower): the health check is one try after `sleep 3` (a slow tsx start on a small VPS = false rollback; use a retry loop of about 20 s); the client is already live when the server step fails; a rollback does not undo a DB migration the new release ran at start (fine with one migration today, a rule is needed before migration 2).

## LOW

### 10. Register limit counts attempts, not accounts
- server/src/http.ts:108: registerPerIp (3 per hour) is taken before validation. Three typos (name taken, short password) lock the IP for an hour; a household or school behind one address gets 3 attempts in total. Fix: a looser attempt limit plus the 3 per hour only on success.

### 11. Login limit per name lets anyone lock a known user out
- server/src/http.ts:121: loginPerName 10 per hour counts every attempt, also good logins. Ten wrong passwords for "Anna" (2 minutes from one IP) = Anna gets 429 with the right password for the rest of the hour; repeatable for ever. Fix: count only failures, and key the name limit by name + ip hash with a much higher global per-name ceiling (or a delay instead of a refusal).

### 12. systemd restart limit is probably not active
- tools/ops/pocketbarrel-server.service:16-17: StartLimitIntervalSec is a [Unit] key; in [Service] systemd ignores it with a warning (to confirm: `systemd-analyze verify`). With the default 10 s window and RestartSec=3 the burst of 5 is never reached, so a broken release restarts for ever instead of "max 5 in 60 s" (OPS.md 4). Fix: move both lines to [Unit].

### 13. "made" quests also count refunds; splice quest counts twice
- questBoard.ts:133 counts any 'cook'/'brew' entry with a positive material: the refunds "stove gone" (cooking.ts:122) and "barrel gone" (brewing.ts:82) count as a batch made. Needs selling the stove, so it costs gold: a miscount, not a loop.
- splice_3 counts reason 'splice', written at the splice (farm.ts:140) AND at the harvest of the spliced plant (farm.ts:235): 2 splices harvested = done. Harvests of spliced plants do not count for the harvest quests.
- Fix: a per-quest sign/notes filter (splice: only entries with a negative material; made: note starts with "collected").

### 14. Quest gold is not in balance.ts
- No 'quest' source in shared/src/balance.ts or `npm run simulate`; only the data test (dailyCount * dailyGoldMax <= 75). Bounded (dailies about 35 to 60 gold a day, events 75 each, achievements 770 once), so no loop, but for a 20-minute-a-day player quests are about a third of the gold and the S3 share table (each source 10% to 50%) does not see them. Fix: add the line and a test for the share.

### 15. Tap state overlay: stale depth and a hard-coded slot count
- client/src/render/pourFx.ts:127 loops `slot < 2` instead of TAP_SLOTS; :138 registers the depth key only when the sprite is created, so after the bar or stand is moved the position follows but the draw order stays that of the old spot (overlay can draw under or over the wrong things until a reload). Fix: TAP_SLOTS; re-add or update the depth key in every sync.

### 16. Small ops notes
- set-password.sh:7 sources /etc/pocketbarrel.env as the pocketbarrel user: OPS.md says 640 root:pocketbarrel (works), but the unit file comment (line 11) and the env example (line 1) say chmod 600 owner root (then the script fails). Make the three agree.
- backup files and directory get the default umask (world-readable); they hold the password hashes and every save. Add `umask 077`.
- setup-firewall.sh: `ufw allow OpenSSH` is port 22 only; with sshd on another port the script locks the box (OPS.md warns; the script could read the port from `sshd -T`). On Debian 12 without rsyslog the sshd jail needs `backend = systemd` or fail2ban does not start; the script would end with an error at `fail2ban-client status`.
- deploy.sh:13-14 (older code): the site is deleted before the new files are unpacked; a dropped connection leaves an empty site. Unpack to a temp dir and swap.
- The Abandon question (client/src/ui/runBar.ts:79) does not say that the lunch box food is lost too (step.ts:363).
