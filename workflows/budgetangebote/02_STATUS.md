# Status: Budgetangebot V2

> Letzte Aktualisierung: 2026-02-11
> Aktualisiert von: Programmierer (B-067 Kunden-Autocomplete)

---

## Aktueller Stand
**Phase:** Kunden-Autocomplete + Suchmodal - **IMPLEMENTIERT, TEST AUSSTEHEND**
**Letzter abgeschlossener Schritt:** B-067 (Kunden-Autocomplete + Suchmodal im Budgetangebot)
**Aktueller Auftrag:** KEINER (B-067 implementiert, manueller Test noetig)

---

## Nachtmodus
**Status:** INAKTIV

---

## Aktiver Auftrag

**Prompt:** Kunden-Autocomplete Plan (IMPLEMENTIERT)
**Rolle:** Programmierer
**Aufgabe:** Autocomplete im Namensfeld + Suchmodal fuer Kontakte-DB
**Details:** searchKontakte(), KundenSuchModal, Autocomplete-Dropdown, kontakt_id im API-Flow
**Ergebnis:** FERTIG - Build OK, alle Aenderungen in Budgetangebot.jsx

### Sprint-Plan P018-P024
| # | Prompt | Rolle | Aufgabe | Status |
|---|--------|-------|---------|--------|
| 1 | P018 | PROG | Montage-Kalkulation NEU (Stunden + lfm) | **FERTIG (B-059)** |
| 2 | P019 | PROG | Verglasung-Format fix + HST/PSK als Fenster | **FERTIG (B-060)** |
| 3 | P020 | PROG | Firmendaten + Preisspanne fix + Netto/Brutto Toggle | **FERTIG (B-061)** |
| 4 | P021 | TEST | Re-Backtest + UI-Verifikation P018-P020 | **FERTIG (B-062)** |
| 5 | P022 | PROG | categories.ts Duplikat fix | **LOKAL FERTIG (B-063)** - Deploy ausstehend |
| 6 | P023 | PROG | V2 Edge Functions lokal sichern | **FERTIG (B-064)** |
| 7 | P024 | PROG | Step-Navigation + Freitext-Hash | **FERTIG (B-065)** |

---

## Gesamtergebnis nach P021 (fenster+balkontuer, inkl. HST/PSK)

| Metrik              | Start (P005) | P013 (418) | P015 fen+bt (442) | P017 fen+bt (1086) | **P021 fen+bt (1098)** | Ziel  | Status |
|---------------------|--------------|------------|--------------------|--------------------|----------------------:|-------|--------|
| Testpositionen      | ~418         | 418        | 442                | 1.086              | **1.098**              | -     | +12 HST |
| Median-Abweichung   | 30.9%        | 18.3%      | 22.2%              | 9.6%               | **9.6%**               | <15%  | ERREICHT |
| Trefferquote <=20%  | 37.1%        | 54.7%      | 48.3%              | 75.2%              | **75.2%**              | >70%  | ERREICHT |
| Ausreisser >50%     | 26.3%        | 6.5%       | 17.7%              | 7.5%               | **7.5%**               | <10%  | ERREICHT |
| Coverage            | 72%          | 91.4%      | 98.4%              | 98.7%              | **97.6%**              | >90%  | ERREICHT |

**ALLE 4 ZIELE WEITERHIN ERREICHT nach P019 (HST/PSK als fenster).**

### Kategorie-Detail P021
| Kategorie    | Pos. | Coverage | Median | Treffer <=20% | Ausreisser >50% |
|-------------|------|----------|--------|---------------|-----------------|
| fenster     | 946  | 97.3%    | **8.9%** | 75.5%       | 7.9%            |
| balkontuer  | 152  | 100.0%   | **13.0%** | 73.0%      | 4.6%            |
| haustuer    | 544  | 91.2%    | 32.7%  | 39.9%         | 32.7%           |
| sonstiges   | 20   | 0%       | -      | -             | -               |
| raffstore   | 13   | 0%       | -      | -             | -               |
| rollladen   | 6    | 0%       | -      | -             | -               |

### Naechste Hebel (priorisiert)
1. **haustuer-Matching separat behandeln** (544 Pos., 32.7% Median - groesster Hebel!)
2. ~~HST/Raffstore LV-Eintraege ergaenzen (25 unmatched)~~ **ERLEDIGT (P019 - HST/PSK als fenster)**
3. ~~Edge Function: Verglasung-Format `'3-fach'`/`'2-fach'` anpassen~~ **ERLEDIGT (P019 - normalizeVerglasung)**

---

## System-Uebersicht V2

### Edge Functions (Supabase - LIVE)
| Function | Status | Version | Lokal Sync | Tools |
|----------|--------|---------|------------|-------|
| `budget-ki` | ACTIVE | **v1.3.0** | **SYNC (P023)** | **4 Tools** (suche_lv_granular, suche_leistungsverzeichnis, hole_preishistorie, berechne_fensterpreis) |
| `budget-dokument` | ACTIVE | **v1.1.0** (Deploy 4) | **SYNC** | Firmendaten fix, Preisspanne fix, Richtwert entfernt |

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
| leistungsverzeichnis | **363** Eintraege (P019 HST/PSK→fenster, avg 78 Samples/Cluster) |

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
| 16 | ~~LV komprimieren (7483→364 Cluster)~~ | ~~HOCH~~ | **ERLEDIGT (B-056)** |
| 17 | **haustuer-Matching separat behandeln** | **HOCH** | **NEU (P015-Erkenntnis)** |
| 18 | ~~formatPreis() Netto-Bug im Breakdown (P021 gefunden)~~ | ~~NIEDRIG~~ | **ERLEDIGT** |
| 19 | ~~process-document redeployen (categories.ts _shared Import)~~ | ~~NIEDRIG~~ | **ENTFAELLT** (Impact=0, Heuristik deaktiviert) |

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
| **P018: Montage-Kalkulation V2 - stundenbasiert + lfm (B-059)** | **Fertig** | **2026-02-11** |
| **P019: Verglasung-Format fix + HST/PSK als Fenster - budget-ki v1.3.0 (B-060)** | **Fertig** | **2026-02-11** |
| **P020: Firmendaten + Preisspanne fix + Netto/Brutto Toggle (B-061)** | **Fertig** | **2026-02-11** |
| **P021: Re-Backtest + UI-Verifikation P018-P020 - 4/4 BESTANDEN (B-062)** | **Fertig** | **2026-02-11** |
| **P023: V2 Edge Functions lokal gesichert - budget-ki v1.0.0->v1.3.0 (B-064)** | **Fertig** | **2026-02-11** |
| **P024: Step-Navigation + Freitext-Hash - U1+U2 UX-Verbesserungen (B-065)** | **Fertig** | **2026-02-11** |
