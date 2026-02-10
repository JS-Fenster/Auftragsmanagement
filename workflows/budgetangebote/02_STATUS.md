# Status: Budgetangebot V2

> Letzte Aktualisierung: 2026-02-10
> Aktualisiert von: Tester (P017 ABGESCHLOSSEN, B-057)

---

## Aktueller Stand
**Phase:** SPRINT P012-P017 - Preisoptimierung Phase 2 ABGESCHLOSSEN
**Letzter abgeschlossener Schritt:** B-057 (P017 Re-Backtest - ALLE ZIELE ERREICHT!)
**Aktueller Auftrag:** KEINER - Warte auf Projektleiter-Entscheidung

---

## Nachtmodus
**Status:** INAKTIV

---

## Aktiver Auftrag

**Prompt:** P017
**Rolle:** Tester
**Aufgabe:** Re-Backtest nach LV-Kompression (P016)
**Details:** Siehe 05_PROMPTS.md [P017]

### Sprint-Plan P012-P017
| # | Prompt | Rolle | Aufgabe | Status |
|---|--------|-------|---------|--------|
| 1 | P012 | PROG | Sonderformen + sonstiges-Fix + Unilux im Build-Script | **FERTIG (B-052)** |
| 2 | P013 | TEST | Re-Backtest nach P012 | **FERTIG (B-053)** |
| 3 | P014 | PROG | W4A 2023+2024 Rechnungs-Sync + LV Rebuild | **FERTIG (B-054)** |
| 4 | P015 | TEST | Re-Backtest nach erweitertem Datensatz | **FERTIG (B-055)** |
| 5 | P016 | PROG | LV-Kompression auf Matching-Dimensionen (7483→364) | **FERTIG (B-056)** |
| 6 | P017 | TEST | Re-Backtest nach LV-Kompression | **FERTIG (B-057)** |

---

## Gesamtergebnis nach P017 (fenster+balkontuer)

| Metrik              | Start (P005) | P013 (418) | P015 fen+bt (442) | **P017 fen+bt (1086)** | Ziel  | Status |
|---------------------|--------------|------------|--------------------|-----------------------:|-------|--------|
| Testpositionen      | ~418         | 418        | 442                | **1.086**              | -     | 2.5x mehr Testdaten |
| Median-Abweichung   | 30.9%        | 18.3%      | 22.2%              | **9.6%**               | <15%  | ERREICHT (-36% unter Ziel) |
| Trefferquote <=20%  | 37.1%        | 54.7%      | 48.3%              | **75.2%**              | >70%  | ERREICHT (+5pp ueber Ziel) |
| Ausreisser >50%     | 26.3%        | 6.5%       | 17.7%              | **7.5%**               | <10%  | ERREICHT (-25% unter Ziel) |
| Coverage            | 72%          | 91.4%      | 98.4%              | **98.7%**              | >90%  | ERREICHT |

**ALLE 4 ZIELE FUER FENSTER+BALKONTUER ERREICHT!**

Die LV-Kompression (P016: 7.483 → 364 Cluster) war der entscheidende Durchbruch.

### Kategorie-Detail P017
| Kategorie    | Pos. | Coverage | Median | Treffer <=20% | Ausreisser >50% |
|-------------|------|----------|--------|---------------|-----------------|
| fenster     | 934  | 98.5%    | **8.9%** | 75.5%       | 7.9%            |
| balkontuer  | 152  | 100.0%   | **13.0%** | 73.0%      | 4.6%            |
| haustuer    | 544  | 91.2%    | 32.7%  | 39.9%         | 32.7%           |
| sonstiges   | 20   | 0%       | -      | -             | -               |
| hst/raffst. | 25   | 0%       | -      | -             | -               |

### Naechste Hebel (priorisiert)
1. **haustuer-Matching separat behandeln** (544 Pos., 32.7% Median - groesster Hebel!)
2. HST/Raffstore LV-Eintraege ergaenzen (25 unmatched)
3. Edge Function: Verglasung-Format `'3-fach'`/`'2-fach'` anpassen
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
| leistungsverzeichnis | **364** Eintraege (P016 Kompression, avg 77.7 Samples/Cluster) |

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
| 16 | ~~LV komprimieren (7483→364 Cluster)~~ | ~~HOCH~~ | **ERLEDIGT (B-056)** |
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
| **P016: LV-Kompression 7483→364 Cluster, avg 77.7 Samples (B-056)** | **Fertig** | **2026-02-10** |
| **P017: Re-Backtest - ALLE ZIELE ERREICHT! Median 9.6%, Treffer 75.2% (B-057)** | **Fertig** | **2026-02-10** |
