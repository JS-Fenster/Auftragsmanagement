# Status: Budgetangebot V1

> Letzte Aktualisierung: 2026-02-04 12:30
> Aktualisiert von: Projektleiter (Session-Checkpoint)

---

## Aktueller Stand
**Phase:** Phase 13 - E2E-Tests und Feinschliff
**Letzter abgeschlossener Schritt:** Parser-Fix W4A Maß-Format (LOG-027)

---

## Aktiver Auftrag

**Status:** ABGESCHLOSSEN - Parser verbessert, Backtest durchgefuehrt

### Parser-Fix Ergebnisse (LOG-027)

**Auftrag:** Parser fixen - Maße stehen im KOMPLETTEN Text, nicht nur erste Zeile

**Durchgefuehrt:**
1. Neues Pattern fuer W4A-Format: `Breite: 1190 mm, Höhe: 1225 mm`
2. Text-Normalisierung (Zeilenumbrueche zu Spaces)
3. Backtest mit 3 verschiedenen Sample-Sets (OFFSET 0, 50, 100)

**Maß-Erkennungs-Verbesserung:**
| Metrik | Vorher | Nachher |
|--------|--------|---------|
| Erkennungsrate | 6.8% | 56.0% |
| Verbesserung | - | +723% |
| Dominantes Pattern | dimension_x | w4a_labeled (91%) |

**Backtest-Ergebnisse (50 Rechnungen je Sample):**
| OFFSET | Rechnungen | Treffer (±20%) | Median |
|--------|------------|----------------|--------|
| 0 | 34 | 18% | -38% |
| 50 | 35 | 20% | -17% |
| 100 | 26 | 8% | -46% |

**ERKENNTNIS:** Parser-Verbesserung hat NICHT zu besserer Trefferquote gefuehrt!
- Grund: Mehr Fenster erkannt → Budget steigt → Abweichung steigt
- Problem ist das **Preismodell**, nicht die Maß-Erkennung
- System-Erkennung funktioniert nicht (85-90% DEFAULT)

---

### Erkenntnisse fuer 04_LEARNINGS.md (Projektleiter)

| # | Learning | Log-Referenz |
|---|----------|--------------|
| L22 | W4A-Format "Breite: XXX mm, Höhe: YYY mm" ist Standard (91% der Masse) | [LOG-027] |
| L23 | Mehr erkannte Masse = NICHT automatisch besser (Preismodell-Problem) | [LOG-027] |
| L24 | DEFAULT-System bei 85-90% → System-Erkennung muss verbessert werden | [LOG-027] |

---

### W4A Tunnel-Architektur (WICHTIG!)
- cloudflared muss lokal laufen: `cloudflared access tcp --hostname sql.js-fenster-intern.org --url localhost:1433`
- Backend verbindet zu `localhost:1433` (NICHT direkt zu sql.js-fenster-intern.org!)
- .env: `W4A_DB_SERVER=localhost`
- Tunnel Status: AKTIV (Timeout 60s)

### Technischer Stand
- Edge Function: v48 deployed, GPT-5.2 Budget-Extraktion aktiv
- Backend: Alle API-Endpunkte funktional (10 Endpunkte)
- Frontend: Budgetangebot-Modul komplett (Liste + Detail)
- DB: Alle Tabellen bereit (11 Tabellen mit RLS)
- Analyse-Scripts: backtest-invoices.js VERBESSERT (W4A Maß-Format)

---

## Erledigte Auftraege

| Schritt | Status | Datum |
|---------|--------|-------|
| 3-Agenten-Analyse (A/B/C) | Fertig | 2026-02-03 |
| Supabase Migration (11 Tabellen) | Fertig | 2026-02-03 |
| Bridge-Proxy Endpunkte | Fertig | 2026-02-04 |
| Parser-Services (N1) | Fertig | 2026-02-04 |
| Preismodell + Kalkulation (N2) | Fertig | 2026-02-04 |
| Backend API-Endpunkte (N3) | Fertig | 2026-02-05 |
| Frontend Budgetangebot-Modul (N4) | Fertig | 2026-02-05 |
| Code-Validierung + Syntax-Checks (N5) | Fertig | 2026-02-05 |
| Funktionale UI-Tests (Chrome MCP) | Fertig | 2026-02-05 |
| Vollstaendige Funktionstests | Fertig | 2026-02-04 |
| GPT-5.2 Performance Test | Fertig | 2026-02-04 |
| Edge Function Refactoring | Fertig | 2026-02-04 |
| Budget-Extraktion Performance Test | Fertig | 2026-02-04 |
| P015-PROG: GPT Budget-Extraktion | Fertig | 2026-02-04 |
| Edge Function Audit (19 geprueft, 4 geloescht) | Fertig | 2026-02-04 |
| renew-subscriptions 401-Fix | Fertig | 2026-02-04 |
| Commit & Push (145c4f2) | Fertig | 2026-02-04 |
| Backtest 50 Rechnungen | Fertig | 2026-02-04 |
| Positions-Klassifikations-Analyse | Fertig | 2026-02-04 |
| Preisspannen-Analyse EK->VK | Fertig | 2026-02-04 |
| Header-Fenster-Muster Analyse | Fertig | 2026-02-04 |
| Backtest-Fixes (LOG-025) | Fertig | 2026-02-04 |
| Artikel-Tabelle Analyse (LOG-026) | Fertig | 2026-02-04 |
| **Parser-Fix W4A Maß-Format (LOG-027)** | **Fertig** | **2026-02-04** |

---

## Blocker
- **PREISMODELL:** Zu hohe Basispreise → Budget systematisch zu hoch
- **SYSTEM-ERKENNUNG:** 85-90% werden als DEFAULT klassifiziert
- **DATEN-QUALITAET:** Masse nur aus Text (kein DB-Feld gepflegt)

---

## Nachtmodus
**Status:** INAKTIV

---

## Letzter Abschlussbericht
Siehe 03_LOG.md [LOG-027]

### Zusammenfassung LOG-027 (Parser-Fix)
- `extractDimensions()` erweitert: 6 Patterns statt 4
- W4A-Format "Breite: XXX mm, Höhe: YYY mm" ist Standard (91% der Funde)
- Maß-Erkennungsrate: 6.8% → 56.0% (+723%)
- ABER: Trefferquote NICHT verbessert (Problem = Preismodell)

### Naechster Schritt (Empfehlung an Projektleiter)
1. **Preismodell kalibrieren:** Basispreise reduzieren, Skalierung anpassen
2. **System-Erkennung verbessern:** Header besser parsen (WERU/CASTELLO/CALIDO/IMPREO)
3. **Filter erweitern:** Schlussrechnungen/Teilrechnungen separat behandeln

---

## SESSION-CHECKPOINT (fuer neue Session)

### Was diese Session erreicht hat
1. W4A Cloudflare Tunnel dokumentiert und funktionsfaehig gemacht
2. Server_Infrastruktur.md aktualisiert mit Tunnel-Details
3. Backtest mit 50 Rechnungen durchgefuehrt (19% Trefferquote)
4. Positions-Struktur analysiert (Header ohne Punkt, Details mit Punkt)
5. Preisspannen analysiert (Median 75%, Standard 85%)
6. Parser verbessert: Maß-Erkennungsrate von 6.8% auf 56%

### Kernproblem identifiziert
**Nicht der Parser ist das Problem, sondern das Preismodell:**
- System-Erkennung: 85-90% landen bei DEFAULT
- Preise zu hoch kalibriert
- Mehr erkannte Fenster → hoeheres Budget → groessere Abweichung

### W4A Positions-Struktur (WICHTIG!)
```
PozNr 0    [HEADER] ALUPROF MB-86: Aluminiumfenster...
PozNr 1    [HEADER] Fenster (Kategorie)
PozNr 1.1  [FENSTER] Obergeschoß - Schlafen
                     Anschlag: DKL Dreh-Kipp links
                     Breite: 1190 mm, Höhe: 1225 mm  ← HIER
PozNr 1.2  [FENSTER] ...
PozNr 2    [HEADER] Montageleistungen
PozNr 2.1  [MONTAGE] Regiestunden... (= Montageleistung, NICHT ignorieren!)
```

### Preiskalkulation W4A
- EKPreis = Einkaufspreis
- EinzPreis = Verkaufspreis
- Standard-Aufschlag: 85% auf EKPreis
- Median in W4A: 75%
- Fenster: 70-85%, Kleinteile: 100-125%, Zargen: 150-200%

### Cloudflare Tunnel (falls nicht laeuft)
```bash
cloudflared access tcp --hostname sql.js-fenster-intern.org --url localhost:1433
```
Backend .env: `W4A_DB_SERVER=localhost`

### Scripts erstellt
- `backend/scripts/backtest-invoices.js` - Hauptskript (verbessert)
- `backend/scripts/analyze-position-types.js` - Positions-Analyse
- `backend/scripts/analyze-price-margins.js` - Preisspannen
- `backend/scripts/show-full-text.js` - Rohdaten anzeigen
