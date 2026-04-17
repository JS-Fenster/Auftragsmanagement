-- =============================================================================
-- INFRA-026 Phase 5c: Heartbeat-Incidents + Flapping-Detection + Auto-Recovery
-- 2026-04-17
-- =============================================================================
-- Motivation: check_stale_heartbeats() hatte keinen Recovery-Mechanismus und
-- feuerte alle 10min eine neue Notification wenn ein Heartbeat stale blieb.
-- Plus: Auto-Resolve fuer Heartbeats fehlte, Flapping war nicht erkennbar.
--
-- Dieses Update bringt die external-services-check Logik auch fuer Heartbeats:
--   - Stale: Incident oeffnen (falls keins offen), Notification (2h-Dedupe)
--   - Recovery (wieder healthy): offenes Incident schliessen + Notifications
--     archivieren
--   - Flapping: interval-abhaengige Schwelle (hourly: >3 incidents/24h)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_stale_heartbeats() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r              record;
  v_open_exists  boolean;
  v_dedupe       boolean;
  v_flap_count   int;
  v_window_hours int;
  v_flap_thr     int;
  v_is_flapping  boolean;
  v_body         text;
  v_title        text;
BEGIN
  -- ==========================================================================
  -- PART 1: STALE HEARTBEATS -> open incident + notify (deduped)
  -- ==========================================================================
  FOR r IN
    SELECT name, display_name, category, host, last_seen_at,
           expected_interval_seconds, severity_if_stale, stale_factor
      FROM public.automation_heartbeats
     WHERE (muted_until IS NULL OR muted_until < now())
       AND (last_seen_at IS NULL
            OR last_seen_at + make_interval(secs => (expected_interval_seconds * stale_factor)::int) < now())
  LOOP
    -- 1a. Incident oeffnen falls keins offen
    SELECT EXISTS (
      SELECT 1 FROM public.infra_incidents
      WHERE service_name = r.name
        AND category = 'heartbeat'
        AND ended_at IS NULL
    ) INTO v_open_exists;

    IF NOT v_open_exists THEN
      INSERT INTO public.infra_incidents (service_name, category, severity, description, metadata)
      VALUES (
        r.name,
        'heartbeat',
        r.severity_if_stale,
        format('Heartbeat fehlt: %s', r.display_name),
        jsonb_build_object(
          'display_name', r.display_name,
          'hb_category', r.category,
          'host', r.host,
          'last_seen_at', r.last_seen_at,
          'expected_interval_seconds', r.expected_interval_seconds,
          'stale_factor', r.stale_factor
        )
      );
    END IF;

    -- 1b. Interval-abhaengige Flapping-Schwelle
    IF r.expected_interval_seconds <= 3600 THEN
      v_flap_thr := 3; v_window_hours := 24;
    ELSIF r.expected_interval_seconds <= 86400 THEN
      v_flap_thr := 3; v_window_hours := 168;  -- 7 Tage
    ELSE
      v_flap_thr := 2; v_window_hours := 720;  -- 30 Tage
    END IF;

    SELECT COUNT(*) INTO v_flap_count
    FROM public.infra_incidents
    WHERE service_name = r.name
      AND category = 'heartbeat'
      AND started_at >= now() - make_interval(hours => v_window_hours);

    v_is_flapping := v_flap_count > v_flap_thr;

    -- 1c. Notification mit 2h-Dedupe
    SELECT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE source = 'heartbeat_check'
        AND archived = false
        AND metadata->>'heartbeat_name' = r.name
        AND created_at >= now() - interval '2 hours'
    ) INTO v_dedupe;

    IF NOT v_dedupe THEN
      IF v_is_flapping THEN
        v_title := format('%s flappt (%s× in %sh)', r.display_name, v_flap_count, v_window_hours);
        v_body  := format('Automation %s ist %s× in den letzten %sh ausgefallen und wiederhergestellt. Wiederkehrender Bug — Root Cause pruefen.'
                         || E'\n\nNächster Schritt: Logs des Hosts %s pruefen, Prozess-Restarts + OOM-Kills suchen, Crontab/Scheduler-Entry validieren.',
                         r.name, v_flap_count, v_window_hours, COALESCE(r.host, 'unbekannt'));
      ELSE
        v_title := format('Heartbeat fehlt: %s', r.display_name);
        v_body  := format('Automation %s hat seit %s nicht mehr gepingt (erwartet alle %s Sekunden).'
                         || E'\n\nNächster Schritt: Auf Host %s pruefen ob der Prozess laeuft (Scheduled Task / Cron / Systemd-Service je nach Typ).',
                         r.name, COALESCE(r.last_seen_at::text, 'nie'), r.expected_interval_seconds,
                         COALESCE(r.host, 'unbekannt'));
      END IF;

      PERFORM public.notify(
        p_type     => CASE WHEN v_is_flapping THEN 'error' ELSE 'error' END,
        p_severity => CASE WHEN v_is_flapping THEN 'high' ELSE r.severity_if_stale END,
        p_source   => 'heartbeat_check',
        p_title    => v_title,
        p_body     => v_body,
        p_metadata => jsonb_build_object(
          'heartbeat_name', r.name,
          'category', r.category,
          'host', r.host,
          'last_seen_at', r.last_seen_at,
          'expected_interval_seconds', r.expected_interval_seconds,
          'stale_factor', r.stale_factor,
          'flapping', v_is_flapping,
          'flap_count', v_flap_count,
          'flap_window_hours', v_window_hours
        )
      );
    END IF;
  END LOOP;

  -- ==========================================================================
  -- PART 2: RECOVERY -> close open incidents + archive notifications for
  -- heartbeats that are healthy again
  -- ==========================================================================
  WITH healthy AS (
    SELECT name
      FROM public.automation_heartbeats
     WHERE (muted_until IS NULL OR muted_until < now())
       AND last_seen_at IS NOT NULL
       AND last_seen_at + make_interval(secs => (expected_interval_seconds * stale_factor)::int) >= now()
  )
  UPDATE public.infra_incidents
     SET ended_at = now()
   WHERE category = 'heartbeat'
     AND ended_at IS NULL
     AND service_name IN (SELECT name FROM healthy);

  WITH healthy AS (
    SELECT name
      FROM public.automation_heartbeats
     WHERE (muted_until IS NULL OR muted_until < now())
       AND last_seen_at IS NOT NULL
       AND last_seen_at + make_interval(secs => (expected_interval_seconds * stale_factor)::int) >= now()
  )
  UPDATE public.notifications
     SET archived = true, read = true
   WHERE source = 'heartbeat_check'
     AND archived = false
     AND metadata->>'heartbeat_name' IN (SELECT name FROM healthy);
END;
$$;

COMMENT ON FUNCTION public.check_stale_heartbeats() IS
  'INFRA-026 Phase 5c: Scannt automation_heartbeats. Stale -> Incident oeffnen + Notification (2h dedupe) + interval-abhaengige Flapping-Detection. Healthy -> Incident schliessen + Notifications archivieren. Laeuft alle 10min via pg_cron.';
