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
| **Backend** | Node.js, Express, mssql |
| **Dashboard** | React 18, Vite, Tailwind CSS |
| **Datenbank** | SQL Server (Work4all ERP) |
| **Auth** | (geplant) JWT/Session-basiert |
| **Hosting** | Cloudflare Pages (Auto-Deploy bei Push auf master) |
| **Online-URL** | https://am.js-fenster-intern.org/ |

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

