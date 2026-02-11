# Status: Reparatur-Workflow

> Letzte Aktualisierung: 2026-02-11 (PROG: P019 process-document absichern ABGESCHLOSSEN)
> Aktualisiert von: Programmierer

---

## Aktueller Stand

**Phase:** Kontakt-Management (OPTIMIERUNG 11.4) - ALLE 4 MEILENSTEINE FERTIG
**SPEC Version:** v1.6 (2026-02-09)

---

## SPRINT: Kontakt-Management - ABGESCHLOSSEN

**Ziel:** Neues 3-Tabellen-Kontaktsystem (kontakte, kontakt_personen, kontakt_details) das langfristig erp_kunden ersetzt.

| Meilenstein | Beschreibung | Status |
|-------------|-------------|--------|
| **M1** | DB-Tabellen + Trigger + Initialer Import (8.687 ERP-Kunden) | **FERTIG** |
| **M2** | Dashboard UI: Kunden.jsx umbauen auf kontakte | **FERTIG** |
| **M3** | E-Mail-Matching gegen kontakt_details | **FERTIG** |
| **M4** | Lieferanten-Link + auftraege.kontakt_id + v_auftraege | **FERTIG** |

---

## Kontakt-System Datenbank (Stand 2026-02-11)

| Tabelle | Datensaetze | Beschreibung |
|---------|-------------|--------------|
| kontakte | **9.291** | 8.628 nur Kunde, 604 nur Lieferant, 59 Dual-Role |
| kontakt_personen | **9.291** | Je 1 Hauptperson pro Kontakt |
| kontakt_details | **9.551+** | Telefon, Mobil, Email |

**Trigger aktiv:**
- `trg_sync_erp_kunden_to_kontakte` → Auto-Kontakt bei ERP-Sync
- `trg_sync_erp_lieferanten_to_kontakte` → Auto-Kontakt bei Lieferanten-Sync
- `trg_documents_email_match` → E-Mail → Kontakt-Zuordnung
- `trg_kontakt_details_rematch` → Re-Match bei neuer E-Mail-Adresse

**Migrationen:** create_kontakt_tables, email_kontakt_matching, lieferanten_trigger_auftraege_kontakt, v_auftraege_mit_kontakte

---

## Letzter abgeschlossener Auftrag

**Auftrag:** P019-PROG: process-document Edge Function absichern (3 Massnahmen) - ERLEDIGT
**Rolle:** Programmierer
**Prompt-Ref:** P019

### Ergebnis: Alle 3 Teilschritte ERLEDIGT
1. Health-Endpoint Version gefixt: 33.0.0 -> 34.0.0 in index.ts
2. Golden Backup erstellt: 7 Dateien + README in `_golden-v34/`
3. CLAUDE.md Schutzregel hinzugefuegt: "Geschuetzte Edge Functions" Abschnitt

### Naechster Schritt
- Projektleiter: Git Commit + Tag erstellen

---

## Dashboard (Step 3)

**Pfad:** `dashboard/` (React 19 + Vite 7 + Tailwind v4 + Supabase JS)
**Server:** `npm run dev` -> http://localhost:3000

6 Seiten gebaut:
| Seite | Status | Funktion |
|-------|--------|----------|
| Uebersicht | FERTIG | KPIs, Pipeline-Status, Verarbeitung, Aging |
| Auftraege | FERTIG | Liste, Detail, Bearbeitungsmodus, Einsatzort, Kundensuche |
| Dokumente | FERTIG | Two-Panel, Preview, Filter |
| Kunden | **NEU (M2)** | Kontakte-System, 3-Query-Suche, Detail mit Personen+Details, CRUD |
| E-Mail | FERTIG | Pipeline-Status, Filter, Body-Ansicht |
| Einstellungen | FERTIG | Optionen CRUD |

---

## API (Edge Functions)

| Function | Version | Status |
|----------|---------|--------|
| reparatur-api | v2.3.0 (Deploy 12) | DEPLOYED |
| reparatur-aging | v2.0.0 (Deploy 3) | DEPLOYED |
| telegram-bot | v3.3.0 (Deploy 10) | DEPLOYED |
| renew-subscriptions | v1.2 (Deploy 13) | DEPLOYED |
| process-email | v4.3.0 (Deploy 37) | DEPLOYED |
| recategorize-batch | v6 (Stub) | DEAKTIVIERT |

---

## Log-Referenz

- [R-054] PROG: P019 process-document absichern (Version-Fix + Golden Backup + Schutzregel) (2026-02-11)
- [R-053] PL: Kontakt-Management Sprint ABGESCHLOSSEN (2026-02-11)
- [R-052] PROG: M4 Lieferanten-Import (663) + auftraege.kontakt_id (2026-02-11)
- [R-051] PROG: M3 E-Mail-Matching (27/562, 4.8%) (2026-02-11)
- [R-050] PROG: M2 Dashboard UI: Kunden.jsx (593→1215 Zeilen) (2026-02-11)
- [R-049] PROG: M1 DB-Tabellen + Trigger + Import (8.687 Kontakte) (2026-02-11)
- [R-048] PL: Kontakt-Management Sprint gestartet (2026-02-11)
- [R-047] PROG: Dokument-Vorschau Fix + Email-Body/Meta/Anhaenge (2026-02-11)
