#!/usr/bin/env bash
# Härtung der Cerberus-VMs (Mason .211, LawNet .212). Als root auf der jeweiligen VM ausführen:
#   ssh max@192.168.178.211 'sudo bash -s' < scripts/vm-haertung.sh      (dann dasselbe für .212)
# Danach (Updates brauchen Neustart): LawNet-VM `sudo reboot`, anschließend homelab-backend auf Hermes neu starten.
set -e
export DEBIAN_FRONTEND=noninteractive
cat > /etc/ssh/sshd_config.d/00-hardening.conf <<X
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
MaxAuthTries 3
X11Forwarding no
X
sshd -t && systemctl reload ssh
timedatectl set-timezone Europe/Berlin
systemctl restart cron
# ufw: LAN + Docker-Netze (Container -> Host, z. B. Portfolio-Backend auf 172.17.0.1) dürfen, sonst zu.
# Notbremse: schaltet ufw nach 3 Minuten wieder aus, falls etwas schiefgeht (unten abgeräumt).
systemd-run --on-active=180 --unit=ufw-notbremse /usr/sbin/ufw --force disable >/dev/null
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow from 192.168.178.0/24 comment LAN >/dev/null
ufw allow from 172.16.0.0/12 comment "Docker-Netze" >/dev/null
ufw --force enable | tail -1
apt-get update -qq
apt-get upgrade -y -qq -o Dpkg::Options::=--force-confold >/dev/null
systemctl stop ufw-notbremse.timer 2>/dev/null || true
echo "---"; timedatectl | grep "Time zone"; sshd -T | grep -E "^passwordauthentication"; ufw status | head -5
[ -f /var/run/reboot-required ] && echo "NEUSTART NÖTIG" || echo "kein Neustart nötig"
