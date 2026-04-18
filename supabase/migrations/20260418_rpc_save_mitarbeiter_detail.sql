-- RPC fuer MA-R2b: Atomare Speicherung aller MA-Detail-Aenderungen
-- Fixes partial-save: bisher 5 separate Supabase-Calls (personen, sperrliste, ma_daten, kontakte, adressen).
-- Bei Failure in der Mitte blieb der MA in inkonsistentem Zustand.

CREATE OR REPLACE FUNCTION public.save_mitarbeiter_detail(
  p_person_id uuid,
  p_ma_daten_id uuid,
  p_person jsonb,
  p_ma_daten jsonb,
  p_kontaktdaten jsonb DEFAULT '[]'::jsonb,
  p_adressen jsonb DEFAULT '[]'::jsonb,
  p_zeichen_sperre jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
BEGIN
  -- 1. Update personen (NOT-NULL-Felder mit COALESCE-Fallback)
  UPDATE personen SET
    vorname = COALESCE(NULLIF(p_person->>'vorname', ''), vorname),
    nachname = COALESCE(NULLIF(p_person->>'nachname', ''), nachname),
    titel = NULLIF(p_person->>'titel', ''),
    anrede = NULLIF(p_person->>'anrede', ''),
    geburtsdatum = (NULLIF(p_person->>'geburtsdatum', ''))::date,
    zeichen = NULLIF(p_person->>'zeichen', ''),
    foto_url = NULLIF(p_person->>'foto_url', ''),
    notizen = NULLIF(p_person->>'notizen', ''),
    geburtsname = NULLIF(p_person->>'geburtsname', ''),
    familienstand = NULLIF(p_person->>'familienstand', ''),
    updated_at = now()
  WHERE id = p_person_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Person % nicht gefunden', p_person_id USING ERRCODE = 'P0002';
  END IF;

  -- 2. Optional: altes Zeichen in Sperrliste eintragen
  IF p_zeichen_sperre IS NOT NULL AND (p_zeichen_sperre->>'zeichen') IS NOT NULL THEN
    INSERT INTO zeichen_sperrliste (zeichen, grund, quelle, ex_mitarbeiter_id, gesperrt_ab)
    VALUES (
      p_zeichen_sperre->>'zeichen',
      p_zeichen_sperre->>'grund',
      'historic',
      NULLIF(p_zeichen_sperre->>'ex_mitarbeiter_id', '')::uuid,
      CURRENT_DATE
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- 3. Update mitarbeiter_daten
  UPDATE mitarbeiter_daten SET
    personalnummer = NULLIF(p_ma_daten->>'personalnummer', ''),
    beschaeftigungsart = NULLIF(p_ma_daten->>'beschaeftigungsart', ''),
    abteilung = NULLIF(p_ma_daten->>'abteilung', ''),
    funktion = NULLIF(p_ma_daten->>'funktion', ''),
    eintrittsdatum = COALESCE((NULLIF(p_ma_daten->>'eintrittsdatum', ''))::date, eintrittsdatum),
    austrittsdatum = (NULLIF(p_ma_daten->>'austrittsdatum', ''))::date,
    probezeit_monate = (NULLIF(p_ma_daten->>'probezeit_monate', ''))::integer,
    status = COALESCE(NULLIF(p_ma_daten->>'status', ''), status),
    verguetungsart = NULLIF(p_ma_daten->>'verguetungsart', ''),
    steuer_id = NULLIF(p_ma_daten->>'steuer_id', ''),
    steuerklasse = (NULLIF(p_ma_daten->>'steuerklasse', ''))::integer,
    kinderfreibetraege = (NULLIF(p_ma_daten->>'kinderfreibetraege', ''))::numeric,
    konfession = NULLIF(p_ma_daten->>'konfession', ''),
    sv_nummer = NULLIF(p_ma_daten->>'sv_nummer', ''),
    rv_nummer = NULLIF(p_ma_daten->>'rv_nummer', ''),
    krankenkasse = NULLIF(p_ma_daten->>'krankenkasse', ''),
    bank = NULLIF(p_ma_daten->>'bank', ''),
    iban = NULLIF(p_ma_daten->>'iban', ''),
    bic = NULLIF(p_ma_daten->>'bic', ''),
    lohnsatz_1 = (NULLIF(p_ma_daten->>'lohnsatz_1', ''))::numeric,
    pausenregel = CASE WHEN p_ma_daten ? 'pausenregel' AND p_ma_daten->'pausenregel' <> 'null'::jsonb THEN p_ma_daten->'pausenregel' ELSE pausenregel END,
    rundung_taktung = (NULLIF(p_ma_daten->>'rundung_taktung', ''))::integer,
    rundung_kommen = NULLIF(p_ma_daten->>'rundung_kommen', ''),
    rundung_gehen = NULLIF(p_ma_daten->>'rundung_gehen', ''),
    fruehester_beginn = (NULLIF(p_ma_daten->>'fruehester_beginn', ''))::time,
    hauptmonteur_befaehigt = COALESCE((p_ma_daten->>'hauptmonteur_befaehigt')::boolean, hauptmonteur_befaehigt),
    urlaubsanspruch = (NULLIF(p_ma_daten->>'urlaubsanspruch', ''))::integer,
    kleidung_hose = NULLIF(p_ma_daten->>'kleidung_hose', ''),
    kleidung_jacke = NULLIF(p_ma_daten->>'kleidung_jacke', ''),
    kleidung_schuhe = NULLIF(p_ma_daten->>'kleidung_schuhe', ''),
    kleidung_handschuhe = NULLIF(p_ma_daten->>'kleidung_handschuhe', ''),
    kleidung_pulli = NULLIF(p_ma_daten->>'kleidung_pulli', ''),
    kleidung_tshirt = NULLIF(p_ma_daten->>'kleidung_tshirt', ''),
    schwerbehinderung_grad = (NULLIF(p_ma_daten->>'schwerbehinderung_grad', ''))::integer,
    aufenthaltserlaubnis_bis = (NULLIF(p_ma_daten->>'aufenthaltserlaubnis_bis', ''))::date,
    anzahl_kinder = (NULLIF(p_ma_daten->>'anzahl_kinder', ''))::integer,
    updated_at = now()
  WHERE id = p_ma_daten_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mitarbeiter-Daten % nicht gefunden', p_ma_daten_id USING ERRCODE = 'P0002';
  END IF;

  -- 4. person_kontaktdaten (array of { id?, _new?, _deleted?, typ, wert, label, ist_primaer, notiz })
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_kontaktdaten) LOOP
    IF COALESCE((v_item->>'_deleted')::boolean, false) AND v_item ? 'id' THEN
      DELETE FROM person_kontaktdaten WHERE id = (v_item->>'id')::uuid;
    ELSIF COALESCE((v_item->>'_new')::boolean, false) THEN
      INSERT INTO person_kontaktdaten (person_id, typ, wert, label, ist_primaer, notiz)
      VALUES (
        p_person_id,
        v_item->>'typ',
        v_item->>'wert',
        NULLIF(v_item->>'label', ''),
        COALESCE((v_item->>'ist_primaer')::boolean, false),
        NULLIF(v_item->>'notiz', '')
      );
    ELSIF v_item ? 'id' THEN
      UPDATE person_kontaktdaten SET
        typ = v_item->>'typ',
        wert = v_item->>'wert',
        label = NULLIF(v_item->>'label', ''),
        ist_primaer = COALESCE((v_item->>'ist_primaer')::boolean, false),
        notiz = NULLIF(v_item->>'notiz', '')
      WHERE id = (v_item->>'id')::uuid;
    END IF;
  END LOOP;

  -- 5. person_adressen (array of { id?, _new?, _deleted?, typ, strasse, plz, ort, land, ist_primaer })
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_adressen) LOOP
    IF COALESCE((v_item->>'_deleted')::boolean, false) AND v_item ? 'id' THEN
      DELETE FROM person_adressen WHERE id = (v_item->>'id')::uuid;
    ELSIF COALESCE((v_item->>'_new')::boolean, false) THEN
      INSERT INTO person_adressen (person_id, typ, strasse, plz, ort, land, ist_primaer)
      VALUES (
        p_person_id,
        v_item->>'typ',
        NULLIF(v_item->>'strasse', ''),
        NULLIF(v_item->>'plz', ''),
        NULLIF(v_item->>'ort', ''),
        NULLIF(v_item->>'land', ''),
        COALESCE((v_item->>'ist_primaer')::boolean, false)
      );
    ELSIF v_item ? 'id' THEN
      UPDATE person_adressen SET
        typ = v_item->>'typ',
        strasse = NULLIF(v_item->>'strasse', ''),
        plz = NULLIF(v_item->>'plz', ''),
        ort = NULLIF(v_item->>'ort', ''),
        land = NULLIF(v_item->>'land', ''),
        ist_primaer = COALESCE((v_item->>'ist_primaer')::boolean, false)
      WHERE id = (v_item->>'id')::uuid;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'person_id', p_person_id, 'ma_daten_id', p_ma_daten_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_mitarbeiter_detail(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb) TO authenticated;
