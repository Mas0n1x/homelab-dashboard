# Homelab Dashboard

Ein umfassendes, modernes Dashboard für deinen Raspberry Pi 5 Homelab-Server mit System-Monitoring, Docker-Management, E-Mail-Client, Web-Terminal und Productivity-Tracker.

![Dashboard Preview](https://img.shields.io/badge/Status-Active-brightgreen) ![License](https://img.shields.io/badge/License-MIT-blue) ![Platform](https://img.shields.io/badge/Platform-Raspberry%20Pi-red)

## Features

### System-Monitoring (via Glances API)
- CPU-Auslastung mit Echtzeit-Graph
- RAM-Nutzung mit Historie
- Disk-Auslastung mit Treemap-Visualisierung
- Netzwerk-Traffic (Upload/Download)
- CPU-Temperatur
- System-Uptime

### Docker-Management
- Liste aller Container mit Status (Running/Stopped)
- Container starten, stoppen und neustarten
- Container-Logs in Echtzeit mit Pause/Play
- Docker Compose Editor & Ausführung
- Container-Ressourcen-Monitoring
- Image-Update-Benachrichtigungen
- Disk-Usage Treemap

### Service-Links
- Automatische Service-Discovery
- Quick-Links zu allen Homelab-Services
- Online/Offline Status-Prüfung mit Uptime-Historie
- Einfaches Hinzufügen/Entfernen über die UI

### E-Mail-Client
- JMAP-Protokoll mit Stalwart Mail-Server Integration
- Multi-Account-Verwaltung
- E-Mail-Komposition und Ordner-Navigation
- Mail-Admin-Panel und Suche

### Web-Terminal
- Browser-basierte Container-Shell via xterm.js
- Interaktiver Echtzeit-Terminal

### Productivity-Tracker
- Kanban-Board (TODO, In Progress, Done)
- Pomodoro-Timer und Focus-Mode
- Projekt-Verwaltung und Achievements
- Task-Heatmap und Statistiken

### Portfolio-Dashboard
- Anfragen, Kunden und Rechnungen
- Analytics-Übersicht

### Weitere Features
- JWT-basierte Authentifizierung
- Anpassbares Glass-Morphism-Theme
- Command Palette, Wetter-Widget, Kalender, Notizen, Lesezeichen
- Discord & Telegram Alert-Benachrichtigungen
- Datenbank-Backup und Audit-Logs
- Echtzeit-Updates via WebSocket

## Tech-Stack

| Komponente | Technologie |
|------------|-------------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| State Management | Zustand, TanStack React Query |
| Charts | Recharts |
| Animationen | Framer Motion |
| Terminal | xterm.js |
| Backend | Node.js 20, Express, WebSocket (ws) |
| Datenbank | SQLite (better-sqlite3) |
| Auth | JWT, bcryptjs |
| Container | Docker, Dockerode |
| Mail-Server | Stalwart (JMAP) |
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

### 2. Umgebungsvariablen konfigurieren

```bash
cp .env.example .env
# .env bearbeiten und JWT_SECRET setzen
```

### 3. Glances starten

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

### 4. Dashboard starten

```bash
docker-compose up -d --build
```

### 5. Dashboard öffnen

```
http://<raspberry-pi-ip>
```

Das Dashboard ist jetzt unter Port 80 erreichbar.

## Projektstruktur

```
homelab-dashboard/
├── docker-compose.yml          # Docker Compose Konfiguration
├── config.json                 # Service-Konfiguration
├── .env.example                # Umgebungsvariablen-Vorlage
├── README.md
│
├── backend/                    # Node.js API Server
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js            # Express + WebSocket Server
│       ├── routes/             # API Route Handler
│       ├── services/           # Business Logic
│       └── middleware/         # Auth Middleware
│
├── frontend/                   # Next.js Dashboard
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── src/
│       ├── app/                # Next.js App Router
│       │   ├── page.tsx                # Dashboard Home
│       │   ├── layout.tsx              # Root Layout
│       │   ├── login/page.tsx          # Login
│       │   ├── docker/page.tsx         # Docker-Management
│       │   ├── logs/page.tsx           # Log-Streaming
│       │   ├── mail/page.tsx           # E-Mail-Client
│       │   ├── portfolio/page.tsx      # Portfolio
│       │   ├── services/page.tsx       # Service-Links
│       │   ├── settings/page.tsx       # Einstellungen
│       │   ├── terminal/page.tsx       # Web-Terminal
│       │   └── tracker/page.tsx        # Productivity-Tracker
│       ├── components/         # React-Komponenten
│       │   ├── auth/           # Authentifizierung
│       │   ├── dashboard/      # Dashboard-Widgets
│       │   ├── docker/         # Docker-Komponenten
│       │   ├── layout/         # Layout (Header, Nav)
│       │   ├── mail/           # Mail-Komponenten
│       │   ├── monitoring/     # System-Monitoring Charts
│       │   ├── services/       # Service-Komponenten
│       │   ├── tracker/        # Tracker-Komponenten
│       │   └── ui/             # Generische UI-Komponenten
│       ├── hooks/              # Custom React Hooks
│       ├── stores/             # Zustand State Stores
│       ├── lib/                # Utilities & Types
│       └── styles/             # Globale Styles
│
├── nginx/                      # Reverse Proxy
│   └── nginx.conf
│
└── cloudflare-worker/          # Cloudflare Worker Integration
```

## Konfiguration

### Umgebungsvariablen

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `JWT_SECRET` | — | Secret für Token-Signierung (erforderlich) |
| `GLANCES_URL` | `http://host.docker.internal:61208` | URL zur Glances API |
| `DB_PATH` | `/app/data/dashboard.db` | Pfad zur SQLite-Datenbank |
| `CONFIG_PATH` | `/app/data/config.json` | Pfad zur Konfigurationsdatei |
| `PORT` | `3001` | Backend API Port |
| `STALWART_URL` | — | URL zum Stalwart Mail-Server |
| `STALWART_ADMIN_USER` | — | Stalwart Admin-Benutzername |
| `STALWART_ADMIN_PASSWORD` | — | Stalwart Admin-Passwort |
| `CLOUDFLARE_TUNNEL_TOKEN` | — | Cloudflare Tunnel Token (optional) |
| `CLOUDFLARE_API_TOKEN` | — | Cloudflare API Token (optional) |

### Service-Links konfigurieren

Service-Links können direkt über die Dashboard-UI verwaltet werden:

1. Navigiere zu **Services**
2. Klicke auf **Service hinzufügen**
3. Gib Name, URL, Beschreibung und Icon ein
4. Klicke auf **Speichern**

## API Endpoints

### Auth
| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/auth/login` | POST | Login |
| `/api/auth/refresh` | POST | Token erneuern |
| `/api/auth/logout` | POST | Logout |
| `/api/auth/change-password` | POST | Passwort ändern |

### System (via Glances)
| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/system/stats` | GET | Alle System-Statistiken |
| `/api/system/cpu` | GET | CPU Details |
| `/api/system/memory` | GET | RAM Details |
| `/api/system/disk` | GET | Disk Details |
| `/api/system/network` | GET | Netzwerk Details |

### Docker
| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/docker/info` | GET | Docker System-Info |
| `/api/docker/containers` | GET | Alle Container |
| `/api/docker/container/:id/start` | POST | Container starten |
| `/api/docker/container/:id/stop` | POST | Container stoppen |
| `/api/docker/container/:id/restart` | POST | Container neustarten |
| `/api/docker/container/:id/logs` | GET | Container Logs |
| `/api/docker/container/:id/stats` | GET | Container Stats |
| `/api/docker/compose/validate` | POST | Compose validieren |
| `/api/docker/compose/execute` | POST | Compose ausführen |

### Services
| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/services` | GET | Alle Services |
| `/api/services/discovered` | GET | Entdeckte Services |
| `/api/services/status` | GET | Service-Status |
| `/api/services/favorites` | GET | Favoriten |
| `/api/services/add` | POST | Service hinzufügen |
| `/api/services/update` | POST | Service aktualisieren |
| `/api/services/delete` | POST | Service löschen |

### Mail
| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/mail/accounts` | GET | Mail-Accounts |
| `/api/mail/inbound` | POST | Eingehende Mail (Webhook) |

### Tracker
| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/tracker/tasks` | GET | Alle Tasks |
| `/api/tracker/tasks/create` | POST | Task erstellen |
| `/api/tracker/tasks/update` | POST | Task aktualisieren |
| `/api/tracker/stats` | GET | Statistiken |
| `/api/tracker/achievements` | GET | Achievements |

### WebSocket
| Endpoint | Beschreibung |
|----------|--------------|
| `ws://<host>:3001/ws` | Echtzeit-Updates (System, Docker, Logs, Terminal) |

## Docker Services

| Service | Image | Ports | Beschreibung |
|---------|-------|-------|--------------|
| frontend | Next.js (custom) | 3000 (intern) | Dashboard UI |
| backend | Node.js (custom) | 3001 (intern) | API Server |
| nginx | nginx:alpine | 80 (extern) | Reverse Proxy |
| stalwart | stalwartlabs/stalwart | 25, 587, 465, 143, 993 | Mail-Server |

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

Frontend läuft auf `http://localhost:3000`, Backend auf `http://localhost:3001`.

## Updates

```bash
git pull
docker-compose up -d --build
```

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

## Lizenz

MIT License - Frei nutzbar für private und kommerzielle Zwecke.

---

Built with Next.js + Node.js for Raspberry Pi Homelab
