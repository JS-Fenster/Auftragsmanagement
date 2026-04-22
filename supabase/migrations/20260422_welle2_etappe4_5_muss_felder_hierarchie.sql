-- Welle 2 Etappe 4.5: MUSS-10-Felder + Hierarchie + BOM-Vorbereitung + Rabatt pro Position
--
-- Scope (additiv, LOW RISK — 0 Rows in belege/beleg_positionen produktiv):
--   1. Neue Tabelle eigene_bankverbindungen (JS hat Volksbank + ggf. weitere Konten)
--   2. belege: MUSS-10-Felder (unser_zeichen, ihr_zeichen, kommission, leistungszeitraum_von/bis,
--      geplanter_liefertermin, tatsaechlicher_liefertermin, verantwortlicher_mitarbeiter_id,
--      eigene_bankverbindung_id, interne_notiz) + empfaenger_ist_privatperson
--   3. beleg_positionen: parent_position_id (Hierarchie), ist_summenzeile, ist_versteckt (BOM-Vorbereitung),
--      artikel_id (nullable FK Placeholder, Welle 6 AM-202), rabatt_prozent, rabatt_betrag (pro Position)
--
-- Bezug: AM-0209 (Logbuch), AM-202 (BOM Welle 6), AM-203 (Email Bescheinigung)

BEGIN;

-- ============================================================
-- 1. Tabelle eigene_bankverbindungen
-- ============================================================
CREATE TABLE eigene_bankverbindungen (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bezeichnung   TEXT NOT NULL,
  bank_name     TEXT NOT NULL,
  iban          TEXT,
  bic           TEXT,
  kontoinhaber  TEXT NOT NULL,
  aktiv         BOOLEAN NOT NULL DEFAULT true,
  ist_default   BOOLEAN NOT NULL DEFAULT false,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_eigene_bankverbindungen_default
  ON eigene_bankverbindungen(ist_default)
  WHERE ist_default = true;

COMMENT ON TABLE eigene_bankverbindungen IS
  'JS-eigene Bankverbindungen. Auf Rechnung erscheint die gewaehlte — JS hat ggf. mehrere Konten (Volksbank Amberg aus W4A-Screenshot).';

-- Seed aus W4A-Referenz — IBAN/BIC leer, muss manuell befuellt werden
INSERT INTO eigene_bankverbindungen (bezeichnung, bank_name, kontoinhaber, ist_default, sort_order)
VALUES ('Volksbank Amberg (Default)', 'Volksbank-Raiffeisenbank Amberg eG', 'JS Fenster & Tueren GmbH', true, 10);

ALTER TABLE eigene_bankverbindungen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon full access" ON eigene_bankverbindungen FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_eigene_bankverbindungen_updated_at
BEFORE UPDATE ON eigene_bankverbindungen
FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ============================================================
-- 2. belege: MUSS-10-Felder + Privat/Firma-Flag
-- ============================================================
ALTER TABLE belege ADD COLUMN unser_zeichen                 TEXT NULL;
ALTER TABLE belege ADD COLUMN ihr_zeichen                   TEXT NULL;
ALTER TABLE belege ADD COLUMN kommission                    TEXT NULL;
ALTER TABLE belege ADD COLUMN leistungszeitraum_von         DATE NULL;
ALTER TABLE belege ADD COLUMN leistungszeitraum_bis         DATE NULL;
ALTER TABLE belege ADD COLUMN geplanter_liefertermin        DATE NULL;
ALTER TABLE belege ADD COLUMN tatsaechlicher_liefertermin   DATE NULL;
ALTER TABLE belege ADD COLUMN verantwortlicher_mitarbeiter_id UUID NULL REFERENCES mitarbeiter(id);
ALTER TABLE belege ADD COLUMN eigene_bankverbindung_id      UUID NULL REFERENCES eigene_bankverbindungen(id);
ALTER TABLE belege ADD COLUMN interne_notiz                 TEXT NULL;
ALTER TABLE belege ADD COLUMN empfaenger_ist_privatperson   BOOLEAN NULL;

COMMENT ON COLUMN belege.unser_zeichen IS
  'Kurze Kennung z.B. "AS" fuer Andreas Stolarczyk - erscheint auf Beleg und in Buchhaltung-Ref.';
COMMENT ON COLUMN belege.ihr_zeichen IS
  'Zeichen des Kunden (bei B2B gelaeufig, z.B. dessen interne Auftrag-Nr).';
COMMENT ON COLUMN belege.kommission IS
  'Bauvorhaben-Kennung / Projekt-Referenz des Kunden (abweichend von unserer projekt_id).';
COMMENT ON COLUMN belege.leistungszeitraum_von IS
  '§14 UStG Pflichtangabe - Beginn der Leistung';
COMMENT ON COLUMN belege.leistungszeitraum_bis IS
  '§14 UStG Pflichtangabe - Ende der Leistung';
COMMENT ON COLUMN belege.geplanter_liefertermin IS
  'Montage-Planung: geplanter Liefertermin/Montagetermin';
COMMENT ON COLUMN belege.tatsaechlicher_liefertermin IS
  'Montage-Ist: tatsaechlicher Liefertermin/Montagetermin';
COMMENT ON COLUMN belege.verantwortlicher_mitarbeiter_id IS
  'Wer hat Beleg erstellt/verantwortet - fuer Rueckfragen und Vertretung.';
COMMENT ON COLUMN belege.eigene_bankverbindung_id IS
  'Welches JS-Konto erscheint auf Rechnung (JS hat ggf. mehrere, siehe eigene_bankverbindungen).';
COMMENT ON COLUMN belege.interne_notiz IS
  'Interne Bemerkung - NICHT auf PDF, nur zur Team-Kommunikation.';
COMMENT ON COLUMN belege.empfaenger_ist_privatperson IS
  'NULL = aus kontakte.ist_privatkunde herleiten; true = Privatperson (keine USt-ID erwartet, Firma-Feld ausgeblendet); false = Firma (Firma-Feld Pflicht).';

-- ============================================================
-- 3. beleg_positionen: Hierarchie + BOM-Vorbereitung + Rabatt
-- ============================================================
ALTER TABLE beleg_positionen ADD COLUMN parent_position_id  UUID NULL REFERENCES beleg_positionen(id) ON DELETE CASCADE;
ALTER TABLE beleg_positionen ADD COLUMN ist_summenzeile     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE beleg_positionen ADD COLUMN ist_versteckt       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE beleg_positionen ADD COLUMN artikel_id          UUID NULL;
ALTER TABLE beleg_positionen ADD COLUMN rabatt_prozent      NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE beleg_positionen ADD COLUMN rabatt_betrag       NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN beleg_positionen.parent_position_id IS
  'Self-Reference fuer Hierarchie (Hauptposition 1 -> Sub-Positionen 1.1, 1.2). NULL = Top-Level.';
COMMENT ON COLUMN beleg_positionen.ist_summenzeile IS
  'true bei Hauptpositionen die keinen eigenen Preis haben sondern die Summe ihrer Kinder zeigen (z.B. "Rollopanzer" mit Unter-Rollos).';
COMMENT ON COLUMN beleg_positionen.ist_versteckt IS
  'true = erscheint NICHT im Kunden-PDF. Dient BOM/Bestellung-Ableitung (z.B. Fensterbank 1,20 lfm unter einem Fenster). Siehe AM-202 Welle 6.';
COMMENT ON COLUMN beleg_positionen.artikel_id IS
  'Platzhalter FK zu artikel-Tabelle (Welle 6 AM-202). Jetzt nullable, bleibt leer bis Artikelkatalog existiert.';
COMMENT ON COLUMN beleg_positionen.rabatt_prozent IS
  'Rabatt pro Position in Prozent (zusaetzlich zum Beleg-Rabatt).';
COMMENT ON COLUMN beleg_positionen.rabatt_betrag IS
  'Rabatt pro Position als Absolutbetrag (alternativ zu rabatt_prozent).';

CREATE INDEX idx_beleg_positionen_parent  ON beleg_positionen(parent_position_id) WHERE parent_position_id IS NOT NULL;
CREATE INDEX idx_beleg_positionen_artikel ON beleg_positionen(artikel_id)         WHERE artikel_id IS NOT NULL;
CREATE INDEX idx_beleg_positionen_versteckt ON beleg_positionen(beleg_id, ist_versteckt) WHERE ist_versteckt = true;

COMMIT;
