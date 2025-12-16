# Homelab Dashboard

Ein modernes, leichtgewichtiges Dashboard für deinen Raspberry Pi 5 mit Docker-Integration und System-Monitoring.

![Dashboard Preview](https://img.shields.io/badge/Status-Active-brightgreen) ![License](https://img.shields.io/badge/License-MIT-blue) ![Platform](https://img.shields.io/badge/Platform-Raspberry%20Pi-red)

## Features

### System-Monitoring (via Glances API)
- CPU-Auslastung mit Echtzeit-Graph
- RAM-Nutzung mit Historie
- Disk-Auslastung (2TB SSD)
- Netzwerk-Traffic (Upload/Download)
- CPU-Temperatur
- System-Uptime

### Docker-Management
- Liste aller Container mit Status (Running/Stopped)
- Container starten, stoppen und neustarten
- Container-Logs in Echtzeit anzeigen
- Docker-Statistiken (Anzahl Container, Images, Version)

### Service-Links
- Quick-Links zu allen deinen Homelab-Services
- Anpassbare Icons (16 verschiedene)
- Online/Offline Status-Prüfung
- Einfaches Hinzufügen/Entfernen über die UI

### Echtzeit-Updates
- WebSocket-Verbindung für Live-Daten
- Automatische Aktualisierung alle 2 Sekunden
- Verbindungsstatus-Anzeige

## Tech-Stack

| Komponente | Technologie |
|------------|-------------|
| Frontend | SvelteKit, Tailwind CSS, Chart.js |
| Backend | Node.js, Express, WebSocket |
| Monitoring | Glances API |
| Container | Docker, Dockerode |
| Reverse Proxy | Nginx |

## Voraussetzungen

- Raspberry Pi 5 (oder anderer Linux-Host)
- Docker & Docker Compose
- Glances (mit Web-API aktiviert)

## Installation

### 1. Repository klonen

```bash
git clone <repo-url> homelab-dashboard
cd homelab-dashboard
```

### 2. Glances starten

**Option A: Direkt auf dem Host**
```bash
glances -w
```

**Option B: Als Docker Container (empfohlen)**
```bash
docker run -d --name glances \
  --restart=unless-stopped \
  -p 61208:61208 \
  -e GLANCES_OPT="-w" \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  --pid host \
  nicolargo/glances:latest-full
```

### 3. Dashboard starten

```bash
docker-compose up -d --build
```

### 4. Dashboard öffnen

```
http://<raspberry-pi-ip>
```

Das Dashboard ist jetzt unter Port 80 erreichbar.

## Projektstruktur

```
homelab-dashboard/
├── docker-compose.yml      # Docker Compose Konfiguration
├── config.json             # Service-Konfiguration (Beispiel)
├── README.md
│
├── backend/                # Node.js API Server
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js        # Express + WebSocket Server
│       ├── routes/
│       │   ├── system.js   # System-Stats Endpoints
│       │   ├── docker.js   # Docker-Management Endpoints
│       │   └── services.js # Service-Links Endpoints
│       └── services/
│           ├── glances.js  # Glances API Integration
│           └── docker.js   # Docker API Integration
│
├── frontend/               # SvelteKit Dashboard
│   ├── Dockerfile
│   ├── package.json
│   ├── svelte.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── app.html
│       ├── app.css
│       ├── routes/
│       │   ├── +layout.svelte
│       │   ├── +page.svelte          # System-Übersicht
│       │   ├── docker/+page.svelte   # Docker-Management
│       │   └── services/+page.svelte # Service-Links
│       └── lib/
│           ├── components/
│           │   ├── SystemStats.svelte
│           │   ├── CpuChart.svelte
│           │   ├── MemoryChart.svelte
│           │   ├── NetworkChart.svelte
│           │   ├── DockerContainers.svelte
│           │   └── ServiceLinks.svelte
│           └── stores/
│               └── stats.js          # State Management
│
└── nginx/                  # Reverse Proxy
    └── nginx.conf
```

## Konfiguration

### Umgebungsvariablen

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `GLANCES_URL` | `http://host.docker.internal:61208` | URL zur Glances API |
| `CONFIG_PATH` | `/app/data/config.json` | Pfad zur Konfigurationsdatei |
| `PORT` | `3001` | Backend API Port |

### Service-Links konfigurieren

Service-Links können direkt über die Dashboard-UI verwaltet werden:

1. Navigiere zu **Services**
2. Klicke auf **Service hinzufügen**
3. Gib Name, URL, Beschreibung und Icon ein
4. Klicke auf **Speichern**

Die Konfiguration wird automatisch in `/app/data/config.json` gespeichert.

## API Endpoints

### System (via Glances)
| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/system/stats` | GET | Alle System-Statistiken |
| `/api/system/cpu` | GET | CPU Details |
| `/api/system/memory` | GET | RAM Details |
| `/api/system/disk` | GET | Disk Details |
| `/api/system/network` | GET | Netzwerk Details |
| `/api/system/sensors` | GET | Temperatursensoren |

### Docker
| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/docker/info` | GET | Docker System-Info |
| `/api/docker/containers` | GET | Alle Container |
| `/api/docker/containers/:id/start` | POST | Container starten |
| `/api/docker/containers/:id/stop` | POST | Container stoppen |
| `/api/docker/containers/:id/restart` | POST | Container neustarten |
| `/api/docker/containers/:id/logs` | GET | Container Logs |

### Services
| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/services` | GET | Alle Services |
| `/api/services` | POST | Service hinzufügen |
| `/api/services/:id` | PUT | Service aktualisieren |
| `/api/services/:id` | DELETE | Service löschen |

### WebSocket
| Endpoint | Beschreibung |
|----------|--------------|
| `ws://<host>:3001/ws` | Echtzeit-Updates (System, Docker) |

## Entwicklung

### Backend lokal starten
```bash
cd backend
npm install
npm run dev
```

### Frontend lokal starten
```bash
cd frontend
npm install
npm run dev
```

### Beide gleichzeitig
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Frontend läuft auf `http://localhost:3000`, Backend auf `http://localhost:3001`.

## Ports

| Port | Service | Zugang |
|------|---------|--------|
| 80 | Nginx | Extern (Hauptzugang) |
| 3000 | Frontend | Intern |
| 3001 | Backend API | Intern |
| 61208 | Glances | Host |

## Troubleshooting

### Dashboard lädt keine Daten

1. Prüfe ob Glances läuft:
   ```bash
   curl http://localhost:61208/api/4/cpu
   ```

2. Prüfe die Docker-Logs:
   ```bash
   docker-compose logs backend
   ```

### Container können nicht gesteuert werden

Stelle sicher, dass der Docker-Socket gemountet ist:
```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
```

### WebSocket verbindet nicht

Prüfe die Nginx-Konfiguration für WebSocket-Upgrade-Header.

## Updates

```bash
# Neueste Version holen
git pull

# Container neu bauen und starten
docker-compose up -d --build
```

## Lizenz

MIT License - Frei nutzbar für private und kommerzielle Zwecke.

---

Made with SvelteKit + Node.js for Raspberry Pi Homelab
