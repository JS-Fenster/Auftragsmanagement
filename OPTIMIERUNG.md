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
| `PLAN.md` | 176 | Sprint-Plan |
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

## 9. Workflow-Logs Konsolidierung

### 9.1 Aktuelle Situation

| Datei | Budgetangebote | Reparaturen | Problem |
|-------|----------------|-------------|---------|
| `03_LOG.md` | 2663 Zeilen, 38 Eintraege | 2301 Zeilen, 39 Eintraege | Kein Problem - workflow-spezifisch |
| `04_LEARNINGS.md` | 72 Zeilen, 35 Learnings | 53 Zeilen, 23 Learnings | Ueberschneidungen bei System-Themen |
| `CLAUDE.md` | 442 Zeilen | 454 Zeilen | 95% identisch! |

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

### Prioritaet 4 - Workflow-Konsolidierung

| # | Aufgabe | Quelle |
|---|---------|--------|
| T4.1 | _SHARED Ordner erstellen | 9.6 |
| T4.2 | WORKFLOW_CLAUDE_BASE.md extrahieren | 9.6 |
| T4.3 | SYSTEM_LEARNINGS.md erstellen | 9.6 |
| T4.4 | Budgetangebote CLAUDE.md reduzieren | 9.6 |
| T4.5 | Reparaturen CLAUDE.md reduzieren | 9.6 |
| T4.6 | 04_LEARNINGS.md bereinigen | 9.6 |

---

*Aktualisiert: 2026-02-06 - Workflow-Logs Konsolidierung hinzugefuegt*
