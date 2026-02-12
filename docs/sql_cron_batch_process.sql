-- =============================================================================
-- Cron-Job fuer batch-process-pending
-- Datum: 2026-02-12
-- =============================================================================
-- Dieses Script im Supabase SQL Editor (Dashboard) ausfuehren.
-- Voraussetzung: pg_cron und pg_net Extensions muessen aktiv sein.
-- =============================================================================

-- 1. Pruefen ob pg_cron Extension aktiv ist
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- 2. Falls NICHT aktiv, Extension aktivieren (braucht superuser/dashboard):
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 3. Pruefen ob pg_net Extension aktiv ist (fuer HTTP calls aus SQL)
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- 4. Falls NICHT aktiv:
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- 5. Bestehende Jobs pruefen
SELECT * FROM cron.job;

-- 6. Cron-Job einrichten: batch-process-pending alle 15 Minuten
-- WICHTIG: Authorization-Header mit anon key ist PFLICHT (Supabase Gateway)
-- x-api-key kommt aus get_app_config() (gleich wie renew-subscriptions)
-- BEREITS AKTIV seit 2026-02-12 (Job ID 4)
SELECT cron.schedule(
  'batch-process-pending',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rsmjgdujlpnydbsfuiek.supabase.co/functions/v1/batch-process-pending',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbWpnZHVqbHBueWRic2Z1aWVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NjY0NTcsImV4cCI6MjA4MTM0MjQ1N30.da6ZwbEfqhqdsZlKYNUGP7uvu8A7qwlVLBI0IK4uQfc',
      'x-api-key', get_app_config('INTERNAL_API_KEY')
    ),
    body := '{"limit": 10}'::jsonb
  ) AS request_id;
  $$
);

-- 7. Job verifizieren
SELECT * FROM cron.job WHERE jobname = 'batch-process-pending';


-- =============================================================================
-- EINMALIG: 6 stuck Dokumente reprocessen (nach Deploy von Fix 1+2)
-- =============================================================================
-- Option A: batch-process-pending manuell aufrufen (holt alle pending_ocr ab)
-- Option B: Falls Docs schon als 'processing_failed' markiert wurden, Status zuruecksetzen:

-- Erst pruefen was stuck ist:
SELECT id, kategorie, processing_status, processing_last_error, created_at, updated_at
FROM documents
WHERE kategorie = 'Email_Anhang'
  AND processing_status IN ('pending_ocr', 'processing_failed')
  AND created_at >= '2026-02-10'
ORDER BY created_at;

-- Dann zuruecksetzen auf pending_ocr damit batch-process-pending sie abholt:
-- UPDATE documents
-- SET processing_status = 'pending_ocr',
--     processing_last_error = NULL,
--     updated_at = now()
-- WHERE kategorie = 'Email_Anhang'
--   AND processing_status IN ('pending_ocr', 'processing_failed')
--   AND ocr_text IS NULL
--   AND created_at >= '2026-02-10';
