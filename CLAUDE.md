# Auftragsmanagement - Web-App

> **Repo:** `https://github.com/JS-Fenster/Auftragsmanagement.git`
> **Zweck:** Web-Applikation fuer Auftragsverwaltung bei JS Fenster & Tueren

---

## Wissensbasis

> **Globale Regeln:** `BOOTSTRAP/CLAUDE.md` + `KB/STANDARDS/code_standards.md`
> **DB-Wissen:** `../KI_Automation/docs/ERP_Datenbank.md`
> **Projektplan:** `docs/Auftragsmanagement_Projektplan.md`

---

## Projektstruktur

```
Auftragsmanagement/
├── backend/                # Node.js + Express API
│   ├── config/             # Datenbank-Konfiguration
│   ├── routes/             # API-Endpunkte
│   ├── server.js           # Express Server
│   └── .env.example        # Umgebungsvariablen Template
├── dashboard/              # React + Vite + Tailwind (Haupt-UI)
│   ├── src/
│   │   ├── pages/          # Seiten-Komponenten
│   │   ├── App.jsx         # Haupt-App mit Routing
│   │   └── main.jsx        # Entry Point
│   └── package.json
├── docs/
│   └── Auftragsmanagement_Projektplan.md
├── README.md               # Setup-Anleitung
├── SETUP_ANLEITUNG.md      # Detaillierte Installation
└── CLAUDE.md               # Diese Datei
```

---

## Tech-Stack

| Bereich | Technologie |
|---------|-------------|
| **Backend** | Node.js, Express, mssql |
| **Dashboard** | React 18, Vite, Tailwind CSS |
| **Datenbank** | SQL Server (Work4all ERP) |
| **Auth** | (geplant) JWT/Session-basiert |

---

## Setup

```bash
# Backend
cd backend
npm install
cp .env.example .env  # Dann Credentials eintragen
npm start             # Port 3001

# Dashboard
cd dashboard
npm install
npm run dev           # Port 3000
```

---

## API-Endpunkte

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/health` | GET | Health Check |
| `/api/customers` | GET | Alle Kunden |
| `/api/customers/:code` | GET | Einzelner Kunde |
| `/api/repairs` | GET | Alle Reparaturen |
| `/api/repairs/stats/overview` | GET | Statistiken |

---

## Entwicklungs-Roadmap

Siehe `docs/Auftragsmanagement_Projektplan.md` fuer Details.

| Phase | Status | Features |
|-------|--------|----------|
| MVP | ✅ | Kunden, Reparaturen, Dashboard |
| Auth | 🚧 | Login, Benutzer, Rollen |
| Outlook | ⏳ | Termin-Sync |
| Routen | ⏳ | Maps-Integration |
| VoiceBot | ⏳ | Automatische Termine |

---

## GitHub

| Info | Wert |
|------|------|
| **Repo** | `https://github.com/JS-Fenster/Auftragsmanagement.git` |
| **PAT** | Gespeichert in Claude Auto-Memory (nicht im Repo) |

---

## Supabase

| Info | Wert |
|------|------|
| **Projekt-URL** | `https://rsmjgdujlpnydbsfuiek.supabase.co` |
| **Zweck** | ERP-Cache + eigene Workflow-Daten |

---

## Geschuetzte Edge Functions

> **KRITISCH:** Diese Edge Functions sind produktiv und duerfen NUR mit expliziter Freigabe von Andreas geaendert/deployed werden.

| Function | Version | Status | Schutzgrund |
|----------|---------|--------|-------------|
| `process-document` | v39 (Deploy 65) | STABIL | json_schema strict + 62 Kategorien, GPT-5 mini, Backtest 100% (2026-03-05) |
| `process-email` | v4.1.0 | STABIL | GPT-Kategorisierung + Anhang-Pipeline mit fetchWithRetry (2026-02-12) |
| `batch-process-pending` | v1.2.0 | STABIL | Safety-Net fuer stuck pending_ocr Docs, direct fetch statt SDK (2026-03-03) |

**Regeln:**
1. KEINE Aenderungen am Kategorisierungs-Prompt (`prompts.ts`) ohne vorherigen Backtest
2. KEINE Aenderungen am GPT-Modell oder Response-Format ohne vorherigen Backtest
3. KEIN Deploy ohne explizite Freigabe von Andreas
4. Bei Bedarf: Erst auf Supabase Branch testen
5. Stabiler Stand gesichert als Git Tag: `process-document-v39-stable`

---

## pg_cron Jobs (aktiv seit 2026-02-12)

| Job | Schedule | Function |
|-----|----------|----------|
| `batch-process-pending` | `*/15 * * * *` | Verarbeitet stuck pending_ocr Dokumente |
| `renew-email-subscriptions` | `0 6,18 * * *` | Microsoft Graph Subscription Renewal |
| `renew-email-subscriptions-safety` | `0 0,12 * * *` | Safety-Net fuer Subscription Renewal |

> **WICHTIG:** Alle pg_cron Jobs brauchen `Authorization: Bearer <anon_key>` + `timeout_milliseconds := 30000`.
> Referenz-SQL: `docs/sql_cron_batch_process.sql`

