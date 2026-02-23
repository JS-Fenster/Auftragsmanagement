# Status: Budgetangebot V2

> Letzte Aktualisierung: 2026-02-20
> Aktualisiert von: Projektleiter (B-071 Datei-Split Budgetangebot.jsx)

---

## Aktueller Stand
**Phase:** Budgetangebot.jsx in 8 Dateien aufgesplittet (Kontext-Optimierung) - **FERTIG**
**Letzter abgeschlossener Schritt:** B-071 (Refactoring: Budgetangebot.jsx → 8 Dateien unter `budgetangebot/`)
**Aktueller Auftrag:** KEINER (B-071 abgeschlossen, BACKLOG-Verweise aktualisiert)

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

## Offene Punkte

| # | Aufgabe | Prioritaet |
|---|---------|------------|
| 11 | LV-Daten ergaenzen (festfeld-Kombis, balkontuer-Stulp, HST) | HOCH |
| 14 | Supabase Auth integrieren | HOCH |
| 17 | **haustuer-Matching separat behandeln** (544 Pos., 32.7% Median) | **HOCH** |
| 13 | Automatischer Server-Sync (Cron) | MITTEL |
| P022 | categories.ts Deploy ausstehend (B-063) | NIEDRIG |
