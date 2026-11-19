# PLAN-ONLINE (17 Nov 2026, planner; owner gave the GO for online)

Goal: players visit each other's rooms (hotel rooms, taverns) and see what friends build. Safety first
(CLAUDE.md 13). Items marked DECISION need the owner (section 7).
Live: https://pocketbarrel.com (static client, nginx, Ubuntu VPS, 1 CPU, 4 GB, 20 GB, certbot).
Game server: server.pocketbarrel.com (wss). Today server/ is a placeholder (server/src/index.ts, no deps).

## 0. THE KEY CHOICE (read first)
CLAUDE.md 3 says "the server is authoritative, the client only sends requests". GameAPI has 86 methods
and LocalGameAPI runs every rule (tavern clock, dungeon run, farm, splice...) in the browser. Making the
server run ALL of that is a big job and is not needed to let people visit. So:
- STAGE A (P1 to P3, this plan): the server is authoritative for ACCOUNTS, SAVE STORAGE, VISITS and CHAT.
  Solo rules still run in the browser (LocalGameAPI); the cloud holds the save.
  Cheating a solo save only hurts that player, as long as nothing shared has value.
- STAGE B (P5, before trading, leaderboards or any shared economy): the same shared/ rules run on the
  server (RemoteGameAPI = full authority); the clocks (stepShop, dungeon run) move to a server tick.
Visits are safe in stage A because a visitor never changes the host's save (read only) and the server
builds the visible room from the host's saved state, never from what a client claims. DECISION 1.

## 1. PHASES (smallest first)
P1 ACCOUNTS + CLOUD SAVE (no visits yet)
- Register / login with username + password only; checkbox "I am 13 or older" (stored as a boolean + date).
  No email, no real name, no reset by email (an admin tool sets a new password).
- The client saves to the server after changes (debounced 5 s, and on tab hide) and loads on login.
  localStorage stays as the offline copy; "Play offline" keeps working.
- Conflict rule (manager decision): NEWEST savedAt wins. The whole GameState (with SAVE_VERSION) is uploaded on change
  (debounced); the server keeps backups. First login with a local save: imported (revision 1) after one tap; if both
  exist the newer savedAt is used, the older is kept as a backup and a short notice names both.
- Done when: register, play, close, log in on a phone, same game.
P2 VISIT A FRIEND'S ROOM, READ-ONLY
- Enter by visit code or from the public room list (section 3) as a GUEST AVATAR (own look and display name):
  see floor, walls, furniture, blocks, plants, the owner's avatar (standing, or walking if online), other
  visitors; tap the floor to walk (server checks the path with the shared nav grid, sends the full path once,
  clients animate). No place, pick up, punch, plant. Sitting on seats is allowed (cosmetic, server-validated).
- Public chat in the room: word filter, max 120 chars, 10 msg/s per connection, bubbles + log. Report, per-player
  mute (stored per account), room private flag, owner kick/ban of a visitor from their rooms.
- Done when: two browsers, two accounts: A visits B's hotel room, walks, chats; a private room refuses.
P3 TAVERN VISITORS / SHOWCASE
- Visit a tavern read-only: a server-side SNAPSHOT of seats, plates, taps summary, open sign, appeal, room stars
  (guests are the host's local simulation, so the visitor sees the last snapshot, refreshed every 30 s while the
  host is online). Visitors cannot order or pay (no gold moves between players in stage A).
- Showcase card per room: owner name, stars, appeal, level, last seen. Optional like counter (DECISION 6).
- Visitors may sit and use emotes (cosmetic).
- Done when: A's tavern shows its open sign and tables to B; B sits and emotes.
P4 LATER (not now)
- Trading ONLY with a safe design and only after P5: server-authoritative inventory, item-for-item escrow,
  both sides confirm a locked list, trade lock for new accounts (3 days), both ledgers written in ONE SQLite
  transaction (single applyChange path, CLAUDE.md 9), no gold or gems at first, daily caps, rank limits (no
  legendary at first), report + audit log. A design review comes before any code.
- Also later: leaderboards, shared lobby tavern. Friend lists and private messages stay out (CLAUDE.md 13).
P5 (prerequisite of P4): server-authoritative game (stage B).

## 2. ARCHITECTURE
One Node process "pb-server" (TypeScript) on the VPS:
- `ws` WebSocket server + a tiny HTTP router (node:http, no express) in the same process, on 127.0.0.1:8080.
  better-sqlite3 (synchronous, one file, WAL) and bcryptjs (cost 10, about 60 ms per hash, behind a login limiter).
- nginx terminates TLS (certbot already works) for server.pocketbarrel.com and proxies:
  `location /ws { proxy_pass http://127.0.0.1:8080; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade;`
  `proxy_set_header Connection "upgrade"; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; proxy_read_timeout 75s; }`
  `location /api/ { proxy_pass http://127.0.0.1:8080; client_max_body_size 1m; limit_req zone=api burst=20; }`
  nginx zones: api 5 r/s per IP, login 5 r/min per IP. Socket origin check: only https://pocketbarrel.com
  (+ http://localhost:5173 in dev). CORS allows that single origin.
- Client stays static at pocketbarrel.com and calls https://server.pocketbarrel.com (Vite env VITE_SERVER_URL);
  offline play needs no server.
- Sessions: login returns a random 32-byte token, stored hashed (sha256) in `sessions`, 30 days sliding.
  HTTP `Authorization: Bearer`; ws first message `{t:'auth', token}`. No cookies (no CSRF), no JWT secrets.
Budget (1 CPU, 4 GB): Node about 80 MB baseline; 100 connected clients with small JSON is well inside it.
Caps: 200 connections, 20 visitors per room, 30 live rooms, ws message max 4 KB, save upload max 1 MB (gzip).
RemoteGameAPI vs LocalGameAPI:
- Stage A: a small separate `OnlineAPI` interface (auth, saves, visit, chat) so the 86 solo methods stay untouched.
  LocalGameAPI stays the game; `CloudSaves` plugs into the existing storage interface (client/src/api/saveStorage.ts,
  savesApi.ts). The visit screen is a new read-only client mode ("VisitView") reusing render/ (items, avatars,
  never rules) and the shared nav.
- Stage B: RemoteGameAPI implements all of GameAPI over ws requests; the server calls the same shared/ functions
  (time and rng are already passed in); LocalGameAPI becomes the offline/test adapter.
- Message shapes live in shared/src/net/ (pure types + validators, tested): `{t, v, id?, ...}` as in BRIEF 11.
  Server to client (P2): room_state (snapshot), avatar_joined, avatar_left, avatar_path (full path once), chat, error.
  Client to server (P2): auth, visit {code|roomKey}, leave, walk {x,y}, chat {text}, emote, report, mute.
- Visible rooms: on every accepted save the server derives `rooms_public.snapshot` (room + items of that room +
  look + stars/appeal). Visits read ONLY the snapshot: no wallet, ledger, inventory or other rooms ever leave.
SAVE VALIDATION (stage A): parse with shared/src/save.ts (same migrations), refuse a SAVE_VERSION newer than the
server knows, check size and shape and cheap pure invariants (unique item uids, ledger sums match wallet, room
items pass canPlace). It does not replay the game. On failure: keep the last good revision, the client shows
"Could not save to the cloud" and keeps the local copy.
SQLITE SCHEMA (data/pb.sqlite; numbered files server/migrations/NNN.sql + schema_version table)
- accounts(id PK, username UNIQUE NOCASE, pw_hash, created_at, age_ok, display_name, banned_until, ban_reason, last_login)
- sessions(token_hash PK, account_id, created_at, expires_at, ip_hash)
- saves(account_id PK, revision, version, blob gzip, saved_at, client_saved_at)
- save_backups(account_id, revision, version, blob, saved_at): last 10 + 1 daily for 14 days
- rooms_public(room_key PK, account_id, room_id, kind, title, visibility 'private'|'code'|'public', visit_code UNIQUE NULL,
  stars, appeal, level, snapshot BLOB, updated_at)
- player_mutes(account_id, target_id); room_bans(room_key, account_id)
- reports(id, reporter_id, target_id, room_key, kind, text_snippet, chat_context, created_at, status)
- chat_log(room_key, account_id, text, ts) kept 7 days (needed for reports)
- bans(account_id, until, reason, by); audit(id, ts, account_id, action, detail); cloud_ledger (stage B only)
LEDGER RULES: stage A keeps the player's own ledger inside the save; the cloud never edits gold, gems or items.
Stage B: every change goes through applyChange on the server and is appended to cloud_ledger; a trade writes both
sides inside one transaction.
SAVE MIGRATION: cloud blobs carry `version`; the server owns the same migration chain (shared/src/save.ts) so a
new client upgrades an old blob; the SAVE_VERSION bump rule (CLAUDE.md SAVING) stays. A client older than the
cloud save gets "Please reload to update" (index.html uncached, assets hashed). `revision` compare-and-swap stops
two devices overwriting each other.

## 3. FINDING EACH OTHER WITHOUT FRIEND REQUESTS
CLAUDE.md 13: no friend requests in v1, no private messages. Proposal, three layers, each owner-controlled:
1. VISIT CODE (the main way). Every room is PRIVATE by default. "Share" creates a 6-character code (no 0/O/1/I/L:
   31^6 = about 887 million, guess attempts rate limited) like `K7QX2M`, or a link `pocketbarrel.com/?visit=K7QX2M`.
   The owner can rotate or delete it any time. The host does not get a list of who knocked.
2. PUBLIC ROOMS BOARD (optional per room). "Show in the list" adds it to a Rooms board (newest, most stars; 20 per
   page): filtered title (max 24 chars), owner display name, stars, visitors now. Owner can hide it any time;
   moderation can remove it.
3. RECENT: the last 10 rooms you visited, kept with your account.
No friend lists, invites, name search or messages in v1 (name search of public rooms only is DECISION 2).
Display names are filtered at register and change (letters, digits, spaces, max 16 as in character creation).

## 4. SAFETY AND OPS CHECKLIST
From CLAUDE.md 13 and BRIEF 11:
- [ ] Accounts: username + password only; password min 8; bcrypt cost 10; no password in logs; 13+ checkbox;
  admin CLI sets a new password (tools/admin.ts reset <user>).
- [ ] Rate limits: 10 messages/s per connection (token bucket; drop, then close on repeated breaches); login 5 per
  minute per IP and 10 per hour per username; register 3 per hour per IP; visit-code tries 10 per minute;
  report 5 per minute; save upload 1 per 2 s.
- [ ] Validation of every message: shape (a validator per `t`), ownership, ranges, coordinates on the floor, paths by
  shared nav, text max 120 chars (trimmed, control chars removed), size limits; unknown `t` dropped; always the
  session's account id, never a client-sent id.
- [ ] Chat: public in the room only; server word filter (data list, handles spacing and leetspeak, allowlist, corpus
  test); report button on lines and avatars; per-player mute kept server side; slow mode 1 line per 1.5 s; owner
  kick/ban; repeated flags = auto mute 10 min; report queue read via admin CLI.
- [ ] No real-money purchases, gems earned only, no timers or tricks (unchanged).
- [ ] Privacy: store the minimum (username, hash, display name, save). IP only as keyed hash, 14-day retention; no
  chat beyond 7 days. Delete-my-account button before public release (DECISION 7).
- [ ] Anti-abuse: registration per IP hash limit, ban list, reject absurd saves.
Ops (VPS 1 CPU, 4 GB, 20 GB):
- [ ] systemd `pb-server.service`: user `pb` (no shell, no sudo), WorkingDirectory /opt/pb-server/current,
  Restart=always, NoNewPrivileges=true, ProtectSystem=strict, ReadWritePaths=/var/lib/pb, MemoryMax=1G,
  EnvironmentFile=/etc/pb-server.env (0600). Node binds 127.0.0.1 only.
- [ ] ufw: default deny incoming; allow 22 (SSH keys only, password login off), 80, 443.
- [ ] fail2ban: sshd, nginx limit-req, and a `pb-login` jail on the auth-failure log line.
- [ ] Updates: unattended-upgrades (security), Node LTS for user `pb`, monthly manual reboot window.
- [ ] Backups: nightly `sqlite3 pb.sqlite ".backup"` into /var/backups/pb (keep 14); weekly copy off the box;
  monthly restore test; weekly `PRAGMA integrity_check`.
- [ ] Logs: journald SystemMaxUse=300M, MaxRetentionSec=14day; nginx logrotate 14 days, IP last octet dropped
  after 7; daily timer prunes chat_log (7 days); reports kept 90 days.
- [ ] Monitoring: /api/health (uptime, connections, db ok) polled by a free external pinger; disk alert at 80%.
- [ ] certbot renew timer checked (`certbot renew --dry-run`), HSTS, CSP (connect-src pocketbarrel.com and
  server.pocketbarrel.com only).

## 5. TESTS AND DEPLOY
Tests (Vitest, pure first):
- shared/src/net: message validators, rate-limit bucket (time passed in), chat filter + sanitize (corpus), visit-code
  generator (rng passed in), visibility rules, snapshot builder (a save gives a snapshot with NO wallet, ledger,
  inventory or other rooms), guest path validation.
- server (SQLite `:memory:`): register/login/lockout, session expiry, save revision CAS, old-version migration,
  backup rotation, report/mute/ban.
- Integration: server on a random port, two `ws` clients (owner A, visitor B): visit, walk, chat, filtered word,
  private refusal, 11th message in 1 s refused, kick.
- Client: CloudSaves with a fake fetch, the conflict choice as a pure function, VisitView render smoke.
- e2e (Playwright, e2e/): two browser contexts against a local server (`npm run e2e:online`).
- Load check: 100 fake ws clients for 5 minutes on the VPS: CPU under 50%, RAM under 500 MB (tools/loadtest-online.ts).
Deploy:
- Client: tools/deploy.sh (exists; clean worktree build, uploads client/dist to /var/www/html; only when the owner says
  go). Build with VITE_SERVER_URL=https://server.pocketbarrel.com.
- Server: new tools/deploy-server.sh in the same style (POCKETBARREL_HOST env): clean worktree, `npm ci --omit=dev`,
  build, upload to /opt/pb-server/releases/<ref>, atomic `current` symlink switch, pre-restart DB `.backup`,
  `systemctl restart pb-server`, health check, automatic rollback to the previous release if /api/health fails.
- Rollout: P1 behind "Cloud save (beta)" in Settings; test with 3 to 5 invited friends before anything public.
  The server hello carries `minClientVersion`; an old client shows "Reload".

## 6. TASK LIST (S under half a day, M about a day, L 2 to 3 days; max 2 workers; gate = typecheck + tests green)
P0
- ON-0 (S, owner) answer decisions 1 to 8. Gate: sign-off.
- ON-1 (S, coder) server package: ws, better-sqlite3, bcryptjs deps, `npm run server`, config, migrations runner,
  /api/health. Files: server/package.json, server/src/{index,config,db,migrate,http}.ts. Gate: starts, health, :memory: tests.
- ON-2 (S, coder) shared/src/net: message types + validators, rate bucket, text sanitize, tests. Files: shared/src/net/*.ts. No client change.
P1 ACCOUNTS + CLOUD SAVE
- ON-3 (M, coder) accounts, sessions, login limiter. Files: server/src/{accounts,auth}.ts. Gate: tests.
- ON-4 (M, coder) save store: PUT/GET /api/save, revision CAS, validation via shared save.ts, backups. Files:
  server/src/saves.ts (shared/src/save.ts read only). Gate: old-version migration test.
- ON-5 (M, coder + ui) client account panel, CloudSaves, conflict dialog. Files: client/src/ui/accountPanel.ts,
  client/src/api/cloudSaves.ts, shared/src/saveConflict.ts. Gate: fake-fetch tests, e2e.
- ON-6 (S, ops) VPS: nginx block + cert for server.pocketbarrel.com, systemd unit, ufw, fail2ban, backup timer. Files:
  ops/ (conf and unit text) + docs/OPS-ONLINE.md. Gate: owner runs the checklist.
- ON-7 (S, coder) tools/deploy-server.sh with rollback. Gate: dry run on the VPS. G-owner: same game on 2 devices.
P2 VISIT
- ON-8 (M, coder) visibility, visit codes, rooms_public, snapshot builder (pure). Files: shared/src/net/{snapshot,visitCode,visibility}.ts, server/src/rooms.ts.
- ON-9 (L, coder) ws hub: auth, visit/leave, per-room presence, walk checked by shared nav, full path once,
  join/leave, caps, ping, reconnect. Files: server/src/{ws,hub,roomPresence}.ts.
- ON-10 (L, coder) client VisitView: read-only room mode reusing render/ and nav, guest avatar, no build/punch/plant
  input, visitor list, leave. Files: client/src/visit/*, client/src/game/visitMode.ts, client/src/ui/visitPanel.ts. Gate: e2e two browsers.
- ON-11 (M, coder) chat, filter, report, mute, owner kick/ban, private flag, admin report CLI. Files:
  shared/src/net/chatFilter.ts + shared/data/chatBlock.json, server/src/{chat,reports,moderation}.ts, client/src/ui/{chatPanel,reportDialog}.ts. Gate: corpus + rate tests.
- ON-12 (S, ui) Rooms board, Recent, Share dialog (code + link). Files: client/src/ui/{roomsBoard,shareRoom}.ts.
- ON-13 (S, tester) abuse pass: malformed JSON fuzz, oversize payloads, code guessing, rate limits. G-owner: invite 3 to 5 friends.
P3 TAVERN VISITORS
- ON-14 (M, coder) tavern snapshot (no gold) + visitor render. Files: shared/src/net/tavernSnapshot.ts, client/src/visit/tavernView.ts.
- ON-15 (S, coder) visitor sit + emotes, showcase card, optional likes (DECISION 6).
P5 (own plan later): ON-20 server-authoritative RemoteGameAPI, then a P4 trading design review before any trading code.
Rough budget: P0+P1 about 6 to 8 worker-days; P2 about 8 to 10; P3 about 3.

## 7. OPEN DECISIONS FOR THE OWNER (recommendation first)
1. Staging (DECIDED by the manager: no full server authority now, rules change daily; anti-cheat = P5). Stage A now (server = accounts, cloud save, visits; solo rules stay in the browser), full server authority
   only before trading (P5). Recommend YES: visits ship in weeks, safe because read only. It relaxes CLAUDE.md 3 for
   solo play until P5; the brief text must then be updated.
2. Finding people. Recommend visit codes (default private) + optional public Rooms board; NO name search, NO friend
   lists in v1 (matches CLAUDE.md 13). Alternative: name search of public rooms only.
3. Default visibility. Recommend every room PRIVATE until the owner taps Share, tavern too.
4. Which rooms can be visited. Recommend hotel rooms and the tavern (P2/P3); farm and lakeside later; dungeon and mine never.
5. Chat content. Recommend text only, URLs blocked, 120 chars, filter + report + mute, 7-day server log for reports.
   Optional: quick-chat emotes only for brand-new accounts.
6. Likes on a room. Recommend skip in P2, a plain counter without rewards in P3 that the owner can turn off.
7. Account deletion and data. Recommend a Delete account button and a short plain privacy text before any public
   release; inactive accounts kept until deleted on request.
8. Hosting and backups. Recommend the current VPS for a private test (up to about 50 players), a bigger one when public;
   weekly off-box backup copy to your PC (or a cheap object store). Which one?
9. Moderation. Recommend you read reports via a daily CLI digest, auto-mute at 3 reports, an editable block-list data file.
10. Public name. "PocketBarrel" is the domain; confirm it as the public name (CLAUDE.md 1 wants a final original name).
11. Money between players. Recommend visitors can never pay or tip the host in stage A; revisit only with trading (P4).


## OWNER DECISION 19 Nov: SCOPE
Online is only for the hotel room (suite), the garden and public spaces. The tavern (with kitchen and cellar), farm, mine and dungeon are not shared or visitable. Share/visit endpoints and the Rooms board must refuse other room kinds (server validates by Room.kind). Public spaces: design open (lobby/plaza with live avatars?), decide before P2 ON-9.
