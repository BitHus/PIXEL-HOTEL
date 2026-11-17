#!/usr/bin/env bash
# Admin: set a new password for a user (no email reset exists). Run on the VPS as the pocketbarrel user.
# Usage: tools/ops/set-password.sh <username>   (asks for the new password, hidden; ends all that user's sessions)
set -euo pipefail
U="${1:?usage: set-password.sh <username>}"
cd /opt/pocketbarrel/current
set -a; . /etc/pocketbarrel.env; set +a
read -r -s -p "New password for $U: " P; echo
printf '%s\n' "$P" | node --import tsx server/src/adminCli.ts set-password "$U"
