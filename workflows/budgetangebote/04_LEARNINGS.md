# Learnings: Budgetangebot V1

> **Nur Projektleiter darf diese Datei editieren.**
> **Format:** NUR Merksatz + LOG-Pointer. Details stehen im Log.

---

## Grundsaetze
| # | Learning | Log-Referenz |
|---|----------|--------------|
| L1 | Index-Pflege ist kritisch | [B-001] |
| L2 | Positionen-Tabelle (~120k) NICHT replizieren | Initialer Kontext |
| L3 | Angebot wird Auftrag wenn AuftragsDatum gesetzt | Initialer Kontext |

---

## Technische Erkenntnisse
| # | Learning | Log-Referenz |
|---|----------|--------------|
| L4 | Work4All Status-Felder sind leer - eigener Workflow noetig | Initialer Kontext |
| L5 | Textpositionen: Anzahl=0 UND EinzPreis=0 UND Keywords | [B-002] |
| L8 | Header-Keywords: WERU, CASTELLO, CALIDO, IMPREO, weiss, anthrazit, 2/3-fach | [B-002] |
| L9 | Bridge-Proxy statt Replikation - Node.js Backend erweitern | [B-002] |
| L10 | Cache TTL 24h, Invalidierung bei erp_update_time aelter | [B-002] |
| L14 | PozNr OHNE Punkt = Header/Kategorie; PozNr MIT Punkt = echte Position | [B-024] |
| L15 | EKPreis->VKPreis Aufschlag: Median 75%, Standard 85% | [B-023] |
| L16 | Regiestunden = Montageleistung, NICHT ignorieren | [B-024] |
| L17 | Masse stehen NUR im Text (0.3% Rate), DB-Spalten Laenge/Breite ungenutzt | [B-022] |
| L18 | Header enthalten System/Hersteller fuer nachfolgende Positionen | [B-024] |
| L19 | Artikel.Breite/Hoehe/Laenge existieren aber 0% gepflegt | [B-026] |
| L20 | ArtikelGr (134 Gruppen) nutzbar fuer Kategorisierung | [B-026] |
| L21 | Nur 4.5% der Fenster-Positionen haben ArtikelCode | [B-026] |
| L22 | W4A-Format "Breite: XXX mm, Hoehe: YYY mm" ist Standard (91%) | [B-027] |
| L23 | Mehr erkannte Masse = NICHT automatisch besser (Preismodell!) | [B-027] |
| L24 | DEFAULT-System bei 85-90% → System-Erkennung verbessern | [B-027] |
| L25 | GPT statt Regex für W4A-Daten (100% Hersteller-Erkennung) | [B-028] |
| L26 | Aggregierte €/qm reichen NICHT - granulare Elementdaten noetig | [B-029] |
| L27 | Anzahl Fluegel (1/2/3) ist KRITISCH fuer Preismodell | [B-029] |
| L28 | Prefer Header: `===` schlaegt fehl bei kombinierten Werten, `.includes()` nutzen | [B-034] |
| L29 | Custom Prefer ueberschreibt Default komplett - IMMER beide kombinieren | [B-034] |
| L30 | PostgREST `resolution=merge-duplicates` gilt NUR fuer PK, `?on_conflict=` fuer andere | [B-037] |
| L31 | Edge Function Response ist verschachtelt: `data.data.positionen` nicht `data.positionen` | [B-035] |
| L32 | Feldnamen zwischen Edge Function und Dashboard normalisieren (beide Seiten!) | [B-035] |
| L33 | GPT-5.2 Reasoning: kein `temperature` Parameter, `reasoning_effort` stattdessen | [B-033] |
| L34 | Edge Function Timeout mind. 55s fuer GPT-Reasoning | [B-033] |
| L35 | Validation in Edge Functions FLEXIBEL machen - Frontend sendet nicht immer alle Felder | [B-036] |

---

## Architektur-Entscheidungen (V2)
| # | Entscheidung | Begruendung | Log-Referenz |
|---|-------------|-------------|--------------|
| D1 | GPT-5.2 Function Calling statt Regex-Parsing | 100% Trefferquote vs ~60% bei Regex | [B-028], [B-033] |
| D2 | Leistungsverzeichnis als Preisbasis statt feste Tabelle | Echte historische Preise > manuelle Pflege | [B-037] |
| D3 | Edge Functions statt Backend-API fuer KI | Serverless, kein eigener Server noetig | [B-033] |
| D4 | 4-Schritt-Wizard statt 1-Seite | Bessere UX, editierbare Positionen | [B-038] |

---

## Fachliche Erkenntnisse
| # | Learning | Log-Referenz |
|---|----------|--------------|
| L6 | Masse koennen in mm, cm oder m kommen | Initialer Kontext |
| L7 | B/H manchmal vertauscht - Heuristik noetig | Initialer Kontext |
| L11 | 4 Mass-Pattern: 1230x1480, 123x148 (cm), 1,23x1,48 (m), B=H= | [B-002] |
| L12 | Confidence Scores: high (±10%), medium (±20%), low (±30%) | [B-002] |
| L13 | Backtest-Ziel: Median <10%, Trefferquote >80%, Ausreisser <5% | [B-002] |

---

*Letzte Aktualisierung: 2026-02-05*
