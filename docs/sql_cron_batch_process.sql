-- =============================================================================
-- Cron-Jobs fuer Edge Functions (pg_cron + pg_net)
-- Datum: 2026-02-12
-- Status: ALLE 3 JOBS AKTIV UND VERIFIZIERT
-- =============================================================================
-- WICHTIG: Zwei Voraussetzungen fuer pg_cron → Edge Function Calls:
--   1. Authorization: Bearer <anon_key> (Supabase Gateway verlangt das)
--   2. timeout_milliseconds := 30000 (Default 5s ist zu kurz fuer Cold Starts)
-- =============================================================================

-- Bestehende Jobs pruefen
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;

-- =============================================================================
-- Job 1: batch-process-pending (alle 15 Min) — Safety-Net fuer stuck Docs
-- AKTIV seit 2026-02-12 (Job ID 7)
-- =============================================================================
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
    body := '{"limit": 10}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

-- =============================================================================
-- Job 2: renew-email-subscriptions (06:00, 18:00 UTC)
-- AKTIV seit 2026-02-12 (Job ID 5)
-- =============================================================================
SELECT cron.schedule(
  'renew-email-subscriptions',
  '0 6,18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rsmjgdujlpnydbsfuiek.supabase.co/functions/v1/renew-subscriptions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbWpnZHVqbHBueWRic2Z1aWVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NjY0NTcsImV4cCI6MjA4MTM0MjQ1N30.da6ZwbEfqhqdsZlKYNUGP7uvu8A7qwlVLBI0IK4uQfc',
      'x-api-key', get_app_config('INTERNAL_API_KEY')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

-- =============================================================================
-- Job 3: renew-email-subscriptions-safety (00:00, 12:00 UTC)
-- AKTIV seit 2026-02-12 (Job ID 6)
-- =============================================================================
SELECT cron.schedule(
  'renew-email-subscriptions-safety',
  '0 0,12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rsmjgdujlpnydbsfuiek.supabase.co/functions/v1/renew-subscriptions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbWpnZHVqbHBueWRic2Z1aWVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NjY0NTcsImV4cCI6MjA4MTM0MjQ1N30.da6ZwbEfqhqdsZlKYNUGP7uvu8A7qwlVLBI0IK4uQfc',
      'x-api-key', get_app_config('INTERNAL_API_KEY')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

-- Alle Jobs verifizieren
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;

-- =============================================================================
-- Wartung: Job entfernen
-- =============================================================================
-- SELECT cron.unschedule('batch-process-pending');
-- SELECT cron.unschedule('renew-email-subscriptions');
-- SELECT cron.unschedule('renew-email-subscriptions-safety');

-- =============================================================================
-- Wartung: Letzte Responses pruefen
-- =============================================================================
-- SELECT r.id, r.status_code, left(r.content::text, 200), left(r.error_msg, 200), r.created
-- FROM net._http_response r ORDER BY r.created DESC LIMIT 20;
