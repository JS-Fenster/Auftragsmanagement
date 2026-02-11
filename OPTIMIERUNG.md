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
| Frontend-Seiten | 9 | 7 (Dashboard) + 12 (Legacy Frontend) | Dashboard ist Primary |
| Backend-APIs | 0 (Frontend-only) | 25+ Endpunkte | AM besser |
| Edge Functions | 0 | 10 aktiv + 1 deaktiviert | AM besser |
| SQL Migrations | 0 | 6+ | AM besser |
| RLS Policies | 0 | Ja | AM besser |

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
- Neue Seite `dashboard/src/pages/Lieferanten.jsx`
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
- Neue Seite `dashboard/src/pages/Bestellungen.jsx`
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
- Neue Seite `dashboard/src/pages/Kalender.jsx`
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
- Dashboard Dokumente-Seite (Two-Panel mit Preview, Filter, Email-Meta/Body/Anhaenge-Anzeige, PDF/Bild-Vorschau)
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
| Dashboard | `dashboard/` | 19 | 7 | 3000 | 6 |

~~Frontend (ALT) wurde geloescht (2026-02-11). Dashboard ist die einzige UI.~~

**ERLEDIGT:**
- [x] ~~Entscheiden: Dashboard ODER Frontend als Primary~~ → Dashboard
- [x] ~~Port-Konflikt loesen~~ → Frontend geloescht
- [ ] Reparaturen-Seite im Dashboard ergaenzen (fehlte im alten Frontend: 94 KB Monster-Datei)

#### 6.1.3 Status-Systeme inkompatibel 🟡

| System | Ort | Zustaende |
|--------|-----|-----------|
| WORKFLOW_STATUS | ~~`frontend/src/lib/supabase.js`~~ (geloescht) | 12 (angebot, auftrag, etc.) |
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
| SUPABASE_URL | backend/.env, dashboard/.env, sync/.env | 3x gleicher Wert |
| SUPABASE_KEY | backend/.env, sync/.env | 2x Service Key |
| VITE_SUPABASE_ANON_KEY | dashboard/.env | Enthaelt SERVICE_KEY statt ANON_KEY! |

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
| `workflows/budgetangebote/` | 7 | V2 deployed, alle Backtest-Ziele erreicht |
| `workflows/reparaturen/` | 11 | Step 3+ (Dashboard komplett, Email-Pipeline aktiv) |

### Edge Functions (aktiv)
| Function | Version | Zweck |
|----------|---------|-------|
| process-document | v33 (GPT-5 mini) | OCR + Kategorisierung |
| email-webhook | aktiv | Microsoft Graph Webhook |
| process-email | v4.3.0 (Deploy 37) | E-Mail verarbeiten (21 Kategorien) |
| admin-review | aktiv | Review-UI |
| reparatur-api | v2.3.0 (Deploy 12) | Reparatur CRUD + Einsatzort |
| reparatur-aging | v2.0.0 (Deploy 3) | Aging-Berechnung |
| telegram-bot | v3.3.0 (Deploy 10) | Telegram-Integration |
| renew-subscriptions | v1.2 (Deploy 13) | Graph-Subscription Renewal |
| budget-ki | aktiv | Budget-Berechnung (LV-Matching) |
| budget-dokument | aktiv | Budget-Dokumente |
| recategorize-batch | DEAKTIVIERT (v6 Stub) | HTTP 410 Gone |

---

*Aktualisiert: 2026-02-06 - Struktur-Analyse hinzugefuegt*

---

## 9. Workflow-Logs Konsolidierung ✅ ERLEDIGT (2026-02-06)

> MASTER_LOG.md zentralisiert, CLAUDE.md bleibt vollstaendig pro Workflow, Learnings bleiben lokal.
> _SHARED-Ordner verworfen - einfacher wenn alles in einer Datei bleibt.

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

### Prioritaet 4 - Workflow-Konsolidierung ✅ ERLEDIGT (2026-02-06)

> Siehe Section 9. MASTER_LOG zentralisiert, CLAUDE.md bleibt vollstaendig pro Workflow.

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

#### V1 (GELOESCHT - war in frontend/, jetzt nur dashboard/)

**Dashboard-Seite:**
- `dashboard/src/pages/Budgetangebot.jsx` - Komplett-Workflow (Eingabe→Positionen→Zusammenfassung→Vorschau)

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

#### V2 (LOKAL VORHANDEN + DEPLOYED)

**Edge Functions (lokal + deployed):**
- `supabase/functions/budget-ki/index.ts` - LV-Matching mit GPT Function Calling
- `supabase/functions/budget-dokument/index.ts` - Budget-Dokument Generierung

**Frontend:**
- ~~V2 Frontend (frontend/) geloescht~~ - alle Features nach Dashboard portiert (2026-02-11)
- Dashboard (`dashboard/src/pages/Budgetangebot.jsx`) ist die einzige Budget-UI

**Backtest-Ergebnisse (P017, 2026-02-10):**
- Median-Abweichung: 9.6% (Ziel <15%)
- Trefferquote <=20%: 75.2% (Ziel >70%)
- Ausreisser >50%: 7.5% (Ziel <10%)
- Coverage: 98.7% (Ziel >90%)

---

#### Status

V2 ist aktiv und deployed. V1 (Backend-Services) existiert parallel in `backend/services/budget/`.
Beide Systeme nutzen unterschiedliche Ansaetze: V1 = regelbasiert (priceCalculator.js), V2 = LV-basiert (budget-ki + Leistungsverzeichnis mit 364 Clustern).

**Offene Entscheidung:** V1 Backend-Services deprecaten oder als Fallback behalten?

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

### 11.5 Kategorisierungs-Optimierung (Dokumente + E-Mails) ✅ ABGESCHLOSSEN (2026-02-10)

> **Ergebnis:** Sonstiges 97%→11% (Emails), process-document v33 (GPT-5 mini, -93% Kosten), 534 Emails + 308 Docs nachkategorisiert, recategorize-batch deaktiviert, ~90% Genauigkeit.
>
> **Offen:** Evaluierung nach 1 Woche Echtbetrieb (geplant ~16.02.2026)

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

### 11.8 Budgetangebot: Preisoptimierung + Daten-Erweiterung ✅ ZIELE ERREICHT (2026-02-10)

> **Ergebnis (P017):** Median 9.6% (<15%), Treffer 75.2% (>70%), Ausreisser 7.5% (<10%), Coverage 98.7% (>90%).
> **Durchbruch:** LV-Kompression 7.483→364 Cluster. Daten: 12.145 Rechnungs- + 29.430 Angebotspositionen (ab 2023).
> **Kundenrabatte:** 27% der Positionen rabattiert, einz_preis bleibt Preisbasis.
> **WERU-Rabatte:** Kunststoff 58%, Alu 35%, Objektrabatt 70% (Premium), BLP stabil seit 2024.
>
> **Offene Hebel:** haustuer-Matching (544 Pos., 32.7% Median), HST/Raffstore LV ergaenzen (25 unmatched).

---

### 11.9 Budgetangebot: UI/UX-Optimierungen 📋

| Attribut | Wert |
|----------|------|
| **Prioritaet** | HOCH |
| **Bereich** | Frontend (BudgetDetail.jsx), Edge Function (budget-ki) |
| **Notiert** | 2026-02-10 |
| **Stand** | Dokumentiert, noch nicht umgesetzt |

---

#### Uebersicht der Punkte

| # | Thema | Beschreibung | Betrifft |
|---|-------|-------------|----------|
| U1 | Step-Navigation | Direktes Springen zwischen Schritten | Frontend |
| U2 | Unnoetige Neuberechnung | Positionen werden bei Navigation regeneriert | Frontend + Edge Function |
| U3 | Positionstext-Formatierung | Einheitliche Beschreibungstexte | Edge Function (GPT-Output) |
| U4 | Vorschau-Kopfdaten | Falsche Telefonnr., Adresse, PLZ | Frontend (Vorschau/PDF) |
| U5 | Montage-Berechnung | Eigene Kalkulationsregeln definieren | Frontend + Backend |
| U6 | Preisspanne fehlerhaft | Geschaetzter Endpreis UNTER Bruttosumme | Edge Function (budget-ki) |
| U7 | Netto vs. Brutto Verwirrung | Unklar welche Preise angezeigt werden | Frontend |

---

#### U1: Step-Navigation (direkt springen)

**Problem:** Aktuell kann man nur schrittweise zurueck navigieren (Eingabe → Positionen → Zusammenfassung → Vorschau). Direktes Springen zu einem beliebigen Schritt ist nicht moeglich.

**Gewuenscht:** Klick auf einen Schritt-Indikator oben springt direkt dorthin, unabhaengig vom aktuellen Schritt.

**Technischer Kontext:**
- Dashboard: `dashboard/src/pages/Budgetangebot.jsx` (komplett-Workflow)
- Aktuell Single-Page mit collapsible Sections
- Stepper-Navigation muss auf beliebigen Schritt-Wechsel umgebaut werden

---

#### U2: Unnoetige Neuberechnung vermeiden

**Problem:** Wenn man zurueck zum Eingabe-Schritt geht und wieder vorwaerts navigiert, werden die Positionen komplett neu berechnet (GPT-Call), obwohl sich am Freitext nichts geaendert hat.

**Gewuenscht:** Positionen nur neu berechnen, wenn sich der Eingabe-Freitext tatsaechlich geaendert hat. Sonst die vorhandenen Positionen beibehalten.

**Technischer Kontext:**
- Die Berechnung laeuft ueber die `budget-ki` Edge Function (GPT-5.2 Function Calling)
- Jeder GPT-Call kostet Geld und dauert ~5-10 Sekunden
- Loesung: Hash/Vergleich des Freitexts speichern, nur bei Aenderung neu berechnen

---

#### U3: Positionstext-Formatierung (einheitlich)

**Problem:** Die Positionstexte sind uneinheitlich formatiert. Mal steht "Fenster 2-flg DKR/DKL", mal "WERU CALIDO Fenster DKR/DKL 3-fach Verglasung" - kein Standard.

**Gewuenscht:** Standardisierte Positionsbeschreibungen in einheitlicher Form, z.B.:
```
[Hersteller] [System] [Typ] [Oeffnungsart] [Breite]x[Hoehe] [Verglasung] [Zubehoer]
```

**Technischer Kontext:**
- Die Positionstexte kommen aus dem GPT-Output der budget-ki Edge Function
- Formatierung muss im System-Prompt oder als Post-Processing definiert werden

---

#### U4: Vorschau-Kopfdaten korrigieren

**Problem:** In der Vorschau/PDF-Ansicht sind die Firmendaten falsch:
- Telefonnummer stimmt nicht
- Adresse/PLZ stimmt nicht
- Firmenname/Logo ggf. nicht korrekt

**Gewuenscht:** Korrekte JS Fenster & Tueren Firmendaten:
- Korrekte Adresse, PLZ, Ort
- Korrekte Telefonnummer(n)
- Firmenname und ggf. Logo

**TODO:** Andreas soll die korrekten Daten liefern, dann im Frontend hinterlegen.

---

#### U5: Montage-Berechnung (eigene Regeln)

**Problem:** Unklar wie die Montage aktuell berechnet wird. Andreas moechte eigene Kalkulationsregeln definieren.

**Technischer Kontext (IST-Zustand):**
```
Montage:     80 EUR/Element (Standard)
Demontage:   40 EUR/Element
Entsorgung:  25 EUR/Element ODER 150 EUR pauschal
```
Quelle: `backend/services/budget/priceCalculator.js`

Montage/Demontage/Entsorgung werden per Default einbezogen und als separate Positionen in der Zusammenfassung angezeigt.

**TODO:** Andreas definiert seine eigenen Montage-Kalkulationsregeln (z.B. nach Fenstergroesse, Etage, Geruest noetig, etc.)

---

#### U6: Preisspanne fehlerhaft (Endpreis < Bruttosumme)

**Problem:** Der "Geschaetzte Endpreis" (z.B. 8.611 - 11.650 EUR) liegt UNTER der Bruttosumme (z.B. 12.055 EUR). Das ergibt keinen Sinn - die Spanne sollte die Bruttosumme einschliessen.

**Technischer Kontext (IST-Berechnung):**
```
1. Positionen: Netto-Einzelpreise
2. Summe Netto
3. + 19% MwSt = Brutto
4. Brutto gerundet auf 50 EUR = "geschaetzter Endpreis"
5. Spanne: ±15% vom gerundeten Brutto
   → spanne_von = Brutto * 0.85 (gerundet auf 50)
   → spanne_bis = Brutto * 1.15 (gerundet auf 50)
```

**Vermutetes Problem:** Die Spanne wird auf die Bruttosumme angewendet (±15%), aber die Bruttosumme ist bereits der MITTLERE Schaetzwert. Wenn die Bruttosumme 12.055 EUR ist, sollte die Spanne 10.247 - 13.863 EUR sein (gerundet: 10.250 - 13.850).

**Moegliche Ursache:** Montage/Zubehoer wird in der Bruttosumme beruecksichtigt, aber die Spanne wird nur auf die Elementpreise (ohne Montage) berechnet. → Pruefen!

**TODO:** Berechnung nachvollziehen und Spanne korrigieren.

---

#### U7: Netto vs. Brutto Klarheit

**Problem:** Fuer den Endkunden ist nicht klar, ob die angezeigten Preise Netto oder Brutto sind. Das Budgetangebot sollte Brutto-Preise zeigen (inkl. 19% MwSt).

**Technischer Kontext:**
- Positionen werden intern als Netto berechnet
- MwSt (19%) wird erst in der Zusammenfassung addiert
- Die Anzeige muss klar machen: "Alle Preise inkl. 19% MwSt" oder Positionen direkt als Brutto anzeigen

**TODO:** Entscheiden ob:
- **Option A:** Positionen Netto + MwSt separat ausweisen (B2B-Standard)
- **Option B:** Alle Preise als Brutto anzeigen (B2C-freundlich)
- **Option C:** Umschaltbar (Netto/Brutto Toggle)

---

#### Zusammenfassung TODOs

| # | Aufgabe | Aufwand | Abhaengigkeit |
|---|---------|---------|---------------|
| U1 | Step-Navigation: Direktes Springen implementieren | 2-3 Std | - |
| U2 | Freitext-Hash: Nur bei Aenderung neu berechnen | 1-2 Std | - |
| U3 | GPT-Output: Positionstext-Formatierung standardisieren | 2-3 Std | budget-ki Prompt |
| U4 | Vorschau: JS Fenster Firmendaten eintragen | 30 Min | Andreas liefert Daten |
| U5 | Montage: Eigene Kalkulationsregeln einbauen | 2-4 Std | Andreas definiert Regeln |
| U6 | Preisspanne: Berechnung korrigieren | 1-2 Std | - |
| U7 | Netto/Brutto: Anzeige klaeren + umsetzen | 1-2 Std | Andreas entscheidet |

**Gesamt: ca. 10-17 Stunden**

---

### 11.10 Kontakt-Detail: Interaktive Summary-Cards 📋

| Attribut | Wert |
|----------|------|
| **Prioritaet** | Mittel |
| **Bereich** | Frontend (Kunden.jsx - KontaktDetailModal) |
| **Notiert** | 2026-02-11 |
| **Stand** | Dokumentiert, noch nicht umgesetzt |

**Anforderung:** Alle Summary-Cards im Kontakt-Detail-Modal sollen klickbar/interaktiv sein. Ein Klick auf eine Card oeffnet eine gefilterte Ansicht der zugehoerigen Daten fuer diesen einen Kunden.

| Card | Klick-Aktion |
|------|-------------|
| **Projekte** | Zeigt alle Projekte dieses Kunden (gefiltert) |
| **Angebotswert** | Zeigt alle Angebote dieses Kunden mit Betraegen |
| **Rechnungen** | Zeigt alle Rechnungen dieses Kunden |
| **Offene Rechnungen** | Zeigt NUR die offenen Rechnungen (Faellig/Ueberfaellig) |

**Moegliche Umsetzung:**
- Klick scrollt zur jeweiligen ExpandableSection und oeffnet sie
- Oder: Klick oeffnet eine eigene Filteransicht/Modal
- Offene Rechnungen koennte direkt die Rechnungs-Section oeffnen mit Filter auf "offen"

**Aufwand:** 2-4 Stunden

---

### 11.11 Hardcoded Werte zentralisieren / externalisieren 📋

| Attribut | Wert |
|----------|------|
| **Prioritaet** | HOCH |
| **Bereich** | Dashboard, Edge Functions, Backend |
| **Notiert** | 2026-02-11 |
| **Stand** | Dokumentiert, noch nicht umgesetzt |

---

#### Problem

Ueberall im Code sind Werte fest eingetragen (Firmendaten, Steuersaetze, Montage-Preise, etc.). Bei Aenderungen muss man an vielen Stellen suchen und manuell anpassen - fehleranfaellig und wartungsintensiv.

---

#### Bekannte Hardcoded-Stellen

| Wert | Datei(en) | Was |
|------|-----------|-----|
| **Firmendaten** (Name, Adresse, Tel, Fax, Email) | `dashboard/src/pages/Budgetangebot.jsx` (FIRMA_INFO), `supabase/functions/budget-dokument/index.ts` (4x) | Firma, Strasse, PLZ, Tel, Fax, Email, Web, GF |
| **MwSt-Satz** (0.19) | `dashboard/src/pages/Budgetangebot.jsx` (MWST_SATZ), `budget-dokument/index.ts` | Steuersatz 19% |
| **Montage-Preise** | `backend/services/budget/priceCalculator.js` (WORK_PRICES), `budget-ki/index.ts` | 80/40/25 EUR pro Element |
| **Zubehoer-Preise** | `backend/services/budget/priceCalculator.js` (ACCESSORY_PRICES) | Rollladen 180/m, Raffstore 280/m, etc. |
| **System-Preise** | `backend/services/budget/priceCalculator.js` (SYSTEM_PRICES) | CASTELLO 400, CALIDO 420, IMPREO 520 EUR/qm |
| **Preisspanne** (±15%) | `dashboard/src/pages/Budgetangebot.jsx`, `budget-dokument/index.ts` | Toleranz fuer Budgetschaetzung |
| **Rundung** (auf 50 EUR) | `dashboard/src/pages/Budgetangebot.jsx`, `budget-dokument/index.ts` | Rundungsgranularitaet |
| **Dokument-Kategorien** | `dashboard/src/lib/constants.js` (DOKUMENT_KATEGORIEN) | 41 Kategorien hardcoded statt aus API |
| **Status-Werte** | `dashboard/src/lib/constants.js` (AUFTRAG_STATUS) | 8 Status-Werte |

---

#### Loesung: Zentrale Konfigurations-Tabelle

**Option A: Supabase-Tabelle `app_config`**

```sql
CREATE TABLE app_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    beschreibung TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Beispiel-Eintraege:
INSERT INTO app_config VALUES
('firma', '{"name":"J.S. Fenster & Tueren GmbH","strasse":"Regensburger Strasse 59","plz":"92224","ort":"Amberg","tel":"09621 / 76 35 33","fax":"09621 / 78 32 59","email":"info@js-fenster.de","web":"www.js-fenster.de","gf":["Andreas Stolarczyk","Jaroslaw Stolarczyk"]}', 'Firmenstammdaten'),
('mwst_satz', '0.19', 'Aktueller MwSt-Satz'),
('budget_preisspanne', '0.15', 'Toleranz +/- fuer Budgetschaetzung'),
('budget_rundung', '50', 'Rundungsgranularitaet in EUR');
```

**Option B: `.env` / Umgebungsvariablen**
- Einfacher, aber nur fuer Backend/Edge Functions
- Frontend braeuchte VITE_-Prefix oder API-Call

**Empfehlung:** Option A (Supabase-Tabelle) - aenderbar ueber Dashboard ohne Deployment.

---

#### TODO

| # | Aufgabe | Aufwand | Abhaengigkeit |
|---|---------|---------|---------------|
| 1 | Codebase durchsuchen: ALLE hardcoded Werte identifizieren | 1-2 Std | - |
| 2 | `app_config` Tabelle anlegen + Seed-Daten | 30 Min | - |
| 3 | API-Endpunkt `/api/config` oder Edge Function fuer Config-Abruf | 1 Std | #2 |
| 4 | Dashboard: Config beim Start laden, in Context/Store halten | 1-2 Std | #3 |
| 5 | Edge Functions: Config aus Supabase lesen statt hardcoded | 2-3 Std | #2 |
| 6 | Backend: priceCalculator.js auf Config umstellen | 1-2 Std | #3 |
| 7 | Admin-UI: Einstellungen-Seite zum Bearbeiten der Config | 3-4 Std | #3 |

**Gesamt: ca. 10-15 Stunden**

---

*Aktualisiert: 2026-02-11 - Hardcoded-Werte Zentralisierung notiert*
