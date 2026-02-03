# Learnings: Budgetangebot V1

> **Nur Projektleiter darf diese Datei editieren.**
> **Format:** NUR Merksatz + LOG-Pointer. Details stehen im Log.

---

## Grundsaetze
| # | Learning | Log-Referenz |
|---|----------|--------------|
| L1 | Index-Pflege ist kritisch | [LOG-001] |
| L2 | Positionen-Tabelle (~120k) NICHT replizieren | Initialer Kontext |
| L3 | Angebot wird Auftrag wenn AuftragsDatum gesetzt | Initialer Kontext |

---

## Technische Erkenntnisse
| # | Learning | Log-Referenz |
|---|----------|--------------|
| L4 | Work4All Status-Felder sind leer - eigener Workflow noetig | Initialer Kontext |
| L5 | Textpositionen: Anzahl=0 UND EinzPreis=0 UND Keywords | [LOG-002] |
| L8 | Header-Keywords: WERU, CASTELLO, CALIDO, IMPREO, weiss, anthrazit, 2/3-fach | [LOG-002] |
| L9 | Bridge-Proxy statt Replikation - Node.js Backend erweitern | [LOG-002] |
| L10 | Cache TTL 24h, Invalidierung bei erp_update_time aelter | [LOG-002] |

---

## Fachliche Erkenntnisse
| # | Learning | Log-Referenz |
|---|----------|--------------|
| L6 | Masse koennen in mm, cm oder m kommen | Initialer Kontext |
| L7 | B/H manchmal vertauscht - Heuristik noetig | Initialer Kontext |
| L11 | 4 Mass-Pattern: 1230x1480, 123x148 (cm), 1,23x1,48 (m), B=H= | [LOG-002] |
| L12 | Confidence Scores: high (±10%), medium (±20%), low (±30%) | [LOG-002] |
| L13 | Backtest-Ziel: Median <10%, Trefferquote >80%, Ausreisser <5% | [LOG-002] |

---

*Letzte Aktualisierung: 2026-02-03*
