# Status: Budgetangebot V1

> Letzte Aktualisierung: 2026-02-04 19:15
> Aktualisiert von: Projektleiter

---

## Aktueller Stand
**Phase:** Phase 12 - Budget-Extraktion Integration
**Letzter abgeschlossener Schritt:** Performance-Test (13.57s pro Extraktion)

---

## Aktiver Auftrag

**Rolle:** Programmierer
**Auftrag-ID:** P015-PROG

### Aufgabe
Budget-Extraktion (GPT) in process-document Edge Function integrieren.

### Anforderungen
1. Bei Kategorie "Aufmassblatt" → automatisch Budget-Extraktion durchführen
2. Eigene Prompt-Datei: `budget-prompts.ts` erstellen
3. Ergebnis in `budget_*` Tabellen speichern (budget_cases, budget_items, etc.)
4. Extraktion nur EINMALIG pro Dokument (Kosten sparen!)
5. Alten Parser `budget-extraction.ts` entfernen (wird nicht mehr gebraucht)

### Technische Details
- GPT-Call dauert ~13s (getestet)
- Prompt aus test-budget-extraction übernehmen
- Nach GPT-Kategorisierung: Wenn "Aufmassblatt" → zweiter GPT-Call
- Ergebnis in DB speichern, nicht nur im Response

### Zu erstellende/ändernde Dateien
1. `supabase/functions/process-document/budget-prompts.ts` - NEU
2. `supabase/functions/process-document/index.ts` - Erweitern (v31)
3. `supabase/functions/process-document/budget-extraction.ts` - LÖSCHEN

### Wichtig
- KEIN separater Endpoint nötig
- Budget-Daten werden bei Scan gespeichert
- Später beim Klick: Nur aus DB laden (schnell)

---

## Erledigte Aufgaben

| Schritt | Status | Datum |
|---------|--------|-------|
| 3-Agenten-Analyse (A/B/C) | Fertig | 2026-02-03 |
| Supabase Migration (11 Tabellen) | Fertig | 2026-02-03 |
| Bridge-Proxy Endpunkte | Fertig | 2026-02-04 |
| Parser-Services (N1) | Fertig | 2026-02-04 |
| Preismodell + Kalkulation (N2) | Fertig | 2026-02-04 |
| Backend API-Endpunkte (N3) | Fertig | 2026-02-05 |
| Frontend Budgetangebot-Modul (N4) | Fertig | 2026-02-05 |
| Code-Validierung + Syntax-Checks (N5) | Fertig | 2026-02-05 |
| Funktionale UI-Tests (Chrome MCP) | Fertig | 2026-02-05 |
| Vollstaendige Funktionstests | Fertig | 2026-02-04 |
| GPT-5.2 Performance Test | Fertig | 2026-02-04 |
| Edge Function Refactoring | Fertig | 2026-02-04 |
| Budget-Extraktion Performance Test | Fertig | 2026-02-04 |

---

## Blocker
- (keine)

---

## Nachtmodus
**Status:** INAKTIV

---

## Letzter Abschlussbericht
Siehe 03_LOG.md [LOG-014]
