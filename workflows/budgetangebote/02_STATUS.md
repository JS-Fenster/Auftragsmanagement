# Status: Budgetangebot V2

> Letzte Aktualisierung: 2026-02-09
> Aktualisiert von: Tester (P007 abgeschlossen)

---

## Aktueller Stand
**Phase:** RE-BACKTEST ABGESCHLOSSEN - NAECHSTE OPTIMIERUNG NOETIG
**Letzter abgeschlossener Schritt:** P007 - Re-Backtest + Verbesserungsanalyse (B-043)
**Aktueller Auftrag:** KEINER - Projektleiter entscheidet naechste Schritte

---

## Nachtmodus
**Status:** INAKTIV

---

## Aktiver Auftrag

KEIN aktiver Auftrag. Warte auf Projektleiter-Entscheidung.

---

## Abschlussbericht P007-TEST

### Ergebnis
- [x] Erfolgreich (alle 3 Teile ausgefuehrt)

### Backtest-Ergebnisse (418 Positionen)

| Metrik              | P005 ALT | P005 NEU(A) | P007 Original | P007 Weighted | Ziel  | Status        |
|---------------------|----------|-------------|---------------|---------------|-------|---------------|
| Median-Abweichung   | 30.9%    | 19.2%       | 21.5%         | **18.7%**     | <15%  | KNAPP (-3.3pp)|
| Trefferquote <=20%  | 37.1%    | 52.2%       | 44.4%         | **52.9%**     | >70%  | VERFEHLT      |
| Ausreisser >50%     | 26.3%    | 6.6%        | 13.0%         | **10.8%**     | <10%  | KNAPP (+0.8pp)|
| Match-Coverage      | 100%     | 72.0%       | 97.6%         | **97.6%**     | >90%  | ERREICHT      |

**Wichtig:** P005 NEU hatte nur 72% Coverage (301/418). P007 Weighted hat 97.6% Coverage (408/418)
bei besserer Median-Abweichung. Das ist eine echte Verbesserung.

### Top 5 Verbesserungsvorschlaege

1. **Matching auf Weighted Average umstellen** (Quick-Win, HOCH)
2. **Rollladen-Aufpreis im Matching** (HOCH, ~2-5pp Verbesserung)
3. **FIX→festfeld Kategorie-Mapping** (MITTEL, 14 Positionen)
4. **Kipp-Oeffnungsart ergaenzen** (MITTEL, 2-3 Positionen)
5. **LV-Aggregation im Build-Script** (NIEDRIG, bessere Datenqualitaet)

### Log-Referenz
Dokumentiert in MASTER_LOG.md: [B-043]

---

## Abschlussbericht P006-PROG

### Ergebnis
- [x] Erfolgreich (alle 4 Fixes implementiert und verifiziert)

### Durchgefuehrte Aenderungen

**Migration:**
- `ist_kombi BOOLEAN DEFAULT false` hinzugefuegt
- `ist_lagerware BOOLEAN DEFAULT false` hinzugefuegt

**Fix 1: Stulp-Kategorisierung**
- 202 fenster/Stulp Eintraege (vorher 0 - alles als haustuer fehlkategorisiert)
- 38 haustuer/Stulp bleiben korrekt (Hoehe >= 2200mm)

**Fix 2: Kombielement-Erkennung**
- 491 LV-Eintraege als ist_kombi=true markiert
- 720 Kombi-Positionen auf Positionsebene erkannt (10%)

**Fix 3: Groessenklasse L aufsplitten**
- L1 (1.3-1.8 qm): 297 Eintraege
- L2 (1.8-2.5 qm): 322 Eintraege

**Fix 4: Lagerware-Erkennung**
- 2 Lagerware-Positionen aus Preisaggregation ausgeschlossen

**Build-Ergebnis:** 2.891 LV-Eintraege (vorher 2.903)

### Log-Referenz
Dokumentiert in MASTER_LOG.md: [B-042]

---

## System-Uebersicht V2

### Edge Functions (Supabase - LIVE)
| Function | Status | URL |
|----------|--------|-----|
| `budget-ki` | ACTIVE | `.../functions/v1/budget-ki` |
| `budget-dokument` | ACTIVE | `.../functions/v1/budget-dokument` |

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
| leistungsverzeichnis | 2.891 Eintraege (P006 OPTIMIERT: +ist_kombi, +ist_lagerware, L1/L2) |

---

## Offene Punkte (TODO)

| # | Aufgabe | Prioritaet | Status |
|---|---------|------------|--------|
| 1 | ~~LV granular erweitern (P004)~~ | ~~HOCH~~ | **ERLEDIGT (B-040)** |
| 2 | ~~Backtest LV vs. Rechnungen (P005)~~ | ~~HOCH~~ | **ERLEDIGT (B-041)** |
| 3 | ~~Stulp-Fix + Kombi-Erkennung im LV (P006)~~ | ~~HOCH~~ | **ERLEDIGT (B-042)** |
| 4 | ~~Re-Backtest + Verbesserungsanalyse (P007)~~ | ~~HOCH~~ | **ERLEDIGT (B-043)** |
| 5 | **Matching auf Weighted Average umstellen** | **HOCH** | Quick-Win empfohlen |
| 6 | **Rollladen-Aufpreis im Matching** | **HOCH** | Empfohlen |
| 7 | FIX→festfeld Kategorie-Mapping | MITTEL | Empfohlen |
| 8 | Automatischer Server-Sync (Cron) | MITTEL | Offen |
| 9 | Supabase Auth integrieren | HOCH | Offen |
| 10 | WERU-Listenpreise (JSON) integrieren | MITTEL | Vorbereitet |

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
