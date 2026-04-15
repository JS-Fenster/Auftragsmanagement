-- INFRA-021 Phase 1 (2/2): Stale-Check + pg_cron Schedule
-- Sucht alle 10 Minuten nach Heartbeats die ueberfaellig sind und feuert
-- eine Notification via bestehendem public.notify() RPC.
-- Konzept: KB/wissen/IT_OBSERVABILITY.md Phase 1

CREATE OR REPLACE FUNCTION public.check_stale_heartbeats() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT name, display_name, category, host, last_seen_at,
           expected_interval_seconds, severity_if_stale, stale_factor
      FROM public.automation_heartbeats
     WHERE (muted_until IS NULL OR muted_until < now())
       AND (last_seen_at IS NULL
            OR last_seen_at + make_interval(secs => (expected_interval_seconds * stale_factor)::int) < now())
  LOOP
    PERFORM public.notify(
      p_type     => 'error',
      p_severity => r.severity_if_stale,
      p_source   => 'heartbeat_check',
      p_title    => format('Heartbeat fehlt: %s', r.display_name),
      p_body     => format('Automation %s hat seit %s nicht mehr gepingt (erwartet alle %s Sekunden).',
                           r.name, COALESCE(r.last_seen_at::text, 'nie'), r.expected_interval_seconds),
      p_metadata => jsonb_build_object(
        'heartbeat_name', r.name,
        'category', r.category,
        'host', r.host,
        'last_seen_at', r.last_seen_at,
        'expected_interval_seconds', r.expected_interval_seconds,
        'stale_factor', r.stale_factor
      )
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.check_stale_heartbeats() FROM public;
GRANT EXECUTE ON FUNCTION public.check_stale_heartbeats() TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-stale-heartbeats') THEN
    PERFORM cron.schedule('check-stale-heartbeats', '*/10 * * * *', $cron$SELECT public.check_stale_heartbeats()$cron$);
  END IF;
END
$$;

COMMENT ON FUNCTION public.check_stale_heartbeats() IS 'INFRA-021: Scannt automation_heartbeats nach ueberfaelligen Eintraegen und feuert eine Notification via public.notify(). Laeuft alle 10 Minuten via pg_cron (Job check-stale-heartbeats).';
