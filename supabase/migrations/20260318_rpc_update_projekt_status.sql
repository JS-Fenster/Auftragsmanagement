-- LLM-016: RPC for Jess to atomically update project status
-- Updates status + relevant date column + creates history entry

CREATE OR REPLACE FUNCTION update_projekt_status(
  p_projekt_id UUID,
  p_neuer_status TEXT,
  p_kommentar TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_projekt RECORD;
  v_alter_status TEXT;
  v_datum_spalte TEXT;
BEGIN
  -- Fetch current project
  SELECT id, titel, status INTO v_projekt
  FROM projekte
  WHERE id = p_projekt_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projekt nicht gefunden: %', p_projekt_id;
  END IF;

  v_alter_status := v_projekt.status;

  -- Validate status value
  IF p_neuer_status NOT IN (
    'anfrage', 'angebot', 'auftrag', 'bestellt', 'ab_erhalten',
    'lieferung_geplant', 'montagebereit', 'abnahme', 'rechnung',
    'bezahlt', 'erledigt', 'reklamation', 'storniert', 'pausiert'
  ) THEN
    RAISE EXCEPTION 'Ungueltiger Status: %', p_neuer_status;
  END IF;

  -- Map status to date column
  v_datum_spalte := CASE p_neuer_status
    WHEN 'angebot' THEN 'angebots_datum'
    WHEN 'auftrag' THEN 'auftrags_datum'
    WHEN 'bestellt' THEN 'bestell_datum'
    WHEN 'ab_erhalten' THEN 'ab_datum'
    WHEN 'montagebereit' THEN 'montage_datum'
    WHEN 'abnahme' THEN 'abnahme_datum'
    WHEN 'rechnung' THEN 'rechnung_datum'
    WHEN 'bezahlt' THEN 'bezahlt_datum'
    WHEN 'erledigt' THEN 'erledigt_datum'
    WHEN 'storniert' THEN 'storniert_datum'
    WHEN 'pausiert' THEN 'pausiert_datum'
    WHEN 'reklamation' THEN 'reklamation_datum'
    ELSE NULL
  END;

  -- Update status + date + vorheriger_status for special statuses
  UPDATE projekte
  SET status = p_neuer_status,
      updated_at = NOW(),
      vorheriger_status = CASE
        WHEN p_neuer_status IN ('reklamation', 'storniert', 'pausiert')
        THEN v_alter_status
        ELSE vorheriger_status
      END
  WHERE id = p_projekt_id;

  -- Update date column dynamically if applicable
  IF v_datum_spalte IS NOT NULL THEN
    EXECUTE format('UPDATE projekte SET %I = CURRENT_DATE WHERE id = $1', v_datum_spalte)
    USING p_projekt_id;
  END IF;

  -- Create history entry
  INSERT INTO projekt_historie (projekt_id, aktion, feld, alter_wert, neuer_wert, erstellt_von)
  VALUES (
    p_projekt_id,
    'status_aenderung',
    'status',
    v_alter_status,
    p_neuer_status,
    'jess-assistant'
  );

  -- Add comment as separate history entry if provided
  IF p_kommentar IS NOT NULL AND p_kommentar != '' THEN
    INSERT INTO projekt_historie (projekt_id, aktion, feld, neuer_wert, erstellt_von)
    VALUES (p_projekt_id, 'kommentar', NULL, p_kommentar, 'jess-assistant');
  END IF;

  RETURN jsonb_build_object(
    'projekt_id', p_projekt_id,
    'titel', v_projekt.titel,
    'alter_status', v_alter_status,
    'neuer_status', p_neuer_status
  );
END;
$$;
