# Status: Budgetangebot V2

> Letzte Aktualisierung: 2026-02-10
> Aktualisiert von: Tester (P013 abgeschlossen, B-053)

---

## Aktueller Stand
**Phase:** SPRINT P012-P016 - Preisoptimierung Phase 2
**Letzter abgeschlossener Schritt:** B-053 (P013 Re-Backtest nach P012)
**Aktueller Auftrag:** Keiner - Warte auf Projektleiter

---

## Nachtmodus
**Status:** INAKTIV

---

## Aktiver Auftrag

**Prompt:** P013 (ABGESCHLOSSEN)
**Rolle:** Tester
**Aufgabe:** Re-Backtest nach P012 Sonderformen + sonstiges-Fix. ERLEDIGT.

### Sprint-Plan P012-P016
| # | Prompt | Rolle | Aufgabe | Status |
|---|--------|-------|---------|--------|
| 1 | P012 | PROG | Sonderformen + sonstiges-Fix + Unilux im Build-Script | **FERTIG (B-052)** |
| 2 | P013 | TEST | Re-Backtest nach P012 | **FERTIG (B-053)** |
| 3 | P014 | PROG | W4A 2024er Positionen nachsynchen + LV Rebuild | Warte (Tunnel!) |
| 4 | P015 | TEST | Re-Backtest nach erweitertem Datensatz | Warte |
| 5 | P016 | PROG | Relaxed-Match + Sonderform-Support in budget-ki | Warte |

---

## Gesamtergebnis nach P013

| Metrik              | Start (P005) | Aktuell (P013) | Ziel  | Status |
|---------------------|--------------|----------------|-------|--------|
| Median-Abweichung   | 30.9%        | **18.3%**      | <15%  | -12.6pp, noch 3.3pp offen |
| Trefferquote <=20%  | 37.1%        | **54.7%**      | >70%  | +17.6pp, noch 15.3pp offen |
| Ausreisser >50%     | 26.3%        | **6.5%**       | <10%  | ERREICHT (Bester Wert!) |
| Coverage            | 72%          | **91.4%**      | >90%  | ERREICHT |

### Naechste Hebel (priorisiert)
1. LV-Daten ergaenzen: festfeld-Kombis + balkontuer-Stulp + HST (+35 Matches)
2. Festfeld-Kategorie verbessern (34.9% Median, 26.3% Ausreisser)
3. 2024er Positionen aus W4A nachsynchen (P014, Tunnel noetig)
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
| erp_rechnungen | 3.031 Eintraege |
| erp_rechnungs_positionen | 3.315 Eintraege |
| erp_angebote | 4.783 Eintraege |
| erp_angebots_positionen | 6.772 Eintraege |
| leistungsverzeichnis | 2.892 Eintraege (P012 OPTIMIERT + form_typ) |

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
