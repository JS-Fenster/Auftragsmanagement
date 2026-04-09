# Auftragsmanagement - Web-App

> **Repo:** `https://github.com/JS-Fenster/Auftragsmanagement.git`
> **Zweck:** Web-Applikation fuer Auftragsverwaltung bei JS Fenster & Tueren

---

## Wissensbasis

> **Globale Regeln:** [CLAUDE_GLOBAL.md](../../KB/CLAUDE_GLOBAL.md) (via ~/.claude/CLAUDE.md Symlink)
> **Deploy-Regeln:** [SUPABASE_DEPLOY.md](../../KB/wissen/SUPABASE_DEPLOY.md)
> **Code-Standards:** [CODE_STANDARDS.md](../../KB/wissen/CODE_STANDARDS.md)
> **DB-Wissen:** [ERP_DATENBANK.md](../../KB/wissen/ERP_DATENBANK.md)
> **Projektplan:** `docs/Auftragsmanagement_Projektplan.md`
> **Log/Learnings/Backlog:** Zentral in [KB/](../../KB/) (Prefix: AM-NNNN)

---

## Projektstruktur

```
Auftragsmanagement/
├── apps/
│   └── review-tool/        # KI-Review Tool (React + Vite + TS)
│       └── src/
│           ├── components/  # ReviewQueue, DetailPanel, StatsPanel, AttachmentPreview
│           ├── hooks/       # usePreviewPrefetch
│           ├── lib/         # api.ts (AdminReviewApi), previewCache.ts
│           └── App.tsx      # Haupt-App (API-Key Auth, Filter, Queue)
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
├── rag-demo/               # RAG Demo App (Node.js Server fuer Retrieval-Augmented Generation)
├── scripts/                # Hilfs-Scripts (Batch-Move, Batch-Process)
├── supabase/
│   └── functions/          # Edge Functions (process-document, process-email, etc.)
├── sync/                   # ERP-zu-Supabase Sync (Python, SQL Server → Supabase)
├── e2e/                    # Playwright E2E Tests (Smoke, Navigation, Features)
├── tests/                  # Regressionstests (Kategorisierungs-Fixtures, Modellvergleiche)
├── tools/                  # Standalone Tools (Scanner-Webhook, Subscription-Management)
├── workflows/              # Workflow-Dokumentation + Backtests (Kategorisierung, Reparaturen)
├── README.md               # Setup-Anleitung
├── SETUP_ANLEITUNG.md      # Detaillierte Installation
└── CLAUDE.md               # Diese Datei
```

---

## Tech-Stack

| Bereich | Technologie |
|---------|-------------|
| **Backend (Bridge)** | Node.js, Express, mssql (on-premise, Port 3001) |
| **Dashboard** | React 19, Vite 7, Tailwind CSS 4 |
| **Edge Functions** | Supabase Deno (32+ Functions) |
| **Datenbank** | Supabase Postgres (primär) + SQL Server Work4all (ERP, read-only Bridge) |
| **Auth** | Supabase Auth + custom API-Keys für Edge Functions |
| **Hosting** | Cloudflare Pages (Dashboard), Supabase (Functions), on-premise (Backend) |
| **Online-URL** | https://am.js-fenster-intern.org/ |

---

## Backend-Architektur (W4A-Bridge)

> **Status:** AKTIV. Nicht Legacy. Läuft als eigenständiger Express-Server auf dem App-Server (Port 3001).

Das `backend/` ist **kein** Legacy-Kandidat — es erfüllt drei produktive Rollen, die Edge Functions nicht abdecken können:

### 1. W4A-Proxy (`routes/w4a-proxy.js`)
On-demand Bridge zu Work4All SQL Server:
- `GET /api/w4a/angebote/:code/positionen` — Positionen eines Angebots
- `GET /api/w4a/angebote/:code/summary` — Aggregat mit Textposition-Erkennung
- `GET /api/w4a/kunden/:code/angebots-history` — Angebots-Historie
- `GET /api/w4a/health` — Health Check

**Warum nicht replizieren?** `dbo.Positionen` hat ~120k Zeilen mit hoher Änderungsfrequenz. Replikation wäre teuer und laggy. Proxy mit 24h-Cache liefert Aktualität + Performance.

### 2. ERP-Sync (`routes/sync.js`)
Triggert den Python-Sync `sync/sync_to_supabase.py` als Child-Process. Verhindert parallele Syncs (nur einer gleichzeitig). Wird vom Dashboard-Admin-UI und von pg_cron aufgerufen.

### 3. Legacy-CRUD (`routes/customers.js`, `repairs.js`, `budget.js`)
Alte REST-Endpunkte die noch von einzelnen Dashboard-Bereichen genutzt werden. **Schrittweise Migration zu Edge Functions geplant**, aber keine harte Deadline — funktioniert.

### Deploy & Start
- Läuft per `node server.js` / `npm run dev` (nodemon) auf dem App-Server
- Config: `backend/.env` (NICHT committed, siehe `.env.example`)
- Kritische ENV-Vars: `PORT`, `DB_*` (Supabase), `W4A_*` (SQL Server), `JWT_SECRET`

### Wann was nutzen?
| Use-Case | Weg |
|----------|-----|
| Live-Daten aus Work4All ERP lesen | Backend W4A-Proxy |
| ERP → Supabase Sync triggern | Backend Sync-Route |
| Neue Business-Logik, LLM, Webhooks | Supabase Edge Function |
| Frontend-Queries auf Supabase-Daten | Direct client mit `supabase-js` |

---

## Dashboard Shared Helpers (ZUERST PRUEFEN)

Vor dem Bauen neuer Supabase-Queries oder UI-Helper ZUERST pruefen ob es schon existiert:

| Helper | Pfad | Zweck |
|--------|------|-------|
| `searchKontakte()` | `pages/budgetangebot/KundenSuche.jsx` | Multi-term Kontaktsuche (firma, name, ort, telefon, email). Splittet Begriffe und filtert client-seitig |
| `KundenSuchModal` | `pages/budgetangebot/KundenSuche.jsx` | Vollstaendiges Such-Modal mit Tabellen-Ergebnis |

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

# Review Tool (KI-Kategorisierung pruefen/korrigieren)
cd apps/review-tool
npm install
npm run dev           # Port 5174
```

### Review Tool

Standalone-App zum Pruefen und Korrigieren der KI-Kategorisierung von Dokumenten und E-Mails.
Kommuniziert mit der `admin-review` Edge Function. Authentifizierung via API-Key (localStorage).

| Info | Wert |
|------|------|
| **Pfad** | `apps/review-tool/` |
| **Tech** | React 19, Vite 6, TypeScript, Tailwind |
| **Port** | 5174 (Vite Dev Server) |
| **Backend** | Edge Function `admin-review` |
| **Start** | `cd apps/review-tool && npm run dev` |

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
| `process-document` | v40.0.0 (Wrapper) | STABIL | 2-Stage Pipeline Wrapper (OCR→Kategorisierung), 222 Zeilen (2026-03-09) |
| `process-document-ocr` | v1.0.1 | STABIL | Stage 1: OCR + Duplikat-Check (G-033) + kategorie-Copy bei Duplikaten (2026-03-10) |
| `process-document-categorize` | v1.1.0 | STABIL | Stage 2: GPT-Kategorisierung + Storage-Move + prompt_version Tracking (2026-03-10) |
| `process-email` | v4.1.1 (Deploy 46) | STABIL | GPT-Kategorisierung + Anhang-Pipeline, kategorie NULL Fix (2026-03-06) |
| `batch-process-pending` | v2.0.1 | STABIL | 2-Stufen-Pipeline + Race-Condition Guard (2026-03-09) |

**Regeln:**
1. KEINE Aenderungen am Kategorisierungs-Prompt (`prompts.ts`) ohne vorherigen Backtest
2. KEINE Aenderungen am GPT-Modell oder Response-Format ohne vorherigen Backtest
3. KEIN Deploy ohne explizite Freigabe von Andreas
4. Bei Bedarf: Erst auf Supabase Branch testen
5. Stabiler Stand gesichert als Git Tag: `process-document-v39-stable`

---

## Edge Function Catalog (32 Functions)

> Vollständige Übersicht. Bei neuen Functions hier eintragen. `_shared/` ist kein Function-Ordner, sondern Common-Code.

### Dokument-Pipeline (geschützt, siehe oben)
| Function | Zweck |
|----------|-------|
| `process-document` | Wrapper OCR → Kategorisierung (2-Stage) |
| `process-document-ocr` | Stage 1: OCR + Duplikat-Check |
| `process-document-categorize` | Stage 2: GPT-Kategorisierung + Storage-Move |
| `batch-process-pending` | Verarbeitet stuck `pending_ocr` Dokumente (via pg_cron) |
| `retry-queued` | Retry fehlgeschlagener Dokumente |
| `move-document` | Storage-Move (Admin-Operation) |
| `reclassify-emails` | Bulk-Rekategorisierung (Admin) |

### Email-Pipeline
| Function | Zweck |
|----------|-------|
| `email-webhook` | Microsoft Graph Webhook Receiver |
| `process-email` | Email-Kategorisierung + Anhang-Extraktion (geschützt) |
| `scan-mailbox` | On-demand Mailbox-Scan |
| `create-subscription` | Microsoft Graph Subscription anlegen |
| `renew-subscriptions` | Subscription-Renewal (pg_cron 2x täglich) |
| `lifecycle-webhook` | Graph Lifecycle-Events |

### Budget / Angebot
| Function | Zweck |
|----------|-------|
| `budget-ki` | LLM-gestützte Budgetkalkulation |
| `budget-dokument` | Budget-Dokument-Parsing |
| `extract-anfrage` | Anfrage-Extraktion aus Texten |
| `generate-beleg-pdf` | PDF-Generierung für Belege |
| `test-budget-extraction` | Test-Endpunkt für Budget-Extraktion |

### Suche / Chat (Jess)
| Function | Zweck |
|----------|-------|
| `llm-chat` | LLM Orchestrator mit Tool-Execution (Jess) |
| `search-contacts` | Fuzzy Kontaktsuche (pg_trgm + fulltext) |
| `search-orders` | Suche in Documents / Auftraege / Projekte |

### Admin / System
| Function | Zweck |
|----------|-------|
| `admin-review` | Review-Queue-API (für `apps/review-tool/`) |
| `manage-auth` | Auth-Verwaltung (API-Keys) |
| `system-health` | Health-Status aller Services |
| `infra-alert` | Alerting-Endpunkt |
| `debug-env` | ENV-Inspection (Dev) |

### Reparatur
| Function | Zweck |
|----------|-------|
| `reparatur-api` | CRUD-API für Reparatur-Vorgänge |
| `reparatur-aging` | Aging-Report (überfällige Reparaturen) |

### Testing / Integration
| Function | Zweck |
|----------|-------|
| `classify-backtest` | Backtest-Runner für Dokument-Kategorisierung |
| `classify-email-backtest` | Backtest-Runner für Email-Kategorisierung |
| `telegram-bot` | Telegram-Bot-Webhook |

**Regel für neue Functions:** In diesen Catalog eintragen + `_shared/security.ts` nutzen + Deploy-Checkliste befolgen.

---

## Edge Function Security (PFLICHT)

> **Globale Regeln:** Siehe [CLAUDE_GLOBAL.md](../../KB/CLAUDE_GLOBAL.md) → Sicherheitsregeln (KRITISCH)

**Jede Edge Function MUSS** die shared Security-Utilities aus `_shared/security.ts` verwenden:

```typescript
import { getCorsHeaders, checkRateLimit, validateQueryLength, sanitizeError } from "../_shared/security.ts";
```

| Utility | Zweck | Standard |
|---------|-------|----------|
| `getCorsHeaders(req)` | CORS-Allowlist (localhost, js-fenster.de) | Pflicht |
| `checkRateLimit(req)` | IP-basiertes Rate Limiting | 30 req/min |
| `validateQueryLength(q, max?)` | Query-Laenge begrenzen | 500 chars |
| `validateISODate(d)` | Datums-Format pruefen | YYYY-MM-DD |
| `sanitizeError(err)` | DB-Details nicht an Client leaken | Pflicht |

**VERBOTEN in neuen Edge Functions:**
- `"Access-Control-Allow-Origin": "*"` — immer `getCorsHeaders(req)` verwenden
- DB-Fehlermeldungen direkt an Client: `throw new Error(error.message)` — immer `sanitizeError()` verwenden
- Unbegrenzte `max_results` — immer `Math.min(user_limit, MAX)` deckeln

**Checkliste bei Kategorie-Aenderungen (PFLICHT):**
> **Hintergrund:** Am 27.02.2026 hat eine CHECK Constraint auf `documents.kategorie` dazu gefuehrt,
> dass `process-email` keine Anhang-Dokumente mehr erstellen konnte (140 Anhaenge verloren ueber 9 Tage).
> Ursache: `"Email_Anhang"` war nicht mehr in der erlaubten Kategorie-Liste.

Bei JEDER Aenderung an Kategorien (Rename, Neu, Loeschen, CHECK Constraint) ALLE diese Stellen pruefen:
1. `_shared/categories.ts` - VALID_DOKUMENT_KATEGORIEN + VALID_EMAIL_KATEGORIEN + Aliases
2. `process-document/prompts.ts` - Kategorie-Beschreibungen im Prompt
3. `process-document/schema.ts` - EXTRACTION_SCHEMA Enum-Liste
4. `process-email/index.ts` - createAttachmentDocument() kategorie-Wert
5. `email-webhook` - Falls dort Kategorien gesetzt werden
6. DB CHECK Constraint auf `documents.kategorie` - Muss alle gueltigen Werte enthalten
7. `admin-review` - Frontend Kategorie-Dropdown + constants.js
8. Storage-Ordner - Bestehende Dateien muessen ggf. verschoben werden

**DSGVO-Dokumentation (PFLICHT bei neuen Verarbeitungszwecken):**
> **Hintergrund:** Alle API-Calls an OpenAI senden personenbezogene Daten (Kundennamen, Emails, Adressen).
> AVVs mit OpenAI, Supabase und Cloudflare sind abgeschlossen (30.03.2026).

Bei JEDER neuen Edge Function oder Jess-Erweiterung die **personenbezogene Daten an externe APIs sendet**:
1. Eintrag in [DSGVO_VERARBEITUNGSVERZEICHNIS.md](../../KB/wissen/DSGVO_VERARBEITUNGSVERZEICHNIS.md) ergaenzen
2. Dokumentieren: Welche Daten, an wen, zu welchem Zweck, welches Modell
3. Bei neuem Dienstleister (nicht OpenAI/Supabase/Cloudflare): AVV abschliessen BEVOR Daten gesendet werden

Betrifft auch: Neue Jess-Tools die Kundendaten in den LLM-Kontext laden, neue OCR/Kategorisierungs-Features, neue API-Integrationen.

**Deploy-Checkliste (PFLICHT nach JEDEM Deploy):**
> **Hintergrund:** Am 05.03.2026 wurde process-document v39 mit json_schema strict deployed.
> Health-Check (GET) war OK, aber ALLE POST-Calls gaben 500 zurueck (24h Ausfall).
> Ursache: Schema nutzte `type: ["string", "null"]` statt `anyOf` - OpenAI strict mode akzeptiert das nicht.

Nach JEDEM Deploy einer Edge Function:
1. Health-Check (GET) - Zeigt nur Config, NICHT ob POST funktioniert
2. **Echten POST-Call mit mind. 3 verschiedenen Dokumenten testen** - PFLICHT
3. **Edge Function Logs pruefen** - Innerhalb 30s auf 500er schauen
4. **DB-Ergebnis pruefen** - Hat das Dokument eine SINNVOLLE Kategorie?
   - "Sonstiges_Dokument" bei bekannten Dokumenttypen = FEHLGESCHLAGEN
   - Kategorie muss zum Dokument passen (Rechnung→Rechnung, AB→AB, etc.)
5. **Sonstiges-Rate pruefen** (nach 1-2h Produktivbetrieb):
   - SQL: `SELECT kategorie, COUNT(*) FROM documents WHERE created_at > NOW() - INTERVAL '2 hours' GROUP BY kategorie`
   - Sonstiges_Dokument > 15% bei Nicht-Bildern = ALARM → Rollback!
6. **Eine Aenderung pro Deploy** - KEINE Buendelung unabhaengiger Aenderungen!
7. Erst dann darf die Function als "funktioniert" bezeichnet werden

---

## pg_cron Jobs (aktiv seit 2026-02-12)

| Job | Schedule | Function |
|-----|----------|----------|
| `batch-process-pending` | `*/15 * * * *` | Verarbeitet stuck pending_ocr Dokumente |
| `renew-email-subscriptions` | `0 6,18 * * *` | Microsoft Graph Subscription Renewal |
| `renew-email-subscriptions-safety` | `0 0,12 * * *` | Safety-Net fuer Subscription Renewal |

> **WICHTIG:** Alle pg_cron Jobs brauchen `Authorization: Bearer <anon_key>` + `timeout_milliseconds := 30000`.
> Referenz-SQL: `docs/sql_cron_batch_process.sql`

