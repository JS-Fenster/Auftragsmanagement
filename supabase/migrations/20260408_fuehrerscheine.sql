-- Fuehrerschein-Verwaltung pro Mitarbeiter
-- Klassen, Gueltigkeit, Pruef-Turnus mit automatischer naechste_pruefung Berechnung
-- Referenz: AM-129

CREATE TABLE IF NOT EXISTS mitarbeiter_fuehrerscheine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mitarbeiter_id UUID NOT NULL REFERENCES mitarbeiter(id) ON DELETE CASCADE,
  klasse TEXT NOT NULL,
  erhalten_am DATE,
  gueltig_bis DATE,
  letzte_pruefung DATE,
  naechste_pruefung DATE,
  pruef_turnus_monate INTEGER DEFAULT 60,
  dokument_url TEXT,
  notiz TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(mitarbeiter_id, klasse)
);

CREATE INDEX idx_fuehrerscheine_ma ON mitarbeiter_fuehrerscheine(mitarbeiter_id);
CREATE INDEX idx_fuehrerscheine_pruefung ON mitarbeiter_fuehrerscheine(naechste_pruefung) WHERE naechste_pruefung IS NOT NULL;

-- Auto-calculate naechste_pruefung from letzte_pruefung + turnus
CREATE OR REPLACE FUNCTION calc_naechste_pruefung()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.letzte_pruefung IS NOT NULL AND NEW.pruef_turnus_monate IS NOT NULL THEN
    NEW.naechste_pruefung := NEW.letzte_pruefung + (NEW.pruef_turnus_monate || ' months')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fuehrerschein_pruefung
  BEFORE INSERT OR UPDATE OF letzte_pruefung, pruef_turnus_monate
  ON mitarbeiter_fuehrerscheine
  FOR EACH ROW
  EXECUTE FUNCTION calc_naechste_pruefung();

-- RLS
ALTER TABLE mitarbeiter_fuehrerscheine ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fuehrerscheine_anon_select" ON mitarbeiter_fuehrerscheine
  FOR SELECT TO anon USING (true);
CREATE POLICY "fuehrerscheine_anon_insert" ON mitarbeiter_fuehrerscheine
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "fuehrerscheine_anon_update" ON mitarbeiter_fuehrerscheine
  FOR UPDATE TO anon USING (true);
CREATE POLICY "fuehrerscheine_anon_delete" ON mitarbeiter_fuehrerscheine
  FOR DELETE TO anon USING (true);
CREATE POLICY "fuehrerscheine_auth_select" ON mitarbeiter_fuehrerscheine
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "fuehrerscheine_auth_insert" ON mitarbeiter_fuehrerscheine
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fuehrerscheine_auth_update" ON mitarbeiter_fuehrerscheine
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "fuehrerscheine_auth_delete" ON mitarbeiter_fuehrerscheine
  FOR DELETE TO authenticated USING (true);
