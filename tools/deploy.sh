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
(cd "$D" && npm ci --silent && npm run build)
tar czf - -C "$D/client/dist" . | ssh -o BatchMode=yes -i "$KEY" "root@$POCKETBARREL_HOST" \
  'find /var/www/html -mindepth 1 -delete && tar xzf - -C /var/www/html && chmod -R a+rX /var/www/html'
echo "deployed $REF to $POCKETBARREL_HOST"
