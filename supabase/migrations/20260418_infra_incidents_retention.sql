-- =============================================================================
-- INFRA-026 Phase 5d: Retention für infra_incidents
-- 2026-04-18
-- =============================================================================
-- Geschlossene Incidents älter als 180 Tage werden wöchentlich gelöscht.
-- Offene Incidents bleiben IMMER, egal wie alt.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_infra_incidents() RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  WITH deleted AS (
    DELETE FROM public.infra_incidents
     WHERE ended_at IS NOT NULL
       AND ended_at < now() - interval '180 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;

  -- Self-heartbeat damit der wöchentliche pg_cron nicht stale meldet
  PERFORM public.heartbeat(
    'db_cleanup_infra_incidents'::text,
    'ok'::text,
    jsonb_build_object('deleted', v_deleted)
  );

  RETURN v_deleted;
END;
$$;

-- Heartbeat-Row registrieren (wöchentlich, low severity wenn stale)
INSERT INTO public.automation_heartbeats
  (name, display_name, category, host, expected_interval_seconds, stale_factor, severity_if_stale)
VALUES
  ('db_cleanup_infra_incidents', 'Infra Incidents Retention (weekly)', 'monitoring', 'supabase',
   604800, 2, 'low')
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name;

REVOKE ALL ON FUNCTION public.cleanup_old_infra_incidents() FROM public;
GRANT EXECUTE ON FUNCTION public.cleanup_old_infra_incidents() TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-infra-incidents') THEN
    PERFORM cron.schedule('cleanup-infra-incidents', '33 3 * * 0', $cron$SELECT public.cleanup_old_infra_incidents()$cron$);
  END IF;
END
$$;

COMMENT ON FUNCTION public.cleanup_old_infra_incidents() IS
  'INFRA-026 Retention: löscht geschlossene Incidents älter als 180 Tage. Läuft wöchentlich Sonntag 03:33 UTC via pg_cron.';
