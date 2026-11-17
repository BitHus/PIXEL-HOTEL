#!/usr/bin/env bash
# Deploy the built client to the VPS. Usage: POCKETBARREL_HOST=<ip> tools/deploy.sh [git-ref]
# Builds the ref (default HEAD) in a clean temp worktree and uploads client/dist to /var/www/html.
# Host and key come from the environment (never stored in the repo). Run only when the owner says go.
set -euo pipefail
: "${POCKETBARREL_HOST:?set POCKETBARREL_HOST to the VPS IP}"
KEY="${POCKETBARREL_KEY:-$HOME/.ssh/id_ed25519}"
REF="${1:-HEAD}"
D="$(mktemp -d)/pb-deploy"
git worktree add --detach "$D" "$REF" >/dev/null
trap 'git worktree remove --force "$D" >/dev/null 2>&1 || true' EXIT
(cd "$D" && npm ci --ignore-scripts --no-audit --no-fund && npm run build)
tar czf - -C "$D/client/dist" . | ssh -o BatchMode=yes -i "$KEY" "root@$POCKETBARREL_HOST" \
  'find /var/www/html -mindepth 1 -delete && tar xzf - -C /var/www/html && chmod -R a+rX /var/www/html'
echo "deployed $REF to $POCKETBARREL_HOST"

# Optional server deploy (ON-7), OFF by default. DEPLOY_SERVER=1 tools/deploy.sh [ref]
# Needs the VPS set up first (docs/OPS.md): user pocketbarrel, /opt/pocketbarrel, unit installed. Rolls back on a failed health check. tsx (root devDependency) is installed on purpose: the unit runs the TS sources.
if [ "${DEPLOY_SERVER:-0}" = "1" ]; then
  SSH=(ssh -o BatchMode=yes -i "$KEY" "root@$POCKETBARREL_HOST")
  REL="/opt/pocketbarrel/releases/$(date -u +%Y%m%d-%H%M%S)"
  (cd "$D" && tar czf - package.json package-lock.json tsconfig.base.json shared server tools/ops) | "${SSH[@]}" \
    "mkdir -p '$REL' && tar xzf - -C '$REL' && cd '$REL' && npm ci --workspace @pixel-hotel/server --include-workspace-root --no-audit --no-fund && chown -R pocketbarrel:pocketbarrel '$REL'"
  # PREV only when `current` is a real symlink to an existing dir (a first deploy has none: then a failed check just removes the link).
  # Health check retries for about 20 s (a slow tsx start must not cause a false rollback).
  "${SSH[@]}" bash -s -- "$REL" <<'REMOTE'
REL="$1"
PREV=$(readlink /opt/pocketbarrel/current 2>/dev/null || true)
ln -sfn "$REL" /opt/pocketbarrel/current
systemctl restart pocketbarrel-server
ok=0
for _ in $(seq 1 20); do
  sleep 1
  if curl -fsS http://127.0.0.1:8080/api/health >/dev/null 2>&1; then ok=1; break; fi
done
if [ "$ok" != 1 ]; then
  echo 'health check failed' >&2
  if [ -n "$PREV" ] && [ -d "$PREV" ]; then
    echo "rolling back to $PREV" >&2
    ln -sfn "$PREV" /opt/pocketbarrel/current && systemctl restart pocketbarrel-server
  else
    echo 'no previous release: removing the link' >&2
    rm -f /opt/pocketbarrel/current
  fi
  exit 1
fi
ls -1dt /opt/pocketbarrel/releases/* | tail -n +6 | xargs -r rm -rf
REMOTE
  echo "server deployed $REF ($REL)"
fi

# SAVE_VERSION check (REVIEW 6): the server refuses uploads from a newer client ('too_new'), so the two must match.
# Reads the built client's version from the source and the server's from /api/health (saveVersion). Warns only (the client is already live).
CLIENT_SV=$(sed -n 's/^export const SAVE_VERSION = \([0-9]*\);.*/\1/p' "$D/shared/src/config/player.ts")
SERVER_SV=$(ssh -o BatchMode=yes -i "$KEY" "root@$POCKETBARREL_HOST" 'curl -fsS http://127.0.0.1:8080/api/health 2>/dev/null' | sed -n 's/.*"saveVersion":\([0-9]*\).*/\1/p' || true)
if [ -z "$SERVER_SV" ]; then
  echo "note: server health not reachable or no saveVersion (server not deployed yet?); client SAVE_VERSION is $CLIENT_SV"
elif [ "$SERVER_SV" != "$CLIENT_SV" ]; then
  echo "WARNING: client SAVE_VERSION $CLIENT_SV != server $SERVER_SV: cloud uploads will be refused until the server is deployed (DEPLOY_SERVER=1 tools/deploy.sh)." >&2
else
  echo "SAVE_VERSION $CLIENT_SV matches the server"
fi
