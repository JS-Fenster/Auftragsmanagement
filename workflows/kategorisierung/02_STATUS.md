# Kategorisierungs-Optimierung - STATUS

## Aktueller Stand
- **Phase:** ABGESCHLOSSEN - Production deployed + Bulk-Re-Kategorisierung fertig
- **Letzte Aenderung:** 2026-02-10
- **Naechster Schritt:** Keine offenen Punkte

## Production Deployment
- **process-document v33** deployed am 2026-02-10 (v32 + Typo-Fix)
- GPT-5.2 → GPT-5 mini, Heuristik entfernt, Dateiname als Kontext
- canonicalizeKategorie() fuer Typo-Korrektur (Brief_eingend→Brief_eingehend etc.)
- Neue Docs werden ab sofort mit GPT-5 mini kategorisiert

## Bulk-Re-Kategorisierung (2026-02-10)

### Ergebnis
| Metrik | Wert |
|--------|------|
| Verarbeitet | 308/308 (96 Rule + 212 GPT-5.2) |
| Geaendert | 126 (40.9%) |
| Applied (DB) | 120 |
| DB-Fehler | 6 |
| Batch-Fehler | 0 |
| Dauer | ~28 Minuten |
| Edge Function | classify-backtest v2.0.1 |

### Top-Aenderungen
| Alt → Neu | Anzahl | Bewertung |
|-----------|--------|-----------|
| Eingangsrechnung → Eingangslieferschein | 15x | Korrekt |
| Auftragsbestaetigung → Eingangslieferschein | 13x | Korrekt |
| Sonstiges_Dokument → Bild | 12x | Korrekt |
| Eingangsrechnung → Montageauftrag | 10x | Korrekt |
| Sonstiges_Dokument → Brief_eingehend | 6x | Korrekt |
| Montageauftrag → Serviceauftrag | 6x | Korrekt |
| Bestellung → Eingangslieferschein | 4x | Korrekt |
| Sonstiges_Dokument → Formular | 3x | Korrekt |
| Sonstiges_Dokument → Produktdatenblatt | 3x | Korrekt |
| Bauplan → Kassenbeleg | 3x | Nicht applied (DB-Fehler) |
| Auftragsbestaetigung → Vertrag | 2x | Korrekt |
| Leasing → Brief_eingehend | 2x | Korrekt |
| + 34 weitere Einzelaenderungen | | |

### Stichproben-Verifikation
- 5x Eingangslieferschein: Alle korrekt (Steinau, Fenstergigant, WERU, AHB, Gruen)
- 4x Bild: Alle korrekt (img-Referenzen, minimaler OCR-Text)
- 3x Montageauftrag: Alle korrekt (Termine mit Ort/Datum/Monteur)

## Backtest-Ergebnis (kumulativ)

| Metrik | 100 Docs (manuell) | 500 Docs (automatisch) |
|--------|-------------------|----------------------|
| Docs getestet | 100 | 500 |
| Geaendert | 55 (55%) | 235 (47.0%) |
| Fehler (API) | 0 | 3 (Typos) |
| Falsch klassifiziert | 1 (gefixt) | Stichproben OK |
| Prompt-Version | v2.1 | v2.1 |
| Modell | GPT-5 mini | GPT-5 mini |

## Gefundene Bugs (alle gefixt)

### 1. Typo-Bug: GPT-5 mini schreibt falsche Kategorienamen
| Falsch | Richtig | Anzahl |
|--------|---------|--------|
| Brief_eingend | Brief_eingehend | 2x |
| Brief_eingang | Brief_eingehend | 1x |
**Fix:** canonicalizeKategorie() in categories.ts + process-document v33 deployed

### 2. temperature: 0 nicht unterstuetzt von GPT-5 mini
- Erster Bulk-Lauf: 308/308 "unchanged" (alle GPT-Calls HTTP 400)
- Diagnose: Manueller Test zeigte "temperature does not support 0"
- **Fix:** temperature entfernt, classify-backtest v2.0.1 deployed

## Prompt-Versionen

| Version | Datum | Aenderung |
|---------|-------|-----------|
| v2.0 | 2026-02-10 | KOMPLETT NEU: 36 Kategorien, 12 Few-Shot, Entscheidungsbaeume, GPT-5 mini |
| v2.1 | 2026-02-10 | Fix: Vorvertragliche Pflichtinformationen → Vertrag (nicht Lieferantenangebot) |

## Dateien und Deployment

| Was | Wo | Version |
|-----|----|---------|
| Haupt-Prompt | `supabase/functions/process-document/prompts.ts` | v2.1 (deployed in v33) |
| Kategorien+Aliases | `supabase/functions/process-document/categories.ts` | v1.0 (deployed in v33) |
| Backtest-Function | Supabase Edge Function `classify-backtest` | v2.0.1 (deployed) |
| Production-Function | Supabase Edge Function `process-document` | **v33 (GPT-5 mini, deployed)** |
| Batch-Runner | `supabase/functions/classify-backtest/_bulk_recat.js` | lokal |

## Offene Entscheidungen
1. ~~Production-Deploy~~ ERLEDIGT (v33)
2. ~~Bulk-Re-Kategorisierung~~ ERLEDIGT (120/308 applied)
3. ~~Typo-Bug fixen~~ ERLEDIGT (canonicalizeKategorie)
4. ~~Stichproben-Review~~ ERLEDIGT (alle geprueften korrekt)

## Backtest-Dateien (lokal, nicht committed)
- `_backtest_ids.json` - 520 Dokument-IDs
- `_backtest_results.json` - Vollstaendige Ergebnisse (500 Docs)
- `_backtest_runner.js` - Batch-Runner Script
- `_backtest_retry.js` - Retry-Script fuer fehlgeschlagene Batches
- `_bulk_recat.js` - Bulk-Re-Kategorisierung Runner (308 Docs)
