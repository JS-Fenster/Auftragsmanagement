-- Welle 2 Etappe 4 (Teil 1): pg_cron für Bescheinigungs-Status "abgelaufen"
-- Scope:
--   - update_bescheinigungen_status() RPC — setzt bescheinigungen.status='abgelaufen'
--     wenn gueltig_bis < current_date und status='gueltig'
--   - pg_cron Daily 06:05 Uhr UTC
--   - automation_heartbeats-Registrierung
-- Email-Automation bei Ablauf ist AM-203 Backlog (benötigt AM-046 Email-Infra)
-- Bezug: AM-0209 Session-Handover, Welle 2 Etappe 4 Teil A

BEGIN;

CREATE OR REPLACE FUNCTION update_bescheinigungen_status()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  WITH upd AS (
    UPDATE bescheinigungen
    SET status = 'abgelaufen', updated_at = now()
    WHERE status = 'gueltig' AND gueltig_bis < current_date
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_updated FROM upd;

  INSERT INTO automation_heartbeats (name, display_name, category, last_seen_at, last_status, last_detail, expected_interval_seconds, stale_factor, severity_if_stale)
  VALUES ('update_bescheinigungen_status', 'Bescheinigungs-Status auto-Update', 'maintenance', now(), 'ok', jsonb_build_object('updated_count', v_updated), 86400, 3, 'warning')
  ON CONFLICT (name) DO UPDATE SET
    last_seen_at = now(),
    last_status  = 'ok',
    last_detail  = jsonb_build_object('updated_count', v_updated),
    updated_at   = now();

  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION update_bescheinigungen_status IS
  'Setzt Bescheinigungen auf abgelaufen wenn gueltig_bis < today. Laeuft taeglich via pg_cron 06:05 UTC. Email-Benachrichtigung separat (AM-203).';

SELECT cron.schedule('update-bescheinigungen-status', '5 6 * * *', 'SELECT update_bescheinigungen_status();');

INSERT INTO automation_heartbeats (name, display_name, category, last_seen_at, last_status, last_detail, expected_interval_seconds, stale_factor, severity_if_stale)
VALUES ('update_bescheinigungen_status', 'Bescheinigungs-Status auto-Update', 'maintenance', now(), 'ok', jsonb_build_object('message', 'initial registration'), 86400, 3, 'warning')
ON CONFLICT (name) DO NOTHING;

COMMIT;
