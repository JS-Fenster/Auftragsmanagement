-- Welle 2 Etappe 2b: Auto-Heilung TEMP-Belegnummern
-- Scope:
--   - heal_temp_beleg_nummern() RPC: findet belege mit beleg_nummer LIKE '%-TEMP%',
--     holt echte Nummer via next_nummer, updated. Nur bei ist_eingefroren=false.
--   - pg_cron Job alle 15 Minuten als Safety-Net (wenn User Beleg nicht wieder öffnet)
--   - automation_heartbeats-Entry für Monitoring
-- Warum: TEMP-Nummer-Fallback (generateBelegNummer bei RPC-Fehler) ist nur Notnagel.
--        Save-Time-Heilung (Frontend) + Safety-Net-Cron halten den Datenbestand sauber.
--        Vorgriff auf Offline-PWA (AM-083) — dort wird das Pattern systematisch.
-- Risiko: LOW — Funktion läuft nur auf nicht-eingefrorenen Belegen, Cron idempotent.

BEGIN;

-- ============================================================
-- 1. Heil-RPC
-- ============================================================
CREATE OR REPLACE FUNCTION heal_temp_beleg_nummern()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_healed INTEGER := 0;
  v_row    RECORD;
  v_new_nr TEXT;
BEGIN
  FOR v_row IN
    SELECT id, beleg_typ, beleg_nummer FROM belege
    WHERE beleg_nummer LIKE '%-TEMP%' AND ist_eingefroren = false
    ORDER BY created_at ASC
  LOOP
    v_new_nr := next_nummer(v_row.beleg_typ);
    UPDATE belege SET beleg_nummer = v_new_nr WHERE id = v_row.id;
    v_healed := v_healed + 1;
  END LOOP;

  -- Heartbeat: immer bei Lauf aktualisieren (auch bei 0 Heilungen = alles sauber)
  INSERT INTO automation_heartbeats (name, display_name, category, last_seen_at, last_status, last_detail, expected_interval_seconds, stale_factor, severity_if_stale)
  VALUES (
    'heal_temp_beleg_nummern',
    'Heilung TEMP-Belegnummern',
    'maintenance',
    now(),
    'ok',
    jsonb_build_object('healed_count', v_healed),
    900,      -- 15 min
    3,        -- 45 min = stale
    'warning'
  )
  ON CONFLICT (name) DO UPDATE SET
    last_seen_at = now(),
    last_status  = 'ok',
    last_detail  = jsonb_build_object('healed_count', v_healed),
    updated_at   = now();

  RETURN v_healed;
END;
$$;

COMMENT ON FUNCTION heal_temp_beleg_nummern IS
  'Safety-Net: Heilt belege mit TEMP-Belegnummer durch echte next_nummer. Läuft alle 15 min via pg_cron, ignoriert eingefrorene Belege. Registriert Heartbeat bei jedem Lauf.';

-- ============================================================
-- 2. pg_cron Job alle 15 Minuten
-- ============================================================
SELECT cron.schedule(
  'heal-temp-beleg-nummern',
  '*/15 * * * *',
  $$SELECT heal_temp_beleg_nummern();$$
);

-- ============================================================
-- 3. Initial-Heartbeat (damit Monitoring sofort weiss dass Job existiert)
-- ============================================================
INSERT INTO automation_heartbeats (name, display_name, category, last_seen_at, last_status, last_detail, expected_interval_seconds, stale_factor, severity_if_stale)
VALUES (
  'heal_temp_beleg_nummern',
  'Heilung TEMP-Belegnummern',
  'maintenance',
  now(),
  'ok',
  jsonb_build_object('message', 'initial registration'),
  900,
  3,
  'warning'
)
ON CONFLICT (name) DO NOTHING;

COMMIT;
