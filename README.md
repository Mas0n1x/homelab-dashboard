# Homelab Dashboard

Ein umfassendes, modernes Dashboard für deinen Raspberry Pi 5 Homelab-Server mit System-Monitoring, Docker-Management, E-Mail-Client, Web-Terminal und Productivity-Tracker.

![Dashboard Preview](https://img.shields.io/badge/Status-Active-brightgreen) ![License](https://img.shields.io/badge/License-MIT-blue) ![Platform](https://img.shields.io/badge/Platform-Raspberry%20Pi-red)

## Features

### System-Monitoring (via Glances API)
- CPU-Auslastung mit Echtzeit-Graph
- RAM-Nutzung mit Historie
- Disk-Auslastung mit Treemap-Visualisierung
- Netzwerk-Traffic (Upload/Download)
- CPU-Temperatur & Sensoren
- System-Uptime

### Docker-Management
- Container-Übersicht gruppiert nach Compose-Projekten
- Container starten, stoppen und neustarten mit Bestätigungsdialog
- Container-Logs, Details und Ressourcen-Monitoring (CPU/RAM inline)
- Docker Compose Projekt-Management (Start/Stop/Restart pro Projekt)
- Compose-Editor mit Datei-Bearbeitung direkt im Browser
- Image-Verwaltung mit Update-Prüfung und Pull
- Volume- und Netzwerk-Übersicht
- Port-Mapping-Tabelle aller Container
- Container-Vergleichs-Ansicht
- Container-Templates zum schnellen Deployen
- Disk-Usage Treemap-Visualisierung
- System Prune (Images, Volumes, Container)

### Service-Management (in Docker integriert)
- Automatische Service-Discovery aus Docker-Containern
- Manuelle Services hinzufügen, bearbeiten und löschen
- Online/Offline Status mit Uptime-Tracking (24h/7d/30d)
- Service-Favoriten für schnellen Zugriff
- Service-Overrides für automatisch erkannte Services
- Kategorisierte Darstellung mit Statusanzeige

### E-Mail-Client
- JMAP-Protokoll mit Stalwart Mail-Server Integration
- Multi-Account-Verwaltung mit Account-Wechsel
- E-Mail-Komposition mit Anhängen (bis 30 MB)
- Ordner-Navigation und Suche
- Mail-Admin-Panel (Accounts, Domains, DKIM)
- Inbound-Webhook für eingehende Mails

### Web-Terminal
- Browser-basierte Container-Shell via xterm.js
- Interaktiver Echtzeit-Terminal über WebSocket

### Productivity-Tracker
- Kanban-Board (TODO, In Progress, Done) mit Drag & Drop
- Pomodoro-Timer und Focus-Mode
- Projekt-Verwaltung mit Kategorien
- Achievements und Gamification (Level, XP)
- Task-Heatmap, Statistiken und Genauigkeitsanalyse
- Notizen pro Projekt
- Backup Export/Import

### Portfolio-Dashboard
- Anfragen-, Kunden- und Rechnungsverwaltung
- Terminplanung und Benachrichtigungen
- Analytics-Übersicht

### Weitere Features
- JWT-basierte Authentifizierung mit Token-Refresh
- Multi-Server-Verwaltung
- Anpassbares Glass-Morphism-Theme mit Akzentfarben
- Command Palette für schnelle Navigation
- Wetter-Widget, Kalender, Notizen, Lesezeichen
- Discord & Telegram Alert-Benachrichtigungen mit Test-Funktion
- Netzwerk-Speedtest
- Datenbank-Backup und Audit-Logs
- Echtzeit-Updates via WebSocket
- Mobile-optimiertes Layout

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
| Reverse Proxy | Nginx (Alpine) |
| Icons | Lucide React |

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
│       ├── routes/             # API Route Handler (20 Dateien)
│       │   ├── auth.js         # Authentifizierung
│       │   ├── system.js       # System-Monitoring
│       │   ├── docker.js       # Docker-Management
│       │   ├── services.js     # Service-Verwaltung
│       │   ├── servers.js      # Multi-Server
│       │   ├── favorites.js    # Favoriten
│       │   ├── mail.js         # E-Mail (JMAP)
│       │   ├── mailInbound.js  # Eingehende Mails
│       │   ├── tracker.js      # Productivity-Tracker
│       │   ├── portfolio.js    # Portfolio
│       │   ├── uptime.js       # Uptime-Monitoring
│       │   ├── speedtest.js    # Netzwerk-Speedtest
│       │   ├── alerts.js       # Benachrichtigungen
│       │   ├── notes.js        # Notizen
│       │   ├── bookmarks.js    # Lesezeichen
│       │   ├── calendar.js     # Kalender
│       │   ├── templates.js    # Container-Templates
│       │   ├── backup.js       # Datenbank-Backup
│       │   └── audit.js        # Audit-Logs
│       ├── services/           # Business Logic (15 Dateien)
│       │   ├── database.js     # SQLite-Integration
│       │   ├── docker.js       # Docker API Wrapper
│       │   ├── mail.js         # Mail-Verarbeitung
│       │   ├── auth.js         # JWT & Authentifizierung
│       │   ├── tracker.js      # Productivity-Logik
│       │   ├── glances.js      # System-Monitoring
│       │   ├── uptime.js       # Uptime-Tracking
│       │   ├── portfolio.js    # Portfolio-Logik
│       │   ├── discovery.js    # Service-Discovery
│       │   ├── alerting.js     # Alert-Benachrichtigungen
│       │   ├── speedtest.js    # Speedtest-Ausführung
│       │   ├── backup.js       # Backup-Verwaltung
│       │   └── serverManager.js # Multi-Server-Verwaltung
│       └── middleware/
│           └── auth.js         # JWT-Verifizierung
│
├── frontend/                   # Next.js Dashboard
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── src/
│       ├── app/                # Next.js App Router
│       │   ├── page.tsx        # Dashboard Home
│       │   ├── layout.tsx      # Root Layout
│       │   ├── login/          # Login
│       │   ├── docker/         # Docker-Management + Services
│       │   ├── logs/           # Log-Streaming
│       │   ├── mail/           # E-Mail-Client
│       │   ├── portfolio/      # Portfolio
│       │   ├── services/       # Redirect → Docker
│       │   ├── settings/       # Einstellungen
│       │   ├── terminal/       # Web-Terminal
│       │   └── tracker/        # Productivity-Tracker
│       ├── components/         # React-Komponenten
│       │   ├── auth/           # Authentifizierung
│       │   ├── dashboard/      # Dashboard-Widgets
│       │   ├── docker/         # Docker-Komponenten
│       │   ├── layout/         # Layout (Header, Nav, Mobile Nav)
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
└── cloudflare-worker/          # Cloudflare Worker Integration (optional)
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
| `MAIL_WEBHOOK_SECRET` | — | Secret für eingehende Mail-Webhooks |
| `CLOUDFLARE_TUNNEL_TOKEN` | — | Cloudflare Tunnel Token (optional) |
| `CLOUDFLARE_API_TOKEN` | — | Cloudflare API Token (optional) |

### Service-Links konfigurieren

Service-Links werden im Docker-Bereich unter dem Tab **Services** verwaltet:

1. Navigiere zu **Docker** → Tab **Services**
2. Klicke auf **Service hinzufügen**
3. Gib Name, URL, Beschreibung, Icon und Kategorie ein
4. Klicke auf **Hinzufügen**

Services aus Docker-Containern werden automatisch erkannt und können über Overrides angepasst werden.

## API Endpoints

### Auth
| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/auth/login` | POST | Login |
| `/api/auth/refresh` | POST | Token erneuern |
| `/api/auth/logout` | POST | Logout |
| `/api/auth/password` | PUT | Passwort ändern |
| `/api/auth/status` | GET | Auth-Status prüfen |

### System (via Glances)
| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/system/stats` | GET | Alle System-Statistiken |
| `/api/system/cpu` | GET | CPU Details |
| `/api/system/memory` | GET | RAM Details |
| `/api/system/disk` | GET | Disk Details |
| `/api/system/network` | GET | Netzwerk Details |
| `/api/system/sensors` | GET | Sensor-Daten (Temperatur) |

### Docker
| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/docker/info` | GET | Docker System-Info |
| `/api/docker/containers` | GET | Alle Container |
| `/api/docker/containers/:id/start` | POST | Container starten |
| `/api/docker/containers/:id/stop` | POST | Container stoppen |
| `/api/docker/containers/:id/restart` | POST | Container neustarten |
| `/api/docker/containers/:id/logs` | GET | Container Logs |
| `/api/docker/containers/:id/stats` | GET | Container Stats |
| `/api/docker/containers/:id/details` | GET | Container Details |
| `/api/docker/containers/:id/restart-policy` | PUT | Restart-Policy ändern |
| `/api/docker/stats/all` | GET | Stats aller Container |
| `/api/docker/images` | GET | Alle Images |
| `/api/docker/images/:id` | DELETE | Image löschen |
| `/api/docker/images/prune` | POST | Ungenutzte Images entfernen |
| `/api/docker/volumes` | GET | Alle Volumes |
| `/api/docker/volumes/:name` | DELETE | Volume löschen |
| `/api/docker/volumes/prune` | POST | Ungenutzte Volumes entfernen |
| `/api/docker/networks` | GET | Alle Netzwerke |
| `/api/docker/ports` | GET | Port-Mappings |
| `/api/docker/disk-usage` | GET | Disk-Usage Übersicht |
| `/api/docker/system/prune` | POST | System Prune |
| `/api/docker/compose/projects` | GET | Compose-Projekte |
| `/api/docker/compose/:project/:action` | POST | Compose-Aktion ausführen |
| `/api/docker/compose/:project/file` | GET | Compose-Datei lesen |
| `/api/docker/compose/:project/file` | PUT | Compose-Datei bearbeiten |
| `/api/docker/updates/check` | GET | Image-Updates prüfen |
| `/api/docker/updates/pull/:id` | POST | Image-Update pullen |

### Services
| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/services` | GET | Alle Services |
| `/api/services` | POST | Service hinzufügen |
| `/api/services/:id` | PUT | Service aktualisieren |
| `/api/services/:id` | DELETE | Service löschen |
| `/api/services/:id/status` | GET | Service-Status |
| `/api/services/override/:serviceId` | PUT | Service-Override setzen |

### Favoriten
| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/favorites` | GET | Alle Favoriten |
| `/api/favorites` | POST | Favorit hinzufügen |
| `/api/favorites/:serviceId` | DELETE | Favorit entfernen |

### Server
| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/servers` | GET | Alle Server |
| `/api/servers` | POST | Server hinzufügen |
| `/api/servers/:id` | PUT | Server aktualisieren |
| `/api/servers/:id` | DELETE | Server löschen |

### Uptime
| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/uptime/summary` | GET | Uptime-Zusammenfassung |
| `/api/uptime/timeline/:serviceId` | GET | Uptime-Timeline |
| `/api/uptime/:serviceId` | GET | Uptime eines Services |

### Mail
| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/mail/session` | GET | JMAP-Session |
| `/api/mail/jmap` | POST | JMAP-Proxy |
| `/api/mail/upload` | POST | Anhang hochladen |
| `/api/mail/download/:accountId/:blobId/:name` | GET | Anhang herunterladen |
| `/api/mail/accounts` | GET | Mail-Accounts |
| `/api/mail/accounts` | POST | Account hinzufügen |
| `/api/mail/accounts/:id/activate` | PUT | Account aktivieren |
| `/api/mail/accounts/:id` | DELETE | Account löschen |
| `/api/mail/credentials` | GET/POST/DELETE | Legacy-Credentials |
| `/api/mail/admin/accounts` | GET/POST | Admin: Accounts |
| `/api/mail/admin/accounts/:username` | DELETE | Admin: Account löschen |
| `/api/mail/admin/accounts/:username/password` | PUT | Admin: Passwort ändern |
| `/api/mail/admin/domains` | GET | Admin: Domains |
| `/api/mail/admin/dkim/:domain` | GET | Admin: DKIM-Einträge |
| `/api/mail/inbound` | POST | Eingehende Mail (Webhook) |

### Tracker
| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/tracker/tasks` | GET | Alle Tasks |
| `/api/tracker/tasks` | POST | Task erstellen |
| `/api/tracker/tasks/:id` | PUT | Task aktualisieren |
| `/api/tracker/tasks/:id` | DELETE | Task löschen |
| `/api/tracker/tasks/:id/move` | PUT | Task verschieben |
| `/api/tracker/tasks/:id/complete` | PUT | Task abschließen |
| `/api/tracker/tasks/done` | DELETE | Erledigte Tasks löschen |
| `/api/tracker/projects` | GET/POST | Projekte |
| `/api/tracker/projects/:id` | PUT/DELETE | Projekt bearbeiten/löschen |
| `/api/tracker/player` | GET | Spieler-Profil (XP, Level) |
| `/api/tracker/player/goal` | PUT | Tagesziel setzen |
| `/api/tracker/achievements` | GET | Achievements |
| `/api/tracker/stats/today` | GET | Tages-Statistik |
| `/api/tracker/stats/week` | GET | Wochen-Statistik |
| `/api/tracker/stats/heatmap` | GET | Task-Heatmap |
| `/api/tracker/stats/accuracy` | GET | Genauigkeits-Analyse |
| `/api/tracker/notes` | GET/POST | Notizen |
| `/api/tracker/notes/:id` | PUT/DELETE | Notiz bearbeiten/löschen |
| `/api/tracker/categories` | GET | Kategorien |
| `/api/tracker/backup/export` | GET | Daten exportieren |
| `/api/tracker/backup/import` | POST | Daten importieren |

### Portfolio
| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/portfolio/dashboard` | GET | Dashboard-Übersicht |
| `/api/portfolio/requests` | GET | Anfragen |
| `/api/portfolio/invoices` | GET | Rechnungen |
| `/api/portfolio/customers` | GET | Kunden |
| `/api/portfolio/appointments` | GET | Termine |
| `/api/portfolio/notifications` | GET/DELETE | Benachrichtigungen |
| `/api/portfolio/notifications/:id/read` | PUT | Als gelesen markieren |

### Alerts
| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/alerts/channels` | GET/POST | Alert-Kanäle |
| `/api/alerts/channels/:id` | PUT/DELETE | Kanal bearbeiten/löschen |
| `/api/alerts/channels/:id/test` | POST | Test-Benachrichtigung senden |
| `/api/alerts/history` | GET | Alert-Historie |

### Speedtest
| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/speedtest/latest` | GET | Letztes Ergebnis |
| `/api/speedtest/history` | GET | Speedtest-Historie |
| `/api/speedtest/run` | POST | Speedtest starten |
| `/api/speedtest/status` | GET | Laufender Speedtest-Status |

### Weitere Endpoints
| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/notes` | GET/POST | Notizen |
| `/api/notes/:id` | PUT/DELETE | Notiz bearbeiten/löschen |
| `/api/bookmarks` | GET/POST | Lesezeichen |
| `/api/bookmarks/:id` | PUT/DELETE | Lesezeichen bearbeiten/löschen |
| `/api/calendar` | GET/POST | Kalender-Einträge |
| `/api/calendar/:id` | PUT/DELETE | Eintrag bearbeiten/löschen |
| `/api/templates` | GET/POST | Container-Templates |
| `/api/templates/:id` | DELETE | Template löschen |
| `/api/templates/:id/deploy` | POST | Template deployen |
| `/api/backup` | GET | Backup-Liste |
| `/api/backup/status` | GET | Backup-Status |
| `/api/backup/run` | POST | Backup erstellen |
| `/api/audit` | GET | Audit-Logs |
| `/api/health` | GET | Health-Check |

### WebSocket
| Endpoint | Beschreibung |
|----------|--------------|
| `ws://<host>/ws` | Echtzeit-Updates (System, Docker, Logs, Terminal) |

## Docker Services

| Service | Image | Ports | Beschreibung |
|---------|-------|-------|--------------|
| frontend | Next.js (custom) | 3000 (intern) | Dashboard UI |
| backend | Node.js (custom) | 3001 (intern) | API Server |
| nginx | nginx:alpine | 80 (extern) | Reverse Proxy mit Rate Limiting |
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

Prüfe die Nginx-Konfiguration für WebSocket-Upgrade-Header:
```bash
docker-compose logs nginx
```

### Mail funktioniert nicht

1. Prüfe ob Stalwart läuft:
   ```bash
   docker-compose logs stalwart
   ```

2. Prüfe die Stalwart-Zugangsdaten in der `.env`-Datei.

## Lizenz

MIT License - Frei nutzbar für private und kommerzielle Zwecke.

---

Built with Next.js + Node.js for Raspberry Pi Homelab
