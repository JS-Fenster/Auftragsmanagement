-- Welle 2 Etappe 2: next_nummer RPC aus nummernkreise-Tabelle
-- Scope:
--   1. Neue Haupt-RPC next_nummer(p_typ) — State-basiert aus nummernkreise-Tabelle
--      - FOR UPDATE Row-Lock (atomar, keine Doppel-Nummern bei parallelen Calls)
--      - Auto-Jahr-Reset via EXTRACT(YEAR) — kein manueller Eingriff beim Jahreswechsel
--      - Auto-Stellen-Erweiterung via LPAD: stellen = Mindest-Breite, Überlauf wird länger (10000+)
--      - max_nummer ignoriert im Lauf — dient nur als Warn-Schwellwert im Admin-UI später
--   2. next_beleg_nummer DROP — Frontend stellt in diesem Commit auf next_nummer um
-- Risiko: LOW — 0 Rows in belege produktiv, kein Sprung in bestehender Nummerierung.

BEGIN;

-- ============================================================
-- 1. Neue Haupt-RPC next_nummer
-- ============================================================
CREATE OR REPLACE FUNCTION next_nummer(p_typ TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row              nummernkreise%ROWTYPE;
  v_aktuelles_jahr   INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_neue_laufnummer  INTEGER;
  v_jahr_prefix      TEXT;
BEGIN
  -- FOR UPDATE = Row-Lock, verhindert Kollision bei parallelen Calls
  SELECT * INTO v_row FROM nummernkreise
  WHERE typ = p_typ AND aktiv = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unbekannter oder inaktiver Nummernkreis: %', p_typ
      USING ERRCODE = '22023';
  END IF;

  -- Jahr-Reset-Logik: wenn jahr_reset=true UND Jahr gewechselt (oder NULL = erster Aufruf)
  IF v_row.jahr_reset
     AND (v_row.aktuelles_jahr IS NULL OR v_row.aktuelles_jahr <> v_aktuelles_jahr)
  THEN
    v_neue_laufnummer := v_row.start_nummer;
    UPDATE nummernkreise SET
      aktuelles_jahr      = v_aktuelles_jahr,
      aktuelle_laufnummer = v_neue_laufnummer
    WHERE typ = p_typ;
  ELSE
    v_neue_laufnummer := v_row.aktuelle_laufnummer + 1;
    UPDATE nummernkreise SET aktuelle_laufnummer = v_neue_laufnummer WHERE typ = p_typ;
  END IF;

  -- Jahr-Format
  IF v_row.jahr_format = 'YY' THEN
    v_jahr_prefix := LPAD((v_aktuelles_jahr % 100)::TEXT, 2, '0');
  ELSE
    v_jahr_prefix := v_aktuelles_jahr::TEXT;
  END IF;

  -- LPAD mit stellen = Mindest-Breite. Überlauf (10000+) wird einfach länger,
  -- kein Crash. max_nummer dient nur als Warn-Schwellwert im Admin-UI.
  RETURN v_row.prefix
         || v_row.trennzeichen
         || v_jahr_prefix
         || v_row.trennzeichen
         || LPAD(v_neue_laufnummer::TEXT, v_row.stellen, '0');
END;
$$;

COMMENT ON FUNCTION next_nummer IS
  'Generiert naechste Belegnummer aus nummernkreise-Tabelle. Atomar (FOR UPDATE), Jahr-Reset automatisch, Stellen-Auto-Erweiterung via LPAD (Mindest-Breite, kein Overflow-Crash). Ersetzt next_beleg_nummer.';

-- ============================================================
-- 2. next_beleg_nummer DROP (Frontend wird in selbem Commit umgestellt)
-- ============================================================
DROP FUNCTION IF EXISTS next_beleg_nummer(TEXT);

COMMIT;
