# OPS: server for server.pocketbarrel.com (ON-6 / ON-7)

Everything here is PREPARED, not run. The manager runs the commands below on the VPS after review. No secret is in the repo: the VPS holds `/etc/pocketbarrel.env`. Files live in `tools/ops/`. Stage A server: accounts and cloud saves over HTTP (docs/PLAN-ONLINE.md).

Assumed on the VPS (Debian/Ubuntu, root via ssh key): nginx and certbot already serve pocketbarrel.com (PB-2/PB-3). Node 20+ installed (`node -v`), plus `sqlite3`, `rsync`, `curl`.

## 0. DNS
Add an A (and AAAA) record `server.pocketbarrel.com` pointing to the VPS. Check: `dig +short server.pocketbarrel.com`.

## 1. User, folders, env (as root)
```
apt-get install -y sqlite3 rsync curl
useradd --system --home /opt/pocketbarrel --shell /usr/sbin/nologin pocketbarrel
install -d -o pocketbarrel -g pocketbarrel /opt/pocketbarrel /opt/pocketbarrel/releases /var/lib/pocketbarrel /var/backups/pocketbarrel
# on your PC: scp tools/ops/pocketbarrel.env.example root@HOST:/etc/pocketbarrel.env
sed -i "s/^PB_IP_KEY=.*/PB_IP_KEY=$(openssl rand -hex 32)/" /etc/pocketbarrel.env
chown root:pocketbarrel /etc/pocketbarrel.env && chmod 640 /etc/pocketbarrel.env
```
The unit reads the env file as root (systemd) so 640 root:pocketbarrel is enough for the backup service and the admin script.

## 2. Firewall and fail2ban (once)
```
scp tools/ops/setup-firewall.sh root@HOST:/root/ && ssh root@HOST bash /root/setup-firewall.sh
```
Opens 22, 80, 443 only (port 8080 stays closed, nginx proxies to 127.0.0.1). WARNING: be sure ssh is on 22 or edit the script first, or you lock yourself out. Check: `ufw status`, `fail2ban-client status`.

## 3. First server release (from your PC)
```
POCKETBARREL_HOST=<ip> DEPLOY_SERVER=1 tools/deploy.sh <git-ref>
```
This also redeploys the client (as before). The server step uploads shared/ server/ and root package files to `/opt/pocketbarrel/releases/<time>`, runs `npm ci` there (builds better-sqlite3; needs build-essential and python3: `apt-get install -y build-essential python3`), points `/opt/pocketbarrel/current` at it, restarts, checks `/api/health` and rolls back to the previous release when that fails. Five releases are kept. Without `DEPLOY_SERVER=1` the script does what it did before.
The very first run needs the unit (step 4) installed first, so do step 4 before step 3 or the restart fails (then it just reports the failure).

## 4. systemd units (as root)
```
scp tools/ops/pocketbarrel-server.service tools/ops/pocketbarrel-backup.service tools/ops/pocketbarrel-backup.timer root@HOST:/etc/systemd/system/
systemctl daemon-reload
systemctl enable --now pocketbarrel-server
systemctl enable --now pocketbarrel-backup.timer
systemctl status pocketbarrel-server --no-pager
curl -s http://127.0.0.1:8080/api/health
```
The server runs as user `pocketbarrel`, restarts on failure (3 s, max 5 in 60 s), cannot write outside `/var/lib/pocketbarrel`.

## 5. nginx and certificate (as root)
```
scp tools/ops/nginx-server.pocketbarrel.com.conf root@HOST:/etc/nginx/sites-available/server.pocketbarrel.com
# move the two limit_req_zone lines and the map line to /etc/nginx/conf.d/pb-limits.conf, delete them from the site file
ln -s /etc/nginx/sites-available/server.pocketbarrel.com /etc/nginx/sites-enabled/
```
The cert files do not exist yet, so nginx -t fails on the 443 block. Get the cert first: temporarily comment the 443 server block, `nginx -t && systemctl reload nginx`, run `certbot --nginx -d server.pocketbarrel.com`, restore the block, then `nginx -t && systemctl reload nginx`. Check: `curl -s https://server.pocketbarrel.com/api/health`.
Rate limits: 10 req/s per IP on /api (burst 20), 1 req/s on login and register (burst 5); the server has its own per-IP and per-name limits too. nginx overwrites X-Forwarded-For, which is why `PB_TRUST_PROXY=1` is safe.

HEALTH PATH (checked live 19 Nov): `https://server.pocketbarrel.com/api/health` (200 `{ok,time,saveVersion}`). `/health`, `/` and anything on the root domain pocketbarrel.com answer nginx 404: that is expected, point an external pinger at /api/health.

## 6. Turn the cloud client on
Build the client with `VITE_CLOUD_SAVE=1 VITE_SERVER_URL=https://server.pocketbarrel.com` (flag default stays off in the repo). `PB_ORIGINS` must be `https://pocketbarrel.com` (CORS). OPEN (19 Nov live check): https://www.pocketbarrel.com serves the game too (200, no redirect) but is NOT an allowed origin, so cloud calls from www fail as 'network'. Either redirect www -> apex in nginx (preferred: one origin = one local save) or set `PB_ORIGINS=https://pocketbarrel.com,https://www.pocketbarrel.com` and restart.

## 7. Backups
REVIEW 6-9 (17 Nov): `/api/health` also returns `saveVersion`; deploy.sh compares it with the client SAVE_VERSION and warns on a mismatch (deploy the server with `DEPLOY_SERVER=1`). The server health check retries about 20 s; a failed FIRST deploy removes the `current` link, later ones roll back only to an existing previous release. The ops .sh files are mode 755 in git and the backup unit runs `bash` on the script. The backup refuses a missing or empty DB or one without the accounts table, uses umask 077 and rsync WITHOUT --delete (prune the remote yourself).

`pocketbarrel-backup.timer` runs `tools/ops/backup-db.sh` daily at about 03:30 as `pocketbarrel`: sqlite `.backup` (safe while the server writes), integrity check, gzip into `PB_BACKUP_DIR`, delete files older than `PB_BACKUP_KEEP` days (14). Test: `systemctl start pocketbarrel-backup && ls -l /var/backups/pocketbarrel`; list timers: `systemctl list-timers pocketbarrel-backup.timer`.
OFF-BOX TARGET (open, owner decides): set `PB_BACKUP_REMOTE=user@host:/path/` in `/etc/pocketbarrel.env` (rsync over ssh; the `pocketbarrel` user needs its own key) or any other target. Empty = local only, which does NOT survive losing the VPS.
Restore: stop the server, `gunzip -c backup.sqlite.gz > /var/lib/pocketbarrel/pb.sqlite`, remove stale `pb.sqlite-wal` and `-shm`, `chown pocketbarrel:pocketbarrel`, start.

## 8. Admin: new password for a user
No email reset exists. On the VPS as the pocketbarrel user (or root):
```
sudo -u pocketbarrel /opt/pocketbarrel/current/tools/ops/set-password.sh <username>
```
It asks for the password (hidden, read from stdin, never argv), applies the same rules as register (8 to 72 bytes), and ends all that user's sessions. Pure rule + tests: server/src/admin.ts, admin.test.ts.

Ban, unban, delete (19 Nov; run in `/opt/pocketbarrel/current` as `pocketbarrel` with the env loaded: `set -a; . /etc/pocketbarrel.env; set +a`):
```
node --import tsx server/src/adminCli.ts ban <username> <days 1..3650> <reason>
node --import tsx server/src/adminCli.ts unban <username>
node --import tsx server/src/adminCli.ts delete-user <username> --yes
```
A ban ends every session at once; login with the right password then answers 403 `banned` until it runs out. delete-user removes the account, its save, backups and shared rooms (reports keep the row). Tests: server/src/hardening.test.ts.
The server refuses to START when the env is unsafe (config.ts configProblems): with `PB_TRUST_PROXY=1` it needs `PB_IP_KEY` of 32+ characters (not CHANGE_ME) and https-only `PB_ORIGINS`; a non-loopback `PB_HOST` needs `PB_ALLOW_PUBLIC=1`. The reason is printed in `journalctl -u pocketbarrel-server`.

## 9. Rollback and logs
Rollback by hand: `ln -sfn /opt/pocketbarrel/releases/<older> /opt/pocketbarrel/current && systemctl restart pocketbarrel-server`. Logs: `journalctl -u pocketbarrel-server -f`, `/var/log/nginx/error.log`.

## Checklist for the owner (ON-6 gate)
health over https answers; register and login work from the game with the cloud flag on; `systemctl restart pocketbarrel-server` brings it back; kill -9 the node process and it restarts; backup file appears; `ufw status` shows only 22/80/443.
