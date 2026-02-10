# Status: Budgetangebot V2

> Letzte Aktualisierung: 2026-02-10
> Aktualisiert von: Tester (P015 ABGESCHLOSSEN, B-055)

---

## Aktueller Stand
**Phase:** SPRINT P012-P016 - Preisoptimierung Phase 2
**Letzter abgeschlossener Schritt:** B-055 (P015 Re-Backtest nach erweitertem Datensatz)
**Aktueller Auftrag:** P016 - Programmierer

---

## Nachtmodus
**Status:** INAKTIV

---

## Aktiver Auftrag

**Prompt:** P016
**Rolle:** Programmierer
**Aufgabe:** LV-Kompression: 7.483 → ~500 Cluster (Aggregation auf Matching-Dimensionen)
**Details:** Siehe 05_PROMPTS.md [P016]

### Sprint-Plan P012-P016
| # | Prompt | Rolle | Aufgabe | Status |
|---|--------|-------|---------|--------|
| 1 | P012 | PROG | Sonderformen + sonstiges-Fix + Unilux im Build-Script | **FERTIG (B-052)** |
| 2 | P013 | TEST | Re-Backtest nach P012 | **FERTIG (B-053)** |
| 3 | P014 | PROG | W4A 2023+2024 Rechnungs-Sync + LV Rebuild | **FERTIG (B-054)** |
| 4 | P015 | TEST | Re-Backtest nach erweitertem Datensatz | **FERTIG (B-055)** |
| 5 | P016 | PROG | LV-Kompression auf Matching-Dimensionen (7483→~500) | **IN ARBEIT** |

---

## Gesamtergebnis nach P015

| Metrik              | Start (P005) | P013 (alt LV) | P015 fen+bt | Ziel  | Status |
|---------------------|--------------|----------------|-------------|-------|--------|
| Testpositionen      | ~418         | 418            | 442         | -     | +58% mehr Testdaten |
| Median-Abweichung   | 30.9%        | **18.3%**      | **22.2%**   | <15%  | REGRESSION +3.9pp (WAVG-Problem) |
| Trefferquote <=20%  | 37.1%        | **54.7%**      | **48.3%**   | >70%  | REGRESSION -6.4pp (WAVG-Problem) |
| Ausreisser >50%     | 26.3%        | **6.5%**       | **17.7%**   | <10%  | REGRESSION +11.2pp (haustuer!) |
| Coverage            | 72%          | **91.4%**      | **98.4%**   | >90%  | VERBESSERUNG +7pp |

**ACHTUNG:** Die P015-Regression ist KEIN echtes Quality-Problem, sondern hat 2 Ursachen:
1. Weighted Average mittelt ueber viel mehr LV-Varianten (7.483 vs 2.892) → breitere Preisspanne
2. haustuer-Kategorie (212 Pos., 43.6% Median) dominiert - bei P013 nur 3 Pos.

**Fenster allein:** 20.4% Median (P015) vs. 18.2% (P013) = nur +2.2pp Verschlechterung

### Erkenntnisse P015
1. LV muss **komprimiert** werden: 1 Eintrag pro kat+oa+gk statt 10-100 Varianten
2. haustuer braucht separate Preisstrategie (43.6% Median!)
3. Backtest-Methodik standardisieren: Immer WERU-Format + Weighted Average
4. Coverage-Verbesserung ist real: 91.4% → 98.4% bei fenster+balkontuer

### Naechste Hebel (priorisiert)
1. **LV komprimieren:** 7.483 → ~500 aggregierte Cluster (HIGHEST IMPACT)
2. haustuer-Matching separat behandeln
3. Festfeld-Kategorie verbessern
4. WERU-Listenpreise als Referenz/Fallback

---

## System-Uebersicht V2

### Edge Functions (Supabase - LIVE)
| Function | Status | Version | Tools |
|----------|--------|---------|-------|
| `budget-ki` | ACTIVE | **v1.2.0** | **4 Tools** (suche_lv_granular, suche_leistungsverzeichnis, hole_preishistorie, berechne_fensterpreis) |
| `budget-dokument` | ACTIVE | v1.0.0 | - |

### Datenbank (Supabase)
| Tabelle | Status |
|---------|--------|
| budget_cases | Bereit (RLS aktiv) |
| budget_positionen | Bereit (RLS aktiv) |
| budget_dokumente | Bereit (RLS aktiv) |
| erp_rechnungen | ~1.100 Eintraege (ab 2023) |
| erp_rechnungs_positionen | **12.145** Eintraege (ab 2023, P014) |
| erp_angebote | ~1.179 Eintraege (ab 2023) |
| erp_angebots_positionen | **29.430** Eintraege (ab 2023, P014) |
| leistungsverzeichnis | **7.483** Eintraege (P014 Rebuild, +159%) |

---

## Offene Punkte (TODO)

| # | Aufgabe | Prioritaet | Status |
|---|---------|------------|--------|
| 1 | ~~LV granular erweitern (P004)~~ | ~~HOCH~~ | **ERLEDIGT (B-040)** |
| 2 | ~~Backtest LV vs. Rechnungen (P005)~~ | ~~HOCH~~ | **ERLEDIGT (B-041)** |
| 3 | ~~Stulp-Fix + Kombi-Erkennung im LV (P006)~~ | ~~HOCH~~ | **ERLEDIGT (B-042)** |
| 4 | ~~Re-Backtest + Verbesserungsanalyse (P007)~~ | ~~HOCH~~ | **ERLEDIGT (B-043)** |
| 5 | ~~Weighted Average Matching (P008)~~ | ~~HOCH~~ | **ERLEDIGT (B-045)** |
| 6 | ~~Rollladen-Aufpreis im Matching (P008)~~ | ~~HOCH~~ | **ERLEDIGT (B-045)** |
| 7 | ~~FIX->festfeld Kategorie-Mapping (P008)~~ | ~~MITTEL~~ | **ERLEDIGT (B-045)** |
| 8 | ~~Re-Backtest P008 Quick-Wins (P009)~~ | ~~HOCH~~ | **ERLEDIGT (B-046)** |
| 9 | ~~Edge Function: Fallback-Stufen entschaerfen~~ | ~~HOCH~~ | **ERLEDIGT (B-048)** |
| 10 | ~~DK-Mapping ergaenzen (DK -> DKR+DKL)~~ | ~~HOCH~~ | **ERLEDIGT (B-048)** |
| 11 | LV-Daten ergaenzen (festfeld-Kombis, balkontuer-Stulp, HST) | HOCH | Offen |
| 12 | ~~"sonstiges"-Kategorie-Regex verbessern~~ | ~~HOCH~~ | **ERLEDIGT (B-052)** |
| 13 | Automatischer Server-Sync (Cron) | MITTEL | Offen |
| 14 | Supabase Auth integrieren | HOCH | Offen |
| 15 | WERU-Listenpreise (JSON) integrieren | MITTEL | Vorbereitet |
| 16 | **LV komprimieren (7483→~500 Cluster)** | **HOCH** | **NEU (P015-Erkenntnis)** |
| 17 | **haustuer-Matching separat behandeln** | **HOCH** | **NEU (P015-Erkenntnis)** |

---

## Erledigte Auftraege

| Schritt | Status | Datum |
|---------|--------|-------|
| SQL Migration (10 Tabellen) | Fertig | 2026-02-05 |
| Edge Functions deployed | Fertig | 2026-02-05 |
| Prefer Header Bugs gefixt (B-034) | Fertig | 2026-02-05 |
| Dashboard Field Normalization (B-035) | Fertig | 2026-02-05 |
| budget-dokument Validation (B-036) | Fertig | 2026-02-05 |
| Sync komplett (B-037) | Fertig | 2026-02-05 |
| E2E Test bestanden (B-038) | Fertig | 2026-02-05 |
| **LV granular erweitert (B-040)** | **Fertig** | **2026-02-09** |
| **Backtest LV vs. Rechnungen (B-041)** | **Fertig** | **2026-02-09** |
| **Stulp-Fix + Kombi + L-Split + Lagerware (B-042)** | **Fertig** | **2026-02-09** |
| **Re-Backtest + Verbesserungsanalyse (B-043)** | **Fertig** | **2026-02-09** |
| **budget-ki v1.1.0 - Weighted Avg + Rollladen + FIX-Mapping (B-045)** | **Fertig** | **2026-02-10** |
| **Re-Backtest P009 - 5 Strategien + RL-Impact (B-046)** | **Fertig** | **2026-02-10** |
| **budget-ki v1.2.0 - Fallback entschaerft + DK-Mapping + RL Smart-Hybrid (B-048)** | **Fertig** | **2026-02-10** |
| **Re-Backtest P011 v1.2.0 - Median 18.6%, Coverage 91.8% (B-049)** | **Fertig** | **2026-02-10** |
| **PL-Review + Gesamtbewertung Quick-Win-Phase (B-050)** | **Fertig** | **2026-02-10** |
| **P012: Sonderformen + sonstiges-Fix + Unilux + Glas (B-052)** | **Fertig** | **2026-02-10** |
| **P013: Re-Backtest - Median 18.3%, Ausreisser 6.5% (B-053)** | **Fertig** | **2026-02-10** |
| **P014: W4A 2023+2024 Sync + LV Rebuild 2892→7483 (B-054)** | **Fertig** | **2026-02-10** |
| **P015: Re-Backtest - WAVG Regression, Coverage 98.4%, LV-Kompression noetig (B-055)** | **Fertig** | **2026-02-10** |
