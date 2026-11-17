#!/usr/bin/env bash
# Daily sqlite backup with rotation. Run by pocketbarrel-backup.timer as the pocketbarrel user.
# Env (all optional): PB_DB, PB_BACKUP_DIR, PB_BACKUP_KEEP (days kept), PB_BACKUP_REMOTE (off-box target, e.g.
# "user@host:/backups/pb/" for rsync; EMPTY = local only; set it in /etc/pocketbarrel.env once decided).
set -euo pipefail
DB="${PB_DB:-/var/lib/pocketbarrel/pb.sqlite}"
DIR="${PB_BACKUP_DIR:-/var/backups/pocketbarrel}"
KEEP="${PB_BACKUP_KEEP:-14}"
REMOTE="${PB_BACKUP_REMOTE:-}"
umask 077
if [ ! -s "$DB" ]; then echo "refusing to back up: database missing or empty: $DB" >&2; exit 1; fi
if [ "$(sqlite3 "$DB" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='accounts';")" != "1" ]; then
  echo "refusing to back up: no accounts table in $DB" >&2; exit 1
fi
mkdir -p "$DIR"
OUT="$DIR/pb-$(date -u +%Y%m%d-%H%M%S).sqlite"
# .backup is safe while the server writes (WAL), unlike cp.
sqlite3 "$DB" ".backup '$OUT'"
if [ "$(sqlite3 "$OUT" 'PRAGMA integrity_check;')" != "ok" ]; then
  echo "backup failed integrity check: $OUT" >&2
  rm -f "$OUT"
  exit 1
fi
gzip -f "$OUT"
find "$DIR" -name 'pb-*.sqlite.gz' -mtime +"$KEEP" -delete
if [ -n "$REMOTE" ]; then rsync -a "$DIR/" "$REMOTE"; fi
echo "backup ok: $OUT.gz"
