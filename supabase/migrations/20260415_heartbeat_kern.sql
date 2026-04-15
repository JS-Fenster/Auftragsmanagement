-- INFRA-021 Phase 1: Heartbeat-Kern
-- Tabelle + RPC fuer "ich lebe"-Pings von Automationen + pg_cron Stale-Check.
-- Neue, isolierte Struktur - aendert nichts am bestehenden AM-Kernschema.
-- Konzept: KB/wissen/IT_OBSERVABILITY.md Phase 1

CREATE TABLE IF NOT EXISTS public.automation_heartbeats (
  id                         bigserial PRIMARY KEY,
  name                       text NOT NULL UNIQUE,
  display_name               text NOT NULL,
  category                   text NOT NULL,
  host                       text,
  last_seen_at               timestamptz,
  last_status                text,
  last_detail                jsonb,
  expected_interval_seconds  int NOT NULL,
  stale_factor               numeric NOT NULL DEFAULT 1.5,
  severity_if_stale          text NOT NULL DEFAULT 'high',
  muted_until                timestamptz,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_heartbeats_stale
  ON public.automation_heartbeats (last_seen_at, expected_interval_seconds)
  WHERE muted_until IS NULL OR muted_until < now();

ALTER TABLE public.automation_heartbeats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS heartbeats_read_auth ON public.automation_heartbeats;
CREATE POLICY heartbeats_read_auth ON public.automation_heartbeats
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS heartbeats_write_service ON public.automation_heartbeats;
CREATE POLICY heartbeats_write_service ON public.automation_heartbeats
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.heartbeat(
  p_name text,
  p_status text DEFAULT 'ok',
  p_detail jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.automation_heartbeats
     SET last_seen_at = now(),
         last_status  = p_status,
         last_detail  = COALESCE(p_detail, last_detail),
         updated_at   = now()
   WHERE name = p_name;
  IF NOT FOUND THEN
    RAISE NOTICE 'heartbeat: unknown name %, skipping', p_name;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.heartbeat(text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.heartbeat(text, text, jsonb) TO anon, authenticated, service_role;

COMMENT ON TABLE public.automation_heartbeats IS 'INFRA-021: Register aller ueberwachten Automationen. last_seen_at wird durch RPC heartbeat() aktualisiert, check_stale_heartbeats() alarmiert bei Stille.';
COMMENT ON FUNCTION public.heartbeat(text, text, jsonb) IS 'INFRA-021: Upsert last_seen_at + status fuer eine Automation. Unbekannte Namen werden ignoriert (Script-Fehler soll kein DB-Error sein).';
