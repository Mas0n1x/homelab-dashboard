#!/bin/bash
# Homelab Dashboard
# Copyright (c) 2024-2026 DEV Mas0n1x.
# Licensed under the MIT License.
#
# Umzug Dashboard (+ Stalwart) von Hermes auf Ares (Raspberry Pi 5). Läuft auf dem
# PC in Git Bash. Alles Schwere ist vorbereitet (Images gebaut, Repo/.env/Schlüssel
# in /srv/homelab-dashboard auf Ares, Compose-Datei docker-compose.ares.yml mit
# 172.20.0.0/16 wie auf Hermes, cloudflared-Tunnel "ares", pi-tunnel-Benutzer auf Ares).
#
#   ./umzug-ares.sh check     Vorabprüfung, nur lesen
#   ./umzug-ares.sh daten     AUSFALL beginnt: Hermes-Stack stoppen, Volumes kopieren, Ares starten
#   ./umzug-ares.sh tunnel    Tunnel von Cerberus/Mason/LawNet auf Ares umhängen, Hermes-Eintrag auf "remote"
#   ./umzug-ares.sh domain    dash.mas0n1x.online von Hermes-Tunnel auf Tunnel "ares" biegen
#   ./umzug-ares.sh zurueck   Rückweg: Hermes-Stack wieder starten, Tunnel + Domain zurück
#
# Hermes' Daten bleiben unangetastet (nur kopiert, nicht verschoben) -> Rückweg jederzeit.
# NICHT automatisiert (siehe Gehirn-Notiz "Umzug Dashboard und Stalwart nach Ares"):
# Fritzbox-Portfreigaben für Mail (25, 465, 587, 993, 143), DNS/DDNS für mail.mas0n1x.online.

set -u
HERMES=Masons-VPS
ARES=ares
HERMES_IP=188.34.130.109
ARES_IP=192.168.178.94
DIR=/srv/homelab-dashboard
COMPOSE="docker compose -f docker-compose.ares.yml"
VOLS="homelab-data bot-runtime-data stalwart-data"
# Tunnel-Endpunkte, die auf Ares umgehängt werden: user@ip|sudo-Präfix
TUNNELHOSTS=("root@192.168.178.210|" "max@192.168.178.211|sudo" "max@192.168.178.212|sudo")

ok()   { echo "  ✔ $*"; }
fail() { echo "  ✘ $*"; FEHLER=1; }
FEHLER=0

check() {
  echo "== Vorabprüfung =="
  ssh -o ConnectTimeout=8 $HERMES true && ok "Hermes erreichbar" || fail "Hermes nicht erreichbar"
  ssh -o ConnectTimeout=8 $ARES true && ok "Ares erreichbar" || fail "Ares nicht erreichbar"
  ssh $ARES "cd $DIR && for i in backend frontend bot-runtime; do docker image inspect homelab-dashboard-\$i >/dev/null 2>&1 || exit 1; done" \
    && ok "Images auf Ares gebaut" || fail "Images fehlen (docker compose -f docker-compose.ares.yml build)"
  ssh $ARES "docker image inspect stalwartlabs/stalwart@sha256:dcf575db2d53d9ef86d6ced8abe4ba491984659a0f8862cc6079ee7b41c3c568 >/dev/null 2>&1" \
    && ok "Stalwart-Image (arm64) da" || fail "Stalwart-Image fehlt"
  ssh $ARES "cd $DIR && $COMPOSE config -q && test -s .env && test -s ssh/id_ed25519" \
    && ok "Compose + .env + Schlüssel ok" || fail "Compose/.env/Schlüssel fehlen"
  ssh $ARES "docker inspect -f {{.State.Running}} cloudflared 2>/dev/null | grep -q true" && ok "cloudflared (Container) auf Ares aktiv" || fail "cloudflared inaktiv"
  ssh $ARES "ss -ltn | grep -E ':(80|25|587|465|993|143) ' ; true" | grep -q . \
    && fail "Ports 80/25/587/465/993/143 auf Ares belegt" || ok "Ports 80/25/587/465/993/143 auf Ares frei"
  n=$(ssh $ARES "ssh-keygen -l -f /home/pi-tunnel/.ssh/authorized_keys | awk '{print \$2}' | sort -u | wc -l")
  [ "${n:-0}" -ge 4 ] && ok "pi-tunnel auf Ares: $n verschiedene Schlüssel (Cerberus, Mason, LawNet, Ares)" \
    || fail "pi-tunnel auf Ares hat nur ${n:-0} verschiedene Schlüssel — Ares' eigenen Tunnelschlüssel eintragen (Gehirn-Notiz, Schritt 0)"
  ssh $HERMES "docker ps --format '{{.Names}}' | grep -c homelab" | xargs -I{} echo "  · Hermes: {} homelab-Container laufen"
  for v in $VOLS; do
    s=$(ssh $HERMES "docker run --rm -v homelab-dashboard_$v:/v:ro alpine du -sk /v | cut -f1")
    echo "  · Volume $v: ${s:-?} KB"
  done
  [ $FEHLER = 0 ] && echo "== alles bereit ==" || { echo "== NICHT bereit =="; return 1; }
}

daten() {
  check || exit 1
  echo "== Hermes-Stack stoppen (Ausfall von Dashboard + Mail beginnt) =="
  ssh $HERMES "cd $DIR && docker compose stop frontend nginx bot-runtime backend stalwart"
  for v in $VOLS; do
    echo "== Volume $v kopieren =="
    ssh $ARES "docker volume create homelab-dashboard_$v >/dev/null && docker run --rm -v homelab-dashboard_$v:/v alpine sh -c 'rm -rf /v/* /v/.[!.]* 2>/dev/null; true'"
    ssh $HERMES "docker run --rm -v homelab-dashboard_$v:/v:ro alpine tar c -C /v ." \
      | ssh $ARES "docker run --rm -i -v homelab-dashboard_$v:/v alpine tar x -C /v" || { echo "FEHLER bei $v — Abbruch"; exit 1; }
    a=$(ssh $HERMES "docker run --rm -v homelab-dashboard_$v:/v:ro alpine sh -c 'find /v -type f | wc -l'")
    b=$(ssh $ARES   "docker run --rm -v homelab-dashboard_$v:/v:ro alpine sh -c 'find /v -type f | wc -l'")
    [ "$a" = "$b" ] && ok "$v: $a Dateien identisch" || { echo "  ✘ $v: Hermes $a ≠ Ares $b — Abbruch"; exit 1; }
  done
  echo "== ACME-Zertifikate, Mail-Cron, SaleNet-Sync mitnehmen =="
  ssh $HERMES "tar c -C /srv _acme" | ssh $ARES "tar x -C /srv"
  for f in /usr/local/bin/mail-cert-deploy.sh /usr/local/bin/salenet-sync.sh; do
    ssh $HERMES "cat $f" | ssh $ARES "cat > $f && chmod 755 $f"
  done
  for f in /etc/cron.d/mail-cert /etc/cron.d/salenet-sync; do
    ssh $HERMES "cat $f" | ssh $ARES "cat > $f && chmod 644 $f"
  done
  echo "== Ares-Stack starten =="
  ssh $ARES "cd $DIR && $COMPOSE up -d && sleep 20 && docker ps --format '{{.Names}} {{.Status}}'"
  code=$(ssh $ARES "curl -s -o /dev/null -w '%{http_code}' http://localhost/")
  echo "  · http://localhost/ auf Ares: $code"
  echo "Weiter: ./umzug-ares.sh tunnel   dann   ./umzug-ares.sh domain"
}

tunnel() {
  echo "== Ares' eigener Tunnel zeigt auf sich selbst =="
  ssh $ARES "sed -i 's/$HERMES_IP/127.0.0.1/' /etc/systemd/system/dashboard-tunnel.service && systemctl daemon-reload && systemctl restart dashboard-tunnel"
  for t in "${TUNNELHOSTS[@]}"; do
    h=${t%%|*}; s=${t##*|}
    echo "== $h =="
    ssh -o ConnectTimeout=8 $h "$s sed -i 's/$HERMES_IP/$ARES_IP/' /etc/systemd/system/dashboard-tunnel.service && $s systemctl daemon-reload && $s systemctl restart dashboard-tunnel" \
      && ok "Tunnel umgehängt" || fail "$h: umhängen fehlgeschlagen"
  done
  sleep 20
  echo "== Tunnel-Ports auf Ares (erwartet 2222 2223 2224 2225 61209 61210 61211 61212) =="
  ssh $ARES "ss -ltn | grep -o '172.20.0.1:[0-9]*' | sort"
  echo "== Hermes-Eintrag von 'lokal' auf 'remote' (Docker/Glances über seine öffentliche Adresse) =="
  ssh $ARES "docker exec -i -w /app homelab-backend node -" <<'JS'
const D = require('better-sqlite3'); const db = new D('/app/data/dashboard.db');
const r = db.prepare("UPDATE servers SET is_local=0, docker_socket=NULL, ssh_host=?, ssh_port=22, ssh_user='root', ssh_key_path='/app/ssh/id_ed25519', glances_url=replace(glances_url,'host.docker.internal',?) WHERE id='local'").run('188.34.130.109','188.34.130.109');
console.log('Zeilen geändert:', r.changes);
JS
  ssh $ARES "docker restart homelab-backend >/dev/null && echo 'Backend neu gestartet'"
}

domain() {
  echo "== Cloudflare: dash.mas0n1x.online -> Tunnel ares =="
  ssh $ARES "cd $DIR && docker cp scripts/cf-tunnel.mjs homelab-backend:/app/cf-tunnel.mjs"
  ssh $ARES "docker exec homelab-backend node /app/cf-tunnel.mjs add dash.mas0n1x.online http://localhost:80 --tunnel=ares --apply"
  ssh $ARES "docker exec homelab-backend node /app/cf-tunnel.mjs dns dash.mas0n1x.online --tunnel=ares --apply"
  ssh $ARES "docker exec homelab-backend node /app/cf-tunnel.mjs remove dash.mas0n1x.online --tunnel=masons-vps2 --apply"
  sleep 5; curl -s -o /dev/null -w "  · https://dash.mas0n1x.online -> HTTP %{http_code}\n" https://dash.mas0n1x.online/
}

zurueck() {
  echo "== Rückweg: Hermes-Stack wieder starten =="
  ssh $ARES "cd $DIR && $COMPOSE stop"
  ssh $HERMES "cd $DIR && docker compose start backend frontend bot-runtime nginx stalwart"
  ssh $ARES "sed -i 's/127.0.0.1 /$HERMES_IP /;s#localhost:22 -R 172.20.0.1:61209:localhost:61208 pi-tunnel@127.0.0.1#localhost:22 -R 172.20.0.1:61209:localhost:61208 pi-tunnel@$HERMES_IP#' /etc/systemd/system/dashboard-tunnel.service; systemctl daemon-reload; systemctl restart dashboard-tunnel"
  for t in "${TUNNELHOSTS[@]}"; do
    h=${t%%|*}; s=${t##*|}
    ssh $h "$s sed -i 's/$ARES_IP/$HERMES_IP/' /etc/systemd/system/dashboard-tunnel.service && $s systemctl daemon-reload && $s systemctl restart dashboard-tunnel" && ok "$h zurück"
  done
  echo "Domain zurück (Hermes-Backend hat das Skript): add/dns mit --tunnel=masons-vps2 und remove mit --tunnel=ares:"
  ssh $HERMES "docker cp $DIR/scripts/cf-tunnel.mjs homelab-backend:/app/cf-tunnel.mjs && docker exec homelab-backend node /app/cf-tunnel.mjs add dash.mas0n1x.online http://nginx:80 --tunnel=masons-vps2 --apply && docker exec homelab-backend node /app/cf-tunnel.mjs dns dash.mas0n1x.online --tunnel=masons-vps2 --apply && docker exec homelab-backend node /app/cf-tunnel.mjs remove dash.mas0n1x.online --tunnel=ares --apply"
}

case "${1:-}" in
  check) check ;;
  daten) daten ;;
  tunnel) tunnel ;;
  domain) domain ;;
  zurueck) zurueck ;;
  *) sed -n 12,19p "$0" ;;
esac
