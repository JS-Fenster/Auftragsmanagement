# Optimierung: ERP-System → Auftragsmanagement Migration

> **Ziel:** Das Auftragsmanagement-Tool wird das Hauptsystem. Dieses Dokument listet alle Features aus dem ERP-System, die noch fehlen oder uebernommen werden muessen.

**Erstellt:** 2026-02-06
**Status:** In Bearbeitung
**Fuer:** Marco Heer (Coaching/Implementierung)

---

## Uebersicht

Das **erp-system-vite** wird als deprecated markiert. Alle fehlenden Features sollen ins **Auftragsmanagement** uebernommen werden.

| Bereich | ERP-System | Auftragsmanagement | Delta |
|---------|------------|-------------------|-------|
| Frontend-Seiten | 9 | 12 | -3 (aber andere Features) |
| Backend-APIs | 0 (Frontend-only) | 25+ Endpunkte | ✅ AM besser |
| Edge Functions | 0 | 10 | ✅ AM besser |
| SQL Migrations | 0 | 6 | ✅ AM besser |
| RLS Policies | 0 | Ja | ✅ AM besser |

---

## 1. Fehlende Frontend-Features

### 1.1 Lieferanten-Verwaltung ❌
| Attribut | Wert |
|----------|------|
| **Prioritaet** | Hoch |
| **Komplexitaet** | Mittel |
| **ERP Code-Pfad** | `erp-system-vite/src/pages/SuppliersPage.tsx` |
| **Geschaetzter Aufwand** | 4-6 Stunden |

**Funktionen:**
- Lieferanten-Liste mit Suche (Name, Firma, Stadt)
- Create/Edit Dialog mit Kontaktfeldern
- Kategorisierung (Fenster, Beschlaege, etc.)
- Portal-URL-Integration fuer direkten Zugriff

**Umsetzungsvorschlag:**
- Neue Seite `frontend/src/pages/Lieferanten.jsx`
- Daten aus `erp_lieferanten` (bereits vorhanden via Sync)
- Route `/lieferanten` in App.jsx

---

### 1.2 Bestellungen-Management ❌
| Attribut | Wert |
|----------|------|
| **Prioritaet** | Hoch |
| **Komplexitaet** | Komplex |
| **ERP Code-Pfad** | `erp-system-vite/src/pages/OrdersPage.tsx` |
| **Geschaetzter Aufwand** | 8-10 Stunden |

**Funktionen:**
- Bestellstatus: DRAFT, ORDERED, PARTIAL, DELIVERED, CANCELLED
- Lieferant-Zuordnung
- Erwartungsdaten und Gesamtwertberechnung
- Statistik-Karten: Entwuerfe, Bestellt, Teillieferung, Erwartet
- Konfirmationsnummer-Tracking
- Audit Log Integration

**Umsetzungsvorschlag:**
- Neue Seite `frontend/src/pages/Bestellungen.jsx`
- Daten aus `erp_bestellungen` (bereits vorhanden via Sync)
- Neuer API-Endpunkt `/api/bestellungen` im Backend

---

### 1.3 Kalender mit FullCalendar ❌
| Attribut | Wert |
|----------|------|
| **Prioritaet** | Mittel |
| **Komplexitaet** | Komplex |
| **ERP Code-Pfad** | `erp-system-vite/src/pages/CalendarPage.tsx` |
| **Geschaetzter Aufwand** | 6-8 Stunden |

**Funktionen:**
- 5 Ansichten: Monat, Woche, Tag, Liste, Team-Planung (ResourceTimeline)
- Farb-Kodierung nach Termintyp:
  - MEASUREMENT (Blau) - Aufmass
  - INSTALLATION (Lila) - Montage
  - REPAIR (Orange) - Reparatur
  - DELIVERY (Cyan) - Lieferung
  - MEETING (Gelb) - Besprechung
  - OTHER (Grau) - Sonstiges
- Ressourcen-Planung (Mitarbeiter/Team)
- Deutsche Lokalisierung
- Time Grid 06:00-20:00

**Umsetzungsvorschlag:**
- Package: `@fullcalendar/react` + Plugins
- Neue Seite `frontend/src/pages/Kalender.jsx`
- Neue Tabelle `appointments` in Supabase
- Integration mit `auftrag_status.montage_geplant`

---

### 1.4 Erweiterte Dokumente (Angebote/Rechnungen) ⚠️
| Attribut | Wert |
|----------|------|
| **Prioritaet** | Mittel |
| **Komplexitaet** | Komplex |
| **ERP Code-Pfad** | `erp-system-vite/src/pages/DocumentsPage.tsx`, `DocumentDetailPage.tsx` |
| **Geschaetzter Aufwand** | 10-12 Stunden |

**Funktionen im ERP:**
- Dokumenttypen: QUOTE (Angebot), ORDER (Auftrag), INVOICE (Rechnung)
- Status-Filter: DRAFT, SENT, ACCEPTED, PAID, CANCELLED
- Intelligente Kundensuche
- Intelligente Projektsuche (nur Projekte des gewaehlten Kunden)
- Steuersystem: Standard, Reverse Charge, Exempt
- Netto-, Steuer-, Bruttobetrag Verwaltung
- Positions-Management (Hinzufuegen/Loeschen)
- PDF-Export/Druck

**Status Auftragsmanagement:**
- `erp_angebote` und `erp_rechnungen` sind bereits als Cache vorhanden
- Dashboard hat eine einfache Dokumente-Seite
- Fehlt: Detailbearbeitung, Positionsverwaltung, PDF-Export

**Umsetzungsvorschlag:**
- Erweitern der bestehenden `dashboard/src/pages/Dokumente.jsx`
- Neue Detail-Seite mit Positionseditor
- Integration mit Budgetangebot-System fuer Preisberechnung

---

### 1.5 Einstellungen mit Datensicherung ❌
| Attribut | Wert |
|----------|------|
| **Prioritaet** | Niedrig |
| **Komplexitaet** | Mittel |
| **ERP Code-Pfad** | `erp-system-vite/src/pages/SettingsPage.tsx` |
| **Geschaetzter Aufwand** | 3-4 Stunden |

**Funktionen:**
- Backup-Export als JSON
- Backup-Import
- Testdaten einfuegen (Seed)
- Supabase-Verbindungsstatus anzeigen

**Umsetzungsvorschlag:**
- Erweitern der `dashboard/src/pages/Einstellungen.jsx`
- Neuer API-Endpunkt `/api/backup/export` und `/api/backup/import`

---

### 1.6 Kunden mit Besteuerung ⚠️
| Attribut | Wert |
|----------|------|
| **Prioritaet** | Niedrig |
| **Komplexitaet** | Einfach |
| **ERP Code-Pfad** | `erp-system-vite/src/pages/CustomersPage.tsx` |
| **Geschaetzter Aufwand** | 2-3 Stunden |

**Funktionen im ERP:**
- Steuertypverwaltung: STANDARD, REVERSE CHARGE, EXEMPT
- Freistellungsbescheinigung mit Nachweis und Gueltigkeitsdatum

**Status Auftragsmanagement:**
- Kunden-Seite existiert (aus `erp_kunden`)
- Fehlt: Steuertyp-Felder

**Umsetzungsvorschlag:**
- Felder `steuertyp`, `freistellung_nachweis`, `freistellung_gueltig_bis` zu `erp_kunden` hinzufuegen
- UI in Kunden-Detailansicht erweitern

---

## 2. Fehlende Datenbank-Tabellen

### 2.1 Reparatur-System ❌
| Tabelle | Zweck | Prioritaet |
|---------|-------|------------|
| `repairs` | Haupt-Reparaturtabelle mit Status und Prioritaet | Hoch |
| `repair_parts` | Ersatzteile fuer Reparaturen | Mittel |
| `repair_notes` | Notizen zu Reparaturen | Mittel |
| `repair_photos` | Fotos von Reparaturen (Supabase Storage) | Mittel |

**ERP Schema:**
```typescript
Repair {
  id, ticketNumber, customerId, projectId,
  description, status: RepairStatus,
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
}
```

**Hinweis:** Das Frontend hat bereits `Reparaturen.jsx` (94 KB!) - moeglicherweise teilweise implementiert.

---

### 2.2 Termin-System ❌
| Tabelle | Zweck | Prioritaet |
|---------|-------|------------|
| `appointments` | Termine (Aufmass, Montage, Reparatur, Lieferung) | Hoch |

**ERP Schema:**
```typescript
Appointment {
  id, type: AppointmentType,
  projectId, repairId,
  title, description,
  plannedStart, plannedEnd,
  actualStart, actualEnd,
  assignedToId, teamId,
  status: AppointmentStatus,
  customerNotified, reminderSent, notes
}
```

**Status Auftragsmanagement:**
- `auftrag_status` hat nur `montage_geplant` (Datum)
- Kein vollstaendiges Termin-Management

---

### 2.3 User-Management ❌
| Tabelle | Zweck | Prioritaet |
|---------|-------|------------|
| `users` | Benutzer mit Rollen | Niedrig |

**ERP Schema:**
```typescript
User {
  id, email, name,
  role: 'ADMIN' | 'OFFICE' | 'TECHNICIAN' | 'USER'
}
```

**Status Auftragsmanagement:**
- Keine Rollen-basierte Zugriffskontrolle
- Aktuell: Service Role fuer alle Operationen

---

### 2.4 Margin-Approval-System ❌
| Feature | Zweck | Prioritaet |
|---------|-------|------------|
| Margin-Kontrolle | Genehmigung bei niedrigen Margen | Niedrig |

**ERP Logik:**
- `MARGIN_TARGET = 30%`
- `MARGIN_CRITICAL = 10%`
- Genehmigungsworkflow bei Unterschreitung
- Felder: `marginApprovedPercent`, `marginApprovedBy`, `marginApprovedAt`

---

## 3. Technologie-Unterschiede

| Aspekt | ERP-System | Auftragsmanagement |
|--------|------------|-------------------|
| **Sprache** | TypeScript | JavaScript |
| **React Version** | React 18 | React 19 |
| **Vite Version** | Vite 5 | Vite 5/7 |
| **Backend** | Kein lokales Backend | Express.js |
| **Datenbank-Zugriff** | Direkt via Supabase Client | Backend-Proxy + Supabase |
| **Edge Functions** | Keine | 10 Functions |
| **SQL Migrations** | Keine (implizit in TypeScript) | 6 versionierte Migrations |
| **RLS Policies** | Keine | Implementiert |

**Empfehlung:**
- Auftragsmanagement-Architektur beibehalten (Backend + Edge Functions)
- Bei Bedarf: TypeScript Migration fuer bessere Typsicherheit

---

## 4. Priorisierte Roadmap

### Phase 1: Kern-Features (Hoch)
1. [ ] Lieferanten-Verwaltung
2. [ ] Bestellungen-Management
3. [ ] Reparatur-System (Tabellen + UI)
4. [ ] Termin-System (appointments Tabelle)

### Phase 2: Erweiterungen (Mittel)
5. [ ] Kalender mit FullCalendar
6. [ ] Erweiterte Dokumente mit Positionseditor
7. [ ] PDF-Export fuer Dokumente

### Phase 3: Nice-to-Have (Niedrig)
8. [ ] Datensicherung (Export/Import)
9. [ ] Kunden-Besteuerung
10. [ ] User-Management mit Rollen
11. [ ] Margin-Approval-System

---

## 5. Geschaetzter Gesamtaufwand

| Phase | Features | Stunden |
|-------|----------|---------|
| Phase 1 | 4 Features | 20-30 |
| Phase 2 | 3 Features | 18-25 |
| Phase 3 | 4 Features | 10-15 |
| **Gesamt** | 11 Features | **48-70 Stunden** |

---

## Anhang: ERP-System Code-Pfade

```
erp-system-vite/
├── src/
│   ├── pages/
│   │   ├── SuppliersPage.tsx      # Lieferanten
│   │   ├── OrdersPage.tsx         # Bestellungen
│   │   ├── CalendarPage.tsx       # Kalender
│   │   ├── DocumentsPage.tsx      # Dokumente
│   │   ├── DocumentDetailPage.tsx # Dokument-Detail
│   │   ├── CustomersPage.tsx      # Kunden
│   │   ├── SettingsPage.tsx       # Einstellungen
│   │   └── DashboardPage.tsx      # Dashboard
│   └── lib/
│       └── supabase.ts            # Schema-Definitionen
└── (kein Backend)
```

---

*Dokument erstellt von Claude Code am 2026-02-06*

---

## 6. Struktur-Analyse (2026-02-06)

> **Analysiert:** Komplette Codebase inkl. alle Unterordner, .env Dateien, Workflows

### 6.1 Kritische Duplikate

#### 6.1.1 categories.ts - Version Mismatch 🔴

| Ort | Version | Kategorien | Problem |
|-----|---------|------------|---------|
| `supabase/functions/_shared/categories.ts` | v2.4.0 | 43 | ✅ AKTUELL (Autoritativ) |
| `supabase/functions/process-document/categories.ts` | v2.3.0 | 42 | ❌ VERALTET - fehlt Kassenbeleg! |
| `dashboard/src/lib/constants.js` | unbekannt | 41 | ❌ FALSCH - ganz andere Liste! |

**Auswirkung:** process-document kann Kassenbelege nicht korrekt kategorisieren.

**TODO:**
- [ ] `process-document/categories.ts` loeschen
- [ ] Import in `process-document/index.ts` auf `../_shared/categories.ts` aendern
- [ ] `dashboard/src/lib/constants.js` DOKUMENT_KATEGORIEN entfernen, stattdessen von API laden

#### 6.1.2 Zwei Frontend-Apps 🟡

| App | Pfad | React | Vite | Port | Seiten |
|-----|------|-------|------|------|--------|
| Dashboard (NEU) | `dashboard/` | 19 | 7 | 3000 | 6 |
| Frontend (ALT) | `frontend/` | 18 | 5 | 3000 | 12 |

**Problem:**
- Beide auf Port 3000 → koennen nicht gleichzeitig laufen
- Duplizierte Seiten: Auftraege.jsx, Kunden.jsx
- Frontend hat Reparaturen.jsx (94 KB Monster-Datei!)

**TODO:**
- [ ] Entscheiden: Dashboard ODER Frontend als Primary
- [ ] Port-Konflikt loesen (z.B. Frontend auf 3002)
- [ ] Reparaturen.jsx aufteilen (>90KB ist zu gross)

#### 6.1.3 Status-Systeme inkompatibel 🟡

| System | Ort | Zustaende |
|--------|-----|-----------|
| WORKFLOW_STATUS | `frontend/src/lib/supabase.js` | 12 (angebot, auftrag, etc.) |
| AUFTRAG_STATUS | `dashboard/src/lib/constants.js` | 8 (OFFEN, IN_BEARBEITUNG, etc.) |

**TODO:**
- [ ] Status-Systeme vereinheitlichen
- [ ] In `_shared/constants.ts` zentralisieren

#### 6.1.4 Workflow CLAUDE.md Duplikat 🟡

Die Dateien `workflows/budgetangebote/CLAUDE.md` und `workflows/reparaturen/CLAUDE.md` sind zu **95% identisch** (442 vs 454 Zeilen).

Identische Abschnitte:
- Drei-Agenten-System
- Datei-Regeln (01_SPEC bis 05_PROMPTS)
- Preflight/Postflight-Checks
- Templates (Log-Eintrag, Checkpoint, Abschlussbericht)
- Notfall-Protokolle
- Subagenten-Orchestrierung
- Autonomer Nachtmodus

Nur Abschnitt 9 (Projekt-Kontext) unterscheidet sich.

**TODO:**
- [ ] Gemeinsame Basis in `workflows/_TEMPLATE/WORKFLOW_CLAUDE_BASE.md` erstellen
- [ ] Workflow-spezifische CLAUDE.md auf ~50 Zeilen reduzieren (nur Kontext)

---

### 6.2 Konfigurationsprobleme

#### 6.2.1 .env Duplikate

| Variable | Orte | Problem |
|----------|------|---------|
| SUPABASE_URL | backend/.env, frontend/.env, dashboard/.env, sync/.env | 4x gleicher Wert |
| SUPABASE_KEY | backend/.env, sync/.env | 2x Service Key |
| VITE_SUPABASE_ANON_KEY | frontend/.env, dashboard/.env | Enthaelt SERVICE_KEY statt ANON_KEY! |

**TODO:**
- [ ] Zentrale .env im Root erstellen
- [ ] Sub-Projekte nutzen `dotenv` mit path zu Root
- [ ] VITE_SUPABASE_ANON_KEY korrigieren (echter Anon Key, nicht Service Key)

#### 6.2.2 Package-Versionen divergieren

| Package | backend | frontend | dashboard | review-tool |
|---------|---------|----------|-----------|-------------|
| @supabase/supabase-js | ^2.87.1 | ^2.39.0 | ^2.93.3 | - |
| react | - | ^18.2.0 | ^19.2.0 | ^19.0.0 |
| vite | - | ^5.0.0 | ^7.2.4 | ^6.0.7 |
| date-fns | - | ^2.30.0 | ^4.1.0 | ^4.1.0 |
| tailwindcss | - | ^3.3.6 | ^4.1.18 | ^3.4.17 |

**TODO:**
- [ ] npm/pnpm Workspace einrichten
- [ ] Gemeinsame Versionen in Root package.json
- [ ] Supabase auf einheitliche Version (^2.93.3)

---

### 6.3 Fehlende zentrale Ressourcen

#### 6.3.1 code_standards.md fehlt

Referenziert in:
- `BOOTSTRAP/CLAUDE.md` (Zeile 39)
- `KI_Automation/CLAUDE.md`
- `Auftragsmanagement/CLAUDE.md`

**Erwarteter Pfad:** `BOOTSTRAP/KB/STANDARDS/code_standards.md`

**Status:** EXISTIERT NICHT!

**TODO:**
- [ ] `code_standards.md` erstellen mit: Umlaute-Regeln, Naming Conventions, Dateistruktur

#### 6.3.2 Hardcoded Pfade zu deprecated Projekt

In `backend/scripts/test-gpt52-none.js` (Zeile 11):
```javascript
require('dotenv').config({ path: 'c:/Claude_Workspace/WORK/repos/erp-system-vite/.env' });
```

**TODO:**
- [ ] Alle Scripts nach erp-system-vite Referenzen durchsuchen
- [ ] Pfade auf Auftragsmanagement umstellen

---

### 6.4 Architektur-Empfehlungen

#### Zentralisierungs-Strategie

```
EMPFOHLEN:

1. _shared/ als Single Source of Truth fuer:
   ├── categories.ts (Dokument- und Email-Kategorien)
   ├── constants.ts (Status, Prioritaeten, Zeitfenster)
   └── types.ts (Gemeinsame Interfaces)

2. Dashboard als Primary Frontend:
   └── Frontend nur fuer Legacy-Features (Reparaturen.jsx)

3. Workflow-Templates zentralisieren:
   └── workflows/_TEMPLATE/WORKFLOW_CLAUDE_BASE.md
```

---

## 7. TODO-Liste fuer naechste Session

### Prioritaet 1 (Sofort - Bug-Fixes)

| # | Aufgabe | Aufwand |
|---|---------|---------|
| T1.1 | categories.ts in process-document auf _shared Import umstellen | 15 Min |
| T1.2 | Dashboard DOKUMENT_KATEGORIEN aus API laden statt hardcoded | 30 Min |
| T1.3 | code_standards.md in BOOTSTRAP erstellen | 45 Min |

### Prioritaet 2 (Diese Woche)

| # | Aufgabe | Aufwand |
|---|---------|---------|
| T2.1 | Port-Konflikt loesen (Frontend auf 3002) | 10 Min |
| T2.2 | Workflow CLAUDE.md Template erstellen | 1 Std |
| T2.3 | Status-Systeme vereinheitlichen | 2 Std |
| T2.4 | .env Zentralisierung planen | 1 Std |

### Prioritaet 3 (Naechste Wochen)

| # | Aufgabe | Aufwand |
|---|---------|---------|
| T3.1 | Package-Versionen angleichen (Workspace) | 2 Std |
| T3.2 | Reparaturen.jsx refactoren (<50KB pro Datei) | 4 Std |
| T3.3 | Frontend vs Dashboard Entscheidung + Migration | 8 Std |
| T3.4 | TypeScript Migration evaluieren | 2 Std |

---

## 8. Datei-Inventar (fuer Referenz)

### Dokumentation
| Datei | Zeilen | Zweck |
|-------|--------|-------|
| `CLAUDE.md` | 110 | Projekt-Anweisungen |
| ~~`PLAN.md`~~ | ~~176~~ | ~~Sprint-Plan~~ → Aufgeloest, Inhalte in diese Datei uebernommen (2026-02-09) |
| `SETUP_ANLEITUNG.md` | 90 | Quick-Start |
| `OPTIMIERUNG.md` | 400+ | Diese Datei |
| `docs/Auftragsmanagement_Projektplan.md` | 416 | Urspruenglicher Plan |
| `docs/NETLIFY_MIGRATION.md` | 197 | Deployment Guide |

### Workflows
| Workflow | Dateien | Status |
|----------|---------|--------|
| `workflows/budgetangebote/` | 7 | V2 deployed |
| `workflows/reparaturen/` | 11 | Step 3 fertig |

### Edge Functions (10 aktiv)
| Function | Version | Zweck |
|----------|---------|-------|
| process-document | v38 | OCR + Kategorisierung |
| email-webhook | v24 | Microsoft Graph Webhook |
| process-email | v28 | E-Mail verarbeiten |
| admin-review | v20 | Review-UI |
| reparatur-api | v9 (2.0.1) | Reparatur CRUD |
| budget-ki | aktiv | Budget-Berechnung |
| budget-dokument | aktiv | Budget-Dokumente |
| + 3 weitere | - | Utility Functions |

---

*Aktualisiert: 2026-02-06 - Struktur-Analyse hinzugefuegt*

---

## 9. Workflow-Logs Konsolidierung ✅ ERLEDIGT

> **Status:** Umgesetzt am 2026-02-06

### 9.1 Neue Struktur

```
workflows/
├── MASTER_LOG.md              ← 77 Eintraege (R-001 bis R-039 + B-001 bis B-038)
├── budgetangebote/
│   ├── CLAUDE.md              ← Vollstaendig, verweist auf ../MASTER_LOG.md
│   ├── 03_LOG_ARCHIVED.md     ← Alte Version
│   └── 04_LEARNINGS.md        ← Nutzt [B-XXX] IDs
└── reparaturen/
    ├── CLAUDE.md              ← Vollstaendig, verweist auf ../MASTER_LOG.md
    ├── 03_LOG_ARCHIVED.md     ← Alte Version
    └── 04_LEARNINGS.md        ← Nutzt [R-XXX] IDs
```

### 9.2 Entscheidungen

| Thema | Entscheidung | Grund |
|-------|--------------|-------|
| CLAUDE.md | Bleibt vollstaendig pro Workflow | Claude liest nur 1 Datei - einfacher |
| LOG | Zentralisiert in MASTER_LOG.md | Ein Ort zum Suchen, uebergreifende Aenderungen sichtbar |
| INDEX | Ohne Zeilenangaben | Suche per `## [R-XXX]` ist robuster |
| LEARNINGS | Bleiben lokal pro Workflow | Workflow-spezifische Erkenntnisse |

### 9.3 Urspruengliche Analyse (historisch)

| Datei | Budgetangebote | Reparaturen | Problem |
|-------|----------------|-------------|---------|
| `03_LOG.md` | 2663 Zeilen, 38 Eintraege | 2301 Zeilen, 39 Eintraege | Jetzt in MASTER_LOG.md |
| `04_LEARNINGS.md` | 72 Zeilen, 35 Learnings | 53 Zeilen, 23 Learnings | Bleiben lokal |
| `CLAUDE.md` | 442 Zeilen | 454 Zeilen | Bleiben vollstaendig (95% identisch ist OK) |

### 9.2 Ueberschneidende Learnings (sollten zentralisiert werden)

Diese Erkenntnisse gelten fuer ALLE Workflows:

| Thema | Budget | Reparatur | Zentral? |
|-------|--------|-----------|----------|
| Index-Pflege kritisch | L1 | L1 | ✅ Ja |
| Preflight/Postflight-Checks | implizit | L2, L3 | ✅ Ja |
| Background-Subagenten kein MCP | implizit | L6 | ✅ Ja |
| Zeit nicht das knappe Gut, sequentiell OK | implizit | L7 | ✅ Ja |
| 5 Nachtmodus-Mechanismen kumulativ | implizit | L10-L13, L15 | ✅ Ja |
| MCP-Ausfaelle dokumentieren | - | L18 | ✅ Ja |
| RLS ohne Policies = unsichtbare Daten | - | L19, L21 | ✅ Ja |
| API-Keys in app_config synchron halten | L17 | L23 | ✅ Ja |

### 9.3 Workflow-spezifische Learnings (bleiben lokal)

**Budgetangebote (NICHT zentralisieren):**
- L2-L3: W4A Daten nicht replizieren, Angebot→Auftrag
- L5-L13: Textpositionen, Mass-Formate, Backtest-Ziele
- L14-L27: Header-Keywords, EK→VK Aufschlag, Artikel-Tabellen
- L28-L35: GPT-Extraktion, Prefer Headers, PostgREST Upsert
- D1-D4: Architektur-Entscheidungen (GPT statt Regex, etc.)

**Reparaturen (NICHT zentralisieren):**
- L4-L5: Kommunikation ueber Markdown, 300-Zeilen-Checkpoints
- L14-L17: Nachtmodus-Test, Stop-Hook, Luecken-Strategien
- L20, L22: ERP-Daten View-Schicht, Storage Signed URLs

### 9.4 Vorgeschlagene Struktur

```
workflows/
├── _SHARED/                              ← NEU
│   ├── WORKFLOW_CLAUDE_BASE.md           ← Gemeinsame 400 Zeilen
│   ├── SYSTEM_LEARNINGS.md               ← Uebergreifende Erkenntnisse (~15 Eintraege)
│   └── TEMPLATES/
│       ├── LOG_ENTRY.md
│       ├── CHECKPOINT.md
│       └── ABSCHLUSSBERICHT.md
├── budgetangebote/
│   ├── CLAUDE.md                         ← Nur noch ~50 Zeilen (Projekt-Kontext)
│   ├── 04_LEARNINGS.md                   ← Nur Budget-spezifische (~25 Eintraege)
│   └── ...
└── reparaturen/
    ├── CLAUDE.md                         ← Nur noch ~50 Zeilen (Projekt-Kontext)
    ├── 04_LEARNINGS.md                   ← Nur Reparatur-spezifische (~15 Eintraege)
    └── ...
```

### 9.5 Vorteile der Konsolidierung

| Vorteil | Beschreibung |
|---------|--------------|
| **Konsistenz** | Alle Workflows nutzen gleiche System-Regeln |
| **Wartbarkeit** | Aenderungen an CLAUDE.md nur an 1 Stelle |
| **Keine Doppelarbeit** | Learning einmal dokumentieren, ueberall nutzen |
| **Bessere Uebersicht** | Weniger Zeilen pro Workflow-Ordner |
| **Rollback-Sicherheit** | Logs bleiben workflow-spezifisch |

### 9.6 Umsetzungs-TODOs

| # | Aufgabe | Aufwand |
|---|---------|---------|
| T4.1 | `workflows/_SHARED/` Ordner erstellen | 5 Min |
| T4.2 | `WORKFLOW_CLAUDE_BASE.md` extrahieren (Abschnitte 1-8, 10-11) | 30 Min |
| T4.3 | `SYSTEM_LEARNINGS.md` mit uebergreifenden Erkenntnissen erstellen | 45 Min |
| T4.4 | Budgetangebote CLAUDE.md auf Kontext reduzieren | 15 Min |
| T4.5 | Reparaturen CLAUDE.md auf Kontext reduzieren | 15 Min |
| T4.6 | Beide 04_LEARNINGS.md bereinigen (System-Learnings entfernen) | 30 Min |

---

## 10. Zusammenfassung aller TODOs

### Prioritaet 1 - Bug-Fixes (Sofort)

| # | Aufgabe | Quelle |
|---|---------|--------|
| T1.1 | categories.ts Import fixen | 6.1.1 |
| T1.2 | Dashboard Kategorien aus API laden | 6.1.1 |
| T1.3 | code_standards.md erstellen | 6.3.1 |

### Prioritaet 2 - Diese Woche

| # | Aufgabe | Quelle |
|---|---------|--------|
| T2.1 | Port-Konflikt loesen | 6.1.2 |
| T2.2 | Workflow CLAUDE.md Template | 6.1.4 |
| T2.3 | Status-Systeme vereinheitlichen | 6.1.3 |
| T2.4 | .env Zentralisierung planen | 6.2.1 |

### Prioritaet 3 - Naechste Wochen

| # | Aufgabe | Quelle |
|---|---------|--------|
| T3.1 | Package-Versionen angleichen | 6.2.2 |
| T3.2 | Reparaturen.jsx refactoren | 6.1.2 |
| T3.3 | Frontend/Dashboard Entscheidung | 6.1.2 |
| T3.4 | TypeScript Migration evaluieren | 3 |

### Prioritaet 4 - Workflow-Konsolidierung ✅ ERLEDIGT

| # | Aufgabe | Status |
|---|---------|--------|
| T4.1 | ~~_SHARED Ordner erstellen~~ | ❌ Verworfen - CLAUDE.md bleibt vollstaendig pro Workflow |
| T4.2 | ~~WORKFLOW_CLAUDE_BASE.md extrahieren~~ | ❌ Verworfen - einfacher wenn alles in einer Datei |
| T4.3 | MASTER_LOG.md erstellen | ✅ ERLEDIGT 2026-02-06 |
| T4.4 | CLAUDE.md auf MASTER_LOG.md umstellen | ✅ ERLEDIGT 2026-02-06 |
| T4.5 | 04_LEARNINGS.md IDs anpassen | ✅ ERLEDIGT 2026-02-06 |
| T4.6 | Alte 03_LOG.md archivieren | ✅ ERLEDIGT 2026-02-06 |

**Entscheidung:** CLAUDE.md bleibt vollstaendig pro Workflow (besser fuer Claude), nur der LOG wurde zentralisiert.

---

*Aktualisiert: 2026-02-06 - Workflow-Logs Konsolidierung hinzugefuegt*

---

## 11. Geplante Feature-Ergaenzungen

> **Hinweis:** Ideen fuer kuenftige Erweiterungen, die noch nicht priorisiert wurden.

### 11.1 Budgetangebot: V1 vs V2 Analyse 🔴

| Attribut | Wert |
|----------|------|
| **Status** | V2 Code lokal FEHLT |
| **Prioritaet** | HOCH |
| **Analysiert** | 2026-02-06 |

---

#### V1 (VOLLSTAENDIG VORHANDEN - frontend/)

**Frontend-Seiten:**
- `frontend/src/pages/Budgetangebot.jsx` (504 Zeilen) - Listenseite
- `frontend/src/pages/BudgetDetail.jsx` (1012 Zeilen) - Detailseite

**V1 Features (alle funktional):**

| Feature | Datei | Status |
|---------|-------|--------|
| Case-Liste mit Status/Kanal-Filter | Budgetangebot.jsx | ✅ |
| Neuer Case Modal | Budgetangebot.jsx | ✅ |
| Kunde/Lead Info Section | BudgetDetail.jsx | ✅ |
| Profil-Einstellungen (System, Farbe, Verglasung) | BudgetDetail.jsx | ✅ |
| Elemente hinzufuegen/entfernen | BudgetDetail.jsx | ✅ |
| Zubehoer pro Element (Rollladen, AFB, IFB, etc.) | BudgetDetail.jsx | ✅ |
| Text-Parser (OCR/Notizen) | BudgetDetail.jsx | ✅ |
| Quick-Preview (debounced Live-Berechnung) | BudgetDetail.jsx | ✅ |
| Ergebnis-Anzeige (Netto, Brutto, Range, Confidence) | BudgetDetail.jsx | ✅ |
| Berechnen-Button | BudgetDetail.jsx | ✅ |

**Backend-API (backend/routes/budget.js - 868 Zeilen):**

| Endpoint | Methode | Funktion |
|----------|---------|----------|
| `/api/budget/cases` | POST | Neuen Case anlegen |
| `/api/budget/cases` | GET | Liste aller Cases (Filter) |
| `/api/budget/cases/:id` | GET | Case mit Details |
| `/api/budget/cases/:id` | PATCH | Case aktualisieren |
| `/api/budget/cases/:id/items` | POST | Items hinzufuegen |
| `/api/budget/cases/:id/profile` | POST | Profil setzen |
| `/api/budget/cases/:id/calculate` | POST | Kalkulation |
| `/api/budget/parse` | POST | Text parsen |
| `/api/budget/quick-calculate` | POST | Schnell-Kalkulation |
| `/api/budget/config` | GET | Preiskonfiguration |

**Services (backend/services/budget/):**

| Modul | Zeilen | Funktion |
|-------|--------|----------|
| `index.js` | 55 | Export-Aggregator |
| `measurementParser.js` | 11266 | Mass-Extraktion (mm/cm/m) |
| `contextParser.js` | 11309 | Kontext aus Header-Positionen |
| `elementClassifier.js` | 2084 | Element-Typ Erkennung |
| `priceCalculator.js` | 641 | Preisberechnung |

**Datenbank-Tabellen:**
- `budget_cases` - Haupt-Tabelle (Status, Kanal, Kunde/Lead)
- `budget_profile` - Profil-Einstellungen (Hersteller, System, Farbe)
- `budget_items` - Elemente (Typ, Breite, Hoehe, Anzahl)
- `budget_accessories` - Zubehoer (Rollladen, AFB, IFB, Insekt, Plissee)
- `budget_results` - Berechnungsergebnisse

**Preismodell V1 (priceCalculator.js):**

```javascript
SYSTEM_PRICES = {
  CASTELLO: 400 EUR/qm (2-fach)
  CALIDO: 420 EUR/qm (3-fach)
  IMPREO: 520 EUR/qm (Premium)
  AFINO: 480 EUR/qm (Design)
}

WORK_PRICES = {
  montage: 80 EUR/Element
  demontage: 40 EUR/Element
  entsorgung: 25 EUR/Element oder 150 EUR pauschal
}

ACCESSORY_PRICES = {
  rollladen: 180 EUR/m (min 120)
  raffstore: 280 EUR/m (min 200)
  motor: 150 EUR/Stueck
  afb: 35 EUR/lfm (min 25)
  ifb: 45 EUR/lfm (min 30)
  insektenschutz: 80 EUR/Stueck
  plissee: 120 EUR/Stueck
}
```

---

#### V2 (LOKAL NICHT VORHANDEN!)

**Laut 02_STATUS.md sind deployed:**
- `budget-ki` Edge Function (ACTIVE in Supabase)
- `budget-dokument` Edge Function (ACTIVE in Supabase)
- Dashboard mit 4-Schritt-Wizard (E2E getestet)

**PROBLEM: Lokaler Code FEHLT!**

```
supabase/functions/
├── budget-ki/        ← NICHT VORHANDEN
├── budget-dokument/  ← NICHT VORHANDEN
└── test-budget-extraction/  ← Nur Test-Funktion (6045 Zeilen)

dashboard/src/pages/
├── Uebersicht.jsx    ← Keine Budget-Seite!
├── Auftraege.jsx
├── Dokumente.jsx
├── Kunden.jsx
├── Emails.jsx
└── Einstellungen.jsx
```

**Schlussfolgerung:**
Marco hat V2 wahrscheinlich direkt in Supabase Cloud erstellt, ohne den Code lokal zu committen. Der Dashboard-Code fuer den 4-Schritt-Wizard existiert ebenfalls nicht lokal.

---

#### Handlungsoptionen

**Option A: V2 Code von Marco holen**
- [ ] Marco fragen: Wo liegt der V2-Code?
- [ ] Edge Functions aus Supabase Dashboard exportieren
- [ ] Dashboard-Wizard Code anfordern
- [ ] Lokal committen

**Option B: V1 nutzen und erweitern**
- V1 ist vollstaendig und funktional
- Backend-Kalkulation funktioniert
- Frontend hat alle Features
- Nur noch Backend starten und testen

**Option C: V1 Features in Dashboard integrieren**
- Dashboard hat kein Budget-Modul
- V1 Features als neue Seite in Dashboard einbauen
- Bestehende Services wiederverwenden

---

#### Empfehlung

1. **Sofort:** V1 im `frontend/` testen (Backend + Frontend starten)
2. **Dann:** Mit Marco klaeren wo V2-Code liegt
3. **Langfristig:** Code-Basis vereinheitlichen (eine Version)

---

### 11.2 Teilrechnung: Eingabe-Optionen 📋

| Attribut | Wert |
|----------|------|
| **Prioritaet** | Niedrig (spaeter) |
| **Bereich** | Rechnungserstellung |
| **Notiert** | 2026-02-06 |

**Feature-Idee:**
Bei Erstellung einer Teilrechnung soll der Benutzer gefragt werden:

1. **Berechnungsart:**
   - Prozent vom Gesamtbetrag (z.B. 30%)
   - Fixer Betrag (z.B. 5.000 EUR)

2. **Bezugsgroesse:**
   - Netto-Wert
   - Brutto-Wert

**Beispiel-Flow:**
```
Teilrechnung erstellen
├─► Wie soll der Betrag berechnet werden?
│   [ ] Prozent vom Gesamtbetrag (empfohlen)
│   [ ] Fixer Betrag
│
└─► Bezogen auf:
    [ ] Netto
    [ ] Brutto
```

**Kontext:**
Aktuell (Work4All) gibt es keine standardisierte Eingabe - Sachbearbeiter rechnen manuell.

**TODO:**
- [ ] In Phase 2 (Erweiterte Dokumente) einplanen
- [ ] UI-Mockup erstellen
- [ ] In `erp_rechnungen` ggf. Felder `ist_teilrechnung`, `teilrechnung_prozent`, `teilrechnung_bezug` hinzufuegen

---

### 11.3 E-Mail-Klassifizierung + Revisionssicherheit (Betriebspruefung) 📋

| Attribut | Wert |
|----------|------|
| **Prioritaet** | Mittel-Hoch |
| **Bereich** | E-Mail-Pipeline, Dokumente, Compliance |
| **Anlass** | Steuerberater-Empfehlung (2026-02-09) |
| **Herkunft** | PLAN.md PRIO 3 (sensibel-Feld) + neue Anforderung |

---

#### Hintergrund

Fuer eine **Betriebspruefung** muessen steuerrelevante E-Mails vorgelegt werden koennen.
Das Tool soll diese E-Mails klassifizieren, damit im Pruefungsfall nur die relevanten
Nachrichten gefiltert und bereitgestellt werden koennen.

---

#### Ist-Zustand (Stand 2026-02-09)

| Was | Status | Details |
|-----|--------|---------|
| E-Mails in DB | **515 Stueck** | `documents`-Tabelle, `source = 'email'` |
| Body (Text) | Gespeichert | `email_body_text` (515/515) |
| Body (HTML) | Gespeichert | `email_body_html` (482/515) |
| KI-Kategorie | Vorhanden | `email_kategorie` (z.B. Auftragserteilung, Lead_Anfrage, Sonstiges) |
| Original .eml | **NICHT gespeichert** | `dokument_url` ist nur `email://`-Referenz auf MS Graph |
| File-Hash | **NICHT befuellt** | 0/515 haben `file_hash` |
| `sensibel`-Flag | **NICHT vorhanden** | War in PLAN.md PRIO 3 geplant, nie umgesetzt |
| `steuerrelevant`-Flag | **NICHT vorhanden** | Neuer Bedarf |
| Loeschsperre | **NICHT vorhanden** | Kein Schutz gegen Loeschung |

---

#### Konzept: Drei Ebenen

**1. Klassifizierung (steuerrelevant ja/nein)**

Automatisches Mapping der bestehenden `email_kategorie` auf Steuerrelevanz:

| Steuerrelevant | Kategorien |
|----------------|------------|
| **JA** | Eingangsrechnung, Ausgangsrechnung, Gutschrift, Auftragsbestaetigung, Auftragserteilung, Lieferschein, Mahnung, Zahlungsavis, Steuerbescheid, Finanzamt-Korrespondenz, Vertrag |
| **NEIN** | Newsletter, Werbung, Spam, Lead_Anfrage (ohne Zahlungsbezug), Sonstiges |
| **PRUEFEN** | Geschaeftskorrespondenz (manuell entscheiden) |

Umsetzung:
- Neues Feld `steuerrelevant` (ENUM: 'ja', 'nein', 'pruefen', NULL)
- Automatische Klassifizierung per Trigger oder bei E-Mail-Verarbeitung
- Manuelles Override moeglich (`steuerrelevant_manual`)

**2. Revisionssichere Archivierung (GoBD-konform)**

> **Grundsatz:** Die Archivierung erfolgt IMMER - unabhaengig davon, ob eine E-Mail
> im Tool sichtbar ist oder nicht. Das Archiv ist die "Wahrheit", das Tool ist die "Ansicht".

Was fuer GoBD-Konformitaet benoetigt wird:

| Anforderung | Umsetzung |
|-------------|-----------|
| Unveraendertes Original | .eml-Datei in Supabase Storage (Bucket: `email-archiv`) |
| Integritaetsnachweis | SHA-256 Hash beim Archivieren → `file_hash` Feld |
| Zeitstempel | `email_empfangen_am` (bereits vorhanden) + `archiviert_am` (neu) |
| Aufbewahrungsfrist | 6 Jahre (Handelsbrief) / 10 Jahre (Buchungsbelege) |
| Nachvollziehbarkeit | Audit-Log bei jeder Aenderung (Kategorie, Steuerrelevanz) |

Offene Frage: .eml-Export ueber Microsoft Graph API moeglich? Oder reicht Body-Text + HTML + Metadaten als "digitale Kopie"? → **Mit Steuerberater klaeren.**

**3. Sichtbarkeit vs. Archivierung (Trennung!)**

> **Wichtig:** Nicht jede E-Mail muss im Tool sichtbar sein. Die Archivierung
> (Revisionssicherheit) laeuft unabhaengig von der Anzeige im Dashboard.

| Konzept | Beschreibung |
|---------|--------------|
| **Archiv** | ALLE E-Mails werden revisionssicher gespeichert (immer, automatisch) |
| **Tool-Sichtbarkeit** | Nur relevante E-Mails werden im Dashboard angezeigt |
| **Verstecken ≠ Loeschen** | E-Mails koennen aus der Tool-Ansicht ausgeblendet werden, bleiben aber im Archiv |
| **Betriebspruefung** | Filter auf `steuerrelevant = 'ja'` liefert nur die relevanten E-Mails |

Moegliche Umsetzung:
- Neues Feld `sichtbar_im_tool` (BOOLEAN, Default: TRUE)
- Dashboard-Filter zeigt nur `sichtbar_im_tool = TRUE`
- Betriebspruefungs-Export ignoriert Sichtbarkeit, filtert nur nach `steuerrelevant`
- Admin-Ansicht kann auch versteckte E-Mails zeigen

---

#### Idee: Loeschsperre-Flag

> **Status:** Nur Idee - muss nicht zwingend im Tool sichtbar sein.

Ein `loeschsperre`-Flag (BOOLEAN) koennte verhindern, dass steuerrelevante E-Mails
versehentlich geloescht werden. Ob das Flag im UI angezeigt wird oder nur als
DB-Constraint (Trigger der DELETE blockiert) existiert, ist noch offen.

Optionen:
- **Option A:** Nur DB-Trigger (unsichtbar, blockiert DELETE bei `steuerrelevant = 'ja'`)
- **Option B:** Sichtbares Flag im Tool + DB-Trigger
- **Option C:** Soft-Delete Pattern (`deleted_at` Timestamp statt echtem DELETE)

---

#### Vorhandene Vorarbeit (aus PLAN.md PRIO 3)

Bereits konzipiert war ein `sensibel`-Feld fuer die `documents`-Tabelle:

```sql
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS sensibel BOOLEAN DEFAULT FALSE;

-- Trigger: Automatisch TRUE bei sensiblen Kategorien
-- AU_Bescheinigung, Lohnabrechnung, Arbeitsvertrag, Finanzierung, Versicherung
```

Dieses Konzept wird hier erweitert: `sensibel` (Datenschutz/intern) und `steuerrelevant`
(Betriebspruefung) sind zwei verschiedene Flags mit unterschiedlichem Zweck.

| Flag | Zweck | Beispiele |
|------|-------|-----------|
| `sensibel` | Datenschutz - eingeschraenkter Zugriff | Lohnabrechnungen, AU-Bescheinigungen, Arbeitsvertraege |
| `steuerrelevant` | Betriebspruefung - muss vorgelegt werden | Rechnungen, Gutschriften, Vertraege, Steuerbescheide |

Beide Flags koennen gleichzeitig gesetzt sein (z.B. Lohnabrechnung = sensibel + steuerrelevant).

---

#### Moegliche DB-Migration (Entwurf)

```sql
-- Steuerrelevanz
ALTER TABLE documents ADD COLUMN IF NOT EXISTS steuerrelevant TEXT;
-- Werte: 'ja', 'nein', 'pruefen', NULL (noch nicht klassifiziert)

ALTER TABLE documents ADD COLUMN IF NOT EXISTS steuerrelevant_manual TEXT;
-- Manuelles Override

-- Sensibel (Datenschutz)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sensibel BOOLEAN DEFAULT FALSE;

-- Sichtbarkeit im Tool
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sichtbar_im_tool BOOLEAN DEFAULT TRUE;

-- Archivierung
ALTER TABLE documents ADD COLUMN IF NOT EXISTS archiviert_am TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS archiv_storage_path TEXT;
-- Pfad zur .eml-Datei in Supabase Storage
```

---

#### TODO

| # | Aufgabe | Aufwand | Abhaengigkeit |
|---|---------|---------|---------------|
| 1 | Mit Steuerberater klaeren: Reicht Body+HTML oder braucht man .eml? | - | Steuerberater |
| 2 | `steuerrelevant` + `sensibel` + `sichtbar_im_tool` Felder anlegen | 30 Min | - |
| 3 | Kategorie→Steuerrelevanz Mapping definieren | 1 Std | - |
| 4 | Automatische Klassifizierung in E-Mail-Pipeline einbauen | 2-3 Std | #2, #3 |
| 5 | Dashboard-Filter erweitern (sichtbar/versteckt/steuerrelevant) | 2-3 Std | #2 |
| 6 | .eml-Export ueber MS Graph implementieren (falls noetig, siehe #1) | 4-6 Std | #1 |
| 7 | Loeschsperre-Trigger implementieren (falls gewuenscht) | 1 Std | #2 |
| 8 | Betriebspruefungs-Export (CSV/ZIP mit allen steuerrelevanten E-Mails) | 3-4 Std | #4 |

---

### 11.4 Erweitertes Kontakt-/Kundenstamm-Management 📋

| Attribut | Wert |
|----------|------|
| **Prioritaet** | Hoch (betrifft fast alle Workflows) |
| **Bereich** | Kunden, Lieferanten, CRM |
| **Anlass** | Praxisfaelle: Rao/Bornschlaeger, Zimmermann, Naturstein Franz, Betreuer-Szenarien |
| **Notiert** | 2026-02-09 |

---

#### Problem: ERP-Kundenstamm ist zu einfach

Das aktuelle Modell (`erp_kunden`) hat pro Kunde:
- **1x** Telefon, **1x** E-Mail, **1x** Name
- Keine Kontaktpersonen (Ehepartner, Betreuer, Ansprechpartner)
- Keine Verknuepfung Kunde ↔ Lieferant
- Keine dynamische Erweiterung

**Praxisfaelle, die heute nicht abbildbar sind:**

| Fall | Problem |
|------|---------|
| **Rao/Bornschlaeger** | Kundin hat alten Namen als E-Mail-Adresse (`bornschleglchristine@yahoo.de`). System erkennt sie nicht als Kundin Rao, weil nur `rao.avanti@gmail.com` hinterlegt ist. |
| **Ehepaar Zimmermann** | Ein Kundenstamm, aber zwei Personen mit verschiedenen Telefonnummern. Nur eine Nummer hinterlegbar. |
| **Naturstein Franz** | Ist gleichzeitig Kunde (bestellt Fenster) UND Lieferant (liefert Fensterbaenke). Existiert in zwei getrennten Tabellen ohne Verknuepfung. |
| **Pflegebeduerftiger + Tochter** | Die Tochter ist Betreuerin der Mutter UND eigene Kundin. Ihre Nummer muesste an zwei Stellen gepflegt werden. |
| **Kunde mit 4 Telefonnummern** | Mobil privat, Mobil Arbeit, Festnetz privat, Festnetz Buero - nur 1 Feld vorhanden. |

---

#### Zukunftsperspektive: Eigene Master-Tabellen

Die `erp_kunden` / `erp_lieferanten` Tabellen sind heute **Import-/Cache-Tabellen** aus Work4all.
In Zukunft wird das Auftragsmanagement die Daten **selbst fuehren** - ohne ERP davor.

Das neue Datenmodell muss daher:
1. **Heute** als Anreicherung der ERP-Daten funktionieren (optionaler Link)
2. **Morgen** als eigenstaendiger Master funktionieren (ohne ERP)

→ Der ERP-Link (`erp_kunden_code`) ist optional/nullable. Wenn NULL = eigener Datensatz.

---

#### Datenmodell: 3 Tabellen

**1. `kontakte` - Der Account/Stamm (ersetzt langfristig erp_kunden + erp_lieferanten)**

```sql
CREATE TABLE kontakte (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- ERP-Links (optional, NULL = eigener Datensatz ohne ERP)
    erp_kunden_code INT,              -- FK zu erp_kunden.code (nullable)
    erp_lieferanten_code INT,         -- FK zu erp_lieferanten.code (nullable)

    -- Rollen (ein Kontakt kann beides sein)
    ist_kunde BOOLEAN DEFAULT FALSE,
    ist_lieferant BOOLEAN DEFAULT FALSE,

    -- Nummern
    kundennummer TEXT,                -- Eigene Kundennr. (oder aus ERP uebernommen)
    lieferantennummer TEXT,           -- Eigene Lieferantennr.
    unsere_nr_bei_ihm TEXT,           -- Unter welcher Nr. kennt er UNS?

    -- Stammdaten
    typ TEXT DEFAULT 'privat',        -- privat / gewerbe / oeffentlich
    firma1 TEXT,
    firma2 TEXT,
    strasse TEXT,
    plz TEXT,
    ort TEXT,

    -- Hinweise
    hinweis_kontakt TEXT,             -- z.B. "Immer ueber Tochter kontaktieren"
    notiz TEXT
);
```

**Beispiele:**

| kontakte | ist_kunde | ist_lieferant | erp_kunden_code | hinweis |
|----------|-----------|---------------|-----------------|---------|
| Rao, Christine | TRUE | FALSE | 1856019620 | - |
| Zimmermann | TRUE | FALSE | 12345 | - |
| Naturstein Franz | TRUE | TRUE | 5678 | unsere_nr_bei_ihm: K-4711 |
| Mutter Schmidt | TRUE | FALSE | 9999 | "Immer ueber Tochter kontaktieren" |
| Tochter Mueller | TRUE | FALSE | 7777 | - |

---

**2. `kontakt_personen` - Personen unter einem Account**

Ein Kontakt/Kundenstamm kann mehrere Personen haben (Ehepartner, Betreuer, Ansprechpartner).

```sql
CREATE TABLE kontakt_personen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kontakt_id UUID NOT NULL REFERENCES kontakte(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Person
    anrede TEXT,                      -- Herr / Frau
    vorname TEXT,
    nachname TEXT,

    -- Rolle in diesem Account
    rolle TEXT,                       -- 'Eigentuemer' / 'Ehepartner' / 'Betreuerin' /
                                      -- 'Ansprechpartner' / 'Geschaeftsfuehrer' /
                                      -- 'Lebenspartner' / 'Mieter'
    ist_hauptkontakt BOOLEAN DEFAULT FALSE,

    -- Verweis auf eigenen Kundenstamm (falls vorhanden)
    referenz_kontakt_id UUID REFERENCES kontakte(id),
    -- Wenn gesetzt: Diese Person IST auch ein eigener Kunde.
    -- Kontaktdaten werden aus dem verlinkten Kundenstamm gelesen.
    -- Keine Doppelpflege noetig!
    -- Beispiel: Tochter Mueller → verweist auf kontakte.id der Tochter

    hinweis TEXT                      -- z.B. "Bevollmaechtigt fuer Unterschriften"
);
```

**Beispiele:**

| kontakt_personen | kontakt_id | rolle | referenz_kontakt_id | ist_hauptkontakt |
|------------------|------------|-------|---------------------|------------------|
| Christine Rao | Rao | Eigentuemerin | NULL | TRUE |
| Herr Zimmermann | Zimmermann | Eigentuemer | NULL | TRUE |
| Frau Zimmermann | Zimmermann | Ehepartnerin | NULL | FALSE |
| Mutter Schmidt | Mutter Schmidt | Eigentuemerin | NULL | TRUE |
| Tochter Mueller | Mutter Schmidt | Betreuerin | → kontakte.Tochter Mueller | FALSE |
| Tochter Mueller | Tochter Mueller | Eigentuemerin | NULL | TRUE |

**Effekt bei Tochter Mueller:**
- Unter Mutter Schmidt: `referenz_kontakt_id` zeigt auf Tochter-Kundenstamm
- Kontaktdaten (Telefon, E-Mail) werden AUTOMATISCH aus dem Tochter-Kundenstamm gelesen
- Aenderung an einer Stelle → ueberall aktuell

---

**3. `kontakt_details` - Unbegrenzte Kontaktwege (dynamisch, "+"-Button)**

Keine festen Felder mehr. Jede Person kann beliebig viele Telefonnummern, E-Mails, etc. haben.

```sql
CREATE TABLE kontakt_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kontakt_person_id UUID NOT NULL REFERENCES kontakt_personen(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Kontaktweg
    typ TEXT NOT NULL,                -- 'telefon' / 'email' / 'fax' / 'website'
    label TEXT,                       -- Frei waehlbar: 'Mobil privat', 'Buero',
                                      -- 'Arbeitshandy', 'Festnetz Werkstatt', etc.
    wert TEXT NOT NULL,               -- Die Nummer / Adresse
    ist_primaer BOOLEAN DEFAULT FALSE,

    notiz TEXT
);
```

**Beispiel: Kundin Rao**

| typ | label | wert | primaer |
|-----|-------|------|---------|
| email | Aktuell | rao.avanti@gmail.com | TRUE |
| email | Alt (Yahoo) | bornschleglchristine@yahoo.de | FALSE |
| telefon | Mobil | 0171-1234567 | TRUE |
| telefon | Festnetz | 09624-98765 | FALSE |

**Beispiel: Herr Zimmermann**

| typ | label | wert | primaer |
|-----|-------|------|---------|
| telefon | Mobil privat | 0171-1111111 | TRUE |
| telefon | Mobil Arbeit | 0160-2222222 | FALSE |
| telefon | Festnetz | 09624-33333 | FALSE |
| email | Privat | zimmermann@web.de | TRUE |

→ Im UI: Jeder Eintrag hat ein "x" zum Loeschen und unten steht `[+ Kontaktweg hinzufuegen]`.

---

#### E-Mail-Matching: Automatische Zuordnung

Mit diesem Modell kann das System eingehende E-Mails **gegen ALLE hinterlegten Adressen matchen**:

```
Eingehende E-Mail von: bornschleglchristine@yahoo.de
→ Suche in kontakt_details WHERE typ = 'email' AND wert = '...'
→ Treffer: kontakt_person_id → Christine Rao
→ Kontakt: Rao (Kundennr. 1856019620)
→ Automatische Zuordnung!
```

Kein manuelles Zuordnen noetig, auch wenn die Kundin eine alte E-Mail-Adresse benutzt.

---

#### Betreuer-Szenario im Projekt-Kontext

Fuer Projekte/Auftraege koennen verschiedene Rollen zugeordnet werden:

```sql
-- In auftraege / projekte:
kontakt_id              -- Wessen Objekt? (Mutter Schmidt)
ansprechpartner_id      -- Wen anrufen? (Tochter Mueller, via referenz_kontakt_id)
rechnungsempfaenger_id  -- Wer zahlt? (Mutter oder Tochter)
```

**Im Dashboard bei einem Anruf:**
```
Anruf: Tochter Mueller (0171-xxxx)
├── Eigene Projekte: P-789 (Fenster Tochter-Wohnung)
├── Betreut: Mutter Schmidt
│   └── Projekt P-456 (Reparatur bei Mutter)
```

---

#### Migration: Schrittweise Einfuehrung

| Phase | Was | Aufwand |
|-------|-----|---------|
| **Phase 1** | Tabellen anlegen, ERP-Daten initial importieren (erp_kunden → kontakte + kontakt_personen mit je 1 Person + kontakt_details mit vorhandener Tel/Email) | 4-6 Std |
| **Phase 2** | Dashboard: Kunden-Detail um Kontaktpersonen + dynamische Details erweitern | 6-8 Std |
| **Phase 3** | E-Mail-Matching gegen kontakt_details statt nur erp_kunden.email | 2-3 Std |
| **Phase 4** | Kontakt-Rollen: Kunde + Lieferant Verknuepfung, unsere_nr_bei_ihm | 2-3 Std |
| **Phase 5** | Betreuer-Referenz: referenz_kontakt_id + Projekt-Ansprechpartner | 3-4 Std |

**Gesamt: ca. 17-24 Stunden**

---

#### TODO

| # | Aufgabe | Abhaengigkeit |
|---|---------|---------------|
| 1 | DB-Tabellen `kontakte`, `kontakt_personen`, `kontakt_details` anlegen | - |
| 2 | Migrations-Script: erp_kunden → kontakte (initialer Import) | #1 |
| 3 | Dashboard Kunden-Detail: Kontaktpersonen-Section + "+"-Button fuer Details | #1 |
| 4 | E-Mail-Pipeline: Matching gegen kontakt_details.wert erweitern | #2 |
| 5 | Lieferanten-Verknuepfung: ist_lieferant + unsere_nr_bei_ihm | #1 |
| 6 | Betreuer-Referenz: referenz_kontakt_id + UI fuer Verknuepfung | #3 |
| 7 | Auftraege: ansprechpartner_id + rechnungsempfaenger_id Felder | #6 |

---

### 11.5 Kategorisierungs-Optimierung (Dokumente + E-Mails) 🟡

| Attribut | Wert |
|----------|------|
| **Prioritaet** | HOCH |
| **Bereich** | E-Mail-Pipeline, Dokument-Pipeline |
| **Herkunft** | PLAN.md PRIO 1 (aufgeloest) |
| **Notiert** | 2026-02-02 |
| **Stand** | 2026-02-09: E-Mail-Prompt v4.2.1 deployed, Sonstiges 75%→8% |

#### Problem (urspruenglich)

Die KI-Kategorisierung hatte massives Verbesserungspotenzial:
- **14%** der Dokumente landen als "Sonstiges_Dokument"
- **97.5%** der E-Mails landen als "Sonstiges"

#### Umgesetzt: E-Mail-Prompt v4.2.1 (2026-02-09)

**process-email Edge Function** v4.1.1 → v4.2.1 (Deploy 36):
- Komplett ueberarbeiteter GPT-5 Nano System-Prompt
- Few-Shot-Beispiele fuer ALLE Kategorien (nicht nur Kundenanfrage)
- Absender-Muster-Erkennung (partnerinfo@, marketing@, news@ = Newsletter)
- Bekannte Lieferanten-Domains als Hint (weru.de, unilux.de, becker-antriebe.com)
- Neue Kategorie **Nachverfolgung** (Status-Nachfragen, loest KEINEN neuen Auftrag aus)
- Personalvermittler = Newsletter_Werbung, nicht Bewerbung
- Kleinanzeigen = Sonstiges, nicht Lead_Anfrage
- Inhalt vor Betreff priorisieren ("Re: Beauftragung" kann Statusfrage sein)
- Coaching-Absagen = Intern, nicht Terminanfrage
- "Sonstiges" als explizit letzte Option betont

**Ergebnis Re-Kategorisierung (49 Emails, 2026-02-09):**

| Kategorie | VORHER | NACHHER |
|-----------|--------|---------|
| Sonstiges | 37 (75.5%) | 4 (8.2%) |
| Newsletter_Werbung | 1 (2%) | 19 (38.8%) |
| Intern | 2 (4%) | 5 (10.2%) |
| Angebot_Anforderung | 1 (2%) | 4 (8.2%) |
| Lieferstatus_Update | 1 (2%) | 4 (8.2%) |
| 8 weitere | je 0-3 | verteilt |

#### Offen

- [ ] Dokument-Kategorisierung (process-document) noch nicht optimiert (14% Sonstiges)
- [ ] Evaluierung nach 1 Woche Echtbetrieb (geplant ~16.02.2026)
- [ ] recategorize-batch Edge Function loeschen (temporaer, ohne Auth)

---

### 11.6 Edge Functions aufsplitten (Token-Optimierung) 🟡

| Attribut | Wert |
|----------|------|
| **Prioritaet** | MITTEL |
| **Bereich** | Edge Functions, Code-Qualitaet |
| **Herkunft** | PLAN.md PRIO 2 (aufgeloest) |
| **Notiert** | 2026-02-02 |

#### Problem

Die Edge Functions sind zu gross und verbrauchen beim Einlesen massiv Tokens:

| Datei | Zeilen | Tokens |
|-------|--------|--------|
| process-document/index.ts | 1.437 | ~13.300 |
| process-email/index.ts | 1.118 | ~10.100 |
| email-webhook/index.ts | 982 | ~8.800 |

#### Loesung

Edge Functions in kleinere Module aufsplitten:

```
process-document/
├── index.ts          # Nur Orchestrierung (~500 Tokens)
├── ocr.ts            # Mistral OCR-Logik
├── categorization.ts # GPT-Kategorisierung
├── storage.ts        # Supabase Upload
├── database.ts       # DB-Operationen
├── prompts.ts        # System-Prompts (bleibt)
├── categories.ts     # Heuristik-Regeln (bleibt)
└── types.ts          # TypeScript Interfaces
```

---

### 11.7 Fehlende Scanner-Dateien nachholen 📋

| Attribut | Wert |
|----------|------|
| **Prioritaet** | NIEDRIG |
| **Herkunft** | PLAN.md PRIO 4 (aufgeloest) |

Dateien vom 22.-23.01.2026 wurden gescannt aber nicht verarbeitet (ca. 40+ Dateien).
Scanner-Problem wurde am 28.01.2026 behoben, alte Dateien liegen in `\\appserver\Work4all`.

---

*Aktualisiert: 2026-02-09 - PLAN.md Inhalte konsolidiert + PLAN.md aufgeloest*
