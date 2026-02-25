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
| G-018 | MITTEL | E-Mail | Dokument-Namensformatierung pro Kunde (beim Rechnungsversand) |
| G-019 | MITTEL | Kontakte | Mehrere E-Mail-Adressen pro Kunde (Rechnungs-E-Mail etc.) |
| G-020 | MITTEL | Kontakte | Kunden-Bestellnummer/Projektnummer (Pflichtfeld-Hinweis) |
| G-021 | MITTEL | E-Mail | Dok-Kategorie bei Emails entfernen (nur email_kategorie nutzen) |
| G-022 | MITTEL | Kategorien | Angebot pruefen: Kunden- vs. Lieferantenangebote trennen |
| G-023 | MITTEL | Kategorien | AB aufsplitten: Auftragsbestaetigung vs. Auftragsbestaetigung_Ausgehend |
| G-024 | MITTEL | Kategorien | Steuer/Buchhaltung: Neue Dok-Kategorien (Bescheid, Freistellung, Buchhaltung) |
| G-025 | NIEDRIG | Kategorien | Zahlungserinnerung + Mahnung zusammenlegen |
| G-026 | MITTEL | E-Mail | Automatische_Benachrichtigung als neue Email-Kategorie |
| G-027 | HOCH | Kategorien | Grosses Rename: Dok-Kategorien auf [Typ]_[Richtung] vereinheitlichen |
| G-028 | NIEDRIG | Kategorien | Retoure_Ausgehend / Retoure_Eingehend als neue Dok-Kategorien |
| G-029 | MITTEL | Budget | Ud-Wert Rechner (EN ISO 10077-1) fuer Tueren |

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

## [G-021] Dok-Kategorie bei Emails entfernen
**Prio:** MITTEL | **Aufwand:** 2-3 Std

Emails bekommen aktuell ZWEI Kategorien: `email_kategorie` UND `kategorie` (Dokument-Kategorie). Die Dok-Kategorie ist ueberfluessig, da Emails bereits ueber `email_kategorie` + Metadaten vollstaendig klassifiziert sind. 95%+ Emails sind Begleittext zum Anhang.

**Offene Frage:** Sonderbehandlung fuer Emails OHNE Anhang die selbst Dokumentcharakter haben (z.B. Auftragserteilung per Email)?

**TODO (mit Andreas besprechen):**
1. `kategorie` bei bestehenden Emails auf NULL setzen
2. `process-email`: Dok-Kategorisierung entfernen (spart GPT-Tokens)
3. Dashboard/Review-Tool: Emails nur ueber `email_kategorie` filtern
4. Edge-Case klaeren: Emails ohne Anhang mit Dokumentcharakter
5. Email_Anhang (79), Email_Eingehend (61), Email_Ausgehend (11) → richtige Dok-Kategorie oder NULL
6. Richtung erkennbar am Absender/Empfaenger → keine eigene Dok-Kategorie noetig

---

## [G-022] Angebot pruefen: Kunden- vs. Lieferantenangebote trennen
**Prio:** MITTEL | **Aufwand:** 2-3 Std

Kategorie "Angebot" (65 Docs) enthaelt vermutlich sowohl eigene Angebote an Kunden als auch Lieferantenangebote. "Lieferantenangebot" (21 Docs) existiert bereits als eigene Kategorie.

**TODO:**
1. Alle 65 "Angebot"-Docs pruefen: welche sind eigene, welche sind Lieferantenangebote?
2. Falsch zugeordnete nach "Lieferantenangebot" verschieben
3. Prompt anpassen: Angebot = NUR eigene Angebote an Kunden, Lieferantenangebot = Angebote von Lieferanten

---

## [G-023] Auftragsbestaetigung aufsplitten (Eingehend/Ausgehend)
**Prio:** MITTEL | **Aufwand:** 3-4 Std

Kategorie "Auftragsbestaetigung" (222 Docs) enthaelt beide Richtungen gemischt:

**Eingehend (von Lieferanten):**
- Lieferant sendet AB → wir pruefen → Freigabe/Korrektur zurueck
- Bleibt: **Auftragsbestaetigung**

**Ausgehend (von uns an Kunden):**
- Kunde erhaelt AB → gibt Freigabe
- Kunde schickt Bestellung → wir senden AB zur Kenntnisnahme
- Neue Kategorie: **Auftragsbestaetigung_Ausgehend**

**Freigabe/Korrektur:** Kein neues Dokument! Ist dieselbe AB mit Unterschrift/Stempel.
→ Kategorie bleibt "Auftragsbestaetigung", Status aendert sich (eingegangen → freigegeben).
→ Verknuepfung mit G-010 (Status-Systeme vereinheitlichen).

**TODO:**
1. Neue Kategorie "Auftragsbestaetigung_Ausgehend" anlegen
2. 222 Docs pruefen und ausgehende umkategorisieren
3. Prompt anpassen: Erkennung ueber Absender (JS Fenster = ausgehend)
4. Status-Flow fuer AB definieren: eingegangen → in_pruefung → freigegeben / korrektur_angefordert

---

## [G-024] Steuer/Buchhaltung: Neue Dokument-Kategorien
**Prio:** MITTEL | **Aufwand:** 2-3 Std

Bisherige Kategorie "Brief_von_Finanzamt" (5 Docs) ist zu ungenau. Aufsplitten in granulare Kategorien fuer spaetere Workflow-Erkennung:

**Neue Kategorien:**
- **Steuer_Bescheid** — Steuernachzahlungen, Vorauszahlungen, Festsetzungen vom Finanzamt
- **Freistellungsbescheinigung** — Braucht Ablaufdatum-Tracking (gueltig_bis Feld)
- **Buchhaltungsunterlagen** — Bilanz, BWA, Kontoauszuege, Steuerberater-Unterlagen

**TODO:**
1. "Brief_von_Finanzamt" (5 Docs) in neue Kategorien aufteilen
2. Prompt anpassen
3. Ggf. spaeter: Ablaufdatum-Warnung fuer Freistellungsbescheinigungen

---

## [G-025] Zahlungserinnerung + Mahnung zusammenlegen
**Prio:** NIEDRIG | **Aufwand:** 30 Min

Zahlungserinnerung (4) und Mahnung (1) haben identischen Workflow (Zahlung einfordern). Zusammenlegen zu **Mahnung** (5 Docs).

---

## [G-026] Automatische_Benachrichtigung als neue Email-Kategorie
**Prio:** MITTEL | **Aufwand:** 1-2 Std

Neue Email-Kategorie fuer automatisch generierte System-Emails:
- Online-Shop Benachrichtigungen (Bearbeitung dauert laenger, Versandbestaetigung)
- Supabase/System-Alerts
- Auto-Replies, Out-of-Office
- NICHT DHL-Tracking (bleibt bei Lieferstatus_Update)

Verhindert, dass diese Mails im "Sonstiges"-Sammeltopf landen (aktuell 422 Sonstiges = 44%).

---

## [G-027] Grosses Rename: Dok-Kategorien auf [Typ]_[Richtung] vereinheitlichen
**Prio:** HOCH | **Aufwand:** 4-6 Std | **Umfasst:** G-022, G-023

**Entscheidung (2026-02-25):** Alle richtungsabhaengigen Dok-Kategorien werden auf Schema `[Dokumenttyp]_[Richtung]` umbenannt. Frontend-Anzeigename kann davon abweichen.

**Rename-Map:**

| Alt | Neu | Anzahl |
|-----|-----|--------|
| Kundenanfrage | Anfrage_Eingehend | 96 |
| Preisanfrage | Anfrage_Ausgehend | 10 |
| Angebot | Angebot_Ausgehend | 65 (pruefen!) |
| Lieferantenangebot | Angebot_Eingehend | 21 |
| Kundenbestellung | Bestellung_Eingehend | 16 |
| Bestellung | Bestellung_Ausgehend | 12 |
| Auftragsbestaetigung | Auftragsbestaetigung_Eingehend | 222 (split!) |
| (neu) | Auftragsbestaetigung_Ausgehend | aus 222 |
| Eingangslieferschein | Lieferschein_Eingehend | 256 |
| Kundenlieferschein | Lieferschein_Ausgehend | 12 |
| Eingangsrechnung | Rechnung_Eingehend | 103 |
| Ausgangsrechnung | Rechnung_Ausgehend | 20 |

**Betroffene Docs:** ~830 (plus AB-Split)

**TODO:**
1. Neue Kategorien in CHECK constraint + _shared/categories.ts anlegen
2. Rename per SQL UPDATE (batch)
3. Storage-Ordner verschieben (move-document Edge Function)
4. Prompt (process-document) anpassen
5. Dashboard-Filter + constants.js anpassen
6. G-022: Bei Rename "Angebot" pruefen ob Lieferantenangebote drin stecken
7. G-023: Bei Rename "Auftragsbestaetigung" in Eingehend/Ausgehend splitten

**Freigabe-Workflow AB (kein neues Dokument):**
Unterschriebene/gestempelte AB bleibt in gleicher Kategorie, nur Status aendert sich (→ G-010).

---

## [G-028] Retoure_Ausgehend / Retoure_Eingehend als neue Dok-Kategorien
**Prio:** NIEDRIG | **Aufwand:** 1-2 Std

Neue Kategorien fuer Retouren-Dokumente:
- **Retoure_Ausgehend** — Wir schicken Ware an Lieferant zurueck (Reklamation, Falschlieferung, Ueberschuss)
- **Retoure_Eingehend** — Kunde schickt Ware an uns zurueck (aktuell sehr selten)

**Dokumente die darunter fallen:** Retoure-Labels, Ruecksendescheine, Retourenbegleitscheine

**Workflow-Potenzial (spaeter, regelbasiert):**
- Retoure_Ausgehend → Status "Retoure offen" → Gutschrift-Eingang erwarten → Erinnerung nach 14 Tagen
- Klassifizierung durch LLM, Workflow-Trigger durch deterministische Regeln (kein GPT-Call)

**Hinweis:** Erst anlegen wenn erster Workflow gebaut wird. Aktuell zu wenige Docs.

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
