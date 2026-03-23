-- =============================================================================
-- Cron-Jobs fuer Alert-System (pg_cron + pg_net)
-- Datum: 2026-03-23
-- Status: BEREIT ZUM DEPLOYMENT (CLI only)
-- =============================================================================
-- WICHTIG: Gleiche Voraussetzungen wie sql_cron_batch_process.sql:
--   1. Authorization: Bearer <anon_key> (Supabase Gateway verlangt das)
--   2. timeout_milliseconds := 30000 (Default 5s ist zu kurz fuer Cold Starts)
-- =============================================================================

-- Bestehende Jobs pruefen (sollte Jobs 5, 6, 7 zeigen)
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;

-- =============================================================================
-- Job: system-health (alle 30 Min) — Zentrale Health Checks
-- Checks: Sub-Ablauf, Stale Pipeline, Queue-Tiefe, Klassifikation, Inaktive Subs
-- ACHTUNG: system-health braucht INTERNAL_API_KEY zur Autorisierung
-- =============================================================================
SELECT cron.schedule(
  'system-health',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rsmjgdujlpnydbsfuiek.supabase.co/functions/v1/system-health',
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
-- Job: reparatur-aging (taeglich 05:00 UTC = 07:00 MESZ)
-- Setzt ist_zu_lange_offen Flag auf Auftraege ohne Kontakt seit 14 Tagen
-- =============================================================================
SELECT cron.schedule(
  'reparatur-aging',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rsmjgdujlpnydbsfuiek.supabase.co/functions/v1/reparatur-aging',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbWpnZHVqbHBueWRic2Z1aWVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NjY0NTcsImV4cCI6MjA4MTM0MjQ1N30.da6ZwbEfqhqdsZlKYNUGP7uvu8A7qwlVLBI0IK4uQfc'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

-- =============================================================================
-- Job: retry-queued (alle 30 Min) — Queued Emails erneut verarbeiten
-- =============================================================================
SELECT cron.schedule(
  'retry-queued',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rsmjgdujlpnydbsfuiek.supabase.co/functions/v1/retry-queued',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbWpnZHVqbHBueWRic2Z1aWVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NjY0NTcsImV4cCI6MjA4MTM0MjQ1N30.da6ZwbEfqhqdsZlKYNUGP7uvu8A7qwlVLBI0IK4uQfc'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

-- =============================================================================
-- Job: notification-cleanup (Sonntags 03:00 UTC) — 90 Tage Retention
-- Referenz: Migration 20260313_notifications_system.sql Kommentar
-- =============================================================================
SELECT cron.schedule(
  'notification-cleanup',
  '0 3 * * 0',
  $$
  DELETE FROM public.notifications WHERE created_at < now() - interval '90 days';
  $$
);

-- Alle Jobs verifizieren (sollte jetzt 7 Jobs zeigen)
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;

-- =============================================================================
-- Wartung: Jobs entfernen
-- =============================================================================
-- SELECT cron.unschedule('system-health');
-- SELECT cron.unschedule('reparatur-aging');
-- SELECT cron.unschedule('retry-queued');
-- SELECT cron.unschedule('notification-cleanup');

-- =============================================================================
-- Wartung: Letzte Responses pruefen
-- =============================================================================
-- SELECT r.id, r.status_code, left(r.content::text, 200), left(r.error_msg, 200), r.created
-- FROM net._http_response r ORDER BY r.created DESC LIMIT 20;
