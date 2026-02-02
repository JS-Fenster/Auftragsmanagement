# Status: Reparatur-Workflow

> Letzte Aktualisierung: 2026-02-02 16:00
> Aktualisiert von: Projektleiter (Step 2 Abschluss)

---

## Aktueller Stand

**Phase:** Step 2 ABGESCHLOSSEN - Backend & Bot komplett

**SPEC Version:** v1.5 (2026-02-02)
**Neue Features in v1.5:**
- Tabelle umbenannt: `reparatur_auftraege` → `auftraege`
- Dynamische Dropdown-Optionen (Kundentypen, Auftragstypen)
- Manuelle Kunden-Tabelle (nicht im ERP)
- Telegram Bot v3.1 mit Voice + GPT + /neuerKunde
- Similarity Search (pg_trgm)

**API Versionen:**
- reparatur-api v2.0.0 (Version 8) - DEPLOYED
- reparatur-aging v2.0.0 (Version 3) - DEPLOYED
- telegram-bot v3.1.0 (Version 8) - DEPLOYED

---

## Meilenstein-Plan (Step 2)

| MS | Beschreibung | Status |
|----|--------------|--------|
| **DB-1** | Alte leere Tabellen loeschen | FERTIG |
| **DB-2** | `einstellungen_optionen` Tabelle | FERTIG |
| **DB-3** | `reparatur_auftraege` → `auftraege` | FERTIG |
| **DB-4** | `manuelle_kunden` Tabelle | FERTIG |
| **DB-5** | pg_trgm Extension + Similarity-Funktion | FERTIG |
| **DB-6** | `auftraege` erweitern (auftragstyp, etc.) | FERTIG |
| **API-1** | reparatur-api v2.0.0 (neue Tabellenstruktur) | FERTIG |
| **API-2** | reparatur-aging v2.0.0 (neuer Tabellenname) | FERTIG |
| **BOT-1** | telegram-bot v3.1.0 (/neuerAuftrag, /neuerKunde, Voice, GPT) | FERTIG |
| **FE-1** | Frontend an neue Struktur anpassen (kunde_kategorie) | FERTIG |
| **FE-2** | Settings Modal (Kundentypen/Auftragstypen) | OFFEN |
| **FE-3** | Kunden-Verwaltung (manuelle Kunden) | OFFEN |
| **SEC-1** | OPENAI_API_KEY als Secret setzen | FERTIG |

---

## Telegram Bot (@JS_Fotobot)

**Status:** v3.1.0 DEPLOYED
**Token:** Gesetzt als TELEGRAM_BOT_TOKEN Secret
**Webhook:** Aktiv

**Features:**
- [x] /start - Willkommensnachricht
- [x] /neuerAuftrag - Auftrag per Dialog (mehrstufig)
- [x] /neuerKunde - Kunde per Dialog anlegen (NEU in v3.1)
- [x] Foto-Upload mit Adresszuordnung
- [x] Voice Messages mit Whisper Transkription
- [x] GPT Vollstaendigkeitspruefung
- [x] Similarity Search fuer Duplikate

---

## Datenbank-Aenderungen

**Geloeschte Tabellen:**
- auftrag_historie (war leer)
- auftrag_fotos (war leer)
- auftrag_checkliste (war leer)
- auftrag_status (war leer)

**Neue Tabellen:**
- `einstellungen_optionen` - Dynamische Dropdown-Werte
- `manuelle_kunden` - Kunden ohne ERP-Eintrag
- `alle_kunden` (VIEW) - Vereinigt ERP + manuelle Kunden

**Umbenannte Tabellen:**
- `reparatur_auftraege` → `auftraege`
- Spalte `kundentyp` → `kunde_kategorie`

**Neue Spalten in `auftraege`:**
- `auftragstyp` (Auftrag, Reparaturauftrag, Lieferung, Abholung)
- `kundentyp_option` (Privat, Gewerbe, Oeffentlich, Architekt)
- `manuelle_kunde_id` (FK zu manuelle_kunden)
- `erstellt_via` (dashboard, telegram)
- `telegram_chat_id`, `telegram_message_id`

---

## Aktueller Auftrag

**Auftrag:** Step 2 Implementierung (autonom)
**Rolle:** Projektleiter
**Status:** ABGESCHLOSSEN - Backend, APIs, Bot komplett

---

## Wartend auf (Backlog fuer Step 3)

- [ ] Settings Modal im Frontend (Kundentypen/Auftragstypen verwalten)
- [ ] Kunden-Verwaltung im Frontend (manuelle Kunden CRUD)

---

## Naechste Schritte (Step 3)

1. **Settings Modal** - Kundentypen/Auftragstypen im Dashboard verwalten
2. **Kunden-Verwaltung** - Manuelle Kunden anlegen/bearbeiten im Dashboard
3. **Tests** - End-to-End Tests fuer Bot-Flows
