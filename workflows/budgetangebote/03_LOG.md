# Arbeitslog: Budgetangebot V1

> **WICHTIG:** Bei JEDEM Eintrag den Index aktualisieren!

---

## INDEX
| ID | Datum | Rolle | Beschreibung | Zeilen |
|----|-------|-------|--------------|--------|
| [LOG-001] | 2026-02-03 | PL | System-Initialisierung | 25-45 |
| [LOG-002] | 2026-02-03 | PL | 3-Agenten-Analyse abgeschlossen | 50-130 |
| [LOG-003] | 2026-02-03 | PROG | Supabase Migration: 11 Tabellen angelegt | 90-150 |

---

## ═══ LOG START ═══

---

## [LOG-001] Projektleiter: System-Initialisierung
**Datum:** 2026-02-03 14:00

### Kontext
Aufbau des Drei-Agenten-Systems fuer Budgetangebot V1 (Fenster).
Basiert auf SYSTEM_DOKUMENTATION.md aus dem Reparatur-Workflow.

### Durchgefuehrt
- Ordner `workflows/budgetangebote/` angelegt
- CLAUDE.md erstellt (Regeln + Kontext)
- 01_SPEC.md erstellt (Entwurf)
- 02_STATUS.md, 03_LOG.md, 04_LEARNINGS.md, 05_PROMPTS.md initialisiert

### Ergebnis
Workflow-Struktur bereit fuer parallele Analyse durch 3 Agenten (A/B/C).

### Naechster Schritt
3 Analyse-Agenten starten:
- A: Datenanalyse/Backtest-Design (Work4All)
- B: Datenmodell Supabase
- C: Bridge/Proxy Architektur

---

## [LOG-002] Projektleiter: 3-Agenten-Analyse abgeschlossen
**Datum:** 2026-02-03 16:00

### Kontext
Parallele Analyse durch 3 spezialisierte Agenten (A/B/C) gemaess Auftrag.

### Durchgefuehrt

**Agent A - Work4All Datenanalyse:**
- Schema dbo.Positionen: ~120k Zeilen, 60 MB, 8 relevante Spalten
- Textposition-Erkennung: `Anzahl=0 AND EinzPreis=0` + Header-Keywords
- Kontext-Parser: Header (WERU CASTELLO...) setzen Kontext, Items erben
- Mass-Extraktion: 4 Regex-Pattern (1230x1480 mm, 123x148 cm, 1,23x1,48 m, B=H=)
- B/H-Heuristik: Element-Typ abhaengig, 3 Confidence-Levels
- Backtest-Plan: 500 Angebote, Metriken (Median <10%, Trefferquote >80%)

**Agent B - Supabase Datenmodell:**
- 10 Tabellen: budget_cases, _inputs, _profile, _items, _accessories, _results, _outcomes, price_model_versions, price_params, learned_stats
- SQL-Migration vollstaendig
- RLS: User sieht nur eigene Cases, Service-Role fuer Preise
- Statusfluss: draft → calculated → sent → quoted → ordered → won/lost
- Learning-Felder: deviation_percent als Gold-Metrik

**Agent C - Bridge/Proxy Architektur:**
- Empfehlung: Node.js Backend erweitern (Option A)
- 4 Endpunkte: /positionen, /summary, /angebots-history, /health
- Cache: erp_angebot_summaries_cache (24h TTL)
- Security: IP Allowlist + API Key + Parameterized Queries
- Fallback: erp_angebote.wert bei Proxy-Ausfall
- Risiko-Matrix: 10 Risiken mit Mitigations

### Ergebnis
Vollstaendige technische Grundlage dokumentiert. Bereit fuer Implementation.

### Naechster Schritt
Phase 1 starten:
1. Supabase Migration deployen (10 Tabellen)
2. Bridge-Proxy Endpunkte implementieren
3. Backtest mit 200 Angeboten

---

## [LOG-003] Programmierer: Supabase Migration - 11 Tabellen angelegt
**Datum:** 2026-02-03 17:05

### Kontext
Auftrag aus 02_STATUS.md: Phase 1 - Supabase Migration deployen.
10 Budget-Tabellen + 1 Cache-Tabelle gemaess 01_SPEC.md Kapitel 3+4.

### Durchgefuehrt
**Migration `create_budget_tables` via MCP erfolgreich deployed:**

**11 Tabellen erstellt:**
1. `budget_cases` - Haupttabelle (Case = Anfrage)
2. `budget_inputs` - Eingabe-Dokumente (Aufmassblatt, Notiz)
3. `budget_profile` - Globale Einstellungen (Hersteller, System, Glas)
4. `budget_items` - Einzelne Elemente (Fenster, Tueren)
5. `budget_accessories` - Zubehoer pro Element
6. `budget_results` - Berechnungsergebnisse
7. `budget_outcomes` - Outcomes mit Gold-Metrik deviation_percent
8. `price_model_versions` - Versionierte Preismodelle
9. `price_params` - Parameter pro Version
10. `learned_stats` - ML-Statistiken
11. `erp_angebot_summaries_cache` - W4A Cache (TTL 24h)

**RLS aktiviert auf allen 11 Tabellen**

**RLS Policies erstellt:**
- budget_cases: SELECT/INSERT/UPDATE/DELETE fuer eigene + unassigned Cases
- budget_inputs/profile/items/results/outcomes: Via budget_case_id
- budget_accessories: Via budget_item_id -> budget_cases
- price_model_versions/price_params/learned_stats/cache: SELECT fuer authenticated, ALL fuer service_role

**23 Indizes erstellt auf:**
- Alle Foreign Keys
- Status-Spalten (budget_cases.status)
- Zeitstempel (created_at, calculated_at, computed_at, outcome_date)
- Haeufig gefilterte Spalten (element_type, category, source_type)

**Trigger erstellt:**
- budget_cases_updated_at: Automatische Aktualisierung von updated_at

**Kommentare hinzugefuegt:**
- Alle Tabellen dokumentiert
- deviation_percent als Gold-Metrik markiert

### Ergebnis
Migration erfolgreich. Alle 11 Tabellen mit RLS, Policies und Indizes in Supabase verfuegbar.

### Naechster Schritt
Phase 1.2: Bridge-Proxy Endpunkte implementieren (Node.js Backend)

---

## ═══ NAECHSTER EINTRAG HIER ═══
