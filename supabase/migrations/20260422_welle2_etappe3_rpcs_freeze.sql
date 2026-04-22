-- Welle 2 Etappe 3: RPCs vorgeschlagener_tatbestand + freeze_beleg + Freeze-Trigger
-- Scope:
--   A. vorgeschlagener_tatbestand(kontakt_id, leistungsart, netto_summe)
--      - Liefert passenden Steuertatbestand basierend auf Kontakt + Leistungsart + §13b-Schwellwert
--      - Privat → standard_19; Bauleister mit UStTG + Montage → 13b_bau;
--        Reparatur/Wartung + ≥500€ + UStTG → 13b_bau; sonst standard_19 mit Warnung
--   B. freeze_beleg(beleg_id)
--      - Snapshot der Kontakt-Daten in empfaenger_*-Felder
--      - Setzt ist_eingefroren=true, eingefroren_am=now(), eingefroren_von=auth.uid()
--      - Idempotent (zweiter Call = no-op)
--   C. fn_block_update_if_frozen Trigger auf belege
--      - Blockt fachliche Änderungen nach Freeze
--      - Erlaubt: status, mahnstufe, letzte_mahnung_am, updated_at
--   D. fn_block_beleg_positionen_if_frozen Trigger auf beleg_positionen
--      - Blockt INSERT/UPDATE/DELETE wenn Beleg eingefroren
-- Risiko: LOW — Trigger greifen nur bei eingefrorenen Belegen (aktuell 0).

BEGIN;

-- ============================================================
-- A. vorgeschlagener_tatbestand
-- ============================================================
CREATE OR REPLACE FUNCTION vorgeschlagener_tatbestand(
  p_kontakt_id    UUID,
  p_leistungsart  TEXT DEFAULT NULL,
  p_netto_summe   NUMERIC DEFAULT NULL
)
RETURNS TABLE(
  tatbestand_id    UUID,
  tatbestand_code  TEXT,
  satz_prozent     NUMERIC,
  warnung          TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kontakt        kontakte%ROWTYPE;
  v_has_ust_tg     BOOLEAN;
  v_standard_row   steuer_tatbestaende%ROWTYPE;
  v_13b_row        steuer_tatbestaende%ROWTYPE;
BEGIN
  SELECT * INTO v_kontakt FROM kontakte WHERE id = p_kontakt_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kontakt nicht gefunden: %', p_kontakt_id USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_standard_row FROM steuer_tatbestaende WHERE code = 'standard_19';
  SELECT * INTO v_13b_row      FROM steuer_tatbestaende WHERE code = '13b_bau';

  -- Privatkunde → immer Standard-USt, keine §13b-Möglichkeit
  IF v_kontakt.ist_privatkunde THEN
    tatbestand_id   := v_standard_row.id;
    tatbestand_code := v_standard_row.code;
    satz_prozent    := v_standard_row.satz_prozent;
    warnung         := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Gültige USt-1-TG-Bescheinigung?
  SELECT EXISTS(
    SELECT 1 FROM bescheinigungen
    WHERE kontakt_id = p_kontakt_id
      AND typ = 'ust_1_tg'
      AND status = 'gueltig'
      AND gueltig_bis >= current_date
  ) INTO v_has_ust_tg;

  -- §13b bei Montage + UStTG (keine Bagatellgrenze)
  IF v_has_ust_tg AND p_leistungsart = 'montage' THEN
    tatbestand_id   := v_13b_row.id;
    tatbestand_code := v_13b_row.code;
    satz_prozent    := v_13b_row.satz_prozent;
    warnung         := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- §13b bei Reparatur/Wartung + UStTG + netto ≥ 500€
  IF v_has_ust_tg AND p_leistungsart IN ('reparatur','wartung') AND COALESCE(p_netto_summe, 0) >= 500 THEN
    tatbestand_id   := v_13b_row.id;
    tatbestand_code := v_13b_row.code;
    satz_prozent    := v_13b_row.satz_prozent;
    warnung         := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Default: Standard 19% USt — mit Warnung wenn Bauleister ohne gueltige UStTG
  tatbestand_id   := v_standard_row.id;
  tatbestand_code := v_standard_row.code;
  satz_prozent    := v_standard_row.satz_prozent;

  IF v_kontakt.ist_bauleister AND NOT v_has_ust_tg THEN
    warnung := 'Kontakt ist als Bauleister markiert, aber keine gueltige USt-1-TG-Bescheinigung vorhanden. Bitte Bescheinigung anfordern — ansonsten bleibt Standard-USt.';
  ELSIF v_has_ust_tg AND p_leistungsart IN ('reparatur','wartung') AND COALESCE(p_netto_summe, 0) < 500 THEN
    warnung := 'Reparatur/Wartung unter 500€ netto → §13b greift nicht (Bagatellgrenze). Standard-USt ausweisen.';
  ELSE
    warnung := NULL;
  END IF;

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION vorgeschlagener_tatbestand IS
  'Liefert passenden Steuertatbestand basierend auf Kontakt + Leistungsart + Netto-Summe. Live-Check auf bescheinigungen-Tabelle (nicht auf kontakte.ist_bauleister-Cache). Beruecksichtigt §13b-500€-Bagatellgrenze bei Reparatur/Wartung.';

-- ============================================================
-- B. freeze_beleg
-- ============================================================
CREATE OR REPLACE FUNCTION freeze_beleg(p_beleg_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_beleg    belege%ROWTYPE;
  v_kontakt  kontakte%ROWTYPE;
BEGIN
  SELECT * INTO v_beleg FROM belege WHERE id = p_beleg_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Beleg nicht gefunden: %', p_beleg_id USING ERRCODE = '22023';
  END IF;

  -- Idempotent: bereits eingefroren → false zurück, kein Fehler, keine Aenderung
  IF v_beleg.ist_eingefroren THEN
    RETURN false;
  END IF;

  -- Snapshot Kontakt-Daten in Empfaenger-Felder (nur wenn noch NULL)
  IF v_beleg.empfaenger_kontakt_id IS NOT NULL THEN
    SELECT * INTO v_kontakt FROM kontakte WHERE id = v_beleg.empfaenger_kontakt_id;
    IF FOUND THEN
      UPDATE belege SET
        empfaenger_email   = COALESCE(empfaenger_email,   v_kontakt.rechnungs_email),
        empfaenger_ust_id  = COALESCE(empfaenger_ust_id,  v_kontakt.ust_id),
        leitweg_id         = COALESCE(leitweg_id,         v_kontakt.leitweg_id)
      WHERE id = p_beleg_id;
    END IF;
  END IF;

  -- Freeze-Flags setzen
  UPDATE belege SET
    ist_eingefroren = true,
    eingefroren_am  = now(),
    eingefroren_von = auth.uid()
  WHERE id = p_beleg_id;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION freeze_beleg IS
  'Friert Beleg ein (GoBD-Snapshot). Kopiert Kontakt-Daten in empfaenger_*-Felder. Idempotent: zweiter Call auf eingefrorenen Beleg = no-op (false).';

-- ============================================================
-- C. Trigger fn_block_update_if_frozen auf belege
-- ============================================================
CREATE OR REPLACE FUNCTION fn_block_update_if_frozen()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Nur prüfen wenn Beleg vorher schon eingefroren war
  IF OLD.ist_eingefroren = false THEN
    RETURN NEW;
  END IF;

  -- Freeze-Metadaten selbst unveränderlich
  IF NEW.ist_eingefroren IS DISTINCT FROM OLD.ist_eingefroren
     OR NEW.eingefroren_am IS DISTINCT FROM OLD.eingefroren_am
     OR NEW.eingefroren_von IS DISTINCT FROM OLD.eingefroren_von
  THEN
    RAISE EXCEPTION 'Beleg % ist eingefroren — Freeze-Status/Metadaten unveraenderlich. Korrektur via Storno/Gutschrift.', OLD.beleg_nummer
      USING ERRCODE = 'P0001';
  END IF;

  -- Fachliche Felder blockiert
  IF NEW.beleg_typ                       IS DISTINCT FROM OLD.beleg_typ
     OR NEW.beleg_nummer                 IS DISTINCT FROM OLD.beleg_nummer
     OR NEW.datum                        IS DISTINCT FROM OLD.datum
     OR NEW.gueltig_bis                  IS DISTINCT FROM OLD.gueltig_bis
     OR NEW.liefer_datum                 IS DISTINCT FROM OLD.liefer_datum
     OR NEW.leistungs_datum              IS DISTINCT FROM OLD.leistungs_datum
     OR NEW.empfaenger_kontakt_id        IS DISTINCT FROM OLD.empfaenger_kontakt_id
     OR NEW.empfaenger_firma             IS DISTINCT FROM OLD.empfaenger_firma
     OR NEW.empfaenger_name              IS DISTINCT FROM OLD.empfaenger_name
     OR NEW.empfaenger_strasse           IS DISTINCT FROM OLD.empfaenger_strasse
     OR NEW.empfaenger_plz               IS DISTINCT FROM OLD.empfaenger_plz
     OR NEW.empfaenger_ort               IS DISTINCT FROM OLD.empfaenger_ort
     OR NEW.empfaenger_email             IS DISTINCT FROM OLD.empfaenger_email
     OR NEW.empfaenger_telefon           IS DISTINCT FROM OLD.empfaenger_telefon
     OR NEW.empfaenger_ust_id            IS DISTINCT FROM OLD.empfaenger_ust_id
     OR NEW.empfaenger_ansprechpartner_name IS DISTINCT FROM OLD.empfaenger_ansprechpartner_name
     OR NEW.betreff                      IS DISTINCT FROM OLD.betreff
     OR NEW.einleitungstext              IS DISTINCT FROM OLD.einleitungstext
     OR NEW.schlusstext                  IS DISTINCT FROM OLD.schlusstext
     OR NEW.kunden_bestellnummer         IS DISTINCT FROM OLD.kunden_bestellnummer
     OR NEW.netto_summe                  IS DISTINCT FROM OLD.netto_summe
     OR NEW.rabatt_prozent               IS DISTINCT FROM OLD.rabatt_prozent
     OR NEW.rabatt_betrag                IS DISTINCT FROM OLD.rabatt_betrag
     OR NEW.netto_nach_rabatt            IS DISTINCT FROM OLD.netto_nach_rabatt
     OR NEW.mwst_satz                    IS DISTINCT FROM OLD.mwst_satz
     OR NEW.mwst_betrag                  IS DISTINCT FROM OLD.mwst_betrag
     OR NEW.brutto_summe                 IS DISTINCT FROM OLD.brutto_summe
     OR NEW.zahlungsbedingungen          IS DISTINCT FROM OLD.zahlungsbedingungen
     OR NEW.zahlungsziel_tage            IS DISTINCT FROM OLD.zahlungsziel_tage
     OR NEW.skonto_prozent               IS DISTINCT FROM OLD.skonto_prozent
     OR NEW.skonto_tage                  IS DISTINCT FROM OLD.skonto_tage
     OR NEW.abschlags_nr                 IS DISTINCT FROM OLD.abschlags_nr
     OR NEW.abschlags_prozent            IS DISTINCT FROM OLD.abschlags_prozent
     OR NEW.abschlags_betrag             IS DISTINCT FROM OLD.abschlags_betrag
     OR NEW.parent_id                    IS DISTINCT FROM OLD.parent_id
     OR NEW.pdf_html                     IS DISTINCT FROM OLD.pdf_html
     OR NEW.ist_erechnung                IS DISTINCT FROM OLD.ist_erechnung
     OR NEW.leitweg_id                   IS DISTINCT FROM OLD.leitweg_id
     OR NEW.projekt_id                   IS DISTINCT FROM OLD.projekt_id
  THEN
    RAISE EXCEPTION 'Beleg % ist eingefroren — fachliche Aenderungen blockiert. Korrektur via Storno/Gutschrift.', OLD.beleg_nummer
      USING ERRCODE = 'P0001';
  END IF;

  -- Erlaubt: status, mahnstufe, letzte_mahnung_am, updated_at
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_block_update_if_frozen IS
  'Defense-in-depth: blockt fachliche Aenderungen an eingefrorenen Belegen. Erlaubt bleibt Status-Flow (bezahlt/storniert/teilbezahlt), Mahnstufe, Mahndatum. GoBD-Kern.';

CREATE TRIGGER trg_block_update_if_frozen
BEFORE UPDATE ON belege
FOR EACH ROW
EXECUTE FUNCTION fn_block_update_if_frozen();

-- ============================================================
-- D. Trigger fn_block_beleg_positionen_if_frozen auf beleg_positionen
-- ============================================================
CREATE OR REPLACE FUNCTION fn_block_beleg_positionen_if_frozen()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ist_eingefroren BOOLEAN;
  v_beleg_id        UUID;
BEGIN
  v_beleg_id := COALESCE(NEW.beleg_id, OLD.beleg_id);
  SELECT ist_eingefroren INTO v_ist_eingefroren FROM belege WHERE id = v_beleg_id;

  IF v_ist_eingefroren THEN
    RAISE EXCEPTION 'Beleg ist eingefroren — Positionen nicht mehr aenderbar. Korrektur via Storno/Gutschrift.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION fn_block_beleg_positionen_if_frozen IS
  'Defense-in-depth: blockt INSERT/UPDATE/DELETE von beleg_positionen wenn zugehoeriger Beleg eingefroren. Sonst waere Summen-Integritaet nicht gewaehrleistet.';

CREATE TRIGGER trg_block_beleg_positionen_if_frozen
BEFORE INSERT OR UPDATE OR DELETE ON beleg_positionen
FOR EACH ROW
EXECUTE FUNCTION fn_block_beleg_positionen_if_frozen();

COMMIT;
