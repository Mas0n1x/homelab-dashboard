#!/bin/bash
# Zieht neue Images für laufende Container mit Registry-Tag und erstellt nur die betroffenen per Compose neu.
# Selbstgebaute Images (ohne Tag), Digest-gepinnte (Stalwart) und per SKIP_RE ausgenommene Container bleiben unberührt.
SKIP_RE="${SKIP_RE:-^$}"
ONLY_RE="${ONLY_RE:-}"   # optional: nur Container, deren Name passt
declare -A gezogen
for n in $(docker ps --format '{{.Names}}'); do
  [[ -n "$ONLY_RE" && ! "$n" =~ $ONLY_RE ]] && continue
  [[ "$n" =~ $SKIP_RE ]] && { echo "ausgenommen  $n"; continue; }
  img=$(docker inspect -f '{{.Config.Image}}' "$n")
  case "$img" in *@*|sha256:*) echo "gepinnt       $n ($img)"; continue ;; esac
  case "$img" in *:*) ;; *) echo "selbstgebaut  $n"; continue ;; esac
  if [ -z "${gezogen[$img]:-}" ]; then
    if docker pull -q "$img" >/dev/null 2>&1; then gezogen[$img]=ok; else gezogen[$img]=fehler; fi
  fi
  [ "${gezogen[$img]}" = fehler ] && { echo "PULL-FEHLER   $n ($img)"; continue; }
  alt=$(docker inspect -f '{{.Image}}' "$n"); neu=$(docker image inspect -f '{{.Id}}' "$img")
  [ "$alt" = "$neu" ] && { echo "aktuell       $n"; continue; }
  proj=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$n")
  cfg=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.config_files"}}' "$n")
  wd=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$n")
  svc=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' "$n")
  if [ -z "$cfg" ] || [ -z "$svc" ]; then echo "OHNE-COMPOSE  $n (Image neu gezogen, Container unverändert)"; continue; fi
  args=(); IFS=',' read -ra cf <<< "$cfg"; for f in "${cf[@]}"; do args+=(-f "$f"); done
  if (cd "$wd" && docker compose -p "$proj" "${args[@]}" up -d --no-deps "$svc" >/dev/null 2>&1); then echo "AKTUALISIERT  $n"; else echo "RECREATE-FEHLER $n"; fi
done
docker image prune -f >/dev/null 2>&1
