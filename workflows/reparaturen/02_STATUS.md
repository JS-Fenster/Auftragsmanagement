# Status: Reparatur-Workflow

> Letzte Aktualisierung: 2026-02-05 16:00
> Aktualisiert von: Projektleiter (renew-subscriptions Fix verifiziert)

---

## Aktueller Stand

**Phase:** Step 3 ABGESCHLOSSEN - Dashboard + ERP-Integration + E-Mail Fix

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
- renew-subscriptions v1.2 (Version 13) - DEPLOYED + GEFIXT (401 behoben)

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
| **FIX-1** | E-Mail Pipeline reparieren (renew-subscriptions 401) | FERTIG (2026-02-04) |
| **FIX-2** | Expired Graph Subscriptions erneuern | FERTIG (auto-renewal laeuft) |

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

- [x] ~~E-Mail Pipeline down seit 29.01.~~ GEFIXT 2026-02-04: app_config INTERNAL_API_KEY aktualisiert
- [x] ~~renew-subscriptions v1.2 API-Key Mismatch~~ GEFIXT: app_config hatte alten Key mit Sonderzeichen
- [ ] Dokument-Vorschau schlaegt bei manchen Dateien fehl (Storage Signed URL)

---

## E-Mail Subscription Renewal (Architektur)

- **Edge Function:** renew-subscriptions v1.2 (v13)
- **Cron:** 4x taeglich (6:00, 12:00, 18:00, 24:00)
- **Subscription Lifetime:** 4200 Min (~70h / ~3 Tage), MS Graph Mail Max: 4230 Min
- **Renewal-Window:** 24h vor Ablauf
- **Auth:** Cron nutzt `get_app_config('INTERNAL_API_KEY')` → Edge Function validiert gegen Secret
- **Token Hardening:** Azure Client Secret wird getrimmt (.trim()), AADSTS-Fehlercode-Erkennung
- **Status:** FUNKTIONIERT seit 2026-02-04

---

## Naechste Schritte

1. **Dashboard-Tests** - Alle 6 Seiten mit Echtdaten im Tagesgeschaeft testen
2. **Settings CRUD testen** - Kundentypen/Auftragstypen verwalten
3. **E-Mail Pipeline beobachten** - Pruefen ob neue Emails korrekt verarbeitet werden

---

## Log-Referenz

Letzte Eintraege:
- [LOG-039] renew-subscriptions Fix verifiziert + Architektur dokumentiert (2026-02-05)
- [LOG-038] Dashboard-Build + ERP-Integration (2026-02-02)
