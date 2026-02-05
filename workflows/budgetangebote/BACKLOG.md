# BACKLOG - Budgetangebot-Workflow

> **Zweck:** Ideen und Features fuer spaetere Iterationen.
> Diese Punkte sind NICHT Teil des aktuellen MVP.
> Stand: 2026-02-03

---

## Legende

| Prioritaet | Bedeutung |
|------------|-----------|
| HOCH | Sollte nach MVP als naechstes kommen |
| MITTEL | Wichtig, aber nicht dringend |
| NIEDRIG | Nice-to-have, irgendwann |

---

## Backlog-Items

### B-001: Terrassendaecher + Wintergaerten
**Prioritaet:** MITTEL
**Quelle:** Analyse-Phase (Out of Scope V1)

**Beschreibung:**
Budgetangebot V1 deckt nur Fenster/Tueren ab. Spaeter erweitern um Terrassendaecher und Wintergaerten mit eigenen Preismodellen.

---

### B-002: OCR-Integration fuer Aufmassblaetter
**Prioritaet:** HOCH
**Quelle:** Agent A Analyse

**Beschreibung:**
Automatische Extraktion von Massen aus gescannten Aufmassblaettern via Mistral OCR (wie bei Documents). Integration mit budget_inputs.raw_ocr.

---

### B-003: ML-basierte Preiskalibrierung
**Prioritaet:** NIEDRIG
**Quelle:** Agent B Analyse

**Beschreibung:**
Wenn genug Outcome-Daten vorhanden (>100 Conversions), ML-Modell trainieren um Preisparameter automatisch zu optimieren. Nutzt deviation_percent als Loss.

---

### B-004: Kunde-Historie Dashboard
**Prioritaet:** MITTEL
**Quelle:** Agent C Analyse

**Beschreibung:**
UI-Komponente die /api/w4a/kunden/:code/angebots-history nutzt um alle bisherigen Angebote eines Kunden anzuzeigen mit Trend-Analyse.

---

## Archiv (abgeschlossen oder verworfen)

*Noch keine Eintraege*

---

*Letzte Aktualisierung: 2026-02-03*
