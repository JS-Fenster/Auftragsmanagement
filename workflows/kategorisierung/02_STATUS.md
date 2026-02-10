# Kategorisierungs-Optimierung - STATUS

## Aktueller Stand
- **Phase:** Production deployed + 500-Docs-Backtest abgeschlossen
- **Letzte Aenderung:** 2026-02-10
- **Naechster Schritt:** Typo-Bug fixen, dann Bulk-Re-Kategorisierung besprechen

## Production Deployment
- **process-document v32** deployed am 2026-02-10
- GPT-5.2 → GPT-5 mini, Heuristik entfernt, Dateiname als Kontext
- Neue Docs werden ab sofort mit GPT-5 mini kategorisiert

## Backtest-Ergebnis (kumulativ)

| Metrik | 100 Docs (manuell) | 500 Docs (automatisch) |
|--------|-------------------|----------------------|
| Docs getestet | 100 | 500 |
| Geaendert | 55 (55%) | 235 (47.0%) |
| Fehler (API) | 0 | 3 (Typos) |
| Falsch klassifiziert | 1 (gefixt) | Auswertung offen |
| Prompt-Version | v2.1 | v2.1 |
| Modell | GPT-5 mini | GPT-5 mini |

## 500-Docs-Backtest Detail

### Source Distribution (woher kam die alte Kategorie?)
| Quelle | Anzahl | Anteil | Davon geaendert |
|--------|--------|--------|-----------------|
| process-document-gpt (GPT-5.2) | 248 | 49.6% | 71 (28.6%) |
| rule (Heuristik) | 174 | 34.8% | 133 (76.4%) |
| ? (unbekannt/null) | 78 | 15.6% | 31 (39.7%) |

### Top Change Patterns (alle 235 Aenderungen)
| Alt → Neu | Anzahl | Wahrscheinliche Ursache |
|-----------|--------|------------------------|
| Sonstiges_Dokument → Bild | 29 | GPT-5.2 zu konservativ bei Bildern |
| Eingangsrechnung → Eingangslieferschein | 22 | Heuristik-Keyword "Auftragsnummer" |
| Auftragsbestaetigung → Eingangslieferschein | 15 | Heuristik-Keyword auf Lieferscheinen |
| Montageauftrag → Serviceauftrag | 12 | Kundendienst-Termine vs interne Montage |
| Eingangsrechnung → Montageauftrag | 10 | Heuristik ordnete falsch zu |
| Auftragsbestaetigung → Vertrag | 9 | Heuristik-Keyword auf Vertraegen |
| Skizze → Aufmassblatt | 7 | Aufmassblatt-Formulare falsch als Skizze |
| Sonstiges_Dokument → Brief_eingehend | 6 | GPT-5.2 zu konservativ |
| Bestellung → Eingangslieferschein | 5 | Lieferscheine falsch als Bestellung |
| Bestellung → Eingangsrechnung | 5 | Rechnungen falsch als Bestellung |
| Bauplan → Kundenanfrage | 5 | Heuristik "1:200" in Norm-Nummern |
| Sonstiges_Dokument → Formular | 5 | GPT-5.2 zu konservativ |
| Notiz → Montageauftrag | 5 | Terminzettel falsch als Notiz |
| Auftragsbestaetigung → Eingangsrechnung | 4 | Heuristik-Keyword auf Rechnungen |
| Eingangsrechnung → Sonstiges_Dokument | 4 | **Moegliche Regression** |
| Bauplan → Eingangslieferschein | 4 | Heuristik auf Lieferscheinen |
| Sonstiges_Dokument → Produktdatenblatt | 4 | GPT-5.2 zu konservativ |

### Backtest-Runden (Runde 1-5: manuell, Runde 6: automatisch)

| Runde | Docs | Geaendert | Fehler | Falsch | Prompt | Highlights |
|-------|------|-----------|--------|--------|--------|------------|
| 1 | 20 | 8 | 0 | 0 | v2.0 | 8x Rule-Korrektur (Bauplan→PDB, AB→LS, AB→Aufmass) |
| 2 | 20 | 15 | 0 | 1 | v2.0 | 4x Sonstiges→Bild, Telekom→Brief statt Vertrag |
| 3 | 20 | 13 | 0 | 1 | v2.0 | Telekom→Lieferantenangebot statt Vertrag, 7x ER→LS |
| 4 | 20 | 11 | 0 | 0 | v2.1 | Bauplan→Kundenanfrage, Sonstiges→Zahlungsavis, 4x Skizze→Aufmass |
| 5 | 20 | 8 | 0 | 0 | v2.1 | Bauplan→Kassenbeleg, Sonstiges→PDB (DoP), 3x Skizze→Aufmass |
| 6 (auto) | 500 | 235 | 3 | offen | v2.1 | Siehe Top-Patterns oben |

## Gefundene Bugs

### 1. Typo-Bug: GPT-5 mini schreibt falsche Kategorienamen
| Falsch | Richtig | Anzahl |
|--------|---------|--------|
| Brief_eingend | Brief_eingehend | 2x |
| Brief_eingang | Brief_eingehend | 1x |
**Ursache:** Die classify-backtest Edge Function nutzt `json_schema` mit Enum-Validierung, aber GPT-5 mini generiert trotzdem Tippfehler. Moegliche Loesung: Post-Processing mit Fuzzy-Match oder Alias-Mapping in production.

### 2. ERROR-Ergebnis (1x)
Ein Dokument wurde mit "ERROR" statt einer Kategorie klassifiziert. Muss manuell geprueft werden.

## Prompt-Versionen

| Version | Datum | Aenderung |
|---------|-------|-----------|
| v2.0 | 2026-02-10 | KOMPLETT NEU: 36 Kategorien, 12 Few-Shot, Entscheidungsbaeume, GPT-5 mini |
| v2.1 | 2026-02-10 | Fix: Vorvertragliche Pflichtinformationen → Vertrag (nicht Lieferantenangebot) |

## Dateien und Deployment

| Was | Wo | Version |
|-----|----|---------|
| Haupt-Prompt | `supabase/functions/process-document/prompts.ts` | v2.1 (deployed in v32) |
| Schema | `supabase/functions/process-document/schema.ts` | unveraendert |
| Backtest-Function | Supabase Edge Function `classify-backtest` | v2.2.0 (deployed) |
| Production-Function | Supabase Edge Function `process-document` | **v32 (GPT-5 mini, deployed)** |

## Offene Entscheidungen
1. ~~Production-Deploy~~ ERLEDIGT (v32)
2. Bulk-Re-Kategorisierung aller bestehenden Dokumente?
3. Typo-Bug fixen (Alias-Mapping oder Enum-Validierung)
4. Stichproben-Review der 12x Montageauftrag→Serviceauftrag und 10x ER→Montageauftrag
5. 4x ER→Sonstiges_Dokument pruefen (moegliche Regression)

## Vorgeschlagene neue Kategorien
| Kategorie | Grund | Status |
|-----------|-------|--------|
| - | Keine neuen Kategorien noetig nach 600 Docs (100+500) | Nicht noetig |

## Backtest-Dateien (lokal, nicht committed)
- `_backtest_ids.json` - 520 Dokument-IDs
- `_backtest_results.json` - Vollstaendige Ergebnisse (500 Docs)
- `_backtest_runner.js` - Batch-Runner Script
- `_backtest_retry.js` - Retry-Script fuer fehlgeschlagene Batches
