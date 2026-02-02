# Status: Reparatur-Workflow

> Letzte Aktualisierung: 2026-02-02 22:00
> Aktualisiert von: Projektleiter (Dashboard-Build + ERP-Integration)

---

## Aktueller Stand

**Phase:** Step 3 IN ARBEIT - Dashboard + ERP-Integration

**SPEC Version:** v1.5 (2026-02-02)

**Neues Dashboard (Step 3):**
- Komplett neues Frontend unter `/dashboard` (React 18 + Vite + Tailwind v4)
- 6 Seiten: Uebersicht, Auftraege, Dokumente, Kunden, E-Mail, Einstellungen
- ERP-Daten-Strategie: View-Schicht (read-only ERP-Tabellen + neue auftraege-Tabelle)
- Kunden-Detail mit vollstaendiger ERP-Historie (Projekte, Angebote, Rechnungen, Bestellungen, Offene Posten)

**API Versionen:**
- reparatur-api v2.0.1 (Version 9) - DEPLOYED (verify_jwt:false)
- reparatur-aging v2.0.0 (Version 3) - DEPLOYED
- telegram-bot v3.1.0 (Version 8) - DEPLOYED

---

## Meilenstein-Plan (Step 3 - Dashboard)

| MS | Beschreibung | Status |
|----|--------------|--------|
| **DASH-1** | Neues Vite+React+Tailwind Projekt scaffolden | FERTIG |
| **DASH-2** | Uebersicht (KPIs, Pipeline, Verarbeitung, Aging) | FERTIG |
| **DASH-3** | Auftraege-Seite (Liste, Detail, Neu-Modal) | FERTIG |
| **DASH-4** | Dokumente-Seite (Two-Panel, Preview, Filter) | FERTIG |
| **DASH-5** | Kunden-Seite (Suche, ERP-Historie Detail-Modal) | FERTIG |
| **DASH-6** | E-Mail-Seite (Pipeline-Status, Filter, Body) | FERTIG |
| **DASH-7** | Einstellungen-Seite (Optionen CRUD, System) | FERTIG |
| **DASH-8** | RLS-Policies fuer Dashboard-Zugriff | FERTIG |
| **DASH-9** | ERP-Daten Integrations-Strategie | FERTIG |
| **FIX-1** | E-Mail Pipeline reparieren (renew-subscriptions 401) | OFFEN |
| **FIX-2** | Expired Graph Subscriptions erneuern | OFFEN |

---

## ERP-Uebergangs-Strategie

**Entscheidung:** ERP-Tabellen bleiben read-only, keine Datenmigration.

| Tabelle | Datensaetze | Zweck im Dashboard |
|---------|-------------|-------------------|
| erp_kunden | 8.687 | Kundenstamm (PK: code) |
| erp_projekte | 2.486 | Projekt-Historie |
| erp_angebote | 4.744 | Angebote/Auftraege (1.434 mit auftrags_datum) |
| erp_rechnungen | 2.996 | Rechnungen |
| erp_ra | 2.993 | Offene Posten / Mahnstufen |
| erp_bestellungen | 3.839 | Bestellungen an Lieferanten |
| erp_lieferanten | 663 | Lieferantenstamm |

Verknuepfung: `auftraege.erp_kunde_id` → `erp_kunden.code`

---

## Bekannte Probleme

- [ ] E-Mail Pipeline down seit 29.01. (renew-subscriptions 401, alle Subscriptions expired)
- [ ] renew-subscriptions v1.2 hat API-Key Pflicht - Cron-Caller sendet falschen/keinen Key
- [ ] Dokument-Vorschau schlaegt bei manchen Dateien fehl (Storage Signed URL)

---

## Naechste Schritte

1. **E-Mail Pipeline reparieren** - renew-subscriptions API-Key fixen, Subscriptions erneuern
2. **Dashboard-Tests** - Alle 6 Seiten mit Echtdaten testen
3. **Settings CRUD testen** - Kundentypen/Auftragstypen verwalten

---

## Log-Referenz

Letzte Eintraege: [LOG-038] Dashboard-Build + ERP-Integration (2026-02-02)
