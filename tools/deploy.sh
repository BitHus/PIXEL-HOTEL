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
  "${SSH[@]}" "PREV=\$(readlink -f /opt/pocketbarrel/current || true); ln -sfn '$REL' /opt/pocketbarrel/current && systemctl restart pocketbarrel-server && sleep 3 && curl -fsS http://127.0.0.1:8080/api/health >/dev/null || { echo 'health check failed, rolling back' >&2; [ -n \"\$PREV\" ] && ln -sfn \"\$PREV\" /opt/pocketbarrel/current && systemctl restart pocketbarrel-server; exit 1; }; ls -1dt /opt/pocketbarrel/releases/* | tail -n +6 | xargs -r rm -rf"
  echo "server deployed $REF ($REL)"
fi
