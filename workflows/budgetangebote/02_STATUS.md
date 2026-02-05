# Status: Budgetangebot V1

> Letzte Aktualisierung: 2026-02-05 14:45
> Aktualisiert von: Projektleiter (Session-Ende, Commit vorbereitet)

---

## Aktueller Stand
**Phase:** Phase 15 - Granulare Elementdaten
**Letzter abgeschlossener Schritt:** Sync-Script getestet (dry-run erfolgreich)

---

## Nachtmodus
**Status:** INAKTIV (Session beendet)

---

## FORTSETZUNG (fuer naechste Session)

**Befehl:** `lies 02_STATUS.md und mach weiter`

### Was bereits funktioniert
1. Sync-Script `sync-positions-to-supabase.js` - KundenCode-Fix angewendet
2. Dry-Run erfolgreich: 381 Rechnungen ab 2025, Positionen werden erkannt
3. Edge Function `process-backtest-batch` deployed
4. Edge Function `test-gpt-extraction` v4 mit anzahl_fluegel
5. Tabelle `backtest_elements` mit kategorie + eigenschaften JSONB

### Naechste Schritte (TODO)

| # | Aufgabe | Befehl/Aktion |
|---|---------|---------------|
| 1 | **Sync ausfuehren** | `cd backend && node scripts/sync-positions-to-supabase.js` |
| 2 | **Edge Function testen** | `curl -X POST https://rsmjgdujlpnydbsfuiek.supabase.co/functions/v1/process-backtest-batch` |
| 3 | **Server-Sync pruefen** | Bestehende ERP-Sync Mechanismen analysieren |
| 4 | **Dokumentation** | LOG-032 schreiben nach erfolgreichem Sync |

### Voraussetzungen
- Cloudflare Tunnel aktiv: `cloudflared access tcp --hostname sql.js-fenster-intern.org --url localhost:1433`

---

## Technischer Stand

### Edge Functions (Supabase)
- `test-gpt-extraction` v4 - GPT-basierte Rechnungsanalyse (mit anzahl_fluegel)
- `process-backtest-batch` v1 - Batch-Verarbeitung aus erp_rechnungs_positionen

### Backend Scripts
- `sync-positions-to-supabase.js` - W4A → Supabase Sync (BEREIT)
- `backtest-gpt-full.js` - Batch-Backtest (Console-Output)
- `backtest-gpt-save.js` - Batch-Backtest mit Speicherung

### Datenbank (Supabase)
| Tabelle | Status |
|---------|--------|
| erp_rechnungen | 2996 Eintraege, gpt_processed_at Spalte hinzugefuegt |
| erp_rechnungs_positionen | 0 (wartet auf Sync-Ausfuehrung) |
| backtest_elements | Bereit (kategorie, eigenschaften JSONB) |

---

## Dry-Run Ergebnis (2026-02-05)

```
381 Rechnungen mit Keywords gefunden (ab 2025-01-01)
Positionen werden korrekt erkannt
Script ist bereit fuer echten Sync
```

---

## Server-Sync Architektur (TODO)

**Ziel:** Automatischer Sync ohne dass PC an sein muss

**Optionen:**
1. Windows Task Scheduler auf APPSERVER
2. Node.js als Windows-Dienst
3. Bestehende ERP-Sync Mechanismen erweitern

**Zu pruefen:**
- Wie wurde der initiale ERP-Import nach Supabase gemacht?
- Gibt es bereits Sync-Scripts die auf dem Server laufen?

---

## Erledigte Auftraege

| Schritt | Status | Datum |
|---------|--------|-------|
| GPT-5.2 Extraktion Test (LOG-028) | Fertig | 2026-02-05 |
| Batch-GPT-Backtest (LOG-029) | Fertig | 2026-02-05 |
| Edge Function process-backtest-batch (LOG-030) | Fertig | 2026-02-05 |
| Sync-Positions Script (LOG-031) | Fertig | 2026-02-05 |
| Sync-Script KundenCode-Fix | Fertig | 2026-02-05 |
| Dry-Run Test | Fertig | 2026-02-05 |
