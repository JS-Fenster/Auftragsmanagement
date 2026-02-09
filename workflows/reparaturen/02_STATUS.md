# Status: Reparatur-Workflow

> Letzte Aktualisierung: 2026-02-09 20:35 (TEST: T017-TEST abgeschlossen)
> Aktualisiert von: Tester

---

## Aktueller Stand

**Phase:** Step 3+ - Einsatzort-Feld + Bundle-Optimierung - VERIFIZIERT
**SPEC Version:** v1.6 (2026-02-09) - Kapitel 2 korrigiert (auftraege statt reparatur_auftraege)

---

## WICHTIG: Datenbank-Realitaet (Stand 2026-02-09)

**Zentrale Tabelle `auftraege` (37 Spalten):**
- Auftragstyp via Feld `auftragstyp` (Default: 'Reparaturauftrag')
- Auftragstypen (aus `einstellungen_optionen`): Auftrag, Reparaturauftrag, Lieferung, Abholung
- Kundentypen: Privat, Gewerbe, Oeffentlich, Architekt
- Reparatur-spezifische Felder: termin_sv1, termin_sv2, zeitfenster, outcome_sv1, mannstaerke, ist_no_show
- Einsatzort (abweichend): einsatzort_strasse, einsatzort_plz, einsatzort_ort
- Kunde: erp_kunde_id (Bestandskunde) ODER neukunde_* Felder (Neukunde)
- Herkunft: erstellt_via (dashboard/telegram/email), document_id, telegram_chat_id

**View `v_auftraege`:** auftraege LEFT JOIN erp_kunden - liefert kunde_firma, kunde_*_erp Felder

**Testdaten:** 12 Auftraege (5 original + 2 Telegram + 5 Email)

---

## Dashboard (Step 3)

**Pfad:** `dashboard/` (React 19 + Vite 7 + Tailwind v4 + Supabase JS)
**Server:** `npm run dev` -> http://localhost:3000

6 Seiten gebaut:
| Seite | Status | Funktion |
|-------|--------|----------|
| Uebersicht | FERTIG | KPIs, Pipeline-Status, Verarbeitung, Aging |
| Auftraege | T017 VERIFIZIERT | Liste mit Nr.-Spalte, Detail mit Bearbeitungsmodus + Einsatzort, Neu-Modal + Einsatzort, Kundensuche, View-Query |
| Dokumente | FERTIG | Two-Panel, Preview, Filter |
| Kunden | FERTIG | ERP-Suche (8.687 Kunden), Detail mit Historie |
| E-Mail | FERTIG | Pipeline-Status, Filter, Body-Ansicht |
| Einstellungen | FERTIG | Optionen CRUD (Auftragstypen, Kundentypen) |

---

## API (Edge Functions)

| Function | Version | Status |
|----------|---------|--------|
| reparatur-api | v2.3.0 (Deploy 12) | DEPLOYED, verify_jwt:false, +Einsatzort-Felder, T017 VERIFIZIERT |
| reparatur-aging | v2.0.0 (Deploy 3) | DEPLOYED |
| telegram-bot | v3.3.0 (Deploy 10) | DEPLOYED, T017 VERIFIZIERT |
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
- [x] ~~01_SPEC.md Kapitel 2 referenziert noch `reparatur_auftraege` statt `auftraege`~~ GEFIXT v1.6
- [ ] Dokument-Vorschau schlaegt bei manchen Dateien fehl (Storage Signed URL)
- [x] ~~Einsatzort-Feld fehlt (Rechnungsadresse != Lieferadresse)~~ GEFIXT P017-PROG, VERIFIZIERT T017
- [x] ~~Dashboard JS-Bundle 560 kB (Chunk-Splitting empfohlen)~~ GEFIXT P018-PROG, VERIFIZIERT T017

---

## Aktueller Auftrag

**Auftrag:** T017-TEST - Gesamttest (ABGESCHLOSSEN)
**Rolle:** Tester
**Log-ID:** [R-044]

### Aufgaben T017-TEST (ABGESCHLOSSEN - 5/5 BESTANDEN)
- [x] Test 1: Einsatzort Migration + API + Frontend - BESTANDEN
- [x] Test 2: Telegram-Bot Health Check - BESTANDEN
- [x] Test 3: Dashboard alle 6 Seiten (API-basiert) - BESTANDEN
- [x] Test 4: Bundle-Groesse nach Splitting - BESTANDEN
- [x] Test 5: Frontend Code Review (Einsatzort) - BESTANDEN

---

## Log-Referenz

- [R-044] T017-TEST: Gesamttest 5/5 BESTANDEN (2026-02-09)
- [R-043] P018-PROG: Bundle-Optimierung manualChunks (2026-02-09)
- [R-042] P017-PROG: Einsatzort-Feld DB + API + Frontend (2026-02-09)
- [R-041] T016-TEST: P016 Verifizierung - Alle 5 Tests BESTANDEN (2026-02-09)
- [R-040] P016-PROG: View + PATCH Update + Auftraege.jsx (2026-02-09)
- [R-039] renew-subscriptions Fix verifiziert (2026-02-05)
- [R-038] Dashboard-Build + ERP-Integration (2026-02-02)
