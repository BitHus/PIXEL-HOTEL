#!/usr/bin/env bash
# Run once on the VPS as root: firewall (ufw) + fail2ban for ssh and nginx. Idempotent.
set -euo pipefail
apt-get update -y
apt-get install -y ufw fail2ban
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

cat > /etc/fail2ban/jail.d/pocketbarrel.local <<'JAIL'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true

[nginx-limit-req]
enabled = true
logpath = /var/log/nginx/error.log

[nginx-botsearch]
enabled = true
JAIL
systemctl enable --now fail2ban
systemctl restart fail2ban
ufw status verbose
fail2ban-client status
