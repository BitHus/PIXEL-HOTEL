#!/usr/bin/env bash
# Pulls a consistent copy of the live server database (accounts + cloud saves) to a Desktop folder.
# Usage: bash tools/backup-to-desktop.sh   (needs the ssh key for root@149.245.246.67)
set -e
HOST="${POCKETBARREL_HOST:-149.245.246.67}"
DEST="${PB_DESKTOP_BACKUP:-/c/Users/ajren/Desktop/PocketBarrel-server-backups}"
mkdir -p "$DEST"
STAMP=$(date +%Y%m%d-%H%M%S)
ssh "root@$HOST" "sqlite3 /var/lib/pocketbarrel/pb.sqlite \".backup /tmp/pb-$STAMP.sqlite\" && gzip -f /tmp/pb-$STAMP.sqlite"
scp -q "root@$HOST:/tmp/pb-$STAMP.sqlite.gz" "$DEST/"
ssh "root@$HOST" "rm -f /tmp/pb-$STAMP.sqlite.gz"
ls -t "$DEST"/pb-*.sqlite.gz | tail -n +31 | xargs -r rm -f   # keep the newest 30
echo "saved $DEST/pb-$STAMP.sqlite.gz"
