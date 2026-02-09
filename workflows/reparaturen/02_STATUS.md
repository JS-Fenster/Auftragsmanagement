# Status: Reparatur-Workflow

> Letzte Aktualisierung: 2026-02-09 (T016-TEST abgeschlossen - ALLE 5 TESTS BESTANDEN)
> Aktualisiert von: Tester (T016-TEST)

---

## Aktueller Stand

**Phase:** Step 3+ - Dashboard Erweiterungen (Auftragsnummer, Bearbeitungsmodus) - VERIFIZIERT
**SPEC Version:** v1.5 (2026-02-02) - ACHTUNG: SPEC referenziert noch `reparatur_auftraege`, real existiert nur `auftraege`

---

## WICHTIG: Datenbank-Realitaet (Stand 2026-02-09)

**Es gibt KEINE Tabelle `reparatur_auftraege`.** Alles wurde in eine zentrale `auftraege`-Tabelle gemergt.

**Tabelle `auftraege` (33 Spalten):**
- Auftragstyp via Feld `auftragstyp` (Default: 'Reparaturauftrag')
- Auftragstypen (aus `einstellungen_optionen`): Auftrag, Reparaturauftrag, Lieferung, Abholung
- Kundentypen: Privat, Gewerbe, Oeffentlich, Architekt
- Reparatur-spezifische Felder: termin_sv1, termin_sv2, zeitfenster, outcome_sv1, mannstaerke, ist_no_show
- Kunde: erp_kunde_id (Bestandskunde) ODER neukunde_* Felder (Neukunde)
- Herkunft: erstellt_via (dashboard/telegram), document_id, telegram_chat_id

**View `v_auftraege` (P016, VERIFIZIERT T016):** auftraege LEFT JOIN erp_kunden - liefert kunde_firma, kunde_*_erp Felder

**Testdaten:** 7+ Auftraege (5 original + 2 via Telegram/Email)

---

## Dashboard (Step 3)

**Pfad:** `/dashboard` (React 19 + Vite 7 + Tailwind v4 + Supabase JS)
**Server:** `npm run dev` -> http://localhost:3000

6 Seiten gebaut:
| Seite | Status | Funktion |
|-------|--------|----------|
| Uebersicht | FERTIG | KPIs, Pipeline-Status, Verarbeitung, Aging |
| Auftraege | VERIFIZIERT (T016) | Liste mit Nr.-Spalte, Detail mit Bearbeitungsmodus, Neu-Modal, Kundensuche, View-Query |
| Dokumente | FERTIG | Two-Panel, Preview, Filter |
| Kunden | FERTIG | ERP-Suche (8.687 Kunden), Detail mit Historie |
| E-Mail | FERTIG | Pipeline-Status, Filter, Body-Ansicht |
| Einstellungen | FERTIG | Optionen CRUD (Auftragstypen, Kundentypen) |

---

## API (Edge Functions)

| Function | Version | Status |
|----------|---------|--------|
| reparatur-api | v2.2.0 (Deploy 11) | DEPLOYED, verify_jwt:false, PATCH /update VERIFIZIERT |
| reparatur-aging | v2.0.0 (Deploy 3) | DEPLOYED |
| telegram-bot | v3.1.0 (Deploy 8) | DEPLOYED |
| renew-subscriptions | v1.2 (Deploy 13) | DEPLOYED, GEFIXT (2026-02-04) |

---

## ERP-Daten (Read-Only)

| Tabelle | Datensaetze |
|---------|-------------|
| erp_kunden | 8.687 |
| erp_projekte | 2.486 |
| erp_angebote | 4.744 |
| erp_rechnungen | 2.996 |
| erp_ra | 2.993 |
| erp_bestellungen | 3.839 |
| erp_lieferanten | 663 |

---

## Bekannte Probleme

- [x] ~~E-Mail Pipeline down seit 29.01.~~ GEFIXT 2026-02-04
- [x] ~~renew-subscriptions 401 Fehler~~ GEFIXT 2026-02-04
- [x] ~~Bestandskunde-Bug: Dashboard schickte `kunde_code` statt `erp_kunde_id`~~ GEFIXT 2026-02-09
- [x] ~~Auftragsnummer fehlt (nur UUID, nicht telefonisch kommunizierbar)~~ GEFIXT P016-PROG, VERIFIZIERT T016
- [ ] Dokument-Vorschau schlaegt bei manchen Dateien fehl (Storage Signed URL)
- [ ] 01_SPEC.md Kapitel 2 referenziert noch `reparatur_auftraege` statt `auftraege`
- [ ] Einsatzort-Feld fehlt (Rechnungsadresse != Lieferadresse)
- [ ] Dashboard JS-Bundle 560 kB (Chunk-Splitting empfohlen fuer Produktion)

---

## Aktueller Auftrag

**Auftrag:** T016-TEST - ABGESCHLOSSEN
**Rolle:** Tester
**Modus:** Foreground
**Log-ID:** [R-041]

### Testergebnis T016-TEST

| Test | Ergebnis | Details |
|------|----------|---------|
| 1. View v_auftraege | BESTANDEN | ERP-Daten korrekt fuer Bestandskunden, NULL fuer Neukunden |
| 2. PATCH /update | BESTANDEN | Erlaubt=200, Verboten=400, Ungueltig=ignoriert |
| 3. Frontend Code-Review | BESTANDEN | Alle 7 Pruefpunkte OK, bestehende Sections unveraendert |
| 4. Regression GET-Endpoints | BESTANDEN | /reparatur=200 (7 Auftraege), /kunden?q=Kraus=200 (15 Kunden) |
| 5. Frontend Build | BESTANDEN | 2593 Module, 6.59s, keine Fehler |

---

## Vorheriger Auftrag (abgeschlossen)

**Auftrag:** P016-PROG - ABGESCHLOSSEN
**Rolle:** Programmierer
**Log-ID:** [R-040]

### Ergebnis P016-PROG
- [x] Teil 1: View `v_auftraege` angelegt (Migration)
- [x] Teil 2: PATCH /reparatur/:id/update Endpoint (Edge Function v2.2.0)
- [x] Teil 3a: Auftragsnummer-Spalte in Tabelle
- [x] Teil 3b: Query auf v_auftraege umgestellt
- [x] Teil 3c: kundeName/kundeAdresse Helper gefixt + Telefon/Email
- [x] Teil 3d: Bearbeitungsmodus mit useFormWithUndo + UnsavedChangesDialog
- [x] Teil 3e: Modal-Header mit Auftragsnummer

---

## Naechste Schritte (nach T016)

1. ~~**Tester:** P016 verifizieren (View, API, Frontend)~~ ERLEDIGT
2. **Einsatzort-Feld** - Separater Einsatzort (abweichend von Kundenadresse)
3. **SPEC aktualisieren** - `reparatur_auftraege` -> `auftraege` korrigieren
4. **Telegram-Bot Webhook pruefen**
5. **Dashboard Feldtest** - Alle 6 Seiten mit Echtdaten testen
6. **Bundle-Optimierung** - Code-Splitting fuer JS-Bundle (560 kB)

---

## Log-Referenz

- [R-041] T016-TEST: P016 Verifizierung - Alle 5 Tests BESTANDEN (2026-02-09)
- [R-040] P016-PROG: View + PATCH Update + Auftraege.jsx (2026-02-09)
- [R-039] renew-subscriptions Fix verifiziert (2026-02-05)
- [R-038] Dashboard-Build + ERP-Integration (2026-02-02)
