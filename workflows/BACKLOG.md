# Feature-Backlog: Auftragsmanagement

> **Schreibrecht:** NUR Projektleiter
> **Lesen:** NUR INDEX (erste ~60 Zeilen)! Dann `Grep: ## \[X-XXX\]` fuer Details.
> **Regel:** Erledigte Items KOMPLETT LOESCHEN (Index-Zeile + Detail-Abschnitt). Wenn alles erledigt ist, bleibt nur der leere INDEX uebrig.
> **IDs:** `B-XXX` (Budget), `R-XXX` (Repair), `G-XXX` (General). Geloeschte IDs werden NICHT wiederverwendet.

---

## INDEX

| ID | Prio | Bereich | Kurzbeschreibung |
|----|------|---------|------------------|
| B-001 | HOCH | Budget | Haustuer-Matching (544 Pos., 32.7% Median) |
| B-002 | HOCH | Budget | UI/UX-Optimierungen (2 TODOs: U3-U4) |
| B-003 | NIEDRIG | Budget | Teilrechnung: Eingabe-Optionen (Prozent/Fix) |
| B-004 | NIEDRIG | Budget | Margin-Approval-System (Genehmigung bei niedrigen Margen) |
| B-005 | MITTEL | Budget | Kundendaten: Weitere Felder (Adresse, Anrede, Projekt) |
| B-006 | MITTEL | Budget | Positions-Struktur: Texte + Aussehen ueberarbeiten |
| B-008 | HOCH | Budget | Angebote speichern + Verlauf/Wiederanzeige im Dashboard |
| R-001 | NIEDRIG | Repair | Reparatur-System (repairs + Tabellen) |
| R-002 | NIEDRIG | Repair | Reparaturen-Seite im Dashboard (nach Frontend-Loesch.) |
| G-001 | HOCH | System | Hardcoded Werte zentralisieren (app_config Tabelle) |
| G-002 | HOCH | Frontend | Lieferanten-Verwaltung (Seite fehlt) |
| ~~G-003~~ | ~~ERLEDIGT~~ | ~~Frontend~~ | ~~Bestellungen-Management (in ProjektDetail.jsx, 2026-03-06)~~ |
| G-004 | MITTEL | E-Mail | Steuerrelevanz-Klassifizierung + Revisionssicherheit |
| ~~G-005~~ | ~~ERLEDIGT~~ | ~~Frontend~~ | ~~Kalender mit FullCalendar (Montageplanung, 3 Ansichten, 2026-03-06)~~ |
| G-006 | MITTEL | Frontend | Erweiterte Dokumente (Detail, Positionen, PDF-Export) |
| G-007 | MITTEL | Frontend | Kontakt-Detail: Interaktive Summary-Cards |
| G-008 | MITTEL | Kontakte | Betreuer-Referenz (Phase 5: referenz_kontakt_id) |
| G-009 | MITTEL | Backend | Edge Functions aufsplitten (Token-Optimierung) |
| G-010 | MITTEL | System | Status-Systeme vereinheitlichen |
| G-011 | NIEDRIG | Backend | Termin-System (appointments + Outlook-Sync) |
| G-012 | NIEDRIG | System | User-Management + Auth (Rollen) |
| G-013 | NIEDRIG | Frontend | Einstellungen mit Datensicherung (Backup/Import) |
| G-014 | NIEDRIG | System | Fehlende Scanner-Dateien nachholen (~40 Stueck) |
| G-015 | NIEDRIG | System | Workflow CLAUDE.md Duplikat aufloesen (Template) |
| G-016 | NIEDRIG | Frontend | Kunden: Besteuerung (Steuertyp, Freistellung) |
| G-017 | MITTEL | Dashboard | Angebotserstellung anhand einer Ausschreibung |
| G-018 | MITTEL | E-Mail | Dokument-Namensformatierung pro Kunde (beim Rechnungsversand) |
| G-019 | MITTEL | Kontakte | Mehrere E-Mail-Adressen pro Kunde (Rechnungs-E-Mail etc.) |
| G-020 | MITTEL | Kontakte | Kunden-Bestellnummer/Projektnummer (Pflichtfeld-Hinweis) |
| G-031 | MITTEL | Kategorien | Kategorien-Bereinigung: Zu allgemeine Kategorien aufspalten (nach Review) |
| G-029 | MITTEL | Budget | Ud-Wert Rechner (EN ISO 10077-1) fuer Tueren |
| G-032 | HOCH | E-Mail | Email-Versand-Architektur (eigene UI vs. Outlook, Entwurf/Fehlgeschlagen) |
| ~~G-033~~ | ~~ERLEDIGT~~ | ~~E-Mail~~ | ~~Globale Duplikat-Erkennung Email-Anhaenge (in process-document-ocr v1.0, 2026-03-09)~~ |
| G-034 | HOCH | Pipeline | OCR-Korrektur + Feinere Klassifizierung (Basis fuer Workflows) |
| G-038 | NIEDRIG | Kategorien | Brief_ausgehend-Bereinigung (3 Docs verschieben) + Prompt-Richtungsregel |
| G-039 | MITTEL | Pipeline | Auto-Split Multi-Dokument PDFs (eigenstaendige Bloecke) |
| G-040 | HOCH | Pipeline | Dokument-Beziehungen (Querverweise zwischen zusammengehoerenden Docs) |
| G-041 | HOCH | Workflow | Notiz→Workflow Pipeline (Reparatur, Termin, Angebot aus Notizen) |
| G-042 | MITTEL | Prozess | Handschriftliche Eingaenge: Formulare fuer GPT/Workflows optimieren |
| G-043 | HOCH | Pipeline | Prompt-Optimierung aus KI-Review-Erkenntnissen (Feedback-Loop) |
| ~~G-044~~ | ~~ERLEDIGT~~ | ~~Pipeline~~ | ~~HEIC-Support (v38, deployed 2026-03-05)~~ |
| ~~G-045~~ | ~~ERLEDIGT~~ | ~~Pipeline~~ | ~~Upload-Filter (v38, deployed 2026-03-05)~~ |
| G-046 | NIEDRIG | Kategorien | Neue Kategorie "Kundenunterlage" + .ics-Support in Email-Pipeline |
| G-047 | MITTEL | Pipeline | Confidence-Score: classify-backtest + process-document + DB-Spalte |
| G-048 | MITTEL | Monitoring | Drift-Erkennung: Woechentlicher Kategorie-Verteilungs-Check |
| G-049 | NIEDRIG | Monitoring | Kategorie-spezifische Fehlerrate tracken (pro Kategorie Trefferquote) |
| G-050 | MITTEL | Pipeline | GPT-Input verbessern: Strukturiertes Metadaten-JSON (json_schema ERLEDIGT in v39) |
| G-051 | IDEE | Workflow | Aufgaben/Ticket-System mit Leerlauf-Aufgaben fuer Mitarbeiter |
| ~~G-052~~ | ~~ERLEDIGT~~ | ~~Pipeline~~ | ~~process-document 2-Stufen-Pipeline (v40 Wrapper + OCR + Categorize, 2026-03-09)~~ |
| G-053 | HOCH | Auftragsm. | Reparatur-Erweiterung: Foto-Upload, Ersatzteil-DB, Dokument-Links |
| G-054 | MITTEL | Auftragsm. | Auftragsmanagement-Tool: Ueberblick-Dashboard mit KPIs + Charts |
| G-055 | NIEDRIG | Kategorien | Trendtueren-Konfigurator: Bestellung = Bestellung_Ausgehend (Lieferanten-Bestellung) |
| G-056 | MITTEL | Kategorien | Neue Dokument-Kategorie "Werbung" (Werbeflyer, Prospekte, Newsletter-Anhaenge) |

---

## [G-055] Trendtueren-Konfigurator: Bestellung = Bestellung_Ausgehend

**Prio:** NIEDRIG | **Bereich:** Kategorien / Wissen

### Erkenntnis
Wenn JS Fenster eine Bestellung aus dem **Trendtueren-Konfigurator** ausloest, wird ein PDF generiert (z.B. `bestellung.pdf`). Dieses Dokument ist eine **Bestellung_Ausgehend** (Lieferanten-Bestellung an Trendtueren). Danach erhaelt JS eine **AB_Eingehend** (Auftragsbestaetigung von Trendtueren).

### Pruefen
- Wird das Konfigurator-PDF korrekt als `Bestellung_Ausgehend` klassifiziert?
- Wird die AB von Trendtueren als `AB_Eingehend` klassifiziert?
- Falls nicht: Prompt-Hinweis oder Few-Shot-Beispiel ergaenzen

---

## [G-056] Neue Dokument-Kategorie "Werbung"

**Prio:** MITTEL | **Bereich:** Kategorien
**Erstellt:** 2026-03-06

### Beschreibung
Neue Dokument-Kategorie `Werbung` fuer Werbeflyer, Produktprospekte von Dienstleistern, Software-Werbung, Newsletter-Anhaenge und unaufgeforderte Aktionsangebote.

### Abgrenzung
- **Spam** = Muell, irrelevant, sofort weg (Fax-Spam, Werbe-Faxe)
- **Katalog** = gewollte Produktkataloge von Lieferanten (WERU, Schuco etc.)
- **Werbung** = potenziell interessant, aber kein Katalog - Flyer, Prospekte, Aktionen
- **Brief_eingehend** = Verbandspost, Rundschreiben (z.B. BVRS)

### Beispiel-Dokumente
- `CyberRisikoCheck.pdf` - IT-Sicherheits-Werbeflyer (IDI/PHD IT-Systeme)
- `Alles_am_Pin_und_Einbauort_gespeichert.pdf` - Software-Produktwerbung
- Newsletter-Anhaenge von Lieferanten mit Aktionen/Neuheiten

### Umsetzung (Kategorie-Checkliste)
1. `_shared/categories.ts` - Werbung in VALID_DOKUMENT_KATEGORIEN
2. `process-document/prompts.ts` - Kategorie-Beschreibung im Prompt
3. `process-document/schema.ts` - Enum erweitern
4. DB CHECK Constraint erweitern
5. `admin-review` Frontend Dropdown (constants.js)
6. Storage-Ordner wird automatisch erstellt

---

## ═══ BACKLOG START ═══

---

## [G-052] process-document 2-Stufen-Pipeline + Storage-Verschiebung

**Prioritaet:** HOCH
**Bereich:** Pipeline / Architektur
**Erstellt:** 2026-03-06

### Problem

1. **process-document** macht alles in einer Function (~40s): OCR + GPT + Storage + DB
   - Supabase Edge Function Limit: 150s → max 3 Docs pro Batch
   - Wenn GPT fehlschlaegt, geht der OCR-Text verloren (muss komplett neu)
   - Aenderungen am GPT-Prompt koennen OCR-Logik brechen (kaskadierende Fehler)
2. **Storage-Pfad stimmt nicht nach Review-Korrektur**
   - process-document legt Datei in Kategorie-Ordner (z.B. `Sonstiges_Dokument/`)
   - Review korrigiert `kategorie_manual` → DB stimmt, aber Datei bleibt im falschen Ordner
   - Aktuell kein Mechanismus der Storage-Pfad nachzieht

### Loesung: 3 Komponenten

**A) Stage 1: process-document-ocr (neue Edge Function, ~15-20s)**
- Download aus Storage + Validierung + File-Hash
- Duplikat-Check (file_hash + text_hash)
- Mistral OCR / Office-Extraktion
- `ocr_text` + `text_hash` in DB speichern
- Status: `pending_ocr` → `pending_categorize`
- Fehler: → `error_ocr`

**B) Stage 2: process-document-categorize (neue Edge Function, ~15-20s)**
- `ocr_text` aus DB lesen (KEIN File-Download, KEIN OCR)
- GPT Kategorisierung + Feld-Extraktion
- DB Update (Kategorie, extrahierte Felder)
- Ruft `move-document-storage` auf (oder inline)
- Status: `pending_categorize` → `done`
- Fehler: → `error_gpt`

**C) move-document-storage (neue Edge Function oder in Stage 2 integriert)**
- Verschiebt Datei von aktuellem Pfad in richtigen Kategorie-Ordner
- Updated `dokument_url` in DB
- Wird aufgerufen von:
  - Stage 2 nach Kategorisierung
  - admin-review nach `correct` (Kategorie-Korrektur)
- Idempotent: Wenn Datei schon im richtigen Ordner → noop

### Status-Flow

```
pending_ocr → pending_categorize → done
     ↓              ↓
  error_ocr     error_gpt (OCR-Text bleibt erhalten!)
```

### Aenderungen noetig

1. **DB:** Neuer Status `pending_categorize` + `error_ocr` + `error_gpt` im processing_status
2. **process-document:** Aufsplitten in 2 neue Functions
3. **batch-process-pending:** Zwei getrennte Schleifen (OCR-Batch + Kategorisierungs-Batch)
4. **admin-review:** Nach `correct` Action → `move-document-storage` aufrufen
5. **Storage-Strategie:** Neue Docs erstmal in `inbox/` oder direkt im Kategorie-Ordner (wie bisher)

### Vorteile

- Jede Stage <20s → 7 Docs pro Batch statt 3
- OCR-Text ueberlebt GPT-Fehler (kein erneuter OCR noetig)
- Prompt-Aenderungen koennen OCR nicht brechen
- Review-Korrekturen ziehen Storage-Pfad automatisch nach
- Retry nur die fehlgeschlagene Stage (spart Mistral-Kosten)
- Verschiedene Modelle/Params pro Stage moeglich

---

## [G-051] Aufgaben/Ticket-System mit Leerlauf-Aufgaben fuer Mitarbeiter
**Prio:** IDEE | **Aufwand:** Gross (Konzept → MVP → Ausbau) | **Status:** Ideensammlung

**Kern-Idee:**
Klassisches Aufgaben-/Ticketsystem fuer JS Fenster mit einem besonderen Feature:
Mitarbeiter koennen bei Leerlaeufen selbststaendig interne Aufgaben waehlen und ausfuehren.

**1. Klassisches Ticketsystem:**
- Aufgaben/Tickets fuer Kunden (Reparatur, Reklamation, Montage)
- Aufgaben fuer Lieferanten (Bestellung nachfassen, Retoure)
- Interne Aufgaben (Buero, Lager, Verwaltung)
- Status-Tracking, Zuweisung, Prioritaeten, Faelligkeiten

**2. Interne Leerlauf-Aufgaben (das Besondere):**
Wiederkehrende und einmalige Arbeiten, die Mitarbeiter bei Freizeit selbst waehlen koennen:

| Typ | Beispiele |
|-----|-----------|
| Wiederkehrend (Intervall) | Ueberdachung reinigen (alle 3-6 Monate), Parkplatz saeubern (Dreck/Unkraut), Lager Aussenbereich kehren |
| Einmalig | Feuerloescher Buero an Wand duebeln, Lager aussen verputzen, Regal aufbauen |

- Wiederkehrende Aufgaben werden automatisch nach Intervall-Ablauf wieder als "offen" angeboten
- Einmalige verschwinden nach Erledigung
- Mitarbeiter sehen eine Liste verfuegbarer Aufgaben und koennen sich selbst eine nehmen

**3. Automatische Leerlauf-Erkennung (Zukunft):**
- Wenn erkannt wird, dass ein Mitarbeiter frueher fertig ist UND der naechste Termin fix vereinbart ist
- System schlaegt passende Leerlauf-Aufgaben vor (nach Standort, Dauer, Faehigkeiten)
- Voraussetzung: Termin-System (G-011) + Echtzeit-Status der Monteure

**Abhaengigkeiten:**
- G-011 (Termin-System) fuer automatische Leerlauf-Erkennung
- G-012 (User-Management) fuer Mitarbeiter-Zuweisung
- Ggf. Mobile-Ansicht fuer Monteure vor Ort

---

## [G-050] GPT-Input verbessern: Strukturiertes Metadaten-JSON
**Prio:** MITTEL | **Aufwand:** 2-4 Std | **Voraussetzung:** v39 stabil

**Hebel 2 ERLEDIGT (v39, Deploy 65, 2026-03-05):**
- json_schema strict mit Enum-Constraint in process-document aktiviert
- Backtest: 89% (json_schema) vs 56% (json_object) bei 9 Montageauftrag-Docs
- Montageauftrag-Header-Regel: Formular-Header schlaegt Einzelpositionen im Body
- prompts.ts v4.3.0 deployed

**Verbleibender Hebel 1: Strukturiertes Metadaten-JSON**
- `{ "dateiname": "...", "quelle": "scanner|email", "ocr_text": "...", "seitenzahl": N, "dateigroesse_kb": N }`
- GPT kann Metadaten fuer bessere Entscheidungen nutzen
- Optional: Bilder mitliefern (GPT Vision) fuer Foto/Skizze-Erkennung

---

## [G-041] Notiz→Workflow Pipeline
**Prio:** HOCH | **Aufwand:** 8-16 Std | **Voraussetzung:** KI-Review Notiz abgeschlossen

**Kontext (2026-03-03):**
Das Kundennotiz-Formular ist der **zentrale Eingangskanal fuer Ausstellungskunden** (Laufkundschaft).
Frequenz: **2-20 pro Woche** (je nach Saison), geschaetzt **300-800/Jahr**.
Aktuell wird jeder Zettel manuell gelesen und abgearbeitet (~3-5 Min pro Stueck = 15-65 Std/Jahr).

**Erkenntnis aus KI-Review (Batch Notiz, 2026-03-02) + Andreas-Input:**
Die Kategorie "Notiz" enthaelt ~40 Dokumente die fast alle handgeschriebene Kundennotiz-Formulare,
Telefonnotizen oder Post-its sind. Darin stecken 6 klare Workflow-Typen:

| Muster | Beispiel | Workflow |
|--------|----------|----------|
| Bestellung | "2.5 SZ-027-CC bestellen, Abholung" | → Bestellvorgang + Lieferant kontaktieren |
| Ersatzteil-Bestellung | "Getriebe fuer BT links, Griff weiss" | → Ersatzteil-Bestellung + Kunde informieren |
| Reparaturauftrag | "BT klemmt, Gurt gerissen, Dichtung defekt" | → Serviceauftrag + Monteur zuweisen |
| Kundentermin | "Aufmass Kueche, naechste Woche" | → Kalender-Eintrag + Bestaetigung |
| Angebotsanfrage | "3 Fenster EG, Kunststoff weiss" | → Angebotsanfrage / Budgetangebot |
| Reklamation | "Fenster undicht seit Einbau" | → Reklamationsvorgang |

**Architektur:**
```
Scan/Upload → process-document (Kundennotiz erkannt)
                    ↓
            extract_action() [NEU]
                    ↓
    ┌──────────┬──────────┬──────────┬──────────┬──────────┐
 Bestellung  Ersatzteil  Reparatur  Termin   Angebot  Reklamation
    ↓           ↓           ↓         ↓         ↓         ↓
 Bestell-    Ersatzteil-  Service-  Kalender  Budget-   Reklama-
 vorgang     Bestellung   auftrag   Eintrag   angebot   tion
```

**GPT extrahiert zusaetzlich:**
- aktion_typ: bestellung | ersatzteil | reparatur | termin | angebot | reklamation
- kunde: Name, Adresse, Telefon, Email (aus Formularfeldern)
- artikel: Artikelnummer, Beschreibung, Menge, Preis (wenn vorhanden)
- problem_beschreibung: Freitext (bei Reparatur/Reklamation)
- gewuenschte_aktion: rueckruf | termin | angebot | abholung | lieferung (aus Checkboxen + Freitext)
- betroffenes_element: z.B. "Balkontuer EG", "Haustuer"
- dringlichkeit: hoch | normal

**Formular-Problem:** Aktuelles Papier-Formular hat nur 3 Checkboxen (Rueckruf/Termin/Angebot).
Die eigentliche Aktion steckt im Freitext "Grund" → GPT muss interpretieren.
Langfristig: Formular-Redesign (→ G-042) mit mehr Struktur.

**WICHTIG:** Erst nach Abschluss des Notiz-Reviews starten, um alle Muster zu kennen.

---

## [G-042] Handschriftliche Eingaenge: Formulare fuer GPT/Workflows optimieren
**Prio:** MITTEL | **Aufwand:** 4-8 Std | **Voraussetzung:** G-041 geplant

**Grundlegende Ueberlegung:**
Alle handgeschriebenen Eingaenge (Kundennotiz, Telefonnotiz, Aufmassblatt, Skizzen) muessen
hinsichtlich GPT-Lesbarkeit und Workflow-Eignung ueberdacht werden.

**Probleme aktuell:**
- Handschrift ist fuer OCR/GPT schwer lesbar (viele Fehlinterpretationen in den Zusammenfassungen)
- Kundennotiz-Formular hat nur 3 Checkboxen (Rueckruf/Termin/Angebot) - zu wenig fuer Workflows
- Keine klare Trennung zwischen Reparatur und Neuanfrage
- Keine Felder fuer: Element-Typ, Stockwerk, Dringlichkeit, Zeitfenster

**Optimierungsrichtung:**
1. **Formular-Redesign:** Bessere Struktur mit Ankreuzfeldern statt Freitext wo moeglich
2. **QR-Code/Barcode:** Formular-ID fuer automatische Zuordnung
3. **Checkbox-Erweiterung:** Reparatur/Beratung/Angebot/Reklamation
4. **Element-Typ Felder:** Fenster/Tuer/Rollladen/Haustuer/Sonstiges
5. **Pflichtfelder klar markiert** fuer konsistente Datenerfassung
6. **Eventuell Tablet-Erfassung** statt Papier (laengerfristig)

**WICHTIG:** Erst alle Notizen reviewen, dann Muster analysieren, dann Formulare entwerfen.

---

## [B-001] Haustuer-Matching (Budget)
**Prio:** HOCH | **Aufwand:** 4-8 Std

Groesster offener Hebel im Budgetangebot-Backtest. 544 Positionen mit 32.7% Median-Abweichung (vs. 9.6% bei Fenstern). Haustuer-Positionen werden aktuell schlecht gematcht weil:
- Stulp-Fenster als "haustuer" fehlkategorisiert (Hoehe<2200mm, L36)
- LV hat wenig Haustuer-Cluster
- Preisstruktur anders als Fenster (keine qm-Berechnung)

**Ansatz:** Eigene Matching-Logik oder LV-Erweiterung fuer Haustueren.

---

## [B-002] Budget UI/UX-Optimierungen
**Prio:** HOCH | **Aufwand:** 2.5-3.5 Std

2 verbleibende TODOs fuer Budgetangebot-Oberflaeche:

| # | Aufgabe | Aufwand |
|---|---------|---------|
| U3 | GPT-Output: Positionstext-Formatierung standardisieren | 2-3 Std |
| U4 | Vorschau: JS Fenster Firmendaten eintragen | 30 Min |

**Abhaengigkeiten:** U4 braucht Firmendaten von Andreas.

---

## [B-003] Teilrechnung: Eingabe-Optionen
**Prio:** NIEDRIG | **Aufwand:** 2-3 Std | **Abhaengigkeit:** G-006 (Erweiterte Dokumente)

Bei Teilrechnung soll Benutzer waehlen: Prozent vom Gesamtbetrag ODER fixer Betrag, bezogen auf Netto ODER Brutto. Aktuell rechnen Sachbearbeiter manuell.

**DB:** Felder `ist_teilrechnung`, `teilrechnung_prozent`, `teilrechnung_bezug` in erp_rechnungen.

---

## [B-004] Margin-Approval-System
**Prio:** NIEDRIG | **Aufwand:** 3-4 Std

Genehmigungsworkflow bei niedrigen Margen: MARGIN_TARGET=30%, MARGIN_CRITICAL=10%. Bei Unterschreitung muss Genehmigung eingeholt werden.

**Felder:** `marginApprovedPercent`, `marginApprovedBy`, `marginApprovedAt` in Auftraegen/Angeboten.

---

## [R-001] Reparatur-System
**Prio:** NIEDRIG | **Aufwand:** 8-12 Std

Neue Tabellen: `repairs`, `repair_parts`, `repair_notes`, `repair_photos` (Supabase Storage).
Status: OPEN→IN_PROGRESS→WAITING_PARTS→COMPLETED. Prioritaet: LOW/NORMAL/HIGH/URGENT.

---

## [R-002] Reparaturen-Seite im Dashboard
**Prio:** NIEDRIG | **Aufwand:** 4-6 Std | **Abhaengigkeit:** R-001 (Reparatur-System DB-Tabellen)

Nach Loeschung des alten Frontends fehlt die Reparaturen-Seite im Dashboard. Das alte Frontend hatte eine 94 KB Monster-Datei - muss sauber neu gebaut werden.

**Umsetzung:** Neue Seite `dashboard/src/pages/Reparaturen.jsx`.

---

## [G-001] Hardcoded Werte zentralisieren
**Prio:** HOCH | **Aufwand:** 10-15 Std

Firmendaten, MwSt (0.19), Montage-Preise (80/40/25 EUR), Zubehoer-Preise, System-Preise, Preisspanne (15%), Rundung (50 EUR) etc. sind ueberall im Code verstreut.

**Betroffene Dateien:**
- `dashboard/src/pages/budgetangebot/constants.js` (FIRMA_INFO, MWST_SATZ)
- `dashboard/src/lib/constants.js` (DOKUMENT_KATEGORIEN, AUFTRAG_STATUS)
- `backend/services/budget/priceCalculator.js` (WORK_PRICES, ACCESSORY_PRICES, SYSTEM_PRICES)
- `supabase/functions/budget-dokument/index.ts` (Firmendaten 4x)
- `supabase/functions/budget-ki/index.ts` (Montage-Preise)

**Loesung:** Supabase-Tabelle `app_config` (key/JSONB) + API-Endpunkt + Dashboard-Settings-Seite.
**Inkl.:** `constants.js` DOKUMENT_KATEGORIEN von API laden statt hardcoded.

---

## [G-002] Lieferanten-Verwaltung
**Prio:** HOCH | **Aufwand:** 4-6 Std

Neue Seite `dashboard/src/pages/Lieferanten.jsx`. Daten aus `erp_lieferanten` (bereits via Sync vorhanden) + Kontakte-System (`kontakte` wo `ist_lieferant = TRUE`).

**Funktionen:** Lieferanten-Liste mit Suche, Create/Edit Dialog, Kategorisierung (Fenster, Beschlaege, etc.), Portal-URL-Integration.

**Referenz:** ERP-Code in `erp-system-vite/src/pages/SuppliersPage.tsx`.

---

## [G-003] Bestellungen-Management
**Prio:** HOCH | **Aufwand:** 8-10 Std

Neue Seite `dashboard/src/pages/Bestellungen.jsx` + API-Endpunkt `/api/bestellungen`.

**Funktionen:** Status (DRAFT→ORDERED→PARTIAL→DELIVERED→CANCELLED), Lieferant-Zuordnung, Erwartungsdaten, Gesamtwertberechnung, Konfirmationsnummer-Tracking, Statistik-Karten.

**Referenz:** ERP-Code in `erp-system-vite/src/pages/OrdersPage.tsx`.

---

## [G-004] E-Mail Steuerrelevanz + Revisionssicherheit
**Prio:** MITTEL | **Aufwand:** 14-20 Std | **Abhaengigkeit:** Steuerberater-Rueckfrage

Fuer Betriebspruefung muessen steuerrelevante E-Mails vorgelegt werden koennen.

**3 Ebenen:**
1. **Klassifizierung:** Neues Feld `steuerrelevant` (ja/nein/pruefen) - auto-Mapping aus email_kategorie
2. **Archivierung:** .eml in Supabase Storage, SHA-256 Hash, GoBD-konform (6-10 Jahre)
3. **Sichtbarkeit:** `sichtbar_im_tool` Flag (verstecken ≠ loeschen), Betriebspruefungs-Export

**Offene Frage:** Reicht Body+HTML oder braucht man .eml? → Steuerberater klaeren.
**Weitere Felder:** `sensibel` (Datenschutz), `loeschsperre`, `archiviert_am`, `archiv_storage_path`.

---

## [G-005] Kalender mit FullCalendar
**Prio:** MITTEL | **Aufwand:** 6-8 Std

Neue Seite `dashboard/src/pages/Kalender.jsx`. Package: `@fullcalendar/react`.

**Funktionen:** 5 Ansichten (Monat, Woche, Tag, Liste, Team-Planung), Farb-Kodierung (Aufmass=Blau, Montage=Lila, Reparatur=Orange, Lieferung=Cyan), Ressourcen-Planung, deutsche Lokalisierung.

**DB:** Neue Tabelle `appointments` in Supabase. Integration mit `auftrag_status.montage_geplant`.

---

## [G-006] Erweiterte Dokumente
**Prio:** MITTEL | **Aufwand:** 10-12 Std

Erweiterung der bestehenden `dashboard/src/pages/Dokumente.jsx`. Aktuell: Two-Panel mit Preview und Filter. Fehlt: Detailbearbeitung, Positionsverwaltung, PDF-Export.

**Funktionen:** Dokumenttypen (Angebot/Auftrag/Rechnung), Status-Filter, Positionseditor, Steuersystem (Standard/Reverse Charge/Exempt), PDF-Druck.

---

## [G-007] Kontakt-Detail: Interaktive Summary-Cards
**Prio:** MITTEL | **Aufwand:** 2-4 Std

Alle Summary-Cards im KontaktDetailModal sollen klickbar sein:

| Card | Klick-Aktion |
|------|-------------|
| Projekte | Gefilterte Projektliste dieses Kunden |
| Angebotswert | Alle Angebote mit Betraegen |
| Rechnungen | Alle Rechnungen |
| Offene Rechnungen | Nur offene (faellig/ueberfaellig) |

**Umsetzung:** Klick scrollt zur ExpandableSection und oeffnet sie, oder eigene Filteransicht.

---

## [G-008] Betreuer-Referenz (Kontakte Phase 5)
**Prio:** MITTEL | **Aufwand:** 3-4 Std | **Abhaengigkeit:** Kontakt-System (M1-M4 FERTIG)

`referenz_kontakt_id` in `kontakt_personen` aktivieren. Wenn gesetzt: Person IST auch eigener Kunde, Kontaktdaten werden automatisch verlinkt (keine Doppelpflege).

**Zusaetzlich:** `ansprechpartner_id` + `rechnungsempfaenger_id` in `auftraege` Tabelle.

**Use Case:** Tochter Mueller betreut Mutter Schmidt → Kontaktdaten nur einmal pflegen.

---

## [G-009] Edge Functions aufsplitten
**Prio:** MITTEL | **Aufwand:** 6-8 Std

Grosse Edge Functions in Module aufsplitten (Token-Optimierung beim Einlesen):
- `process-document/index.ts` (1.437 Zeilen, ~13.300 Tokens)
- `process-email/index.ts` (1.118 Zeilen, ~10.100 Tokens)
- `email-webhook/index.ts` (982 Zeilen, ~8.800 Tokens)

**Ziel:** index.ts nur Orchestrierung (~500 Tokens), Rest in ocr.ts, categorization.ts, storage.ts, database.ts etc.

---

## [G-010] Status-Systeme vereinheitlichen
**Prio:** MITTEL | **Aufwand:** 2-3 Std

Aktuell zwei inkompatible Status-Systeme:
- WORKFLOW_STATUS (12 Zustaende, aus geloeschtem Frontend)
- AUFTRAG_STATUS in `dashboard/src/lib/constants.js` (8 Zustaende)

**Loesung:** In `_shared/constants.ts` zentralisieren, ein einheitliches System.

---

## [G-011] Termin-System
**Prio:** NIEDRIG | **Aufwand:** 6-8 Std | **Abhaengigkeit:** G-005 (Kalender)

Tabelle `appointments` mit Typen: MEASUREMENT, INSTALLATION, REPAIR, DELIVERY, MEETING.
Felder: plannedStart/End, actualStart/End, assignedToId, teamId, customerNotified, reminderSent.

**Aktuell:** `auftrag_status` hat nur `montage_geplant` (ein Datum). Kein vollstaendiges Termin-Management.

---

## [G-012] User-Management + Auth
**Prio:** NIEDRIG | **Aufwand:** 6-8 Std

Tabelle `users` mit Rollen: ADMIN, OFFICE, TECHNICIAN, USER. Aktuell: Service Role fuer alle Operationen, keine Zugriffskontrolle.

**Loesung:** JWT/Session-basiert (in CLAUDE.md Roadmap als "geplant" markiert).

---

## [G-013] Einstellungen mit Datensicherung
**Prio:** NIEDRIG | **Aufwand:** 3-4 Std

Erweitern der `dashboard/src/pages/Einstellungen.jsx`: Backup-Export als JSON, Backup-Import, Testdaten-Seed, Supabase-Verbindungsstatus.

---

## [G-014] Fehlende Scanner-Dateien nachholen
**Prio:** NIEDRIG | **Aufwand:** 1-2 Std

~40 Dateien vom 22.-23.01.2026 wurden gescannt aber nicht verarbeitet. Liegen in `\\appserver\Work4all`. Scanner-Problem wurde am 28.01.2026 behoben.

---

## [G-015] Workflow CLAUDE.md Duplikat aufloesen
**Prio:** NIEDRIG | **Aufwand:** 2-3 Std

`workflows/budgetangebote/CLAUDE.md` und `workflows/reparaturen/CLAUDE.md` sind zu 95% identisch (442 vs 460 Zeilen). Nur Abschnitt 9 (Projekt-Kontext) unterscheidet sich.

**Loesung:** Gemeinsame Basis in `workflows/_TEMPLATE/WORKFLOW_CLAUDE_BASE.md`, per Workflow nur Kontext-Abschnitt.

---

## [G-016] Kunden: Besteuerung
**Prio:** NIEDRIG | **Aufwand:** 2-3 Std

Steuertyp-Verwaltung pro Kunde: STANDARD, REVERSE CHARGE, EXEMPT. Freistellungsbescheinigung mit Nachweis und Gueltigkeitsdatum.

**Felder:** `steuertyp`, `freistellung_nachweis`, `freistellung_gueltig_bis` in kontakte oder erp_kunden.
**UI:** Kunden-Detailansicht erweitern.

---

## [B-005] Kundendaten: Weitere Felder
**Prio:** MITTEL | **Aufwand:** 2-4 Std

Der Kundendaten-Bereich im Budgetangebot zeigt aktuell nur: Kundenname, Telefon, E-Mail. Fehlende Felder:
- Anrede (Herr/Frau)
- Strasse + Hausnummer
- PLZ + Ort
- Projektname / Bauvorhaben
- Anmerkungen / Notizen

**Datei:** `dashboard/src/pages/budgetangebot/StepEingabe.jsx`
**Datenquelle:** Aus Kontakte-System (`kontakte` + `kontakt_personen` + `kontakt_details`) bei Kundenverknuepfung automatisch befuellen.

---

## [B-006] Positions-Struktur: Texte + Aussehen
**Prio:** MITTEL | **Aufwand:** 3-5 Std

Die Positionstabelle im Budgetangebot braucht optische und inhaltliche Ueberarbeitung:
- RAUM zeigt ueberall "unbekannt" → sinnvoller Default oder ausblenden
- BEZEICHNUNG: Texte aus GPT sind uneinheitlich formatiert (mal mit Komma, mal mit Klammern)
- Badges wie "raffstore" unter der Bezeichnung - Styling verbessern
- Spaltenbreiten optimieren (BEZEICHNUNG braucht mehr Platz)
- Einheitliche Schreibweise: "3-fach" vs "3fach", "DKL" vs "Dreh-Kipp Links"

**Datei:** `dashboard/src/pages/budgetangebot/StepPositionen.jsx`
**Zusammenhang:** Teilweise ueberschneidung mit B-002 U3 (GPT-Output Formatierung).

---

---

## [B-008] Angebote speichern + Verlauf im Dashboard
**Prio:** HOCH | **Aufwand:** 6-10 Std

Aktuell gehen erstellte Budgetangebote verloren sobald die Seite verlassen wird. Es fehlt:

**1. Speicherung:**
- Neues Angebot in Supabase speichern (Tabelle `budgetangebote` oder aehnlich)
- Alle Positionen, Kundendaten, Zusatzleistungen, Profilsystem, Preise persistent halten
- Verknuepfung zu Kontakt (`kontakt_id`) und ggf. Projekt

**2. Verlauf/Wiederanzeige:**
- Liste aller erstellten Budgetangebote im Dashboard (eigene Seite oder Tab)
- Angebot oeffnen → alle Daten wieder laden und anzeigen
- Status: Entwurf / Versendet / Angenommen / Abgelehnt
- Suchbar nach Kunde, Datum, Betrag

**3. Bearbeitung:**
- Gespeichertes Angebot erneut oeffnen und bearbeiten
- Neue Version erstellen (Versionierung)
- PDF erneut generieren

**DB-Entwurf (Vorschlag):**
- `budgetangebote` (id, kontakt_id, projekt_id, status, erstellt_am, version, netto_summe, brutto_summe, profilsystem, notizen)
- `budgetangebot_positionen` (id, budgetangebot_id, pos_nr, raum, typ, bezeichnung, breite, hoehe, menge, einzelpreis, gesamtpreis)

---

## [G-017] Angebotserstellung anhand einer Ausschreibung
**Prio:** MITTEL | **Aufwand:** 8-15 Std

Neues Feature fuer das gesamte Dashboard: Ein Ausschreibungs-Dokument (PDF/Scan) hochladen und daraus automatisch ein Angebot erstellen lassen.

**Ablauf:**
1. Nutzer laedt Ausschreibung hoch (PDF, Scan, Bild)
2. OCR + KI extrahiert Positionen (Fenstertypen, Masse, Mengen, Anforderungen)
3. Positionen werden in Budgetangebot-Format ueberfuehrt
4. Nutzer prueft/korrigiert und erstellt Angebot

**Abhaengigkeiten:** Nutzt bestehende OCR-Pipeline (process-document) + Budgetangebot-Logik (budget-ki).
**Datei:** Neue Seite oder Integration in bestehende Budgetangebot.jsx.

---

## [G-018] Dokument-Namensformatierung pro Kunde (E-Mail-Versand)
**Prio:** MITTEL | **Aufwand:** 2-4 Std | **Abhaengigkeit:** E-Mail-Versand von Rechnungen (noch nicht implementiert)

Beim E-Mail-Versand von Rechnungen und Anhaengen muessen Dokumente bei bestimmten Kunden eine spezielle Dateinamen-Formatierung haben (z.B. Rechnungsnummer_Kundenname_Datum.pdf o.ae.).

**Anforderungen:**
- Pro Kunde konfigurierbar, welches Namensformat fuer Dokument-Anhaenge gilt
- Platzhalter-System (z.B. `{rechnungsnr}`, `{kunde}`, `{datum}`, `{dokumenttyp}`)
- Default-Format fuer Kunden ohne spezielle Anforderung
- Einstellbar ueber Kunden-Detailansicht oder Einstellungen

**DB:** Neues Feld `dokument_namensformat` in `kontakte` oder eigene Konfigurationstabelle.

---

## [G-019] Mehrere E-Mail-Adressen pro Kunde
**Prio:** MITTEL | **Aufwand:** 2-3 Std

Im Kundenstamm sollen mehrere verschiedene E-Mail-Adressen hinterlegt werden koennen, jeweils mit Zweck/Typ:

**E-Mail-Typen (Beispiele):**
- Rechnungs-E-Mail (fuer Rechnungsversand)
- Bestell-E-Mail (fuer Auftragsbestaetigungen)
- Allgemeine E-Mail (Hauptkontakt)
- Buchhaltungs-E-Mail
- Technische E-Mail (fuer Montage-Koordination)

**Anforderungen:**
- Mehrere E-Mail-Adressen pro Kontakt mit Typ-Zuordnung
- Beim Versand automatisch die richtige Adresse je nach Dokumenttyp vorschlagen
- Eine Adresse als "Standard" markierbar

**DB:** Erweiterung von `kontakt_details` (hat bereits `typ`-Feld fuer email/telefon etc.) oder eigene Zuordnungstabelle `kontakt_email_typen`.
**UI:** Kunden-Detailansicht erweitern (KontaktDetailModal).

---

## [G-020] Kunden-Bestellnummer / Projektnummer (Pflichtfeld-Hinweis)
**Prio:** MITTEL | **Aufwand:** 3-5 Std

Manche Kunden verlangen, dass ihre eigene Bestellnummer oder Projektnummer auf allen Dokumenten (Angebote, Auftragsbestaetigungen, Rechnungen) erscheint.

**Anforderungen:**
- Im Kundenstamm aktivierbar: "Kunde erfordert Bestellnummer/Projektnummer"
- Wenn aktiviert: Bei jedem neuen Vorgang (Angebot, Auftrag, Rechnung) wird geprueft ob das Feld befuellt ist
- Falls leer: Deutlicher Warnhinweis/Pflichtfeld-Markierung, bevor Vorgang gespeichert/versendet wird
- Mehrere Nummern pro Kunde moeglich (verschiedene Projekte)
- Nummer erscheint auf allen zugehoerigen Dokumenten (PDF, E-Mail-Betreff etc.)

**DB:**
- Neues Feld `erfordert_bestellnummer` (BOOLEAN, Default: false) in `kontakte`
- Neues Feld `kunden_bestellnummer` / `kunden_projektnummer` in Vorgangstabellen (auftraege, budgetangebote, rechnungen)

**UI:**
- Kunden-Detailansicht: Toggle "Bestellnummer erforderlich" + ggf. Standard-Projektnummer
- Vorgangs-Erstellung: Eingabefeld mit Pflichthinweis wenn aktiviert
- Warnung/Blockierung beim Speichern/Versenden wenn Feld leer und Pflicht aktiv

---

## [G-029] Ud-Wert Rechner (Tueren)
**Prio:** MITTEL | **Aufwand:** 4-6 Std

Normgerechter Ud-Wert-Rechner nach EN ISO 10077-1:2017 ins Auftragsmanagement einbauen.

**Formel:** Ud = (Af×Uf + Ap×Up + lp×Ψp) / Aw

**Funktion:**
- Eingabe: Profilsystem + Paneel + Tuermasse (Breite × Hoehe)
- Ausgabe: Ud-Wert in W/(m²K)
- Profildatenbank mit gaengigen Systemen (Uf, Ansichtsbreiten, Schwellenbreiten)
- Paneel-Datenbank (Up, Ψp)

**Referenz-Beispiel (ROKA ZS-3669-2024):**
- System: Wicona 75 EVO_RK mit Daemmprofil
- Tuer: 1110 × 2235 mm
- Uf: 1,6 W/(m²K) | Up: 0,44 W/(m²K) | Ψp: 0,000 W/(m·K)
- Ansichtsbreite seitlich/oben: ~131 mm | Schwelle: ~87 mm
- Ergebnis: Ud = 0,81 W/(m²K)

**Voraussetzung:** Exakte Profilansichtsbreiten aus Wicona-Datenblaettern (statt rueckgerechnet) fuer normgenaue Ergebnisse.

**Erweiterbar auf:** Uw-Berechnung fuer Fenster (gleiche Formel, Glas statt Paneel).

---

## [G-032] Email-Versand-Architektur
**Prio:** HOCH | **Aufwand:** 15-25 Std | **Abhaengigkeit:** G-021 (Email-Kategorien)

Emails aus dem Auftragsmanagement versenden mit vollstaendigem Status-Tracking. Grundsatzentscheidung noetig: Eigene Email-UI vs. Outlook-Integration.

**Option A: Eigene Email-UI im Auftragsmanagement**
- Vorteil: Volle Kontrolle, kein Outlook-Abhaengigkeit, laeuft ueberall
- Vorteil: Status (Entwurf/Gesendet/Fehlgeschlagen) sofort im System
- Nachteil: Email-Editor bauen (Formatierung, Anhaenge, Signatur)
- Nachteil: SMTP/Graph API direkt anbinden
- Tech: Microsoft Graph `sendMail` API oder SMTP

**Option B: Outlook-Integration (Compose-Fenster)**
- Vorteil: Gewohnte Outlook-Oberflaeche, Signatur automatisch
- Nachteil: Outlook buggt regelmaessig unter Windows
- Nachteil: Erkennung ob Email tatsaechlich gesendet wurde (Graph Webhook auf Sent Items)
- Nachteil: Entwuerfe schwerer zu tracken
- Tech: Graph Draft erstellen + Outlook Deep Link, Webhook auf Sent Items

**Status-Tracking (beide Optionen):**
- `email_versand_status`: entwurf | wird_gesendet | gesendet | fehlgeschlagen
- `email_versand_fehler`: Fehlermeldung bei Fehlschlag
- `email_versand_am`: Timestamp
- `bezug_dokument_id`: Link zum Angebot/Rechnung/AB das verschickt wurde

**Sende- und Lesebestaetigung:**
- Sendebestaetigung (Delivery Receipt): Bestaetigung dass Email zugestellt wurde
- Lesebestaetigung (Read Receipt): Bestaetigung dass Empfaenger Email geoeffnet hat
- Beides per Graph API anforderbar (`isDeliveryReceiptRequested`, `isReadReceiptRequested`)
- Bestaetigungen werden NICHT im Postfach/Tool angezeigt, sondern nur im Email-Verlauf dokumentiert
- DB-Felder: `zugestellt_am`, `gelesen_am` (automatisch befuellt wenn Receipt eingeht)

**Workflow-Trigger bei Versand:**
- Angebot versendet → Angebot-Status auf "gesendet"
- Rechnung versendet → Rechnung-Status auf "versendet"
- AB versendet → AB-Status auf "versendet"
- Mahnung versendet → Mahnung-Status auf "versendet"

**Weitere Aspekte (zu besprechen):**
- Email-Vorlagen pro Dokumenttyp (Angebot-Anschreiben, Rechnungs-Anschreiben, Mahnung)
- CC/BCC-Regeln (z.B. Buchhaltung automatisch in CC bei Rechnungen)
- Anhang-Benennung pro Kunde (→ G-018)
- Mehrere Empfaenger-Adressen pro Kunde (→ G-019)
- Email-Verlauf/Thread pro Vorgang (alle Emails zu einem Angebot/Auftrag gruppiert)
- Wiedervorlage bei fehlgeschlagenem Versand (automatischer Retry oder Benachrichtigung)
- Signatur-Verwaltung (pro Mitarbeiter oder Firmen-Signatur)
- Anhaenge: Automatisch das richtige Dokument (PDF) anhaengen oder manuell waehlen?

**Entscheidung:** Mit Andreas besprechen - eigene UI vs. Outlook. Outlook-Instabilitaet unter Windows ist ein Argument fuer eigene UI.

---

---

## [G-031] Kategorien-Bereinigung (nach Review-Durchlauf)
**Prio:** MITTEL | **Aufwand:** 3-6 Std | **Abhaengigkeit:** Aktueller KI-Review muss abgeschlossen sein

Nach dem Review-Durchlauf pruefen: Welche Kategorien sind zu allgemein und sollten in detailliertere aufgespalten werden? Beispiel: Mahnung → Mahnung_Eingehend/Ausgehend.

**Konkrete Kandidaten (2026-03-03):**

1. **~~"Notiz" → "Kundennotiz" (NEU)~~ GESTRICHEN (2026-03-05)**
   - Erkenntnis K-019: Zweck > Format. "Kundennotiz" beschreibt nur das Traegermedium (Formular), nicht den Zweck
   - Alle 34 ex-"Kundennotiz"-Docs sind jetzt **Anfrage_Eingehend** (Kunde will Angebot/Reparatur/Ersatzteil)
   - 12 interne Notizen (Telefonnotizen, Auftragsvermerke) bleiben **Notiz**
   - Fuer Workflows zaehlt der Aktionstyp, nicht das Papierformat

2. **"Anfrage_Eingehend" - Prompt-Erkennung verbessern**
   - **Kern-Erkenntnis (K-019 Review 2026-03-05):** GPT kategorisiert nach DOKUMENTFORMAT (Bauplan, Skizze, Aufmassblatt), aber die richtige Kategorie ergibt sich aus dem ZWECK/KONTEXT
   - **WICHTIG:** Nicht pauschal "Aufmassblatt→Anfrage" umleiten! Echte Aufmassblätter bleiben Aufmassblatt. Das Problem: GPT hat Docs FALSCH als Aufmassblatt/Bauplan/Skizze erkannt, die eigentlich Anfragen waren.
   - **Prompt-Anpassung noetig:** GPT muss den ZWECK des Dokuments erkennen, nicht nur das Traegermedium:
     - Bauplan mit handschriftlichen Anfragenotizen → Anfrage_Eingehend
     - Kundenzeichnung/Skizze mit konkretem Anliegen (Angebot, Reparatur, Ersatzteil) → Anfrage_Eingehend
     - Spezifikations-Aufnahme bei Kundentermin in Ausstellung → Anfrage_Eingehend
     - Begleitdokumente zu LVs/Ausschreibungen → Anfrage_Eingehend (gehoeren zum Vorgang)
     - ABER: Reines Aufmassblatt (tatsaechliche Vermessung) → bleibt Aufmassblatt
   - **Typische Signale fuer Anfrage:** Handschriftliche Ergaenzungen wie "ohne Montage", "inkl. Lieferung", "Dreh/Kipp", nummerierte Positionen, Kundennamen/Adressen am Rand, "Ausstellung", Preisnotizen
   - **Referenz-Docs fuer Prompt-Verfeinerung (OCR nochmal pruefen!):**
     - `c07afd9f` (Nr3) - Kunde Ausstellung, GPT sagte Aufmassblatt → war keins
     - `6945e46a` (Nr5) - Bauplan mit Anfragenotizen, GPT sagte Bauplan
     - `03cf8d72` (Nr6) - Ersatzteilanfrage Ausstellung, GPT sagte Skizze
     - `5bb6da27` (Nr10) - Spezifikationen Ausstellungstermin, GPT sagte Aufmassblatt → war keins
     - `82c02e23` (Nr15) - Bauplan mit Anfragenotizen, GPT sagte Bauplan
     - `a1175bf1` (Nr16) - Begleitdokument LV, GPT sagte Aufmassblatt → war keins
     - `a4269f87` (Nr20) - Kundenanfrage mit Skizze, GPT sagte Skizze
     - `16271418` (Nr21) - Begleitdokument LV, GPT sagte Aufmassblatt → war keins
     - `eda49a41` (Nr26) - Anfrage neue Fenster mit Zeichnungen, GPT sagte Bauplan
   - **Spaeter:** Pruefen ob Split sinnvoll (z.B. nach Aktionstyp: Angebotanfrage, Reparaturanfrage, Ersatzteilanfrage)

3. **Weitere Kandidaten (aus kategorie_fehlerrate View):**
   - Alle Kategorien ohne _Eingehend/_Ausgehend Suffix
   - Kategorien mit hoher Fehlklassifizierungsrate (Sonstiges 86%, Skizze 83%, Formular 58%)
   - Kategorien mit >50 Docs die heterogene Inhalte haben

**Voraussetzung:** K-017 Review muss abgeschlossen sein, damit die Datenbasis stimmt.
**Reihenfolge:** G-031 (Bereinigung) → G-041 (Workflow-Pipeline)

---

## [G-033] Globale Duplikat-Erkennung Email-Anhaenge
**Prio:** MITTEL | **Aufwand:** 2-4 Std

Aktuell wird file_hash nur innerhalb einer Email geprueft. Wenn derselbe Anhang in einer Weiterleitung ("WG:") nochmal kommt, wird er als neues Dokument angelegt. Beispiel: Hauptwetter_26.pdf kam 2x mit identischem Hash.

**Loesung:**
- Beim Anlegen eines email_attachment: Globaler Check ob file_hash schon existiert
- Wenn ja: Dokument als Duplikat markieren oder gar nicht erst anlegen
- Optional: Referenz auf das Original-Dokument speichern
- Betrifft: `process-email` bzw. Anhang-Pipeline

---

## [G-034] OCR-Korrektur + Feinere Klassifizierung
**Prio:** HOCH | **Aufwand:** 8-16 Std

**Problem:** OCR-Fehler fuehren zu Fehlklassifizierungen. Dokumente die falsch zugeordnet sind, koennen spaeter nicht sauber automatisiert werden. Saubere Grunddaten sind Voraussetzung fuer alles was darauf aufbaut.

**Schritt 1: OCR-Korrektur in `process-document` einbauen**
- Nach OCR: LLM bereinigt den Text (Tippfehler, Formatierung, Sonderzeichen)
- Bereinigter Text wird in DB gespeichert (verbessert Suche, Embeddings, Klassifizierung)
- Einbauen VOR der Klassifizierung in der bestehenden Pipeline

**Schritt 2: Strukturierte Datenextraktion (einmalig pro Dokument) - ERLEDIGT**
- ✓ process-document extrahiert bereits: aussteller, empfaenger, positionen, summen, bezug, bank, mahnung etc.
- ✓ Schema in `schema.ts` mit 40+ Feldern (ExtractedDocument Interface)
- ✓ Daten werden in `documents` JSON-Spalten gespeichert

**Schritt 3: Feinere Kategorien einfuehren - TEILWEISE ERLEDIGT**
- ✓ 50→60 Kategorien (v3.0→v4.0): Splits (Mahnung, Kassenbeleg, Gutschrift, Retoure) + 9 Neue
- Offen: `Anfrage_Eingehend` aufspalten (Reparaturanfrage, Reklamation, Preisanfrage)
- Offen: Weitere Splits nach KI-Review-Auswertung (→ G-031, G-043)

**Spaeter (nicht Teil dieses Tickets):**
- Workflow-Trigger basierend auf Kategorien (Reparatur → Monteur, Reklamation → Vorgang, etc.)
- Sub-Kategorisierung per zweiter LLM-Stufe wo noetig
- Sprachnachrichten, weitere Eingangs-Kanaele

**Kosten-Argument:** LLM-Korrektur im Cent-Bereich pro Dokument vs. manuelle Nachkorrektur im Euro-Bereich pro Minute.

**Voraussetzung:** `process-document` ist geschuetzt → Backtest noetig vor Aenderung

---

## [G-038] Brief_ausgehend-Bereinigung + Richtungsregel
**Prio:** NIEDRIG | **Aufwand:** 1 Std
**Hinweis:** 9 neue Kategorien (Vorlage, Versicherung, Privat, Foerderantrag, Gutschein, Schliessanlage, Garantie, Bescheinigung, Veranstaltung) sind ERLEDIGT (v4.0.0, 2026-02-27).

**Offen:**
1. **Brief_ausgehend-Bereinigung (3 Docs):**
   - Dok `9540679a` (JS Briefpapier SEPA fuer Druckerei) → Vorlage verschieben
   - Dok `8b0684c8` + `29c48705` (JHV Einladung, Duplikat) → Brief_eingehend + Duplikat loeschen

2. **Prompt-Richtungsregel (Brief_eingehend/ausgehend):**
   - Eingehend/Ausgehend nach **JS Fenster Perspektive**, NICHT physischer Absender
   - Ausgehend = Im Namen/Auftrag von JS Fenster (auch Anwalts-/Steuerberaterschreiben)
   - Eingehend = Von Dritten an JS Fenster
   - In prompts.ts einarbeiten (→ wird mit G-043 zusammen erledigt)

---

## [G-039] Auto-Split Multi-Dokument PDFs
**Prio:** MITTEL | **Aufwand:** 6-10 Std | **Abhaengigkeit:** G-034 (OCR-Korrektur)

Automatisches Erkennen und Aufteilen von PDFs die mehrere eigenstaendige Dokumente enthalten (z.B. Uebergabeprotokoll + Darlehensantrag + SEPA-Mandat in einer PDF).

**Ablauf (in process-document):**
1. GPT analysiert OCR-Text: "Enthaelt diese PDF mehrere eigenstaendige Dokumente?"
2. Wenn ja: Pro Block `{seiten, kategorie, titel, zusammenfassung}` zurueckliefern
3. Wenn nein: Normaler Single-Dokument-Flow (kein Split)
4. PDF wird seitenbasiert aufgeteilt (pdf-lib)
5. Jeder Block wird als eigenes Dokument angelegt mit eigener Kategorie
6. Verbindung ueber `parent_document_id` bleibt immer erhalten

**DB-Erweiterung:**
```sql
ALTER TABLE documents ADD COLUMN parent_document_id UUID REFERENCES documents(id);
ALTER TABLE documents ADD COLUMN split_seiten TEXT;      -- z.B. "4-8"
ALTER TABLE documents ADD COLUMN split_label TEXT;        -- z.B. "Darlehensantrag"
```

**Regeln:**
- Nur splitten wenn klar eigenstaendige Bloecke (anderer Briefkopf, Dokumenttyp, Absender)
- Bei Unsicherheit: KEIN Split (lieber ein Dokument zu viel als falsch getrennt)
- Original-PDF bleibt als Parent erhalten (wird nie geloescht)
- Im Review Tool: Verknuepfte Dokumente als Gruppe anzeigen
- Vollautomatisch ohne menschlichen Eingriff

**Fehlertoleranz:**
- Kein Split erkannt → bleibt wie heute (kein Schaden)
- Falscher Split → im Review korrigierbar (Bloecke wieder zusammenfuehren)

**Beispiel:** Mercedes-Paket (Dok ac26b130): 3 Bloecke → Leasing + Finanzierung + Finanzierung

---

## [G-043] Prompt-Optimierung aus KI-Review-Erkenntnissen
**Prio:** HOCH | **Aufwand:** 4-8 Std | **Abhaengigkeit:** KI-Review-Durchlauf weitgehend abgeschlossen

**Ziel:** Systematischer Feedback-Loop: Alle Korrekturen aus dem KI-Review auswerten, GPT-Fehlmuster identifizieren, Prompts in `prompts.ts` optimieren, Backtest durchfuehren.

**Datengrundlage (Stand 2026-03-02):**
- 473 korrigierte Dokumente (`review_status = 'corrected'`)
- Davon ~250 echte Umklassifizierungen (kategorie != kategorie_manual)

**Top GPT-Fehlmuster (haeufigste Verwechslungen):**

| GPT-Kategorie | Korrigiert zu | Anzahl | Ursache / Prompt-Fix |
|---------------|--------------|--------|---------------------|
| Sonstiges_Dokument | Bild | 40 | Fotos ohne Text werden als "sonstig" statt "Bild" erkannt |
| Skizze | Aufmassblatt | 30 | Handskizzen MIT Massen = Aufmassblatt, OHNE = Skizze |
| Montageauftrag | Serviceauftrag | 14 | Reparatur-Einsaetze sind Serviceauftraege, nicht Montage |
| Produktdatenblatt | Bild | 12 | Einzelfotos von Produkten sind Bilder, nicht Datenblaetter |
| Anfrage_Ausgehend | Anfrage_Eingehend | 7 | Richtungs-Verwechslung (JS-Perspektive nicht klar) |
| Lieferschein_Eingehend | Bild | 7 | Lieferfotos sind keine Lieferscheine |
| Formular | Foerderantrag | 7 | BAFA/KfW-Formulare = Foerderantrag (neue Kategorie) |
| Sonstiges_Dokument | Montageauftrag | 5 | Outlook-Termine mit Montage-Infos |
| Notiz | Aufmassblatt | 4 | Outlook "Bestellaufmass" + handschr. Masse = Aufmassblatt |
| Formular | Schliessanlage | 3 | Schliesspläne/Sicherungskarten = Schliessanlage |
| Bauplan | Anfrage_Eingehend | 3 | Bauplan MIT handschriftl. Angebotsnotizen = Anfrage, nicht Bauplan |

**Erkenntnisse aus dem Notiz-Review (2026-03-02):**
- Outlook-Termin-Ausdrucke mit "Bestellaufmass/Angebotsaufmass" + handschriftliche Masse → Aufmassblatt
- Outlook-Termin + Erledigungsnotizen → Serviceauftrag
- Technische Zeichnung mit Bemaßung (z.B. Kupferwinkel) → Skizze
- Google-Maps-Screenshot → Bild

**Ablauf:**
1. Alle `corrected` Docs mit `kategorie != kategorie_manual` exportieren
2. Pro Fehlmuster: Docs stichprobenartig ansehen, Ursache verstehen
3. Prompt-Hints in `prompts.ts` ergaenzen (NICHT/Abgrenzung-Regeln)
4. Optional: Heuristic Rules in `categories.ts` erweitern
5. Backtest mit `classify-backtest` Edge Function
6. Bei Verbesserung: process-document deployen (mit Andreas-Freigabe)

**Metriken:**
- Ziel: Top-10 Fehlmuster um >50% reduzieren
- Messung: Vor/Nach-Vergleich der Fehlklassifizierungsrate

---

## ~~[G-044] HEIC-Support~~ → ERLEDIGT (v38, deployed 2026-03-05)
Pragmatischer Ansatz: Mistral-OCR-Versuch + Bild-Fallback. Kein WASM-Konverter.

---

## ~~[G-045] Upload-Filter~~ → ERLEDIGT (v38, deployed 2026-03-05)
Extension-Whitelist + Bilder <5KB auto-"Bild". .lnk wird jetzt abgelehnt (HTTP 400).

---

## [G-046] Neue Kategorie "Kundenunterlage" + .ics-Support
**Prio:** NIEDRIG | **Aufwand:** 2-3 Std

**1. Kategorie "Kundenunterlage":**
Dokumente die Kunden mitbringen/zuschicken und NICHT an JS Fenster adressiert sind:
- Rechnungen von Wettbewerbern/anderen Firmen (Preisvergleich)
- Angebote von Dritten
- Alte Auftraege, Bauplaene vom Vorbesitzer
- Ersatzteil-Dokumente anderer Hersteller

Abgrenzung: Dokument ist NICHT von JS und NICHT an JS gerichtet, sondern Fremd-Dokument das der Kunde als Referenz bereitstellt.

**2. .ics Kalender-Support:**
- `.ics` zu `ALLOWED_EXTENSIONS` in process-email hinzufuegen
- Kalender-Metadaten extrahieren (SUMMARY, DTSTART, DTEND, LOCATION) statt OCR
- In documents-Tabelle speichern (betreff, termine, etc.)
- Kategorie: ggf. eigene Kategorie "Termin" oder unter bestehende einordnen

**Wartende Dokumente (nach Umsetzung neu kategorisieren):**
- `216f7015` (Immergy...ics) → .ics verarbeiten + Kategorie zuweisen
- `3295756f` (188.HEIC) → nach G-044 (HEIC-Konverter) verarbeiten + Kategorie zuweisen
- `97e1a2fd` (72f12653...pdf, HOVEBA-Rechnung an Strobl) → Kundenunterlage

**Betroffene Dateien:**
- `supabase/functions/_shared/categories.ts` (neue Kategorie)
- `supabase/functions/process-document/prompts.ts` (Prompt-Hint)
- `supabase/functions/process-document/schema.ts` (Enum)
- `supabase/functions/process-email/index.ts` (ALLOWED_EXTENSIONS + .ics Parser)
- DB: CHECK Constraint aktualisieren
- Frontend: constants.js + Review-Tool Filter

---

## [G-040] Dokument-Beziehungen (Querverweise)
**Prio:** HOCH | **Aufwand:** 8-12 Std | **Abhaengigkeit:** G-033 (Duplikate), G-039 (Split)

Zusammengehoerige Dokumente automatisch verknuepfen. Aktuell existieren Dokumente isoliert - eine AGB weiss nicht, zu welcher Rechnung sie gehoert. Eine Zeichnung weiss nicht, zu welchem Auftrag sie geliefert wurde.

**DB-Erweiterung:**
```sql
CREATE TABLE document_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id_a UUID REFERENCES documents(id) NOT NULL,
  document_id_b UUID REFERENCES documents(id) NOT NULL,
  relation_type TEXT NOT NULL,  -- 'anlage_zu', 'version_von', 'duplikat_von', 'gehoert_zu'
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT DEFAULT 'system',
  UNIQUE(document_id_a, document_id_b, relation_type)
);
```

**Relation Types:**
- `anlage_zu` - AGB ist Anlage zu Rechnung/Bestellung
- `gehoert_zu` - Zeichnung gehoert zu AB/Auftrag
- `version_von` - Neue AGB-Fassung ersetzt alte
- `duplikat_von` - Identisches Dokument (aus G-033)

**Automatische Erkennung (in process-email / process-document):**
- Email-Anhaenge die zusammen kommen → automatisch verknuepfen
- AGB/Widerrufsrecht + Rechnung aus gleicher Email → `anlage_zu`
- Zeichnung + AB aus gleicher Email → `gehoert_zu`
- Gleicher file_hash → `duplikat_von`
- Bei Duplikat-AGB: Nur einmal speichern, Relation zu allen zugehoerigen Docs

**Deduplizierung (AGB-Beispiel):**
- Erste AGB von Lieferant X: Normal speichern
- Gleiche AGB nochmal: Nicht neu anlegen, nur `anlage_zu` Relation zur neuen Rechnung
- Neue AGB-Fassung: Als neues Dok speichern + `version_von` alte AGB

**UI (Review Tool + Dokumente-Seite):**
- Bei jedem Dokument: "Verknuepfte Dokumente" Abschnitt
- Klick auf Verknuepfung oeffnet das verknuepfte Dokument
- Manuelles Verknuepfen per Drag&Drop oder Suche

**Beispiele:**
- Rechnung 260092 ←anlage_zu→ AGB + Widerrufsrecht + Zahlungsbedingungen
- AB von WERU ←gehoert_zu→ Zeichnung + Produktdatenblatt
- Lieferschein ←gehoert_zu→ Bestellung

---

## [G-047] Confidence-Score fuer Klassifizierung
**Prio:** MITTEL | **Aufwand:** 3-5 Std
**Ausloeser:** K-017 Backtest (2026-03-03) - kein Confidence in DB, kein Auto-Confirm moeglich

**Problem:**
GPT klassifiziert Dokumente, aber wir speichern keinen Confidence-Score. Dadurch:
- Kein Auto-Confirm bei hoher Sicherheit (alles muss manuell reviewed werden)
- Keine Smart Review-Queue (unsichere oben, sichere unten)
- Kein Prompt-Monitoring (Verschlechterung nicht erkennbar)
- Backtests koennen nicht zwischen sicher/unsicher unterscheiden

**Umsetzung in 3 Schritten:**

**Schritt 1: classify-backtest (ungefaehrlich, kein Prod-System)**
- GPT-Prompt um `confidence` (0-100) erweitern
- Response-Schema anpassen: `{kategorie, confidence, begruendung}`
- Backtest-Ergebnisse enthalten dann Confidence pro Dokument
- Analyse kann sofort confidence-basiert filtern

**Schritt 2: DB-Spalte anlegen**
```sql
ALTER TABLE documents ADD COLUMN kategorie_confidence NUMERIC;
```

**Schritt 3: process-document (GESCHUETZT - nur mit Andreas-Freigabe)**
- GPT-Prompt analog erweitern
- Confidence in DB speichern bei jeder Klassifizierung
- Review-Tool: Confidence anzeigen, sortierbar machen

**Langfristiger Nutzen:**
- Auto-Confirm: Confidence > 90% + Agreement → kein Review noetig
- Smart Queue: Niedrige Confidence → oben in der Review-Liste
- Prompt-Monitoring: Durchschnittliche Confidence tracken ueber Zeit
- Backtest-Analyse: Unsichere Faelle gezielt identifizieren
- Weniger Review-Aufwand fuer Andreas bei gleichbleibender Qualitaet

**Hinweis:** GPT 5.2 hat kein Temperature-Parameter mehr. Confidence muss ueber Prompt-Instruktion ("Bewerte deine Sicherheit 0-100") erhoben werden, nicht ueber Modell-Logprobs.

**Ergaenzung:** `kategorisiert_von` konsequent mit Prompt-Version befuellen (z.B. "process-document-v4.1.0"). Dann kann man per Query die Confidence pro Version vergleichen und sehen ob der Prompt besser oder schlechter wurde.

---

## [G-048] Drift-Erkennung: Kategorie-Verteilungs-Monitoring
**Prio:** MITTEL | **Aufwand:** 2 Std | **Abhaengigkeit:** Keine

**Problem:** Wenn ein Prompt-Update oder GPT-Modell-Wechsel die Klassifizierung verschlechtert, merken wir das erst beim naechsten manuellen Review - Wochen spaeter.

**Loesung:** pg_cron Job (woechentlich) der die Kategorie-Verteilung der letzten 7 Tage mit den 30 Tagen davor vergleicht.

**Alarm-Logik:**
```sql
-- Wenn eine Kategorie >20% Abweichung vom Durchschnitt hat → Warnung
-- Wenn "Sonstiges_Dokument" > 10% aller neuen Docs → Alarm
-- Wenn eine Kategorie ploetzlich 0 Docs hat die vorher regelmaessig kam → Warnung
```

**Ergebnis speichern in:**
- Neue Tabelle `system_alerts` (typ, nachricht, created_at, resolved_at)
- Optional: Telegram-Benachrichtigung ueber bestehenden @JS_Fotobot

**Verworfene Alternativen:**
- Absender-Profil als GPT-Hint: Risiko dass GPT in falsche Richtung gefuehrt wird
- Dateiname/Groesse als Vorstufe: Gleiche Gefahr, GPT folgt Hint blind statt Inhalt zu lesen

---

## [G-049] Kategorie-spezifische Fehlerrate
**Prio:** NIEDRIG | **Aufwand:** 1 Std | **Abhaengigkeit:** G-047 (Confidence)

**Problem:** Wir wissen nicht welche Kategorien zuverlaessig klassifiziert werden (99% Rechnung_Eingehend) und welche fehleranfaellig sind (60% Aufmassblatt vs Skizze).

**Loesung:** SQL-View oder materialized View:
```sql
SELECT kategorie,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE review_status = 'corrected' AND kategorie != kategorie_manual) AS fehler,
       ROUND(100.0 * COUNT(*) FILTER (WHERE review_status = 'corrected' AND kategorie != kategorie_manual) / COUNT(*), 1) AS fehlerrate_pct,
       AVG(kategorie_confidence) AS avg_confidence
FROM documents
GROUP BY kategorie
ORDER BY fehlerrate_pct DESC
```

**Nutzen:**
- Prompt-Optimierung gezielt auf schwache Kategorien fokussieren
- Review-Aufwand priorisieren (schwache Kategorien zuerst)
- Zusammen mit G-047 (Confidence): Kategorien mit niedriger Confidence + hoher Fehlerrate = Prompt-Baustelle
