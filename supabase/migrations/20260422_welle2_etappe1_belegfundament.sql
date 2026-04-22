-- Welle 2 Etappe 1: Beleg-Fundament additiv
-- Scope:
--   1. kontakte: ist_privatkunde, ist_bauleister
--   2. Neue Tabellen: nummernkreise, steuer_tatbestaende, bescheinigungen
--   3. beleg_positionen: steuer_tatbestand_id, leistungsart
--   4. belege: Freeze-Flags, Empfänger-Felder (E-Rechnung/USt-ID/Ansprechpartner), leitweg_id
--   5. Trigger: Auto-ist_bauleister bei USt-1-TG-Bescheinigung
--   6. Seed Nummernkreise (7 Beleg-Typen) + Steuertatbestände (5 Standard-Fälle)
-- Risiko: LOW — rein additiv, keine bestehenden Daten verändert. belege/beleg_positionen = 0 Rows produktiv.

BEGIN;

-- ============================================================
-- 1. kontakte: Privat-Flag + Bauleister-Flag
-- ============================================================
ALTER TABLE kontakte ADD COLUMN ist_privatkunde BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE kontakte ADD COLUMN ist_bauleister  BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN kontakte.ist_privatkunde IS 'true = Privatperson (nie §13b, nie §48 EStG). Default false weil Bestandsdaten firma-dominiert. Bei sauberer AM-Migration korrekt setzen.';
COMMENT ON COLUMN kontakte.ist_bauleister  IS 'true = Bauunternehmer (§13b-relevant bei Montage). Wird automatisch true beim Hinzufügen einer gültigen USt-1-TG-Bescheinigung (siehe Trigger).';

-- ============================================================
-- 2. Tabelle nummernkreise (konfigurierbar pro Beleg-Typ)
-- ============================================================
CREATE TABLE nummernkreise (
  typ                  TEXT PRIMARY KEY,
  bezeichnung          TEXT NOT NULL,
  prefix               TEXT NOT NULL,
  stellen              INTEGER NOT NULL DEFAULT 4 CHECK (stellen BETWEEN 3 AND 8),
  jahr_format          TEXT NOT NULL DEFAULT 'YYYY' CHECK (jahr_format IN ('YY','YYYY')),
  trennzeichen         TEXT NOT NULL DEFAULT '-',
  jahr_reset           BOOLEAN NOT NULL DEFAULT true,
  aktuelles_jahr       INTEGER NULL,
  aktuelle_laufnummer  INTEGER NOT NULL DEFAULT 0,
  start_nummer         INTEGER NOT NULL DEFAULT 1,
  max_nummer           INTEGER NULL,
  aktiv                BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE nummernkreise IS 'Konfigurierbare Nummernkreise pro Beleg-/Dokument-Typ. Ersetzt hardcoded Prefix-Liste. Jahr-Reset automatisch via next_nummer-RPC (Etappe 2).';

INSERT INTO nummernkreise (typ, bezeichnung, prefix, stellen) VALUES
  ('angebot',              'Angebot',              'A',  4),
  ('auftragsbestaetigung', 'Auftragsbestätigung',  'AB', 4),
  ('lieferschein',         'Lieferschein',         'LS', 4),
  ('rechnung',             'Rechnung',             'R',  4),
  ('abschlagsrechnung',    'Abschlagsrechnung',    'AR', 4),
  ('schlussrechnung',      'Schlussrechnung',      'SR', 4),
  ('gutschrift',           'Gutschrift',           'GS', 4);

-- ============================================================
-- 3. Tabelle steuer_tatbestaende (konfigurierbar, nachpflegbar)
-- ============================================================
CREATE TABLE steuer_tatbestaende (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                        TEXT UNIQUE NOT NULL,
  bezeichnung                 TEXT NOT NULL,
  satz_prozent                NUMERIC(5,2) NOT NULL,
  anwendungsbereich           TEXT[] NOT NULL DEFAULT '{}',
  bagatellgrenze_netto        NUMERIC(12,2) NULL,
  bagatellgrenze_gilt_fuer    TEXT[] NOT NULL DEFAULT '{}',
  pdf_hinweis                 TEXT NULL,
  erfordert_bescheinigung     TEXT NULL CHECK (erfordert_bescheinigung IN ('48b_freistellung','ust_1_tg','nato') OR erfordert_bescheinigung IS NULL),
  nur_fuer_geschaeftskunden   BOOLEAN NOT NULL DEFAULT false,
  aktiv                       BOOLEAN NOT NULL DEFAULT true,
  sort_order                  INTEGER NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE steuer_tatbestaende IS 'Steuer-Tatbestände editierbar im Admin-UI. Deckt Standard-USt (19/7), §13b Bauleistung, §4 Nr. 1 EU-Lieferung, §4 Nr. 7 NATO. Erweiterbar ohne Migration.';
COMMENT ON COLUMN steuer_tatbestaende.anwendungsbereich IS 'Array von Leistungsarten (montage/reparatur/wartung/material/sonstiges). Leer = überall anwendbar.';
COMMENT ON COLUMN steuer_tatbestaende.bagatellgrenze_gilt_fuer IS 'Bagatellgrenze greift nur für diese Leistungsarten (z.B. §13b 500€ nur bei Reparatur/Wartung).';

INSERT INTO steuer_tatbestaende (code, bezeichnung, satz_prozent, anwendungsbereich, bagatellgrenze_netto, bagatellgrenze_gilt_fuer, pdf_hinweis, erfordert_bescheinigung, nur_fuer_geschaeftskunden, sort_order) VALUES
  ('standard_19', '19% USt (Standard)',                      19.00, '{}',                             NULL,   '{}',                  NULL,                                                                                                  NULL,               false, 10),
  ('reduziert_7', '7% USt (ermäßigt)',                        7.00, '{}',                             NULL,   '{}',                  NULL,                                                                                                  NULL,               false, 20),
  ('13b_bau',     '§13b UStG Bauleistung (0%)',               0.00, '{montage,reparatur,wartung}',    500.00, '{reparatur,wartung}', 'Steuerschuldnerschaft des Leistungsempfängers gemäß § 13b UStG',                                      'ust_1_tg',         true,  30),
  ('4_nr1_eu',    '§4 Nr. 1 UStG innergemeinschaftlich (0%)', 0.00, '{}',                             NULL,   '{}',                  'Steuerfreie innergemeinschaftliche Lieferung gemäß § 4 Nr. 1b UStG',                                  NULL,               true,  40),
  ('4_nr7_nato',  '§4 Nr. 7 UStG NATO-Truppen (0%)',          0.00, '{}',                             NULL,   '{}',                  'Steuerfrei nach § 4 Nr. 7 UStG (Lieferung an NATO-Streitkräfte)',                                     'nato',             true,  50);

-- ============================================================
-- 4. Tabelle bescheinigungen (§48b / USt-1-TG / NATO)
-- ============================================================
CREATE TABLE bescheinigungen (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kontakt_id               UUID NOT NULL REFERENCES kontakte(id) ON DELETE CASCADE,
  typ                      TEXT NOT NULL CHECK (typ IN ('48b_freistellung','ust_1_tg','nato')),
  nummer                   TEXT NULL,
  ausgestellt_von          TEXT NULL,
  gueltig_von              DATE NOT NULL,
  gueltig_bis              DATE NOT NULL CHECK (gueltig_bis >= gueltig_von),
  status                   TEXT NOT NULL DEFAULT 'gueltig' CHECK (status IN ('gueltig','abgelaufen','widerrufen','angefordert')),
  dokument_storage_path    TEXT NULL,
  bemerkung                TEXT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bescheinigungen_kontakt       ON bescheinigungen(kontakt_id);
CREATE INDEX idx_bescheinigungen_typ_gueltig   ON bescheinigungen(kontakt_id, typ, gueltig_bis);

COMMENT ON TABLE bescheinigungen IS 'Steuer-Bescheinigungen pro Kontakt. Basis für §13b/§48-Automatik im BelegFormular.';

-- ============================================================
-- 5. beleg_positionen: Steuer-Tatbestand + Leistungsart
-- ============================================================
ALTER TABLE beleg_positionen ADD COLUMN steuer_tatbestand_id UUID NULL REFERENCES steuer_tatbestaende(id);
ALTER TABLE beleg_positionen ADD COLUMN leistungsart         TEXT NULL;

ALTER TABLE beleg_positionen ADD CONSTRAINT beleg_positionen_leistungsart_check
  CHECK (leistungsart IS NULL OR leistungsart IN ('montage','reparatur','wartung','material','sonstiges'));

COMMENT ON COLUMN beleg_positionen.steuer_tatbestand_id IS 'FK zu steuer_tatbestaende. Bei bestehenden Rows NULL (0 Rows produktiv). Neu-Positionen werden per vorgeschlagener_tatbestand-RPC (Etappe 3) vorbefüllt.';
COMMENT ON COLUMN beleg_positionen.leistungsart         IS 'Default montage bei Migration in Etappe 5. Relevant für §13b Schwellwert-Logik (500€ bei Reparatur/Wartung).';

-- ============================================================
-- 6. belege: Freeze-Flags + Empfänger-Erweiterung + E-Rechnung
-- ============================================================
ALTER TABLE belege ADD COLUMN ist_eingefroren                  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE belege ADD COLUMN eingefroren_am                   TIMESTAMPTZ NULL;
ALTER TABLE belege ADD COLUMN eingefroren_von                  UUID NULL;
ALTER TABLE belege ADD COLUMN empfaenger_email                 TEXT NULL;
ALTER TABLE belege ADD COLUMN empfaenger_telefon               TEXT NULL;
ALTER TABLE belege ADD COLUMN empfaenger_ust_id                TEXT NULL;
ALTER TABLE belege ADD COLUMN empfaenger_ansprechpartner_name  TEXT NULL;
ALTER TABLE belege ADD COLUMN ist_erechnung                    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE belege ADD COLUMN leitweg_id                       TEXT NULL;

COMMENT ON COLUMN belege.ist_eingefroren IS 'true nach freeze_beleg(): Beleg read-only, Empfänger-Felder als Snapshot festgeschrieben. Trigger-Event: "An Buchhaltung übermittelt".';
COMMENT ON COLUMN belege.eingefroren_am  IS 'Zeitpunkt des Freeze — GoBD-relevant.';
COMMENT ON COLUMN belege.eingefroren_von IS 'User der Freeze ausgelöst hat (später auth.uid()).';
COMMENT ON COLUMN belege.ist_erechnung   IS 'true bei XRechnung/ZUGFeRD-konformer E-Rechnung (Daten-Felder jetzt, Generierung siehe AM-190/191).';
COMMENT ON COLUMN belege.leitweg_id      IS 'Leitweg-ID für B2G / öffentliche Auftraggeber (E-Rechnung).';

-- ============================================================
-- 7. Trigger: Auto-Setzen ist_bauleister bei USt-1-TG
-- ============================================================
CREATE OR REPLACE FUNCTION fn_auto_set_ist_bauleister()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.typ = 'ust_1_tg' AND NEW.status = 'gueltig' THEN
    UPDATE kontakte SET ist_bauleister = true WHERE id = NEW.kontakt_id AND ist_bauleister = false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bescheinigungen_set_bauleister
AFTER INSERT OR UPDATE OF status, typ ON bescheinigungen
FOR EACH ROW
EXECUTE FUNCTION fn_auto_set_ist_bauleister();

COMMENT ON FUNCTION fn_auto_set_ist_bauleister IS 'Setzt kontakte.ist_bauleister auf true wenn eine gültige USt-1-TG-Bescheinigung angelegt wird. Hand-Override möglich (Flag bleibt true bis manuell zurückgesetzt).';

-- ============================================================
-- 8. RLS Policies (anon CRUD wie bestehende Tabellen)
-- ============================================================
ALTER TABLE nummernkreise       ENABLE ROW LEVEL SECURITY;
ALTER TABLE steuer_tatbestaende ENABLE ROW LEVEL SECURITY;
ALTER TABLE bescheinigungen     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon full access" ON nummernkreise       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON steuer_tatbestaende FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON bescheinigungen     FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 9. Trigger: updated_at auto-bump auf neuen Tabellen
-- ============================================================
CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_nummernkreise_updated_at
BEFORE UPDATE ON nummernkreise
FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_steuer_tatbestaende_updated_at
BEFORE UPDATE ON steuer_tatbestaende
FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_bescheinigungen_updated_at
BEFORE UPDATE ON bescheinigungen
FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

COMMIT;
