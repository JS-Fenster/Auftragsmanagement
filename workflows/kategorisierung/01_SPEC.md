# Kategorisierungs-Optimierung - SPEC

## Ziel
Dokument-Kategorisierung von Heuristik+GPT-5.2 auf **reinen GPT-5 mini Prompt** umstellen.
Fehlerhafte Klassifizierungen eliminieren, Kosten senken (15x guenstiger).

## 3-Agenten-System
| Rolle | Aufgabe |
|-------|---------|
| **Projektleiter** | Koordiniert Batches, reviewed Ergebnisse, entscheidet Prompt-Aenderungen |
| **Programmierer** | Schreibt Prompt, deployt Edge Functions, passt Code an |
| **Tester** | Fuehrt Backtests durch, analysiert Ergebnisse, meldet Abweichungen |

## Bekannte Probleme (Ausgangslage)
1. Heuristik-Keyword `1:200` matcht in EN-Norm `1:2006` → Bauplan statt Produktdatenblatt
2. Heuristik-Keyword `auftragsnummer` zu generisch → Lieferschein wird Auftragsbestaetigung
3. 12.7% Sonstiges_Dokument (278 von 2.197)
4. Heuristik override GPT auch wenn GPT richtig liegt

## Ansatz
1. Heuristik-Override komplett entfernen
2. GPT-5.2 → GPT-5 mini ($0.002/Doc statt $0.03/Doc)
3. Prompt mit Few-Shot-Beispielen, besseren Abgrenzungen
4. Dateiname als zusaetzlichen Kontext mitgeben
5. Iterativ testen: 10-20 Docs pro Runde, Prompt anpassen

## Metriken
| Metrik | IST | ZIEL |
|--------|-----|------|
| Sonstiges_Dokument | 12.7% | <5% |
| Fehlklassifikation (geschaetzt) | ~15-20% | <5% |
| Kosten/Dokument | ~$0.03 | ~$0.002 |
| Heuristik-Regeln | 13 Rules | 0 Rules |

## Kategorien (36 aktuell)
Siehe `categories.ts` - bei Bedarf neue Kategorien vorschlagen.
