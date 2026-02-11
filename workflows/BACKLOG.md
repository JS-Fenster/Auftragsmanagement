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
| B-002 | HOCH | Budget | UI/UX-Optimierungen (7 TODOs: U1-U7) |
| B-003 | NIEDRIG | Budget | Teilrechnung: Eingabe-Optionen (Prozent/Fix) |
| B-004 | NIEDRIG | Budget | Margin-Approval-System (Genehmigung bei niedrigen Margen) |
| B-005 | MITTEL | Budget | Kundendaten: Weitere Felder (Adresse, Anrede, Projekt) |
| B-006 | MITTEL | Budget | Positions-Struktur: Texte + Aussehen ueberarbeiten |
| B-007 | HOCH | Budget | BUG: Zusatzleistungen nicht im Angebot trotz Auswahl |
| B-008 | HOCH | Budget | Angebote speichern + Verlauf/Wiederanzeige im Dashboard |
| R-001 | NIEDRIG | Repair | Reparatur-System (repairs + Tabellen) |
| R-002 | NIEDRIG | Repair | Reparaturen-Seite im Dashboard (nach Frontend-Loesch.) |
| G-001 | HOCH | System | Hardcoded Werte zentralisieren (app_config Tabelle) |
| G-002 | HOCH | Frontend | Lieferanten-Verwaltung (Seite fehlt) |
| G-003 | HOCH | Frontend | Bestellungen-Management (Seite fehlt) |
| G-004 | MITTEL | E-Mail | Steuerrelevanz-Klassifizierung + Revisionssicherheit |
| G-005 | MITTEL | Frontend | Kalender mit FullCalendar (5 Ansichten) |
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

---

## ═══ BACKLOG START ═══

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
**Prio:** HOCH | **Aufwand:** 10-17 Std

7 Einzel-TODOs fuer Budgetangebot-Oberflaeche:

| # | Aufgabe | Aufwand |
|---|---------|---------|
| U1 | Step-Navigation: Direktes Springen zwischen Steps | 2-3 Std |
| U2 | Freitext-Hash: Nur bei Aenderung neu berechnen | 1-2 Std |
| U3 | GPT-Output: Positionstext-Formatierung standardisieren | 2-3 Std |
| U4 | Vorschau: JS Fenster Firmendaten eintragen | 30 Min |
| U5 | Montage: Eigene Kalkulationsregeln einbauen | 2-4 Std |
| U6 | Preisspanne: Berechnung korrigieren (±15% auf Brutto) | 1-2 Std |
| U7 | Netto/Brutto: Anzeige klaeren (B2B vs B2C) | 1-2 Std |

**Abhaengigkeiten:** U4 braucht Firmendaten von Andreas, U5 braucht Montage-Regeln, U7 braucht Entscheidung.

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
- `dashboard/src/pages/Budgetangebot.jsx` (FIRMA_INFO, MWST_SATZ)
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

**Datei:** `dashboard/src/pages/Budgetangebot.jsx` (Kundendaten-Section)
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

**Datei:** `dashboard/src/pages/Budgetangebot.jsx` (Positionen-Tabelle)
**Zusammenhang:** Teilweise ueberschneidung mit B-002 U3 (GPT-Output Formatierung).

---

## [B-007] BUG: Zusatzleistungen nicht im Angebot
**Prio:** HOCH | **Aufwand:** 1-3 Std

Montage, Demontage und Entsorgung koennen als Zusatzleistungen ausgewaehlt werden (Checkboxen), aber die ausgewaehlten Leistungen erscheinen NICHT im fertigen Angebot/Budgetvorschlag.

**Erwartetes Verhalten:** Wenn Zusatzleistungen ausgewaehlt sind, sollen sie:
1. Als eigene Positionen oder Zusammenfassung im Angebot erscheinen
2. In die Gesamtsumme eingerechnet werden
3. Im PDF/Vorschau sichtbar sein

**Datei:** `dashboard/src/pages/Budgetangebot.jsx` + evtl. `budget-ki/index.ts` oder `priceCalculator.js`

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
