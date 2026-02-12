# Fix: Email-Anhang Pipeline - Stuck pending_ocr

**Datum:** 2026-02-12
**Betrifft:** process-email v4.1.0, batch-process-pending v1.1.0

---

## Problem

6 Dokumente mit `kategorie='Email_Anhang'` und `processing_status='pending_ocr'` seit
10.02.2026 stuck. Ursache: `process-email` ruft `process-document` per einfachem `fetch()`
ohne Timeout oder Retry auf. Bei Fehler nur `console.warn()` — Dokument bleibt ewig als
`pending_ocr` haengen.

## Root Cause

1. **Kein Timeout** — fetch() wartet unbegrenzt, kann bei Edge Function Timeout abbrechen
2. **Kein Retry** — ein einziger Fehler reicht, Dokument ist stuck
3. **Kein Error-Status** — bei Fehler wird processing_status nicht aktualisiert
4. **Kein Cron** — batch-process-pending existiert, aber kein pg_cron Job konfiguriert

## Fixes

### Fix 1: process-email v4.0.0 → v4.1.0

**Datei:** `supabase/functions/process-email/index.ts`

Aenderungen:
- `fetchWithRetry()` Funktion: 55s Timeout, 2 Retries, exponentieller Backoff
- `fetch()` Aufruf fuer process-document ersetzt durch `fetchWithRetry()`
- `markAttachmentFailed()` Funktion: Setzt `processing_status='processing_failed'` bei endgueltigem Fehler
- Error-Handler erweitert: HTTP-Fehler und Exceptions setzen jetzt explizit Fehler-Status

### Fix 2: batch-process-pending v1.0.0 → v1.1.0

**Datei:** `supabase/functions/batch-process-pending/index.ts`

Aenderungen:
- `fetchWithRetry()` Funktion: 55s Timeout, 1 Retry
- `fetch()` in `processDocument()` ersetzt durch `fetchWithRetry()`

### Fix 3: pg_cron Job (manuell in Supabase)

Siehe `docs/sql_cron_batch_process.sql` fuer SQL-Befehle.

## Deploy-Reihenfolge

1. `process-email` deployen (Fix 1)
2. `batch-process-pending` deployen (Fix 2)
3. pg_cron pruefen/aktivieren (Fix 3 — SQL im Supabase Dashboard)
4. 6 stuck Docs reprocessen (einmalig batch-process-pending aufrufen)

## Ergebnis (deployed + verifiziert 2026-02-12)

Alle 3 Fixes erfolgreich angewendet:

| Schritt | Status | Details |
|---------|--------|---------|
| Deploy process-email v4.1.0 | OK | Supabase Functions deployed |
| Deploy batch-process-pending v1.1.0 | OK | Supabase Functions deployed |
| pg_cron Job | OK | Job ID 4, `*/15 * * * *`, mit Auth-Header |
| 6 stuck Docs reprocessen | OK | Alle 6/6 erfolgreich verarbeitet |

Ergebnis der 6 stuck Dokumente:

| Dokument | Neue Kategorie | OCR |
|----------|---------------|-----|
| eVB_GVGJVKJ (44061970) | Sonstiges_Dokument | ja |
| EmailAttachment001 (71719f69) | Auftragsbestaetigung | ja |
| 617321_Gesamtsummenblatt (5b0a4d2e) | Sonstiges_Dokument | nein (Excel) |
| EmailAttachment001 (3a0a0a05) | Auftragsbestaetigung | ja |
| EmailAttachment001 (7fa127da) | Auftragsbestaetigung | ja |
| EmailAttachment001 (71a3257e) | Auftragsbestaetigung | ja |

### Fix 4: pg_cron Jobs — Auth-Header + Timeout (Bonus-Fix)

**Problem gefunden bei Verifizierung:** Alle pg_cron Jobs (auch renew-subscriptions) hatten:
1. Keinen `Authorization: Bearer <anon_key>` Header → 401 vom Supabase Gateway
2. Default pg_net Timeout von 5s → Edge Function Cold Starts (3-5s) fuehren zu Timeouts

**Loesung:** Alle 3 Cron-Jobs neu erstellt mit:
- `Authorization: Bearer <anon_key>` Header (Supabase Gateway)
- `timeout_milliseconds := 30000` (30s statt 5s Default)

| Job | Schedule | Status |
|-----|----------|--------|
| renew-email-subscriptions | `0 6,18 * * *` | OK (Job ID 5) |
| renew-email-subscriptions-safety | `0 0,12 * * *` | OK (Job ID 6) |
| batch-process-pending | `*/15 * * * *` | OK (Job ID 7) |

**Verifiziert:** 13:30 UTC → HTTP 200, kein Timeout mehr.

## Rollback

Git revert moeglich — Aenderungen sind additiv (Wrapper um bestehenden fetch).
pg_cron Jobs koennen via `cron.unschedule('jobname')` entfernt werden.
