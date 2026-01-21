# QA/Audit Report: Kategorien Email + Scan

> **Datum:** 2026-01-20
> **Projekt:** Auftragsmanagement (Supabase)
> **Erstellt von:** Claude + Andreas (Multi-Agent ULTRATHINK)

---

## 1. CURRENT STATE

### E2E Pipeline Status

| Pipeline | Status | Details |
|----------|--------|---------|
| **email-webhook** | ✅ RUNNING | Empfaengt Microsoft Graph Notifications |
| **process-email** | ✅ RUNNING | GPT-5.2 Kategorisierung, v3.1.1 |
| **process-document** | ✅ RUNNING | Mistral OCR + GPT-5.2, v19 |
| **Attachment Processing** | ✅ 100% OK | 39/39 Emails mit Metadaten |

### Taxonomie-Trennung

| Aspekt | Status | Details |
|--------|--------|---------|
| `kategorie` (Dokumenttyp) | ✅ SAUBER | CHECK Constraint aktiv, 26 Werte |
| `email_kategorie` (Intent) | ✅ SAUBER | Kein Constraint, 18 Werte |
| Trennung Email/Dokument | ✅ KORREKT | Alle 140 Emails haben kategorie=Email_Eingehend |
| Email_Anhang Markierung | ✅ KORREKT | Alle 56 Attachments korrekt markiert |

---

## 2. TESTSET BESCHREIBUNG

### Gesamtbestand

| Typ | Anzahl | Anteil |
|-----|--------|--------|
| **Gesamt** | 1.410 | 100% |
| Scans/Uploads | 1.214 | 86% |
| Emails | 196 | 14% |

### Kategorie-Verteilung (Top 10 Dokumente)

| # | Kategorie | Anzahl | Bewertung |
|---|-----------|--------|-----------|
| 1 | Montageauftrag | 275 | ✅ Korrekt |
| 2 | **Sonstiges_Dokument** | 233 | ⚠️ ZU HOCH (16.5%) |
| 3 | Eingangslieferschein | 154 | ✅ Korrekt |
| 4 | Skizze | 148 | ✅ Korrekt |
| 5 | Auftragsbestaetigung | 146 | ✅ Korrekt |
| 6 | Email_Eingehend | 140 | ✅ Korrekt |
| 7 | Notiz | 83 | ✅ Korrekt |
| 8 | Email_Anhang | 56 | ✅ Korrekt |
| 9 | Angebot | 41 | ✅ Korrekt |
| 10 | Eingangsrechnung | 34 | ✅ Korrekt |

### Email-Kategorie Verteilung

| email_kategorie | Anzahl | Anteil | Bewertung |
|-----------------|--------|--------|-----------|
| **Sonstiges** | 131 | 93.6% | ❌ KRITISCH |
| Newsletter_Werbung | 8 | 5.7% | ✅ |
| Lieferstatus_Update | 1 | 0.7% | ✅ |

---

## 3. ERGEBNISSE

### 3.1 Dokumenttyp Klassifizierung (process-document)

#### Accuracy Schaetzung

| Kategorie | Samples | Korrekt | Accuracy |
|-----------|---------|---------|----------|
| Angebot | 5 | 5 | 100% ✅ |
| Eingangsrechnung | 5 | 5 | 100% ✅ |
| Auftragsbestaetigung | 5 | 5 | 100% ✅ |
| **Brief_von_Kunde** | 5 | 0 | **0%** ❌ |
| **Sonstiges_Dokument** | 233 | ~65 | **28%** ❌ |

#### Brief_von_Kunde Confusion Matrix

| Modell sagt | Sollte sein | Anzahl | % |
|-------------|-------------|--------|---|
| Brief_von_Kunde | Finanzierung | 16 | 80% |
| Brief_von_Kunde | Versicherung | 12 | 60% |
| Brief_von_Kunde | Vertrag | 1 | 5% |
| Brief_von_Kunde | Brief_von_Kunde | ~1 | 5% |

**Problem:** 80% der "Brief_von_Kunde" sind von Banken/Versicherungen, NICHT von Kunden!

#### Sonstiges_Dokument Keyword-Analyse (205 mit gutem OCR)

| Keyword | Treffer | Sollte sein |
|---------|---------|-------------|
| Leistungserklaerung/CE/DoP | 60 | Leistungserklaerung |
| Rechnung | 25 | Eingangs-/Ausgangsrechnung |
| Vertrag | 24 | Vertrag |
| Garantie | 14 | Garantie |
| Angebot | 9 | Angebot |
| Bestellung | 5 | Bestellung |
| Lieferschein | 2 | Lieferschein |
| Mahnung | 2 | Mahnung |

**~141 Dokumente (69%) in Sonstiges_Dokument sind falsch klassifiziert!**

### 3.2 Email-Intent Klassifizierung (process-email)

#### Accuracy

| Metrik | Wert | Bewertung |
|--------|------|-----------|
| Kategorisiert | 140/196 | 71% |
| Davon "Sonstiges" | 131/140 | **93.6%** ❌ |
| Spezifische Kategorie | 9/140 | **6.4%** |

**KRITISCH:** Der GPT-Prompt ist zu konservativ - fast alles wird als "Sonstiges" klassifiziert!

#### Email-Stichprobe "Sonstiges" (sollte spezifischer sein)

| Betreff (gekuerzt) | Modell | Sollte sein |
|--------------------|--------|-------------|
| Auftragsbestätigung für: info@js-fenster.de | Sonstiges | Bestellbestaetigung |
| Rechnung 250394 DKF ISS | Sonstiges | Rechnung_Eingang |
| Bestellung 260024 zu Angebot 10491 | Sonstiges | Auftragserteilung |
| EHRET GmbH: Verschiebung Preiserhöhung | Sonstiges | Lieferstatus_Update |
| Smarter wohnen, günstiger kaufen! | Sonstiges | Newsletter_Werbung |

### 3.3 Attachment-Verarbeitung

| Metrik | Wert | Bewertung |
|--------|------|-----------|
| Emails mit Attachments | 39 | - |
| Total Attachments | 56 | - |
| Mit Metadaten | 39/39 | 100% ✅ |
| Mit Hashes | 39/39 | 100% ✅ |
| Als Email_Anhang markiert | 56/56 | 100% ✅ |

---

## 4. TOP 5 FINDINGS

### ❌ F1: email_kategorie 93.6% "Sonstiges" (KRITISCH)
- **Impact:** Email-Intent-Klassifizierung ist praktisch nutzlos
- **Ursache:** GPT-Prompt zu konservativ / unspezifisch
- **Prioritaet:** P0

### ❌ F2: Brief_von_Kunde 80% falsch klassifiziert (KRITISCH)
- **Impact:** Bank/Versicherungs-Dokumente werden Kunden zugeordnet
- **Ursache:** SYSTEM_PROMPT unterscheidet nicht zwischen Absendertypen
- **Prioritaet:** P0

### ⚠️ F3: Sonstiges_Dokument 16.5% aller Dokumente (HOCH)
- **Impact:** 141+ Dokumente falsch, fehlende Kategorien
- **Ursache:** Neue Kategorien (Garantie, Leistungserklaerung, etc.) fehlen im Schema
- **Prioritaet:** P1

### ⚠️ F4: Email_Anhang ohne Referenz zur Parent-Email
- **Impact:** 55/55 (100%) Email_Anhang Dokumente haben keine `email_message_id`
- **Ursache:** Pipeline setzt Feld nicht beim Attachment-Import
- **Prioritaet:** P1

### ✅ F5: Attachment-Processing 100% funktional
- **Status:** Extraktion + Storage OK, nur Referenzierung fehlt

### ✅ F6: Taxonomie-Trennung sauber
- **Status:** kategorie vs email_kategorie korrekt implementiert

---

## 5. OPEN RISKS

| Risk | Wahrscheinlichkeit | Impact | Mitigation |
|------|-------------------|--------|------------|
| OCR-Qualitaet bei Bildern | Mittel | Hoch | Fallback auf Dateinamen-Heuristik |
| GPT-Halluzination bei kurzen Texten | Niedrig | Mittel | Confidence-Threshold |
| Neue Dokumenttypen nicht erkannt | Hoch | Mittel | Regelmaessiges Schema-Update |
| Email-Attachments nicht OCR-verarbeitet | Mittel | Mittel | process-document Trigger nach Upload |

---

## 6. NEXT STEPS (Priorisiert)

### P0 - KRITISCH (sofort)

| # | Aktion | Details |
|---|--------|---------|
| 1 | **process-email Prompt ueberarbeiten** | Spezifischere Regeln fuer Email-Intent |
| 2 | **process-document Prompt ueberarbeiten** | Absender-Erkennung (Bank ≠ Kunde) |
| 3 | **EXTRACTION_SCHEMA erweitern** | 20 neue Kategorien (siehe EDGE_FUNCTION_VERBESSERUNGEN_2026-01-16.md) |

### P1 - HOCH (diese Woche)

| # | Aktion | Details |
|---|--------|---------|
| 4 | **SQL Migration** | CHECK Constraint mit 38 Kategorien |
| 5 | **Re-Klassifizierung** | 233 Sonstiges_Dokument + 20 Brief_von_Kunde mit neuem Prompt |

### P2 - MITTEL (spaeter)

| # | Aktion | Details |
|---|--------|---------|
| 6 | **Confidence-Feld** | Threshold fuer "needs review" |
| 7 | **kategorisiert_von Feld** | gpt/manuell/regel tracking |
| 8 | **sensibel Feld + Trigger** | Zugriffskontrolle fuer HR-Dokumente |

---

## 7. GO/NO-GO KRITERIEN

| Kriterium | Ziel | Aktuell | Status |
|-----------|------|---------|--------|
| Dokumenttyp Accuracy (sichere Faelle) | >= 85% | ~70% | ❌ NO-GO |
| Email-Intent Accuracy (sichere Faelle) | >= 80% | ~6% | ❌ NO-GO |
| Attachment Processing | >= 95% | 100% | ✅ GO |
| Keine Constraint Violations | 0 | 0 | ✅ GO |
| Keine Kategorie-Vermischung | 0 | 0 | ✅ GO |

**GESAMTERGEBNIS: ❌ NO-GO fuer Produktionsreife**

---

## 8. GOLDEN REGRESSION CASES

Speichere diese IDs fuer kuenftige Regressionstests:

| ID | Kategorie | Expected | Test Case |
|----|-----------|----------|-----------|
| `b7b3cb54-1dbc-4218-a331-bf82be8c1499` | Sonstiges_Dokument | **Garantie** | WERU Garantiepass |
| `d6ad7a33-3273-47bc-8d46-a43b07d47a3e` | Brief_von_Kunde | **Finanzierung** | Mercedes-Benz Leasing |
| `bdf44c4d-4a3c-40ff-b76e-330a566eb68e` | Brief_von_Kunde | **Versicherung** | Generali Kfz-Versicherung |

---

## 9. FAZIT

Die **Pipeline laeuft technisch stabil** (Attachments 100%, keine Constraint Violations).

Jedoch ist die **Klassifizierungsqualitaet unzureichend**:
- email_kategorie ist mit 93.6% "Sonstiges" praktisch nutzlos
- Brief_von_Kunde wird systematisch falsch verwendet (Bank/Versicherung statt echte Kunden)
- 16.5% aller Dokumente landen in "Sonstiges_Dokument" obwohl bessere Kategorien existieren

**Empfehlung:** Edge Function Verbesserungen aus `EDGE_FUNCTION_VERBESSERUNGEN_2026-01-16.md` deployen, dann Re-Klassifizierung der bestehenden Dokumente.

---

*Report erstellt: 2026-01-20 | Multi-Agent QA Audit | Andreas Stolarczyk + Claude*
