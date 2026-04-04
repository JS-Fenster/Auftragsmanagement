# Implementierungsplan — Session 2026-04-04

> **Kontext:** Zeiterfassungs-Modul Konzeptbesprechung abgeschlossen.
> **Konzept:** [KB/wissen/ZEITERFASSUNG_KONZEPT.md](../../KB/wissen/ZEITERFASSUNG_KONZEPT.md)
> **Typ:** INVASIV — wird nach Umsetzung aktualisiert oder geloescht.

---

## Phase 1: UI-Umstrukturierung (JETZT)

### 1.1 Neuer Menuepunkt "Zeiterfassung"
- Neuen Eintrag in Sidebar: "Zeiterfassung" (zwischen Kontakte und Mitarbeiter)
- Neue Route `/zeiterfassung`
- Neue Seite `Zeiterfassung.jsx` mit Sub-Navigation (Tabs):
  - Tagesuebersicht (Platzhalter)
  - Stempel-Protokoll (Platzhalter)
  - Abwesenheiten (bestehende AbwesenheitenSection hierher verschieben)
  - Monats-Auswertung (Platzhalter)
- Icon: Clock oder Timer (lucide-react)

### 1.2 Abwesenheiten aus MA-Stamm entfernen
- `AbwesenheitenSection` aus MitarbeiterDetail.jsx Tab 3 entfernen
- In Zeiterfassung-Seite einbauen (gefiltert nach MA oder alle)
- Bidirektionaler Link: MA-Detail → "Zeiterfassung anzeigen"
- Zeiterfassung → Klick auf MA-Name → MA-Detail

### 1.3 MA-Stamm Tabs aufraemen
- Verbleibende Tabs:
  1. Stammdaten (Name, Geburt, Ausweis, Bankdaten, Zeichen)
  2. Vertrag & Arbeitszeit (Beschaeftigungsart, Rolle, Wochentag-Grid, Urlaubsanspruch)
  3. Skills & Qualifikationen (bestehend)
  4. Persoenliches & Finanzen (Notfallkontakt, Lohn)

### 1.4 Hauptmonteur-Skill
- Neuer Skill in `mitarbeiter_skills` oder eigene Spalte auf `mitarbeiter_daten`: `hauptmonteur_befaehigt` (boolean)
- UI: Toggle/Checkbox im Skills-Tab
- Kalender-Integration: Bei Termin-Erstellung Warnung wenn kein Hauptmonteur im Team
- Seed-Daten: Stefan, Mariusz, Christoph = befaehigt. Michael, Manfred = nicht.

---

## Phase 2: Zeiterfassungs-Grundgeruest

### 2.1 DB-Schema erweitern
- `zeitstempel` Tabelle existiert bereits — pruefen ob alle Felder vorhanden:
  - typ: kommen/gehen/pause_start/pause_ende
  - quelle: tablet/app/manuell/nachgetragen
  - ort_verifiziert: boolean
  - koordinaten_lat/lon
  - geraet_id
- Neue Tabelle `zeit_korrekturen` (Audit-Trail):
  - original_zeitstempel_id, beantragt_von, grund, alter/neuer_wert
  - genehmigt_von, status (beantragt/genehmigt/abgelehnt)
- RLS Policies

### 2.2 Tagesuebersicht (Live-Status)
- Tabelle: Alle MA, heutiger Status (eingestempelt/ausgestempelt/Pause/nicht gestempelt)
- Farbcodes: Gruen=aktiv, Grau=noch nicht da, Rot=ausgestempelt
- Letzte Aktion + Uhrzeit

### 2.3 Stempel-Protokoll
- Chronologische Liste aller Stempel (filterbar nach MA, Datum)
- Manueller Nachtrag moeglich (markiert als "nachgetragen")
- Korrektur beantragen (MA-Ansicht spaeter)

### 2.4 Monats-Auswertung
- Soll/Ist pro MA und Monat
- Ueberstunden-Stand
- Abwesenheitstage

---

## Phase 3: Baustellenzeit + Kundenbericht (SPAETER)

Abhaengig von:
- Projekte/Auftraege muessen ausgearbeitet sein
- Firmenhandy-GPS muss konfiguriert sein
- Jess-Sprachberichte muessen erweitert werden

### Features (aus Konzept):
- baustellen_zeiten Tabelle
- Kundenbestaetigung + Unterschrift
- Geofencing
- Anomalie-Erkennung
- Materialverbrauch per Jess
- Wetterdaten automatisch
- Folge-Auftrag automatisch
- Offline-Cache + Sync
- Baustellenbericht (Kurz + Voll)
- Pflichtfelder vor Abschluss

---

## Reihenfolge (empfohlen)

```
1.1 Menuepunkt + Route + Seite (Grundgeruest)       ✓ DONE 2026-04-04
1.4 Hauptmonteur-Skill (DB + UI, klein)              ✓ DONE 2026-04-04
1.2 Abwesenheiten verschieben (bestehende Komponente) ✓ DONE 2026-04-04
1.3 MA-Tabs aufraeumen                               ✓ DONE 2026-04-04
2.1 DB-Schema (zeitstempel pruefen + zeit_korrekturen)  ✓ DONE 2026-04-04
2.2 Tagesuebersicht                                     ✓ DONE 2026-04-04
2.3 Stempel-Protokoll                                   ✓ DONE 2026-04-04
2.4 Monats-Auswertung                                   ✓ DONE 2026-04-04
```

---

## Qualitaets-Regeln (NEU — diese Session)

Nach JEDEM Schritt:
1. Chrome MCP: Seite oeffnen, Screenshot machen
2. Console-Errors pruefen
3. Network-Requests pruefen
4. Edge Cases testen (leere Daten, Umlaute)
5. E2E_TESTS.md aktualisieren
6. Erst DANN naechster Schritt

---

## Referenzen

- Konzept: [KB/wissen/ZEITERFASSUNG_KONZEPT.md](../../KB/wissen/ZEITERFASSUNG_KONZEPT.md)
- E2E Tests: [E2E_TESTS.md](E2E_TESTS.md)
- Backlog: AM-145 (Zeiterfassung), AM-146 (DATEV)
- CLAUDE_GLOBAL.md: Test-Qualitaet Regeln

*Erstellt: 2026-04-04*
