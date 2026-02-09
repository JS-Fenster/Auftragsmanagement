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

## ═══ NAECHSTER PROMPT HIER ═══
