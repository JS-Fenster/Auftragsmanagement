# Status: Reparatur-Workflow

> Letzte Aktualisierung: 2026-02-10 22:00 (PL: Email-Nachkategorisierung abgeschlossen)
> Aktualisiert von: Projektleiter

---

## Aktueller Stand

**Phase:** Step 3+ - Email-Kategorisierung optimiert + Nachkategorisierung ABGESCHLOSSEN
**SPEC Version:** v1.6 (2026-02-09) - Kapitel 2 korrigiert (auftraege statt reparatur_auftraege)

---

## WICHTIG: Datenbank-Realitaet (Stand 2026-02-10)

**Zentrale Tabelle `auftraege` (37 Spalten):**
- Auftragstyp via Feld `auftragstyp` (Default: 'Reparaturauftrag')
- Auftragstypen (aus `einstellungen_optionen`): Auftrag, Reparaturauftrag, Lieferung, Abholung
- Kundentypen: Privat, Gewerbe, Oeffentlich, Architekt
- Reparatur-spezifische Felder: termin_sv1, termin_sv2, zeitfenster, outcome_sv1, mannstaerke, ist_no_show
- Einsatzort (abweichend): einsatzort_strasse, einsatzort_plz, einsatzort_ort
- Kunde: erp_kunde_id (Bestandskunde) ODER neukunde_* Felder (Neukunde)
- Herkunft: erstellt_via (dashboard/telegram/email), document_id, telegram_chat_id

**View `v_auftraege`:** auftraege LEFT JOIN erp_kunden - liefert kunde_firma, kunde_*_erp Felder

**Email-Kategorisierung:** 534 Emails, 18/21 Kategorien aktiv, Sonstiges-Rate 10.1%

**Testdaten:** 13 Auftraege (5 original + 2 Telegram + 5 Email + 1 Dashboard)

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
| process-email | v4.3.0 (Deploy 37) | DEPLOYED, +Marktplatz_Anfrage, 21 Kategorien |
| recategorize-batch | v6 (Stub) | DEAKTIVIERT, verify_jwt:true, HTTP 410 Gone |

---

## ERP-Daten (Read-Only)

| Tabelle | Datensaetze |
|---------|-------------|
| erp_kunden | 8.687 |
| erp_projekte | 2.486 |
| erp_angebote | 4.783 |
| erp_rechnungen | 3.031 |
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
- [x] ~~recategorize-batch ohne Auth deployed~~ DEAKTIVIERT 2026-02-10 (v6 Stub)
- [x] ~~Kleinanzeigen "Fiat Punto" als Lead_Anfrage~~ GEFIXT: Neue Kategorie Marktplatz_Anfrage (v4.3.0)

---

## Aktueller Auftrag

**Auftrag:** Kein aktiver Auftrag
**Rolle:** -
**Log-ID:** [R-045]

---

## Log-Referenz

- [R-046] PL: Neue Kategorie Marktplatz_Anfrage (process-email v4.3.0) (2026-02-10)
- [R-045] PL: Email-Nachkategorisierung 468 Emails + recategorize-batch deaktiviert (2026-02-10)
- [R-044] T017-TEST: Gesamttest 5/5 BESTANDEN (2026-02-09)
- [R-043] P018-PROG: Bundle-Optimierung manualChunks (2026-02-09)
- [R-042] P017-PROG: Einsatzort-Feld DB + API + Frontend (2026-02-09)
- [R-041] T016-TEST: P016 Verifizierung - Alle 5 Tests BESTANDEN (2026-02-09)
- [R-040] P016-PROG: View + PATCH Update + Auftraege.jsx (2026-02-09)
- [R-039] renew-subscriptions Fix verifiziert (2026-02-05)
- [R-038] Dashboard-Build + ERP-Integration (2026-02-02)
