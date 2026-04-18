-- RPC fuer ZE-R2c: Atomare Bearbeitung von Zeit-Korrekturen
-- Fixes race condition: bisher 2 separate UPDATEs (zeit_korrekturen + zeitstempel)
-- Bei Failure zwischen beiden Updates war die Korrektur "genehmigt" ohne dass der Stempel geaendert wurde.

CREATE OR REPLACE FUNCTION public.approve_correction(
  p_korrektur_id uuid,
  p_gf_id uuid,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_korrektur zeit_korrekturen%ROWTYPE;
BEGIN
  IF p_action NOT IN ('genehmigt', 'abgelehnt') THEN
    RAISE EXCEPTION 'Invalid action: %', p_action USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_korrektur FROM zeit_korrekturen WHERE id = p_korrektur_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Korrektur % nicht gefunden', p_korrektur_id USING ERRCODE = 'P0002';
  END IF;

  IF v_korrektur.status <> 'offen' THEN
    RAISE EXCEPTION 'Korrektur bereits bearbeitet (Status: %)', v_korrektur.status USING ERRCODE = '22023';
  END IF;

  UPDATE zeit_korrekturen
  SET status = p_action, genehmigt_von = p_gf_id, genehmigt_am = now()
  WHERE id = p_korrektur_id;

  IF p_action = 'genehmigt' AND (v_korrektur.neuer_zeitpunkt IS NOT NULL OR v_korrektur.neuer_typ IS NOT NULL) THEN
    UPDATE zeitstempel
    SET zeitpunkt = COALESCE(v_korrektur.neuer_zeitpunkt, zeitpunkt),
        typ = COALESCE(v_korrektur.neuer_typ, typ),
        quelle = 'korrektur'
    WHERE id = v_korrektur.zeitstempel_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Zeitstempel % nicht gefunden', v_korrektur.zeitstempel_id USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', p_action, 'korrektur_id', p_korrektur_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_correction(uuid, uuid, text) TO authenticated;
