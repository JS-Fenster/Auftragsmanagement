-- =============================================================================
-- INFRA-026 Phase 5b: Incident Tracking (Flapping Detection)
-- 2026-04-17
-- =============================================================================
-- Motivation: Auto-resolve (closing notifications when service recovers) makes
-- bell stay clean BUT hides recurring issues. A service flapping every 2h never
-- gets fixed because each alert vanishes after recovery.
--
-- Solution: Permanent incident log with open/close timestamps. Flapping detector
-- counts incidents per time window, interval-dependent thresholds.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.infra_incidents (
  id               bigserial PRIMARY KEY,
  service_name     text NOT NULL,
  category         text NOT NULL,          -- e.g. 'external_service', 'heartbeat', 'expiring_item'
  severity         text NOT NULL,          -- critical/high/medium/low
  description      text,
  started_at       timestamptz NOT NULL DEFAULT now(),
  ended_at         timestamptz,
  duration_seconds int GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (ended_at - started_at))::int) STORED,
  metadata         jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Open incidents: fast lookup for auto-resolve
CREATE INDEX IF NOT EXISTS idx_infra_incidents_open
  ON public.infra_incidents (service_name)
  WHERE ended_at IS NULL;

-- Recent incidents: fast lookup for flapping detection + reports
CREATE INDEX IF NOT EXISTS idx_infra_incidents_recent
  ON public.infra_incidents (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_infra_incidents_service_started
  ON public.infra_incidents (service_name, started_at DESC);

-- RLS
ALTER TABLE public.infra_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "infra_incidents_read" ON public.infra_incidents;
CREATE POLICY "infra_incidents_read" ON public.infra_incidents
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "infra_incidents_write_service_role" ON public.infra_incidents;
CREATE POLICY "infra_incidents_write_service_role" ON public.infra_incidents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.infra_incidents IS
  'Permanent incident log. Auto-resolve closes the incident (sets ended_at) but history remains for flapping detection and weekly reports.';
