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

## Rollback

Git revert moeglich — Aenderungen sind additiv (Wrapper um bestehenden fetch).

## Test

Nach Deploy eine Test-Email mit PDF-Anhang senden. Pruefen:
- Anhang wird als eigenes Document erstellt
- `processing_status` geht von `pending_ocr` auf `done`
- Bei Fehler: Status wird auf `processing_failed` gesetzt (nicht stuck als `pending_ocr`)
