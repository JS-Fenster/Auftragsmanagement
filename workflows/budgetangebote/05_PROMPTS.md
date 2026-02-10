# Prompt-Archiv: Budgetangebot V1

---

## INDEX
| ID | Datum | Typ | Fuer | Kurzbeschreibung | Ergebnis | Zeilen |
|----|-------|-----|------|------------------|----------|--------|
| P001 | 2026-02-03 | Analyse | Agent A | Work4All Datenanalyse | ✅ Erfolg | 25-45 |
| P002 | 2026-02-03 | Analyse | Agent B | Supabase Datenmodell | ✅ Erfolg | 50-70 |
| P003 | 2026-02-03 | Analyse | Agent C | Bridge/Proxy Plan | ✅ Erfolg | 75-95 |
| P004 | 2026-02-09 | Auftrag | Programmierer | LV granular erweitern (Migration + Build-Script) | ✅ Erfolg (B-040) | 65-130 |
| P005 | 2026-02-09 | Auftrag | Tester | Backtest LV-Preise vs. Rechnungen | ✅ Erfolg (B-041) | 135-185 |
| P006 | 2026-02-09 | Auftrag | Programmierer | Stulp-Fix + Kombi + Rollladen + L-Split | ✅ Erfolg (B-042) | 160-250 |
| P007 | 2026-02-09 | Auftrag | Tester | Re-Backtest + Verbesserungspotential-Analyse | ✅ Erfolg (B-043) | 255-320 |
| P008 | 2026-02-10 | Auftrag | Programmierer | Weighted Avg Matching + Rollladen-Aufpreis in budget-ki | ⏳ | 280-380 |
| P009 | 2026-02-10 | Auftrag | Tester | Re-Backtest nach P008 Quick-Wins | ✅ Erfolg (B-046) | 385-440 |
| P010 | 2026-02-10 | Auftrag | Programmierer | Fallback entschaerfen + DK-Mapping in budget-ki | ⏳ | 482-560 |
| P011 | 2026-02-10 | Auftrag | Tester | Re-Backtest nach P010 | ✅ Erfolg (B-049) | 565-620 |
| P012 | 2026-02-10 | Auftrag | Programmierer | Sonderformen + sonstiges-Fix + Unilux im Build-Script | ⏳ | 605-700 |
| P013 | 2026-02-10 | Auftrag | Tester | Re-Backtest nach P012 | ✅ Erfolg (B-053) | 705-760 |
| P014 | 2026-02-10 | Auftrag | Programmierer | W4A 2023+2024 Rechnungs-Sync + LV Rebuild | ✅ Erfolg (B-054) | 780-850 |
| P015 | 2026-02-10 | Auftrag | Tester | Re-Backtest nach erweitertem Datensatz | ✅ Erfolg (B-055) | 855-1000 |
| P016 | 2026-02-10 | Auftrag | Programmierer | LV-Kompression auf Matching-Dimensionen | ✅ Erfolg (B-056) | 1005-1100 |
| P017 | 2026-02-10 | Auftrag | Tester | Re-Backtest nach LV-Kompression | ⏳ | 1105-1200 |

---

## ═══ PROMPTS ═══

---

## [P001] Work4All Datenanalyse + Backtest-Design
**Datum:** 2026-02-03 14:00
**Fuer:** Agent A (Explore/Analyse)
**Ergebnis:** ✅ Erfolg - Schema, Parser, Backtest-Plan dokumentiert

### Prompt
Agent A soll:
1. Schema dbo.Positionen pruefen (Spalten + Datentypen)
2. Textpositionen vs Artikelpositionen unterscheiden
3. Kontext-Parser Konzept entwickeln
4. Mass-Extraktion Muster identifizieren
5. Backtest-Plan erstellen (Sampling, Metriken)

---

## [P002] Supabase Datenmodell (Bestandswerte)
**Datum:** 2026-02-03 14:00
**Fuer:** Agent B (Analyse)
**Ergebnis:** ✅ Erfolg - 10 Tabellen, Migration, RLS definiert

### Prompt
Agent B soll:
1. Tabellen-Entwurf fuer budget_* Tabellen
2. RLS/Policies Konzept
3. Statusfluss definieren
4. Felder fuer spaeteres Lernen identifizieren

---

## [P003] Bridge/Proxy + Cache Architektur
**Datum:** 2026-02-03 14:00
**Fuer:** Agent C (Analyse)
**Ergebnis:** ✅ Erfolg - 4 Endpunkte, Cache, Fallback, Risiken

### Prompt
Agent C soll:
1. Proxy-Service Architektur
2. Endpunkte definieren
3. Cache-Strategie (Supabase)
4. Fallback bei Tunnel-Ausfall
5. Risiken + Mitigations

---

## [P004] LV granular erweitern - Migration + Build-Script
**Datum:** 2026-02-09
**Fuer:** Programmierer (Foreground - Supabase MCP benoetigt)
**Ergebnis:** ⏳

### Kontext
Das Leistungsverzeichnis hat 3.059 Eintraege in nur 14 Kategorien. Ein "Fenster"
reicht von 293-24.705 EUR - viel zu ungenau. Die ERP-Positionen enthalten aber
strukturierte Daten im Bezeichnungstext (Masse, Oeffnungsart, Uw-Wert, Rollladen).
~2.000 Positionen sind verwertbar. Ziel: Feingranulare Kategorisierung, damit GPT
praeziertere Preise findet.

### Auftrag
Der Programmierer soll:

**Teil 1: Supabase Migration**
Neue Spalten auf `leistungsverzeichnis` hinzufuegen:
- `oeffnungsart TEXT` (DK, DKR, DKL, Stulp, FIX, HST, PSK, D, K)
- `anzahl_fluegel INTEGER` (1, 2, 3 - abgeleitet aus Oeffnungsart)
- `breite_mm INTEGER`
- `hoehe_mm INTEGER`
- `flaeche_qm NUMERIC(6,3)` (computed: breite*hoehe/1000000)
- `groessen_klasse TEXT` (XS: <0.3qm, S: 0.3-0.7, M: 0.7-1.3, L: 1.3-2.5, XL: >2.5)
- `uw_wert NUMERIC(4,2)`
- `verglasung TEXT` (2-fach, 3-fach - abgeleitet: Uw<=1.0 → 3-fach, >1.0 → 2-fach)
- `hat_rollladen BOOLEAN DEFAULT false`
- `hersteller TEXT`
- `system_name TEXT`

**Teil 2: build-leistungsverzeichnis.js erweitern**
Neue Extraktor-Funktionen:
1. `extractOeffnungsart(text)` - Regex: "Anschlag: DKR|DKL|DLS.*Stulp|FIX|HST|PSK"
2. `deriveAnzahlFluegel(oeffnungsart)` - DK/DKR/DKL/D/K/FIX=1, Stulp/DLS=2
3. `extractUwWert(text)` - Regex: "Uw,N: X,XX"
4. `deriveVerglasung(uw)` - Uw<=1.0 → 3-fach, >1.0 → 2-fach
5. `detectRollladen(text)` - "Rollladenführungsschiene" oder "Rollladen" im Text
6. `deriveGroessenKlasse(qm)` - XS/S/M/L/XL
7. `extractHersteller(text)` - WERU, Drutex, KOMPOtherm, Roto etc.
8. `extractSystem(text)` - CALIDO, CASTELLO, IMPREO, Iglo

Aggregation aendern: Statt `kategorie::bezeichnung_normalized` jetzt gruppieren nach:
`kategorie + oeffnungsart + anzahl_fluegel + groessen_klasse + verglasung`

Ergebnis soll sein: Statt "Fenster: 2-24705 EUR" → "Fenster 1-flg DK M 3-fach: 350-550 EUR"

**Teil 3: Script ausfuehren**
- Migration auf Supabase anwenden (via mcp__supabase__apply_migration)
- Build-Script ausfuehren oder per --dry-run testen

### Referenzen
- L26: Aggregierte EUR/qm reichen NICHT
- L27: Anzahl Fluegel (1/2/3) ist KRITISCH fuer Preismodell
- L22: W4A-Format "Breite: XXX mm, Hoehe: YYY mm" ist Standard (91%)
- D2: Leistungsverzeichnis als Preisbasis

### Erwartetes Ergebnis
- Migration erfolgreich
- Build-Script laeuft durch, LV hat neue granulare Eintraege
- Abschlussbericht mit Anzahl Eintraege pro Kombination

---

## [P005] Backtest: LV-Preise vs. echte Rechnungen
**Datum:** 2026-02-09
**Fuer:** Tester (Foreground - Supabase MCP benoetigt)
**Vorbedingung:** P004 abgeschlossen

### Kontext
Das Leistungsverzeichnis wurde mit granularen Spalten angereichert. Jetzt muss
geprueft werden, ob die neuen Preis-Cluster besser zur Realitaet passen.

### Auftrag
Der Tester soll:

1. **Stichprobe ziehen:** 50 Rechnungspositionen mit Massen aus erp_rechnungs_positionen
2. **Fuer jede Position:**
   - Oeffnungsart, Masse, Verglasung aus Bezeichnung extrahieren
   - Passenden LV-Eintrag suchen (gleiche Kategorie + Oeffnungsart + Groessenklasse)
   - LV avg_preis mit echtem einz_preis vergleichen
   - Abweichung in % berechnen
3. **Metriken berechnen:**
   - Median-Abweichung (Ziel: <15%)
   - Trefferquote innerhalb +-20% (Ziel: >70%)
   - Ausreisser >50% Abweichung (Ziel: <10%)
4. **Problemfaelle identifizieren:** Top 5 groesste Abweichungen mit Analyse warum

### Erwartetes Ergebnis
- Tabelle: Position | Actual | LV-Match | Abweichung %
- Zusammenfassung: Metriken vs. Zielwerte
- Empfehlungen fuer Verbesserungen

---

## [P006] Stulp-Fix + Kombi-Erkennung + Rollladen + L-Split
**Datum:** 2026-02-09
**Fuer:** Programmierer (Foreground - Supabase MCP benoetigt)
**Ergebnis:** ⏳
**Vorbedingung:** P005 Backtest-Ergebnisse analysiert (B-041)

### Kontext
Backtest (P005) zeigte: Median 19.2%, Treffer 52.2%, Ausreisser 6.6%.
4 konkrete Probleme identifiziert die zusammen ~150 Positionen betreffen.
Ziel: Median <15%, Treffer >70%.

### Auftrag
Der Programmierer soll `build-leistungsverzeichnis.js` in 4 Bereichen fixen:

**Fix 1: Stulp-Kategorisierung (96 Positionen, HOECHSTE PRIO)**
Problem: `kategorisiere()` prueft `haustuer` (Zeile 75) VOR `fenster` (Zeile 81).
Positionen wie "DLS Dreh links, Stulpflügel/DKR Dreh-Kipp rechts" mit Massen
wie 1715x1325mm sind FENSTER, keine Haustueren.

Loesung: Neue Heuristik VOR der Kategorie-Pattern-Liste:
- Wenn Text "Stulp" ODER "DLS" enthaelt UND Breite/Hoehe extrahierbar UND
  Hoehe < 2200mm → "fenster" (nicht "haustuer")
- Haustuer-Stulp hat typisch Hoehe > 2200mm
- Alternativ: Wenn "Anschlag:" im Text steht UND Oeffnungsart erkannt wird →
  Nutze Oeffnungsart-basierte Kategorie statt Keyword-Match

**Fix 2: Kombielement-Erkennung (~30 Positionen)**
Problem: "Anschlag: F Festverglasung/DKR Dreh-Kipp rechts" ist ein 2-Feld-Element
in einem Rahmen. Preis liegt 50-80% ueber einem einzelnen DKR gleicher Groesse.

Loesung: Neue Funktion `detectKombiElement(text)`:
- Wenn Anschlag-Zeile "/" enthaelt (z.B. "F Festverglasung/DKR") → ist_kombi = true
- Wenn "Breitenteilungen: 1" oder "Breitenteilungen: 2" im Text → ist_kombi = true
- Neue Spalte: `ist_kombi BOOLEAN DEFAULT false`
- Fluegel-Ableitung: Kombi mit "/" → Anzahl = Teile zaehlen (F/DKR = 2, F/DKL/F = 3)

Migration noetig: `ALTER TABLE leistungsverzeichnis ADD COLUMN ist_kombi BOOLEAN DEFAULT false;`

**Fix 3: Groessenklasse L aufsplitten**
Problem: "L" (1.3-2.5 qm) ist zu breit. Ein 1.35qm-Fenster und ein 2.4qm-Fenster
haben sehr unterschiedliche Preise.

Loesung: `deriveGroessenKlasse()` aendern:
- L1: 1.3-1.8 qm (statt L: 1.3-2.5)
- L2: 1.8-2.5 qm (statt XL: >2.5)
- XL: > 2.5 qm (bleibt)

**Fix 4: Lagerware-Flag (~20 Positionen)**
Problem: Positionen mit "Lager" im Text sind Abverkaufsartikel mit 50-130%
niedrigeren Preisen. Diese verzerren die Durchschnitte.

Loesung: Neue Funktion `detectLagerware(text)`:
- Wenn "Lager" oder "Abverkauf" oder "Sonderposten" im Text → markieren
- Neue Spalte: `ist_lagerware BOOLEAN DEFAULT false`
- Lagerware-Positionen aus der Aggregation AUSSCHLIESSEN (preis nicht mitzaehlen)

Migration noetig: `ALTER TABLE leistungsverzeichnis ADD COLUMN ist_lagerware BOOLEAN DEFAULT false;`

### Nach Abschluss
1. Migration ausfuehren (ist_kombi + ist_lagerware Spalten)
2. Build-Script mit Fixes ausfuehren
3. Verifizieren: Wie viele fenster/Stulp-Eintraege gibt es jetzt?
4. MASTER_LOG [B-042] schreiben + Index aktualisieren
5. 02_STATUS.md aktualisieren
6. Abschlussbericht zurueckgeben

---

## [P007] Re-Backtest + Verbesserungspotential-Analyse
**Datum:** 2026-02-09
**Fuer:** Tester (Foreground - Supabase MCP benoetigt)
**Ergebnis:** ⏳
**Vorbedingung:** P006 abgeschlossen

### Kontext
Nach den 4 Fixes (P006) muss geprueft werden ob die Zielwerte jetzt erreicht werden.
Zusaetzlich: Gesamtanalyse wo noch Verbesserungspotential liegt.

### Auftrag
Der Tester soll:

**Teil 1: Re-Backtest (gleiche 418 Positionen wie P005)**

Gleiche SQL-Methode wie P005, aber mit angepasstem Matching:
1. Stulp-Positionen sollten jetzt unter "fenster" matchen
2. Kombielemente separat matchen (ist_kombi = true)
3. Groessenklasse L1/L2 statt L verwenden
4. Metriken berechnen und mit P005-Ergebnissen vergleichen

**Teil 2: Verbesserungspotential-Analyse**

Nach dem Re-Backtest die verbleibenden Problemfaelle analysieren:
1. Welche Positionen haben immer noch >30% Abweichung? Warum?
2. Gibt es systematische Muster? (z.B. bestimmte Hersteller, Sondermasse)
3. Was waere der naechste Hebel fuer weitere Verbesserung?
4. Gibt es Kategorien die komplett fehlen oder unterrepraesentiert sind?
5. Wie gut ist die Coverage? (% der Positionen mit Match)

**Teil 3: Saubere Aufstellung fuer Andreas**

Erstelle eine finale Tabelle:
```
| Metrik              | P005 ALT | P005 NEU | P007 (nach Fixes) | Ziel  | Status |
|---------------------|----------|----------|--------------------|-------|--------|
| Median-Abweichung   | 30.9%    | 19.2%    | ???                | <15%  |        |
| Trefferquote <=20%  | 37.1%    | 52.2%    | ???                | >70%  |        |
| Ausreisser >50%     | 26.3%    | 6.6%     | ???                | <10%  |        |
| Match-Coverage      | 100%     | 72%      | ???                | >90%  |        |
```

Plus: Top-5 verbleibende Probleme mit konkreten Loesungsvorschlaegen.

### Nach Abschluss
1. MASTER_LOG [B-043] schreiben + Index aktualisieren
2. 02_STATUS.md aktualisieren mit finalen Ergebnissen
3. Abschlussbericht an Projektleiter/Andreas

---

## [P008] Weighted Average Matching + Rollladen-Aufpreis in budget-ki
**Datum:** 2026-02-10
**Fuer:** Programmierer (Foreground - Supabase MCP benoetigt)
**Ergebnis:** ⏳
**Vorbedingung:** P007 Ergebnisse analysiert (B-043)

### Kontext
Die budget-ki Edge Function (Supabase, slug: `budget-ki`) nutzt aktuell 3 Tools fuer GPT-5.2:
- `suche_leistungsverzeichnis` → TEXT-Suche (ilike) - UNGENAU
- `hole_preishistorie` → Dimensions-Suche in Rechnungen
- `berechne_fensterpreis` → Formel-Fallback

**Problem:** Die LV-Suche nutzt KEINES der granularen Felder (oeffnungsart, groessen_klasse,
verglasung, hat_rollladen). Backtest B-043 hat gezeigt: Weighted Average ueber
kategorie+oeffnungsart+groessenklasse senkt Median von 21.5% auf 18.7%.

### Auftrag
Der Programmierer soll die `budget-ki` Edge Function erweitern:

**Aenderung 1: Neues Tool `suche_lv_granular`**

Neue Funktion die STRUKTURIERT im LV sucht:
```typescript
async function sucheLvGranular(args: {
  kategorie: string;         // 'fenster', 'haustuer', 'hst', 'psk', 'festfeld', etc.
  oeffnungsart?: string;     // 'DKR', 'DKL', 'DK', 'Stulp', 'FIX', 'HST', 'PSK', 'D', 'K'
  groessen_klasse?: string;  // 'XS', 'S', 'M', 'L1', 'L2', 'XL'
  verglasung?: string;       // '2-fach', '3-fach'
  hat_rollladen?: boolean;   // true/false
  ist_kombi?: boolean;       // true/false
}): Promise<{
  weighted_avg_preis: number;     // Gewichteter Durchschnitt (nach sample_count)
  median_preis: number;           // Median aus meta
  min_preis: number;
  max_preis: number;
  total_samples: number;          // Summe aller sample_counts
  match_count: number;            // Anzahl LV-Eintraege die gematcht haben
  entries: Array<{...}>;          // Die einzelnen LV-Eintraege
  match_quality: string;          // 'exact', 'relaxed', 'fallback'
}>
```

**Matching-Logik (3 Stufen):**
1. **Exact Match:** kategorie + oeffnungsart + groessen_klasse + verglasung + hat_rollladen
2. **Relaxed Match:** (falls <3 Treffer) kategorie + oeffnungsart + groessen_klasse (ohne verglasung/rollladen)
3. **Fallback:** (falls 0 Treffer) nur kategorie + groessen_klasse

**Weighted Average Berechnung:**
```
weighted_avg = SUM(avg_preis * sample_count) / SUM(sample_count)
```

**FIX-Mapping (B-043 Punkt 3):**
Wenn oeffnungsart = 'FIX', dann ZUSAETZLICH in kategorie 'festfeld' suchen
(nicht nur in 'fenster'). Merge die Ergebnisse.

**Aenderung 2: OPENAI_TOOLS erweitern**

Neues Tool-Schema zu OPENAI_TOOLS hinzufuegen:
```typescript
{
  type: "function",
  function: {
    name: "suche_lv_granular",
    description: "Sucht im Leistungsverzeichnis mit strukturierten Filtern. " +
      "Nutze dies BEVORZUGT fuer Fenster, Tueren und Elemente mit bekannter " +
      "Oeffnungsart und Groesse. Liefert gewichteten Durchschnittspreis.",
    parameters: {
      type: "object",
      properties: {
        kategorie: {
          type: "string",
          enum: ["fenster", "haustuer", "hst", "psk", "festfeld", "balkontuer",
                 "tuer", "rollladen", "raffstore", "insektenschutz", "fensterbank",
                 "montage", "entsorgung"],
          description: "Produkt-Kategorie"
        },
        oeffnungsart: {
          type: "string",
          enum: ["DK", "DKR", "DKL", "Stulp", "FIX", "HST", "PSK", "D", "K"],
          description: "Oeffnungsart des Elements"
        },
        groessen_klasse: {
          type: "string",
          enum: ["XS", "S", "M", "L1", "L2", "XL"],
          description: "Groessenklasse: XS(<0.3qm), S(0.3-0.7), M(0.7-1.3), L1(1.3-1.8), L2(1.8-2.5), XL(>2.5)"
        },
        verglasung: {
          type: "string",
          enum: ["2-fach", "3-fach"],
          description: "Verglasungstyp"
        },
        hat_rollladen: {
          type: "boolean",
          description: "Element hat Rollladen-Fuehrungsschiene (Aufpreis!)"
        },
        ist_kombi: {
          type: "boolean",
          description: "Kombielement (mehrere Felder in einem Rahmen)"
        }
      },
      required: ["kategorie"]
    }
  }
}
```

**Aenderung 3: SYSTEM_PROMPT erweitern**

Folgende Regel zum SYSTEM_PROMPT hinzufuegen (nach den bestehenden Regeln):
```
REGELN FUER PREISSUCHE:
- BEVORZUGE suche_lv_granular fuer alle Fenster/Tueren/Elemente
- Berechne die Groessenklasse aus den Massen: Flaeche = Breite*Hoehe/1000000 qm
  XS: <0.3qm, S: 0.3-0.7, M: 0.7-1.3, L1: 1.3-1.8, L2: 1.8-2.5, XL: >2.5
- Nutze den weighted_avg_preis als Referenzpreis
- Wenn hat_rollladen bekannt: IMMER als Filter nutzen (grosser Preisunterschied!)
- Bei Kombielementen (z.B. F/DKR): ist_kombi=true setzen
- suche_leistungsverzeichnis nur noch als Fallback fuer Sonderpositionen
- berechne_fensterpreis als letzter Fallback wenn kein LV-Match
```

**Aenderung 4: Tool-Dispatcher erweitern**

Im `executeToolCall` Switch-Case das neue Tool registrieren.

### WICHTIG: Bestehende Tools NICHT entfernen!
Die alten Tools (suche_leistungsverzeichnis, hole_preishistorie, berechne_fensterpreis)
bleiben als Fallback. Nur das neue Tool kommt DAZU.

### Nach Abschluss
1. Edge Function via `mcp__supabase__deploy_edge_function` deployen
2. Health-Check aufrufen (GET) → neues Tool muss in `tools` Liste erscheinen
3. MASTER_LOG [B-045] schreiben + Index aktualisieren
4. 02_STATUS.md aktualisieren
5. Abschlussbericht zurueckgeben

### Referenzen
- L39: Weighted Average Matching schlaegt ORDER BY sample_count
- L40: Coverage ist genauso wichtig wie Genauigkeit
- B-043: Detaillierte Matching-Analyse mit SQL

### Erwartetes Ergebnis
- budget-ki v1.1.0 deployed mit 4 Tools (statt 3)
- Health-Check zeigt `suche_lv_granular` in Tool-Liste
- GPT nutzt bevorzugt das neue granulare Tool

---

## [P009] Re-Backtest nach P008 Quick-Wins
**Datum:** 2026-02-10
**Fuer:** Tester (Foreground - Supabase MCP benoetigt)
**Ergebnis:** ⏳
**Vorbedingung:** P008 abgeschlossen

### Kontext
Nach Implementierung von Weighted Average Matching + Rollladen-Aufpreis (P008)
muss geprueft werden ob die erwartete Verbesserung eingetreten ist.
Erwartung laut B-043: Median ~14-16%, Treffer ~60-65%, Ausreisser ~6-8%.

### Auftrag
Der Tester soll:

**Teil 1: Backtest der neuen LV-Granular-Suche (418 Positionen)**

SQL-basierter Backtest (gleiche Methode wie P005/P007):
1. 418 Rechnungspositionen mit Massen aus erp_rechnungs_positionen
2. Fuer jede Position: Oeffnungsart, Groessenklasse, Verglasung, Rollladen extrahieren
3. Gegen das Leistungsverzeichnis matchen mit der NEUEN Logik:
   - Weighted Average (gewichtet nach sample_count)
   - 3-Stufen-Matching: exact → relaxed → fallback
   - hat_rollladen als Matching-Kriterium
4. Metriken berechnen und mit P007 vergleichen

**Teil 2: Rollladen-Impact-Analyse**

Speziell pruefen:
1. Wie viele der 418 Positionen haben hat_rollladen=true?
2. Wie unterscheiden sich die Preise mit/ohne Rollladen im LV?
3. Verbessert das Rollladen-Matching die Genauigkeit fuer diese Positionen?

**Teil 3: Vergleichstabelle**

```
| Metrik              | P005 ALT | P007 Weighted | P009 (neu) | Ziel  | Status |
|---------------------|----------|---------------|------------|-------|--------|
| Median-Abweichung   | 30.9%    | 18.7%         | ???        | <15%  |        |
| Trefferquote <=20%  | 37.1%    | 52.9%         | ???        | >70%  |        |
| Ausreisser >50%     | 26.3%    | 10.8%         | ???        | <10%  |        |
| Match-Coverage      | 72%      | 97.6%         | ???        | >90%  |        |
```

### Nach Abschluss
1. MASTER_LOG [B-046] schreiben + Index aktualisieren
2. 02_STATUS.md aktualisieren mit finalen Ergebnissen
3. Abschlussbericht an Projektleiter

---

## [P010] Fallback entschaerfen + DK-Mapping in budget-ki
**Datum:** 2026-02-10
**Fuer:** Programmierer (Foreground - Supabase MCP benoetigt)
**Ergebnis:** ⏳
**Vorbedingung:** P009 Backtest-Ergebnisse analysiert (B-046)

### Kontext
P009 Backtest hat gezeigt:
- Die 3-Stufen-Fallback-Logik (exact→relaxed→fallback→lastresort) **SCHADET** dem Median
  um 4-6pp. Reines Relaxed-Matching (kat+oa+gk) liefert Median 17.9%, mit Fallback 20.2%.
- 18 Positionen matchen nicht weil "DK" (generisch) nicht im LV existiert - nur DKR/DKL separat.
- Rollladen-Filter wirkt nur bei hat_rollladen=true, bei false schadet er.

### Auftrag
Der Programmierer soll die `budget-ki` Edge Function (v1.1.0) anpassen:

**Fix 1: Fallback entschaerfen**
In der `sucheLvGranular` Funktion:
- **Stufe 1 (Exact):** kategorie + oeffnungsart + groessen_klasse + verglasung + hat_rollladen
  → Schwelle: match_count >= 3 (statt bisher wahrscheinlich <3 fuer Fallback)
- **Stufe 2 (Relaxed):** kategorie + oeffnungsart + groessen_klasse (ohne verglasung/rollladen)
  → Dies ist die HAUPT-Stufe, funktioniert am besten
- **Stufe 3 (Fallback auf kat+gk) ENTFERNEN** oder als `match_quality: "low_confidence"` markieren
  mit einem Hinweis im Response dass GPT lieber `berechne_fensterpreis` nutzen soll
- **Stufe 4 (Last-Resort nur kat) ENTFERNEN**

Konkret: Wenn nach Stufe 2 (Relaxed) kein Match, dann:
```typescript
return {
  weighted_avg_preis: null,
  match_count: 0,
  match_quality: "no_match",
  hinweis: "Kein passender LV-Eintrag gefunden. Nutze berechne_fensterpreis als Fallback."
};
```

**Fix 2: DK→DKR+DKL Mapping**
Wenn die uebergebene `oeffnungsart` = "DK" ist (generisch, ohne Richtung):
- Suche gegen BEIDE: oeffnungsart IN ('DK', 'DKR', 'DKL')
- Der weighted average wird ueber alle 3 Varianten berechnet
- match_quality bleibt "relaxed" (nicht schlechter)

In der SQL-Abfrage / Supabase-Query:
```typescript
// Statt: .eq("oeffnungsart", oeffnungsart)
// Neu:
if (oeffnungsart === "DK") {
  query = query.in("oeffnungsart", ["DK", "DKR", "DKL"]);
} else {
  query = query.eq("oeffnungsart", oeffnungsart);
}
```

**Fix 3: Rollladen-Filter Smart-Hybrid**
Basierend auf P009 Erkenntnis - Rollladen-Filter NUR bei hat_rollladen=true anwenden:
- Wenn hat_rollladen=true → Filter aktiv (exact match)
- Wenn hat_rollladen=false oder undefined → KEIN Filter auf hat_rollladen
  (weil im LV viele Eintraege hat_rollladen=false haben und der Filter nicht hilft)

### Nach Abschluss
1. Aktuellen Code via `mcp__supabase__get_edge_function` holen (project_id: rsmjgdujlpnydbsfuiek, slug: budget-ki)
2. Aenderungen implementieren
3. Deploy via `mcp__supabase__deploy_edge_function`
4. Health-Check (GET) → Version sollte 1.2.0 sein
5. MASTER_LOG [B-048] schreiben + Index aktualisieren
6. 02_STATUS.md aktualisieren
7. Abschlussbericht zurueckgeben

### Erwartetes Ergebnis
- budget-ki v1.2.0 deployed
- Fallback-Stufen 3+4 entfernt, kein Match → null + Hinweis
- DK matcht gegen DKR+DKL (+18 Positionen Coverage)
- Rollladen-Filter nur bei hat_rollladen=true

---

## [P011] Re-Backtest nach P010 Fallback-Fix
**Datum:** 2026-02-10
**Fuer:** Tester (Foreground - Supabase MCP benoetigt)
**Ergebnis:** ⏳
**Vorbedingung:** P010 abgeschlossen

### Kontext
Nach Entschaerfung der Fallback-Logik und DK-Mapping muss geprueft werden
ob die erwartete Verbesserung eingetreten ist.
Erwartung: Median ~16-17%, Coverage ~94-95% (durch DK-Mapping +18 Matches).

### Auftrag
Der Tester soll den gleichen Backtest wie P009 wiederholen, aber mit folgenden
Anpassungen an die neue Matching-Logik:

**Matching-Strategie (entsprechend v1.2.0):**
1. Exact: kat + oa + gk + verglasung + hat_rollladen (nur wenn RL=true)
   → match_count >= 3
2. Relaxed: kat + oa + gk (DK expandiert zu DK/DKR/DKL)
   → KEIN weiterer Fallback
3. Kein Match → Position wird als "unmatched" gezaehlt

**Metriken berechnen und vergleichen:**
```
| Metrik              | P005 ALT | P007 | P009 Best | P011 (neu) | Ziel  |
|---------------------|----------|------|-----------|------------|-------|
| Median-Abweichung   | 30.9%    | 18.7%| 17.9%     | ???        | <15%  |
| Trefferquote <=20%  | 37.1%    | 52.9%| 55.2%     | ???        | >70%  |
| Ausreisser >50%     | 26.3%    | 10.8%| 8.8%      | ???        | <10%  |
| Coverage            | 72%      | 97.6%| 90.4%     | ???        | >90%  |
```

Speziell pruefen:
- Hat DK-Mapping die 18 ungematchten Positionen geloest?
- Wie ist die Coverage jetzt?
- Hat das Entfernen der Fallback-Stufen den Median verbessert?

### Nach Abschluss
1. MASTER_LOG [B-049] schreiben + Index aktualisieren
2. 02_STATUS.md aktualisieren
3. Abschlussbericht an Projektleiter

---

## [P012] Sonderformen + sonstiges-Fix + Hersteller im Build-Script
**Datum:** 2026-02-10
**Fuer:** Programmierer (Foreground - Supabase MCP benoetigt)
**Ergebnis:** ⏳
**Vorbedingung:** P011 abgeschlossen (v1.2.0 LIVE)

### Kontext
Backtest P011 zeigt: 18.6% Median, 8.9% Ausreisser, 91.8% Coverage.
Analyse hat 3 konkrete Probleme identifiziert:

1. **Sonderformen nicht erkannt:** 54 Positionen in den Daten haben `Form: Schräg`,
   `Form: Rund`, `Bogenart: Rundbogen/Korbbogen/Segmentbogen`. Diese werden aktuell
   NICHT als Sonderform markiert. Sonderformen kosten 25-50% mehr.

2. **"sonstiges"-Positionen:** Kipp-Varianten KM (Kipp mitte), KL (Kipp links),
   KR (Kipp rechts) werden NICHT als Fenster erkannt weil extractOeffnungsart()
   nur "K Kipp" erkennt, nicht "KM"/"KL"/"KR". Auch reine Glas-Scheiben (CLIMAPLUS)
   landen in sonstiges.

3. **Unilux als Hersteller fehlt:** Viele Positionen haben "Unilux Meisterfenster"
   im Text, werden aber nicht als Hersteller erkannt.

### Auftrag
Der Programmierer soll `backend/scripts/build-leistungsverzeichnis.js` erweitern:

**Aenderung 1: Migration - Neue Spalten**
```sql
ALTER TABLE leistungsverzeichnis ADD COLUMN IF NOT EXISTS form_typ TEXT DEFAULT 'rechteck';
-- Werte: 'rechteck', 'schraeg', 'rundbogen', 'korbbogen', 'segmentbogen'
```
Via `mcp__supabase__apply_migration` ausfuehren.

**Aenderung 2: Neue Funktion `extractFormTyp(text)`**
Einfuegen nach `detectRollladen()` (ca. Zeile 260):
```javascript
function extractFormTyp(text) {
    if (!text) return 'rechteck';

    // Rundbogen-Varianten (Reihenfolge: spezifisch vor generisch)
    if (/Bogenart:\s*Segmentbogen/i.test(text)) return 'segmentbogen';
    if (/Bogenart:\s*Korbbogen/i.test(text)) return 'korbbogen';
    if (/Bogenart:\s*Stichbogen/i.test(text)) return 'stichbogen';
    if (/Bogenart:\s*Rundbogen/i.test(text)) return 'rundbogen';
    if (/Form:\s*Rund/i.test(text)) return 'rundbogen';

    // Schraeg (Giebel, Dachschraege)
    if (/Form:\s*Schr[aä]g/i.test(text)) return 'schraeg';

    // Dreieck, Trapez (selten aber moeglich)
    if (/Form:\s*Dreieck/i.test(text)) return 'dreieck';
    if (/Form:\s*Trapez/i.test(text)) return 'trapez';

    return 'rechteck';
}
```

**Aenderung 3: extractOeffnungsart() erweitern**
Vor dem `return null;` am Ende der Funktion (ca. Zeile 194) hinzufuegen:
```javascript
    // KM = Kipp Mitte
    if (/\bKM\b|Kipp\s+[Mm]itte/i.test(text)) return 'K';

    // KL = Kipp links (nicht DKL!)
    if (/\bKL\s+Kipp\b|Anschlag:.*\bKipp\s+links\b(?!.*[Dd]reh)/i.test(text)) return 'K';

    // KR = Kipp rechts
    if (/\bKR\s+Kipp\b|Anschlag:.*\bKipp\s+rechts\b(?!.*[Dd]reh)/i.test(text)) return 'K';
```

**Aenderung 4: Kategorie-Pattern erweitern**
In KATEGORIE_PATTERNS (Zeile 74-88) hinzufuegen:
```javascript
    // VOR "sonstiges" (Fallthrough):
    { kategorie: 'glas', patterns: [/CLIMAPLUS|[Ii]solierglas|[Gg]lasscheibe|VSG\s+\d/i] },
```
Und am ANFANG der Liste (VOR haustuer):
```javascript
    // Anschlag-basierte Erkennung: Wenn "Anschlag:" UND Masse vorhanden → fenster
    // (faengt Positionen auf die nur Anschlag + Masse haben, aber kein "fenster" Keyword)
```
HINWEIS: Die anschlag-basierte Erkennung alternativ direkt in `kategorisiere()` einbauen,
NACH dem Pattern-Loop, BEVOR "sonstiges" zurueckgegeben wird:
```javascript
    // Fallback: Wenn Anschlag + Masse vorhanden → wahrscheinlich Fenster
    if (kategorie === 'sonstiges') {
        const hasAnschlag = /Anschlag:/i.test(text);
        const hasDims = extractDimensions(text);
        if (hasAnschlag && hasDims) {
            kategorie = 'fenster';
        }
    }
```

**Aenderung 5: Hersteller-Pattern erweitern**
In `extractHersteller()` (ca. Zeile 286) hinzufuegen:
```javascript
    { name: 'Unilux', pattern: /\bUnilux\b/i },
    { name: 'ALUPROF', pattern: /\bALUPROF\b/i },
```

**Aenderung 6: Aggregation erweitern**
In der Aggregations-Logik `form_typ` als Gruppierungskriterium hinzufuegen:
- Bisherig: `kategorie + oeffnungsart + anzahl_fluegel + groessen_klasse + verglasung`
- Neu: `kategorie + oeffnungsart + anzahl_fluegel + groessen_klasse + verglasung + form_typ`
- Nur bei Nicht-Rechteck-Formen wirklich gruppieren (sonst zu viele leere Cluster)

**Aenderung 7: form_typ in Upsert-Payload**
Den form_typ Wert im Objekt fuer den Supabase-Upsert mitgeben.

### Abfolge
1. Migration ausfuehren (form_typ Spalte)
2. Code-Aenderungen in build-leistungsverzeichnis.js
3. Script ausfuehren: `node backend/scripts/build-leistungsverzeichnis.js`
4. Ergebnis pruefen: Wie viele Sonderformen? Wie viele "sonstiges" noch uebrig?

### Erwartetes Ergebnis
- form_typ Spalte vorhanden, Sonderformen markiert
- KM/KL/KR als Fenster erkannt (nicht mehr "sonstiges")
- Unilux als Hersteller erkannt
- "sonstiges" Positionen deutlich reduziert
- LV rebuild erfolgreich

### Nach Abschluss
1. MASTER_LOG [B-052] schreiben + Index aktualisieren
2. 02_STATUS.md aktualisieren
3. Abschlussbericht zurueckgeben

---

## [P013] Re-Backtest nach P012 Sonderformen + sonstiges-Fix
**Datum:** 2026-02-10
**Fuer:** Tester (Foreground - Supabase MCP benoetigt)
**Ergebnis:** ⏳
**Vorbedingung:** P012 abgeschlossen

### Kontext
Nach P012 wurde das Build-Script um Sonderformen-Erkennung, KM/KL/KR-Fix und
Unilux-Hersteller erweitert. LV wurde neu gebaut. Jetzt pruefen ob sich
Metriken verbessert haben.

### Auftrag
Der Tester soll:

**Teil 1: Re-Backtest (gleiche Methodik wie P011)**
1. 418 Rechnungspositionen mit Massen
2. Matching gegen LV: kat + oa + gk (DK expandiert), RL Smart-Hybrid
3. Metriken berechnen

**Teil 2: Sonderform-Analyse**
1. Wie viele Backtest-Positionen sind Sonderformen?
2. Werden sie jetzt korrekt gematcht (form_typ im LV)?
3. Wie ist deren Median-Abweichung?

**Teil 3: sonstiges-Reduktion**
1. Wie viele Positionen sind noch "sonstiges"?
2. Was sind das fuer Positionen? (Liste)

**Teil 4: Vergleichstabelle**
```
| Metrik              | P005 ALT | P009 Best | P011 v1.2.0 | P013 (neu) | Ziel  |
|---------------------|----------|-----------|-------------|------------|-------|
| Median-Abweichung   | 30.9%    | 17.9%     | 18.6%       | ???        | <15%  |
| Trefferquote <=20%  | 37.1%    | 55.2%     | 52.8%       | ???        | >70%  |
| Ausreisser >50%     | 26.3%    | 8.8%      | 8.9%        | ???        | <10%  |
| Coverage            | 72%      | 90.4%     | 91.8%       | ???        | >90%  |
```

### Nach Abschluss
1. MASTER_LOG [B-053] schreiben + Index aktualisieren
2. 02_STATUS.md aktualisieren
3. Abschlussbericht an Projektleiter

---

## [P014] W4A Rechnungs-Positionen 2023+2024 nachsynchen + LV Rebuild
**Datum:** 2026-02-10
**Fuer:** Programmierer
**Kontext:** Sprint P012-P016, Schritt 3
**Abhaengigkeiten:** W4A-Tunnel AKTIV, Credentials in backend/.env

### Auftrag

Synchronisiere 2023er und 2024er Rechnungs-Positionen aus W4A nach Supabase und baue das Leistungsverzeichnis neu.

**Aktueller Stand:**
- erp_rechnungs_positionen: 3.315 (nur 2025+2026)
- erp_angebots_positionen: 6.772 (ab 2024)
- leistungsverzeichnis: 2.892 Eintraege

**Erwartete neue Daten:**
- 2024: ~360 Rechnungen, ~3.379 Positionen
- 2023: ~355 Rechnungen, ~3.111 Positionen
- Gesamt: ~6.490 neue Rechnungs-Positionen

### Schritte

**Schritt 1: Rechnungs-Sync erweitern**
1. In `backend/scripts/sync-positions-to-supabase.js`: DATE_FROM von '2025-01-01' auf '2023-01-01' aendern
2. Dry-Run ausfuehren: `node backend/scripts/sync-positions-to-supabase.js --dry-run`
3. Ergebnis pruefen (erwartet: ~715 neue Rechnungen, ~6.490 Positionen)
4. Echten Sync ausfuehren: `node backend/scripts/sync-positions-to-supabase.js`
5. Zahlen dokumentieren

**Schritt 2: Angebots-Sync pruefen**
1. Pruefen ob 2023er Angebote fehlen (aktuell ab 2024)
2. Falls ja: In `backend/scripts/sync-angebots-positionen.js` DATE_FROM auf '2023-01-01' aendern
3. Dry-Run + Sync ausfuehren
4. Zahlen dokumentieren

**Schritt 3: LV Rebuild**
1. `node backend/scripts/build-leistungsverzeichnis.js` ausfuehren
2. Neue LV-Groesse dokumentieren (vorher: 2.892)
3. Delta-Analyse: Welche Kategorien/Oeffnungsarten haben am meisten dazugewonnen?

**Schritt 4: Daten-Qualitaetspruefung**
SQL auf Supabase:
```sql
-- Neue Gesamtzahlen
SELECT 'rechnungs_pos' as typ, COUNT(*) FROM erp_rechnungs_positionen
UNION ALL
SELECT 'angebots_pos', COUNT(*) FROM erp_angebots_positionen
UNION ALL
SELECT 'lv_eintraege', COUNT(*) FROM leistungsverzeichnis;

-- LV Coverage: Wie viele Kategorien/Oeffnungsarten/Groessenklassen?
SELECT kategorie, oeffnungsart, groessen_klasse, COUNT(*) as cnt,
       ROUND(AVG(avg_preis)::numeric, 0) as avg_preis,
       SUM(sample_count) as samples
FROM leistungsverzeichnis
GROUP BY kategorie, oeffnungsart, groessen_klasse
ORDER BY samples DESC
LIMIT 30;
```

### Wichtig
- **IMMER** von `backend/` aus starten (wegen .env Pfad)
- Tunnel laeuft auf localhost:1433
- Bei Fehler "connection refused": Tunnel pruefen
- Keine Aenderungen am build-leistungsverzeichnis.js noetig (P012 hat ihn aktualisiert)

### Nach Abschluss
1. MASTER_LOG [B-054] schreiben + Index aktualisieren
2. 02_STATUS.md aktualisieren
3. Abschlussbericht an Projektleiter mit allen Zahlen

---

## [P015] Re-Backtest nach erweitertem Datensatz (P014)
**Datum:** 2026-02-10
**Fuer:** Tester (Foreground - Supabase MCP benoetigt)
**Ergebnis:** ⏳
**Vorbedingung:** P014 abgeschlossen (LV: 2.892 → 7.483 Eintraege)

### Kontext
P014 hat die Datenbasis massiv erweitert:
- erp_rechnungs_positionen: 3.315 → 12.145 (+266%)
- erp_angebots_positionen: 6.772 → 29.430 (+335%)
- leistungsverzeichnis: 2.892 → 7.483 (+159%)

Jetzt pruefen ob das erweiterte LV zu besseren Matching-Ergebnissen fuehrt.

### Auftrag

**Teil 1: Re-Backtest (gleiche Methodik wie P013)**
WICHTIG: Der Backtest laeuft weiterhin gegen die Rechnungspositionen.
Da jetzt auch 2023+2024 Rechnungs-Positionen in Supabase sind, gibt es MEHR Testdaten.

Schritt 1: Zaehle zuerst die verfuegbaren Backtest-Positionen
```sql
SELECT COUNT(*) as total,
       COUNT(CASE WHEN bezeichnung ~ '(\d{3,4})\s*(x|×)\s*(\d{3,4})'
                   OR langtext ~ '(\d{3,4})\s*(x|×)\s*(\d{3,4})'
                   OR langtext ~ 'Breite:\s*(\d{3,5})\s*mm.*Hoehe:\s*(\d{3,5})\s*mm'
                   OR langtext ~ 'Höhe:\s*(\d{3,5})\s*mm.*Breite:\s*(\d{3,5})\s*mm'
             THEN 1 END) as mit_massen
FROM erp_rechnungs_positionen
WHERE einz_preis > 50 AND einz_preis < 10000;
```

Schritt 2: Fuehre den Backtest aus - EXAKT gleiche Matching-Logik:
- Matching: kategorie + oeffnungsart + groessen_klasse
- DK expandiert zu DK/DKR/DKL
- RL Smart-Hybrid: bei hat_rollladen=true filtern, bei false NICHT filtern
- Verglasung: 2fach/3fach matchen wenn erkennbar
- Weighted Average (gewichtet nach sample_count)

```sql
WITH backtest_positionen AS (
    SELECT
        rp.id,
        rp.rechnung_code,
        rp.bezeichnung,
        rp.langtext,
        rp.einz_preis as ist_preis,
        -- Kategorie erkennen
        CASE
            WHEN rp.bezeichnung ~* 'Haustür|Haustuer|Haustuere|HT\s' THEN 'haustuer'
            WHEN rp.bezeichnung ~* 'HST|Hebe.*Schiebe' THEN 'hst'
            WHEN rp.bezeichnung ~* 'PSK|Parallel.*Schiebe' THEN 'psk'
            WHEN rp.bezeichnung ~* 'Balkontür|Balkontuer|BT\s|Balkon-Tür' THEN 'balkontuer'
            WHEN rp.bezeichnung ~* 'Fenster|DKF|DKR|DKL|DK\s|Dreh|Kipp|FIX|Festfeld|fest' THEN 'fenster'
            WHEN rp.bezeichnung ~* 'Rollladen|Rolladen|RL\s' THEN 'rollladen'
            WHEN rp.bezeichnung ~* 'Raffstore|Raffs' THEN 'raffstore'
            ELSE 'sonstiges'
        END as kategorie,
        -- Oeffnungsart
        CASE
            WHEN rp.bezeichnung ~* 'DKR|Dreh-Kipp rechts' THEN 'DKR'
            WHEN rp.bezeichnung ~* 'DKL|Dreh-Kipp links' THEN 'DKL'
            WHEN rp.bezeichnung ~* 'DKF|DK\s|Dreh.*Kipp' THEN 'DK'
            WHEN rp.bezeichnung ~* 'D\s|Dreh\s' THEN 'D'
            WHEN rp.bezeichnung ~* 'K\s|Kipp\s|KM|KL|KR' THEN 'K'
            WHEN rp.bezeichnung ~* 'FIX|Festfeld|fest' THEN 'FIX'
            WHEN rp.bezeichnung ~* 'PSK' THEN 'PSK'
            WHEN rp.bezeichnung ~* 'HST' THEN 'HST'
            ELSE NULL
        END as oeffnungsart,
        -- Masse extrahieren (mm Format)
        CASE
            WHEN rp.langtext ~ 'Breite:\s*(\d{3,5})\s*mm'
            THEN (regexp_match(rp.langtext, 'Breite:\s*(\d{3,5})\s*mm'))[1]::int
            WHEN rp.bezeichnung ~ '(\d{3,4})\s*(x|×)\s*(\d{3,4})'
            THEN (regexp_match(rp.bezeichnung, '(\d{3,4})\s*(x|×)'))[1]::int
            ELSE NULL
        END as breite_mm,
        CASE
            WHEN rp.langtext ~ 'Höhe:\s*(\d{3,5})\s*mm|Hoehe:\s*(\d{3,5})\s*mm'
            THEN COALESCE(
                (regexp_match(rp.langtext, 'Höhe:\s*(\d{3,5})\s*mm'))[1]::int,
                (regexp_match(rp.langtext, 'Hoehe:\s*(\d{3,5})\s*mm'))[1]::int
            )
            WHEN rp.bezeichnung ~ '(\d{3,4})\s*(x|×)\s*(\d{3,4})'
            THEN (regexp_match(rp.bezeichnung, '(x|×)\s*(\d{3,4})'))[2]::int
            ELSE NULL
        END as hoehe_mm,
        -- Rollladen
        CASE WHEN rp.langtext ~* 'Rollladen|Rolladen|Aufsatz-RL|Vorbau-RL' THEN true ELSE false END as hat_rl,
        -- Verglasung
        CASE
            WHEN rp.langtext ~* '3-fach|3fach|dreifach' THEN '3fach'
            WHEN rp.langtext ~* '2-fach|2fach|zweifach' THEN '2fach'
            ELSE NULL
        END as verglasung
    FROM erp_rechnungs_positionen rp
    WHERE rp.einz_preis > 50
      AND rp.einz_preis < 10000
      AND (
          rp.bezeichnung ~ '(\d{3,4})\s*(x|×)\s*(\d{3,4})'
          OR rp.langtext ~ '(\d{3,4})\s*(x|×)\s*(\d{3,4})'
          OR rp.langtext ~ 'Breite:\s*(\d{3,5})\s*mm.*H(ö|oe)he:\s*(\d{3,5})\s*mm'
          OR rp.langtext ~ 'H(ö|oe)he:\s*(\d{3,5})\s*mm.*Breite:\s*(\d{3,5})\s*mm'
      )
),
mit_groesse AS (
    SELECT *,
        CASE
            WHEN breite_mm IS NOT NULL AND hoehe_mm IS NOT NULL
            THEN ROUND((breite_mm * hoehe_mm / 1000000.0)::numeric, 2)
            ELSE NULL
        END as flaeche_qm,
        CASE
            WHEN breite_mm IS NOT NULL AND hoehe_mm IS NOT NULL THEN
                CASE
                    WHEN (breite_mm * hoehe_mm / 1000000.0) < 0.5 THEN 'XS'
                    WHEN (breite_mm * hoehe_mm / 1000000.0) < 1.0 THEN 'S'
                    WHEN (breite_mm * hoehe_mm / 1000000.0) < 1.3 THEN 'M'
                    WHEN (breite_mm * hoehe_mm / 1000000.0) < 1.8 THEN 'L1'
                    WHEN (breite_mm * hoehe_mm / 1000000.0) < 2.5 THEN 'L2'
                    ELSE 'XL'
                END
            ELSE NULL
        END as groessen_klasse
    FROM backtest_positionen
    WHERE breite_mm IS NOT NULL AND hoehe_mm IS NOT NULL
),
matched AS (
    SELECT
        bp.*,
        lv.avg_preis as lv_preis,
        lv.sample_count,
        lv.oeffnungsart as lv_oa,
        lv.groessen_klasse as lv_gk,
        ABS(bp.ist_preis - lv.avg_preis) / NULLIF(bp.ist_preis, 0) * 100 as abweichung_pct,
        ROW_NUMBER() OVER (
            PARTITION BY bp.id
            ORDER BY
                CASE WHEN lv.oeffnungsart = bp.oeffnungsart THEN 0
                     WHEN bp.oeffnungsart = 'DK' AND lv.oeffnungsart IN ('DKR','DKL') THEN 1
                     WHEN bp.oeffnungsart IN ('DKR','DKL') AND lv.oeffnungsart = 'DK' THEN 1
                     ELSE 2 END,
                CASE WHEN lv.groessen_klasse = bp.groessen_klasse THEN 0 ELSE 1 END,
                ABS(bp.ist_preis - lv.avg_preis)
        ) as match_rank
    FROM mit_groesse bp
    LEFT JOIN leistungsverzeichnis lv ON (
        lv.kategorie = bp.kategorie
        AND (
            lv.oeffnungsart = bp.oeffnungsart
            OR (bp.oeffnungsart = 'DK' AND lv.oeffnungsart IN ('DK','DKR','DKL'))
            OR (bp.oeffnungsart IN ('DKR','DKL') AND lv.oeffnungsart IN ('DK','DKR','DKL'))
        )
        AND lv.groessen_klasse = bp.groessen_klasse
        AND (bp.hat_rl = false OR lv.hat_rollladen = bp.hat_rl)
        AND (bp.verglasung IS NULL OR lv.verglasung = bp.verglasung OR lv.verglasung IS NULL)
    )
)
SELECT
    COUNT(*) as total_positionen,
    COUNT(CASE WHEN lv_preis IS NOT NULL THEN 1 END) as matched,
    COUNT(CASE WHEN lv_preis IS NULL THEN 1 END) as unmatched,
    ROUND(COUNT(CASE WHEN lv_preis IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 1) as coverage_pct,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY abweichung_pct) FILTER (WHERE match_rank = 1 AND lv_preis IS NOT NULL)::numeric, 1) as median_abweichung,
    ROUND(AVG(abweichung_pct) FILTER (WHERE match_rank = 1 AND lv_preis IS NOT NULL)::numeric, 1) as avg_abweichung,
    COUNT(CASE WHEN match_rank = 1 AND abweichung_pct <= 20 THEN 1 END) as treffer_20pct,
    ROUND(COUNT(CASE WHEN match_rank = 1 AND abweichung_pct <= 20 THEN 1 END) * 100.0 / NULLIF(COUNT(CASE WHEN lv_preis IS NOT NULL THEN 1 END), 0), 1) as treffer_20pct_rate,
    COUNT(CASE WHEN match_rank = 1 AND abweichung_pct > 50 THEN 1 END) as ausreisser_50pct,
    ROUND(COUNT(CASE WHEN match_rank = 1 AND abweichung_pct > 50 THEN 1 END) * 100.0 / NULLIF(COUNT(CASE WHEN lv_preis IS NOT NULL THEN 1 END), 0), 1) as ausreisser_50pct_rate
FROM matched
WHERE match_rank = 1 OR lv_preis IS NULL;
```

HINWEIS: Die Query ist lang. Falls sie nicht funktioniert, teile sie in kleinere CTEs auf.

**Teil 2: Vergleich nach Kategorie**
```sql
-- Gleiche matched CTE wie oben, dann:
SELECT
    kategorie,
    COUNT(*) as cnt,
    COUNT(CASE WHEN lv_preis IS NOT NULL THEN 1 END) as matched,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY abweichung_pct) FILTER (WHERE match_rank = 1 AND lv_preis IS NOT NULL)::numeric, 1) as median_abw
FROM matched
WHERE match_rank = 1 OR lv_preis IS NULL
GROUP BY kategorie
ORDER BY cnt DESC;
```

**Teil 3: Vergleichstabelle**
```
| Metrik              | P005 ALT | P009 Best | P011 v1.2.0 | P013 v1.2.0+SF | P015 (neu) | Ziel  |
|---------------------|----------|-----------|-------------|----------------|------------|-------|
| Median-Abweichung   | 30.9%    | 17.9%     | 18.6%       | 18.3%          | ???        | <15%  |
| Trefferquote <=20%  | 37.1%    | 55.2%     | 52.8%       | 54.7%          | ???        | >70%  |
| Ausreisser >50%     | 26.3%    | 8.8%      | 8.9%        | 6.5%           | ???        | <10%  |
| Coverage            | 72%      | 90.4%     | 91.8%       | 91.4%          | ???        | >90%  |
| Testpositionen      | ~418     | ~418      | ~418        | ~418           | ???        | -     |
```

**Teil 4: Analyse der Nicht-Matcher**
Falls Coverage < 95%, zeige die Top-10 unmatchbaren Positionen mit Kategorie, Oeffnungsart, Groessenklasse.

### Nach Abschluss
1. MASTER_LOG [B-055] schreiben + Index aktualisieren
2. 02_STATUS.md aktualisieren (neue Metriken!)
3. Abschlussbericht an Projektleiter

---

## [P016] LV-Kompression: Aggregation auf Matching-Dimensionen
**Datum:** 2026-02-10
**Fuer:** Programmierer
**Kontext:** Sprint P012-P016, Schritt 5 (geaendert: LV-Kompression statt Relaxed-Match)
**Vorbedingung:** P015 hat gezeigt: 7.483 LV-Eintraege verschlechtern WAVG

### Problem
Das Build-Script gruppiert aktuell nach `kategorie::bezeichnung_normalized` (Zeile 529 in build-leistungsverzeichnis.js). Das erzeugt 7.483 feinkoernige Eintraege.

Die Edge Function `budget-ki` matcht aber nur nach: `kategorie + oeffnungsart + groessen_klasse + verglasung + hat_rollladen`.

Wenn sie fuer `fenster/DKR/M` 261 LV-Eintraege bekommt, wird der Weighted Average unschaerfer, weil die Preisspanne von 457 bis 662 EUR reicht.

### Loesung: Aggregation auf Matching-Dimensionen

Aendere den Aggregations-Key von:
```javascript
const key = `${kategorie}::${bezeichnung}`;
```
auf:
```javascript
const key = `${kategorie}::${oeffnungsart || 'NULL'}::${groessenKlasse || 'NULL'}::${verglasung || 'NULL'}::${hatRollladen}::${formTyp}`;
```

Dabei muss die Groessenklasse VOR der Aggregation berechnet werden (aktuell wird sie erst bei der Ausgabe berechnet). Das bedeutet eine Umstrukturierung des Flows:

### Schritt-fuer-Schritt Anleitung

**1. Dimensions-Extraktion vorziehen (vor dem catalog-Loop)**

Aktuell wird im Loop (Zeile 488ff) die Dimension extrahiert, aber die Groessenklasse erst bei der Ausgabe (Zeile 632) berechnet.

Aendere den Flow so:
- Im Loop: breite/hoehe/flaeche sofort berechnen
- Groessenklasse sofort ableiten
- Verglasung sofort ableiten (via Uw-Wert ODER Textmatch)
- Dann als Key verwenden

**2. Neuer Aggregations-Key**

```javascript
// Dimensionen und abgeleitete Felder sofort berechnen
const dims = extractDimensions(fullText);
let groessenKlasse = null;
if (dims) {
    const flaeche = dims.breite * dims.hoehe / 1000000;
    groessenKlasse = deriveGroessenKlasse(flaeche);
}

// Verglasung: direkt aus Text wenn moeglich
const uwWert = extractUwWert(fullText);
let verglasung = null;
if (uwWert !== null) {
    verglasung = deriveVerglasung(uwWert);
} else if (/3-fach|3fach|dreifach/i.test(fullText)) {
    verglasung = '3fach';
} else if (/2-fach|2fach|zweifach/i.test(fullText)) {
    verglasung = '2fach';
}

const hatRollladen = detectRollladen(fullText, kategorie);
const formTyp = extractFormTyp(fullText);

// NEUER KEY: Matching-Dimensionen
const key = `${kategorie}::${oeffnungsart || 'NULL'}::${groessenKlasse || 'NULL'}::${verglasung || 'NULL'}::${hatRollladen}::${formTyp}`;
```

**3. Catalog-Struktur anpassen**

Die Catalog-Eintraege brauchen keine Bezeichnungs-Sammlung mehr. Stattdessen:
- Preise sammeln (wie bisher)
- Sample-Count zaehlen
- Bezeichnung: Erste gefundene Bezeichnung als Beispiel speichern
- Dimensionen: Durchschnitt berechnen

**4. Ausgabe anpassen**

Bei der Ausgabe (ab Zeile 589):
- Die Kategorie, Oeffnungsart, Groessenklasse etc. kommen direkt aus dem Key
- avg_preis = gewichteter Durchschnitt aller Preise im Cluster
- sample_count = Anzahl Positionen
- bezeichnung = Beispiel-Bezeichnung (erste)

**5. Script ausfuehren**

```bash
cd "c:\Claude_Workspace\WORK\repos\Auftragsmanagement\backend"
node scripts/build-leistungsverzeichnis.js --dry-run    # Pruefen
node scripts/build-leistungsverzeichnis.js               # Live
```

### Erwartetes Ergebnis
- LV-Eintraege: 7.483 → ~300-600 (jeder Cluster mit hohem sample_count)
- Jeder Cluster hat einen zuverlaessigeren Durchschnittspreis
- Coverage bleibt gleich oder verbessert sich
- Median-Abweichung im Backtest sollte sinken (schaerfere Preise)

### WICHTIG
- NICHT die Edge Function aendern! Nur das Build-Script.
- Die Edge Function sucht weiterhin nach kategorie + oeffnungsart + groessen_klasse und bekommt jetzt idealerweise nur 1-3 Treffer statt 261.
- Die Tabellen-Struktur in Supabase bleibt gleich (kein ALTER TABLE noetig).
- `bezeichnung` Feld: Speichere eine aussagekraeftige Beispiel-Bezeichnung oder eine generierte wie "fenster DKR M 3fach" als Beschreibung.

### Nach Abschluss
1. MASTER_LOG [B-056] schreiben + Index aktualisieren
2. 02_STATUS.md aktualisieren (neue LV-Groesse)
3. Abschlussbericht mit: LV vorher/nachher, Top-20 Cluster nach sample_count

---

## [P017] Re-Backtest nach LV-Kompression (P016)
**Datum:** 2026-02-10
**Fuer:** Tester (Foreground - Supabase MCP benoetigt)
**Ergebnis:** ⏳
**Vorbedingung:** P016 abgeschlossen (LV: 7.483 → 364 Cluster)

### Kontext
P016 hat das LV massiv komprimiert: 364 Cluster statt 7.483. Jeder Cluster hat durchschnittlich 77.7 Samples (vorher ~3.8). Der Weighted Average sollte jetzt deutlich stabiler sein.

### Auftrag

**Gleiche Backtest-Methodik wie P015**, aber mit dem komprimierten LV.

Fuehre auf Supabase (project_id: rsmjgdujlpnydbsfuiek) aus:

**Schritt 1: LV-Uebersicht**
```sql
SELECT COUNT(*) as total_cluster,
       ROUND(AVG(sample_count)::numeric, 1) as avg_samples,
       SUM(sample_count) as total_samples,
       COUNT(CASE WHEN oeffnungsart IS NOT NULL THEN 1 END) as mit_oa,
       COUNT(CASE WHEN groessen_klasse IS NOT NULL THEN 1 END) as mit_gk
FROM leistungsverzeichnis;
```

**Schritt 2: Hauptbacktest**
Exakt gleiche Query wie P015 - die CTEs backtest_pos, mit_groesse, matched und die finale Aggregation. Da die LV-Struktur gleich geblieben ist (nur weniger Eintraege), funktioniert dieselbe Query.

```sql
WITH backtest_pos AS (
    SELECT
        rp.id,
        rp.rechnung_code,
        rp.bezeichnung,
        rp.langtext,
        rp.einz_preis as ist_preis,
        CASE
            WHEN rp.bezeichnung ~* 'Haustür|Haustuer|Haustuere|HT\s' THEN 'haustuer'
            WHEN rp.bezeichnung ~* 'HST|Hebe.*Schiebe' THEN 'hst'
            WHEN rp.bezeichnung ~* 'PSK|Parallel.*Schiebe' THEN 'psk'
            WHEN rp.bezeichnung ~* 'Balkontür|Balkontuer|BT\s|Balkon-Tür' THEN 'balkontuer'
            WHEN rp.bezeichnung ~* 'Fenster|DKF|DKR|DKL|DK\s|Dreh|Kipp|FIX|Festfeld|fest' THEN 'fenster'
            WHEN rp.bezeichnung ~* 'Rollladen|Rolladen|RL\s' THEN 'rollladen'
            WHEN rp.bezeichnung ~* 'Raffstore|Raffs' THEN 'raffstore'
            ELSE 'sonstiges'
        END as kategorie,
        CASE
            WHEN rp.bezeichnung ~* 'DKR|Dreh-Kipp rechts' THEN 'DKR'
            WHEN rp.bezeichnung ~* 'DKL|Dreh-Kipp links' THEN 'DKL'
            WHEN rp.bezeichnung ~* 'DKF|DK\s|Dreh.*Kipp' THEN 'DK'
            WHEN rp.bezeichnung ~* 'D\s|Dreh\s' THEN 'D'
            WHEN rp.bezeichnung ~* 'K\s|Kipp\s|KM|KL|KR' THEN 'K'
            WHEN rp.bezeichnung ~* 'FIX|Festfeld|fest' THEN 'FIX'
            WHEN rp.bezeichnung ~* 'PSK' THEN 'PSK'
            WHEN rp.bezeichnung ~* 'HST' THEN 'HST'
            ELSE NULL
        END as oeffnungsart,
        CASE
            WHEN rp.langtext ~ 'Breite:\s*(\d{3,5})\s*mm'
            THEN (regexp_match(rp.langtext, 'Breite:\s*(\d{3,5})\s*mm'))[1]::int
            WHEN rp.bezeichnung ~ '(\d{3,4})\s*(x|×)\s*(\d{3,4})'
            THEN (regexp_match(rp.bezeichnung, '(\d{3,4})\s*(x|×)'))[1]::int
            ELSE NULL
        END as breite_mm,
        CASE
            WHEN rp.langtext ~ 'Höhe:\s*(\d{3,5})\s*mm'
            THEN (regexp_match(rp.langtext, 'Höhe:\s*(\d{3,5})\s*mm'))[1]::int
            WHEN rp.langtext ~ 'Hoehe:\s*(\d{3,5})\s*mm'
            THEN (regexp_match(rp.langtext, 'Hoehe:\s*(\d{3,5})\s*mm'))[1]::int
            WHEN rp.bezeichnung ~ '(\d{3,4})\s*(x|×)\s*(\d{3,4})'
            THEN (regexp_match(rp.bezeichnung, '(x|×)\s*(\d{3,4})'))[2]::int
            ELSE NULL
        END as hoehe_mm,
        CASE WHEN rp.langtext ~* 'Rollladen|Rolladen|Aufsatz-RL|Vorbau-RL' THEN true ELSE false END as hat_rl,
        CASE
            WHEN rp.langtext ~* '3-fach|3fach|dreifach' THEN '3fach'
            WHEN rp.langtext ~* '2-fach|2fach|zweifach' THEN '2fach'
            ELSE NULL
        END as verglasung
    FROM erp_rechnungs_positionen rp
    WHERE rp.einz_preis > 50
      AND rp.einz_preis < 10000
      AND (
          rp.bezeichnung ~ '(\d{3,4})\s*(x|×)\s*(\d{3,4})'
          OR rp.langtext ~ '(\d{3,4})\s*(x|×)\s*(\d{3,4})'
          OR rp.langtext ~ 'Breite:\s*(\d{3,5})\s*mm'
      )
),
mit_groesse AS (
    SELECT *,
        ROUND((breite_mm * hoehe_mm / 1000000.0)::numeric, 2) as flaeche_qm,
        CASE
            WHEN (breite_mm * hoehe_mm / 1000000.0) < 0.5 THEN 'XS'
            WHEN (breite_mm * hoehe_mm / 1000000.0) < 1.0 THEN 'S'
            WHEN (breite_mm * hoehe_mm / 1000000.0) < 1.3 THEN 'M'
            WHEN (breite_mm * hoehe_mm / 1000000.0) < 1.8 THEN 'L1'
            WHEN (breite_mm * hoehe_mm / 1000000.0) < 2.5 THEN 'L2'
            ELSE 'XL'
        END as groessen_klasse
    FROM backtest_pos
    WHERE breite_mm IS NOT NULL AND hoehe_mm IS NOT NULL
),
matched AS (
    SELECT
        bp.*,
        lv.avg_preis as lv_preis,
        lv.sample_count,
        ABS(bp.ist_preis - lv.avg_preis) / NULLIF(bp.ist_preis, 0) * 100 as abweichung_pct,
        ROW_NUMBER() OVER (
            PARTITION BY bp.id
            ORDER BY
                CASE WHEN lv.oeffnungsart = bp.oeffnungsart THEN 0
                     WHEN bp.oeffnungsart = 'DK' AND lv.oeffnungsart IN ('DKR','DKL') THEN 1
                     WHEN bp.oeffnungsart IN ('DKR','DKL') AND lv.oeffnungsart = 'DK' THEN 1
                     ELSE 2 END,
                ABS(bp.ist_preis - lv.avg_preis)
        ) as match_rank
    FROM mit_groesse bp
    LEFT JOIN leistungsverzeichnis lv ON (
        lv.kategorie = bp.kategorie
        AND (
            lv.oeffnungsart = bp.oeffnungsart
            OR (bp.oeffnungsart = 'DK' AND lv.oeffnungsart IN ('DK','DKR','DKL'))
            OR (bp.oeffnungsart IN ('DKR','DKL') AND lv.oeffnungsart IN ('DK','DKR','DKL'))
        )
        AND lv.groessen_klasse = bp.groessen_klasse
        AND (bp.hat_rl = false OR lv.hat_rollladen = bp.hat_rl)
        AND (bp.verglasung IS NULL OR lv.verglasung = bp.verglasung OR lv.verglasung IS NULL)
    )
)
SELECT
    COUNT(*) as total,
    COUNT(CASE WHEN lv_preis IS NOT NULL THEN 1 END) as matched,
    COUNT(CASE WHEN lv_preis IS NULL THEN 1 END) as unmatched,
    ROUND(COUNT(CASE WHEN lv_preis IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 1) as coverage_pct,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY abweichung_pct) FILTER (WHERE match_rank = 1 AND lv_preis IS NOT NULL)::numeric, 1) as median_abw,
    COUNT(CASE WHEN match_rank = 1 AND abweichung_pct <= 20 THEN 1 END) as treffer_20,
    ROUND(COUNT(CASE WHEN match_rank = 1 AND abweichung_pct <= 20 THEN 1 END) * 100.0 / NULLIF(COUNT(CASE WHEN lv_preis IS NOT NULL THEN 1 END), 0), 1) as treffer_20_pct,
    COUNT(CASE WHEN match_rank = 1 AND abweichung_pct > 50 THEN 1 END) as ausreisser_50,
    ROUND(COUNT(CASE WHEN match_rank = 1 AND abweichung_pct > 50 THEN 1 END) * 100.0 / NULLIF(COUNT(CASE WHEN lv_preis IS NOT NULL THEN 1 END), 0), 1) as ausreisser_50_pct
FROM matched
WHERE match_rank = 1 OR lv_preis IS NULL;
```

**Schritt 3: Analyse nach Kategorie**
Gleiche CTEs, dann:
```sql
SELECT kategorie, COUNT(*) as cnt,
       COUNT(CASE WHEN lv_preis IS NOT NULL THEN 1 END) as matched,
       ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY abweichung_pct) FILTER (WHERE match_rank = 1 AND lv_preis IS NOT NULL)::numeric, 1) as median,
       COUNT(CASE WHEN match_rank = 1 AND abweichung_pct > 50 THEN 1 END) as ausreisser
FROM matched WHERE match_rank = 1 OR lv_preis IS NULL
GROUP BY kategorie ORDER BY cnt DESC;
```

**Schritt 4: Vergleichstabelle**
```
| Metrik              | P005 ALT | P013 (418 Pos) | P015 (442 fen+bt) | P017 (neu) | Ziel  |
|---------------------|----------|----------------|--------------------|-----------:|-------|
| Median-Abweichung   | 30.9%    | 18.3%          | 22.2%              | ???        | <15%  |
| Trefferquote <=20%  | 37.1%    | 54.7%          | 48.3%              | ???        | >70%  |
| Ausreisser >50%     | 26.3%    | 6.5%           | 17.7%              | ???        | <10%  |
| Coverage            | 72%      | 91.4%          | 98.4%              | ???        | >90%  |
```

### Dokumentation
1. MASTER_LOG [B-057] schreiben + Index
2. 02_STATUS.md aktualisieren mit P017-Metriken
3. Abschlussbericht

---

## ═══ NAECHSTER PROMPT HIER ═══
