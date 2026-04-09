# Backend — W4A-Bridge & Legacy-API

Express-Server auf dem App-Server (Port 3001). **Nicht Legacy.** Erfüllt drei produktive Rollen die Edge Functions nicht abdecken können.

> **Architektur-Details:** [../CLAUDE.md](../CLAUDE.md) → Sektion "Backend-Architektur (W4A-Bridge)"

## Rollen

### 1. W4A-Proxy (on-demand Work4All-Brücke)
Kein Replizieren der ~120k `dbo.Positionen`-Zeilen. Stattdessen proxied Live-Calls mit 24h-Cache.

| Endpoint | Zweck |
|----------|-------|
| `GET /api/w4a/health` | Health Check |
| `GET /api/w4a/angebote/:code/positionen` | Positionen eines Angebots |
| `GET /api/w4a/angebote/:code/summary` | Aggregat mit Textposition-Erkennung |
| `GET /api/w4a/kunden/:code/angebots-history` | Angebots-Historie |

Quelle: `routes/w4a-proxy.js`

### 2. ERP-Sync-Trigger
Startet `sync/sync_to_supabase.py` als Child-Process. Sperrt parallele Syncs (`activeSyncProcess`).

| Endpoint | Zweck |
|----------|-------|
| `POST /api/sync` | Triggert ERP → Supabase Sync |

Quelle: `routes/sync.js`

### 3. Legacy-CRUD (in Migration zu Edge Functions)
- `routes/customers.js` — Kunden-CRUD
- `routes/repairs.js` — Reparatur-CRUD
- `routes/budget.js` — Budget-Endpoints

## Setup

```bash
cd backend
npm install
cp .env.example .env   # Credentials eintragen
npm run dev            # nodemon
# oder
npm start              # node server.js
```

## Environment Variables

Minimal-Set (siehe `.env.example` für vollständige Liste):

| Variable | Zweck |
|----------|-------|
| `PORT` | Default 3001 |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Supabase Postgres |
| `W4A_SERVER`, `W4A_DATABASE`, `W4A_USER`, `W4A_PASSWORD` | Work4All SQL Server |
| `JWT_SECRET` | Auth-Tokens |

**PFLICHT:** `.env` NIE committen (gitignored, siehe Audit AM-181).

## Dependencies

- `express`, `body-parser`, `cors`
- `mssql` — Work4All SQL Server Client
- `@supabase/supabase-js` — Supabase Client
- `bcrypt`, `jsonwebtoken` — Auth
- Dev: `nodemon`

## Deploy

Läuft als Windows-Service / systemd-Unit auf dem App-Server. Kein Cloud-Hosting (wegen Work4All SQL Server Zugriff im internen Netz).

## Migration nach Edge Functions

Legacy-CRUD-Endpunkte werden schrittweise nach Supabase Edge Functions migriert. Kein harter Cutoff — funktioniert wie es ist. Neue Features immer als Edge Function implementieren, nicht hier.

## Tests

Aktuell keine automatisierten Tests im Backend. Änderungen manuell per curl / Postman gegen lokale Instanz testen.
