# K-021 Modell-Vergleich: GPT-5-mini vs GPT-5.2

## Test-Setup
- 10 Dokumente mit bekannten Fehlkategorisierungen (manuell korrigiert)
- 3 Varianten: gpt-5-mini, gpt-5.2 low, gpt-5.2 medium
- Prompt: identisch (SYSTEM_PROMPT v4.3.0 aus process-document/prompts.ts)
- json_schema strict mit CLASSIFICATION_SCHEMA (62-Kategorie-Enum + Confidence)
- classify-backtest v2.3.0, deployed 2026-03-06

## Ergebnisse

| # | Doc-ID (kurz) | Korrekte Kategorie | gpt-5-mini (c) | gpt-5.2 low (c) | gpt-5.2 medium (c) |
|---|---------------|-------------------|----------------|-----------------|---------------------|
| 1 | 483060d6 | AB_Eingehend | AB_Eingehend (100) | AB_Eingehend (98) | AB_Eingehend (99) |
| 2 | 5bb6da27 | Anfrage_Eingehend | Aufmassblatt (90) | Notiz (78) | Notiz (70) |
| 3 | 35a7aa04 | Zahlungsavis | Mahnung_Eingehend (92) | Mahnung_Eingehend (72) | Mahnung_Eingehend (78) |
| 4 | ae7abdc9 | Aufmassblatt | Aufmassblatt (90) | Aufmassblatt (92) | Aufmassblatt (86) |
| 5 | 5a3d7f2c | Bild | Lieferschein_Eingehend (95) | Lieferschein_Eingehend (95) | Lieferschein_Eingehend (96) |
| 6 | 0bd14f0f | Montageauftrag | Montageauftrag (98) | Montageauftrag (98) | Montageauftrag (96) |
| 7 | 05de81e4 | Aufmassblatt | Aufmassblatt (98) | Aufmassblatt (99) | Aufmassblatt (100) |
| 8 | e300deb0 | Anfrage_Eingehend | Notiz (85) | Notiz (62) | Notiz (72) |
| 9 | a2bed44e | Zeichnung | Angebot_Eingehend (85) | Angebot_Eingehend (92) | Angebot_Eingehend (85) |
| 10 | e870ef2c | Retoure_Ausgehend | Retoure_Ausgehend (90) | Retoure_Ausgehend (95) | Retoure_Ausgehend (97) |

Legende: Ergebnis (Confidence 0-100). **Fett** = korrekt, kursiv = falsch.

## Korrektheit pro Modell

| # | Korrekte Kategorie | gpt-5-mini | gpt-5.2 low | gpt-5.2 medium |
|---|-------------------|:----------:|:-----------:|:--------------:|
| 1 | AB_Eingehend | OK | OK | OK |
| 2 | Anfrage_Eingehend | FALSCH (Aufmassblatt) | FALSCH (Notiz) | FALSCH (Notiz) |
| 3 | Zahlungsavis | FALSCH (Mahnung_Eingehend) | FALSCH (Mahnung_Eingehend) | FALSCH (Mahnung_Eingehend) |
| 4 | Aufmassblatt | OK | OK | OK |
| 5 | Bild | FALSCH (Lieferschein_Eingehend) | FALSCH (Lieferschein_Eingehend) | FALSCH (Lieferschein_Eingehend) |
| 6 | Montageauftrag | OK | OK | OK |
| 7 | Aufmassblatt | OK | OK | OK |
| 8 | Anfrage_Eingehend | FALSCH (Notiz) | FALSCH (Notiz) | FALSCH (Notiz) |
| 9 | Zeichnung | FALSCH (Angebot_Eingehend) | FALSCH (Angebot_Eingehend) | FALSCH (Angebot_Eingehend) |
| 10 | Retoure_Ausgehend | OK | OK | OK |

## Zusammenfassung

| Modell | Korrekt | Falsch | Trefferquote | Avg Confidence |
|--------|---------|--------|-------------|----------------|
| gpt-5-mini | 5/10 | 5/10 | 50% | 92.3 |
| gpt-5.2 low | 5/10 | 5/10 | 50% | 88.1 |
| gpt-5.2 medium | 5/10 | 5/10 | 50% | 87.9 |

## Analyse

### Alle 3 Modelle identisch korrekt bei:
- AB_Eingehend (Doc 1) - alle mit hoher Confidence (98-100)
- Aufmassblatt (Doc 4, 7) - solide Erkennung
- Montageauftrag (Doc 6) - klare Erkennung
- Retoure_Ausgehend (Doc 10) - korrekt erkannt

### Alle 3 Modelle identisch falsch bei:
- Zahlungsavis (Doc 3): Alle sagen Mahnung_Eingehend - Prompt kennt Zahlungsavis-Muster nicht gut genug
- Bild (Doc 5): Alle sagen Lieferschein_Eingehend - vermutlich OCR-Text vorhanden, Bild-Regel greift nicht
- Anfrage_Eingehend (Doc 8): Alle sagen Notiz - Prompt-Optimierung fuer Anfrage-Erkennung noetig
- Zeichnung (Doc 9): Alle sagen Angebot_Eingehend - Zeichnungs-Erkennung schwach

### Unterschied gpt-5-mini vs gpt-5.2:
- Doc 2 (Anfrage_Eingehend): gpt-5-mini sagt Aufmassblatt, gpt-5.2 sagt Notiz - beide falsch, aber unterschiedlich
- gpt-5-mini hat tendenziell hoehere Confidence-Scores (Durchschnitt 92.3 vs 88)
- gpt-5.2 hat bei korrekt erkannten Docs leicht hoehere Confidence (Aufmassblatt 99-100)

### Fazit
Kein Modell-Unterschied bei der Trefferquote (alle 5/10). Die 5 Fehler sind Prompt-Probleme, nicht Modell-Probleme:
1. **Zahlungsavis** braucht bessere Prompt-Heuristiken (Abgrenzung von Mahnung)
2. **Bild-Erkennung** greift nicht wenn OCR-Text vorhanden ist
3. **Anfrage vs Notiz** Unterscheidung unklar im Prompt
4. **Zeichnung** Kategorie zu selten / zu wenig Hinweise im Prompt

Ein Modellwechsel zu gpt-5.2 bringt bei diesem Test-Set keinen Vorteil. Die Optimierung sollte beim Prompt ansetzen.
