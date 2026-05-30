# CLAUDE.md

Leitfaden für Claude Code (claude.com/code) in diesem Repository.

## Projekt

**Homelab Dashboard** — umfassendes Dashboard für einen Raspberry-Pi-5-Homelab-Server: System-Monitoring, Docker-Management, E-Mail-Client, Web-Terminal und Productivity-Tracker.

## Tech-Stack

- **Frontend:** **Next.js 14** (App Router) + React 18 + TypeScript (`frontend/`)
- **Backend:** Node.js + **Express** + dockerode (Docker-Steuerung) (`backend/`)
- **cloudflare-worker/** — Cloudflare Worker (Edge-Komponente)
- **Docker / docker-compose**, nginx (`nginx/`)

## Struktur

- `frontend/` — Next.js-App (`src/app/`, `src/components/`, `src/stores/`)
- `backend/` — API (`src/routes/`, `src/services/`)
- `cloudflare-worker/` — Worker-Code
- `nginx/`, `docker-compose.yml`, `config.json`

## Entwicklung

```bash
# Backend
cd backend && npm install && npm run dev     # node --watch

# Frontend
cd frontend && npm install && npm run dev    # next dev
npm run build && npm run start               # Produktion
```

Gesamt: `docker compose up -d --build`.

## Konventionen

- Frontend-Komponenten mit Client-Logik beginnen mit der Direktive `'use client'` — Copyright-Header steht als Block-Kommentar **darüber** (von Next.js erlaubt).
- Build-Artefakte (`.next/`, `dist/`) und Laufzeitdaten (`data/`) sind git-ignored.
- **Jede Quelldatei trägt einen Copyright-Header** — neue Dateien analog versehen.

## Lizenz & Urheberrecht

Copyright (c) 2024-2026 DEV Mas0n1x — veröffentlicht unter der **MIT-Lizenz**.
