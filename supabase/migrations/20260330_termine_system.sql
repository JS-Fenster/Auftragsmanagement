-- ============================================================
-- AM-095: Termine-System (Kalender + Ressourcen + Arbeitszeitmodelle)
-- Applied via MCP on 2026-03-30
-- ============================================================

-- 1. Ressourcen (Fahrzeuge, Monteure, Hilfsmittel)
CREATE TABLE IF NOT EXISTS public.ressourcen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  typ TEXT NOT NULL CHECK (typ IN ('fahrzeug', 'monteur', 'hilfsmittel')),
  name TEXT NOT NULL,
  kuerzel TEXT,
  farbe TEXT,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  eigenschaften JSONB DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ressourcen_typ ON public.ressourcen(typ);
CREATE INDEX idx_ressourcen_aktiv ON public.ressourcen(aktiv);

-- 2. Termin-Arten
CREATE TABLE IF NOT EXISTS public.termin_arten (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  farbe TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  aktiv BOOLEAN NOT NULL DEFAULT true
);

-- 3. Termine
CREATE TABLE IF NOT EXISTS public.termine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  art_id UUID NOT NULL REFERENCES public.termin_arten(id),
  titel TEXT NOT NULL,
  beschreibung TEXT,
  start_zeit TIMESTAMPTZ NOT NULL,
  end_zeit TIMESTAMPTZ NOT NULL,
  ganztaegig BOOLEAN NOT NULL DEFAULT false,
  projekt_id UUID REFERENCES public.projekte(id),
  kontakt_id UUID REFERENCES public.kontakte(id),
  status TEXT NOT NULL DEFAULT 'geplant' CHECK (status IN ('geplant', 'bestaetigt', 'abgeschlossen', 'abgesagt')),
  notizen TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT termine_end_nach_start CHECK (end_zeit >= start_zeit)
);

CREATE INDEX idx_termine_start ON public.termine(start_zeit);
CREATE INDEX idx_termine_end ON public.termine(end_zeit);
CREATE INDEX idx_termine_status ON public.termine(status);
CREATE INDEX idx_termine_art ON public.termine(art_id);
CREATE INDEX idx_termine_projekt ON public.termine(projekt_id);
CREATE INDEX idx_termine_kontakt ON public.termine(kontakt_id);

-- 4. Termin-Ressourcen (M:N Zuweisung)
CREATE TABLE IF NOT EXISTS public.termin_ressourcen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  termin_id UUID NOT NULL REFERENCES public.termine(id) ON DELETE CASCADE,
  ressource_id UUID NOT NULL REFERENCES public.ressourcen(id),
  rolle TEXT,
  UNIQUE(termin_id, ressource_id)
);

CREATE INDEX idx_termin_ressourcen_termin ON public.termin_ressourcen(termin_id);
CREATE INDEX idx_termin_ressourcen_ressource ON public.termin_ressourcen(ressource_id);

-- 5. Arbeitszeitmodelle
CREATE TABLE IF NOT EXISTS public.arbeitszeitmodelle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ressource_id UUID NOT NULL REFERENCES public.ressourcen(id),
  gueltig_ab DATE NOT NULL,
  gueltig_bis DATE,
  montag JSONB,
  dienstag JSONB,
  mittwoch JSONB,
  donnerstag JSONB,
  freitag JSONB,
  samstag JSONB,
  notiz TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_azm_ressource ON public.arbeitszeitmodelle(ressource_id);
CREATE INDEX idx_azm_gueltig ON public.arbeitszeitmodelle(gueltig_ab, gueltig_bis);

-- 6. Abwesenheiten
CREATE TABLE IF NOT EXISTS public.abwesenheiten (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ressource_id UUID NOT NULL REFERENCES public.ressourcen(id),
  datum DATE NOT NULL,
  typ TEXT NOT NULL DEFAULT 'frei' CHECK (typ IN ('urlaub', 'krank', 'frei', 'sonstiges')),
  ganztaegig BOOLEAN NOT NULL DEFAULT true,
  von_zeit TIME,
  bis_zeit TIME,
  notiz TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_abwesenheiten_ressource ON public.abwesenheiten(ressource_id);
CREATE INDEX idx_abwesenheiten_datum ON public.abwesenheiten(datum);

-- 7. Updated_at Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_ressourcen ON public.ressourcen;
CREATE TRIGGER set_updated_at_ressourcen
  BEFORE UPDATE ON public.ressourcen
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_termine ON public.termine;
CREATE TRIGGER set_updated_at_termine
  BEFORE UPDATE ON public.termine
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. RLS Policies
ALTER TABLE public.ressourcen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.termin_arten ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.termine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.termin_ressourcen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arbeitszeitmodelle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abwesenheiten ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ressourcen_anon_all" ON public.ressourcen FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "termin_arten_anon_all" ON public.termin_arten FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "termine_anon_all" ON public.termine FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "termin_ressourcen_anon_all" ON public.termin_ressourcen FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "arbeitszeitmodelle_anon_all" ON public.arbeitszeitmodelle FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "abwesenheiten_anon_all" ON public.abwesenheiten FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "ressourcen_auth_all" ON public.ressourcen FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "termin_arten_auth_all" ON public.termin_arten FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "termine_auth_all" ON public.termine FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "termin_ressourcen_auth_all" ON public.termin_ressourcen FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "arbeitszeitmodelle_auth_all" ON public.arbeitszeitmodelle FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "abwesenheiten_auth_all" ON public.abwesenheiten FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Termin-Arten
INSERT INTO public.termin_arten (name, slug, farbe, icon, sort_order) VALUES
  ('Montage', 'montage', '#3B82F6', 'Wrench', 1),
  ('Reparatur', 'reparatur', '#EF4444', 'AlertTriangle', 2),
  ('Aufmass', 'aufmass', '#8B5CF6', 'Ruler', 3),
  ('Lieferung / Abholung', 'lieferung', '#F59E0B', 'Truck', 4),
  ('Kundenbesuch / Beratung', 'beratung', '#10B981', 'Users', 5),
  ('Intern / Buero', 'intern', '#6B7280', 'Building', 6),
  ('Lieferanten-Termin', 'lieferant', '#EC4899', 'Factory', 7);

-- Fahrzeuge
INSERT INTO public.ressourcen (typ, name, kuerzel, farbe, sort_order, eigenschaften) VALUES
  ('fahrzeug', 'Bus 1', 'B1', '#3B82F6', 1, '{"typ": "bus", "sitzplaetze": 3}'),
  ('fahrzeug', 'Bus 2', 'B2', '#10B981', 2, '{"typ": "bus", "sitzplaetze": 3}'),
  ('fahrzeug', 'Bus 3', 'B3', '#8B5CF6', 3, '{"typ": "bus", "sitzplaetze": 3}'),
  ('fahrzeug', 'Bus 4', 'B4', '#F59E0B', 4, '{"typ": "bus", "sitzplaetze": 3}'),
  ('fahrzeug', 'Caddy 1', 'C1', '#6B7280', 5, '{"typ": "caddy", "sitzplaetze": 2}'),
  ('fahrzeug', 'Caddy 2', 'C2', '#9CA3AF', 6, '{"typ": "caddy", "sitzplaetze": 2}'),
  ('fahrzeug', 'Caddy 3', 'C3', '#6B7280', 7, '{"typ": "caddy", "sitzplaetze": 2}'),
  ('fahrzeug', 'Caddy 4', 'C4', '#9CA3AF', 8, '{"typ": "caddy", "sitzplaetze": 2}');

-- Monteure
INSERT INTO public.ressourcen (typ, name, kuerzel, farbe, sort_order, eigenschaften) VALUES
  ('monteur', 'Mariusz', 'MA', '#3B82F6', 1, '{"faehigkeiten": ["fenster", "tueren", "raffstore", "markise"]}'),
  ('monteur', 'Manfred', 'MF', '#2563EB', 2, '{"faehigkeiten": ["fenster", "tueren", "raffstore"]}'),
  ('monteur', 'Christian', 'CH', '#10B981', 3, '{"faehigkeiten": ["fenster", "tueren", "raffstore", "markise"]}'),
  ('monteur', 'Michael', 'MI', '#059669', 4, '{"faehigkeiten": ["fenster", "tueren"]}'),
  ('monteur', 'Stefan', 'ST', '#F59E0B', 5, '{"faehigkeiten": ["fenster", "tueren", "reparatur", "service"]}'),
  ('monteur', 'Andreas', 'AN', '#7C3AED', 6, '{"faehigkeiten": ["alle"], "flexibel": true}'),
  ('monteur', 'Jaroslaw', 'JA', '#DC2626', 7, '{"faehigkeiten": ["alle"], "flexibel": true}');

-- Hilfsmittel
INSERT INTO public.ressourcen (typ, name, kuerzel, farbe, sort_order, eigenschaften) VALUES
  ('hilfsmittel', 'Anhaenger 1', 'AH1', '#78716C', 1, '{"max_parallel": 1}'),
  ('hilfsmittel', 'Anhaenger 2', 'AH2', '#78716C', 2, '{"max_parallel": 1}'),
  ('hilfsmittel', 'Markisenlifter', 'ML', '#78716C', 3, '{"max_parallel": 1}'),
  ('hilfsmittel', 'Fraeser', 'FR', '#78716C', 4, '{"max_parallel": 1}'),
  ('hilfsmittel', 'Handkreissaege 1', 'HK1', '#78716C', 5, '{"max_parallel": 1}'),
  ('hilfsmittel', 'Handkreissaege 2', 'HK2', '#78716C', 6, '{"max_parallel": 1}');

-- Arbeitszeitmodelle: Standard Mo-Fr 07:00-16:00
INSERT INTO public.arbeitszeitmodelle (ressource_id, gueltig_ab, montag, dienstag, mittwoch, donnerstag, freitag, samstag)
SELECT id, '2025-01-01',
  '{"start": "07:00", "ende": "16:00"}'::jsonb,
  '{"start": "07:00", "ende": "16:00"}'::jsonb,
  '{"start": "07:00", "ende": "16:00"}'::jsonb,
  '{"start": "07:00", "ende": "16:00"}'::jsonb,
  '{"start": "07:00", "ende": "16:00"}'::jsonb,
  NULL
FROM public.ressourcen WHERE typ = 'monteur' AND name IN ('Mariusz', 'Manfred', 'Christian');

-- Stefan: Mo-Fr 07:00-15:00
INSERT INTO public.arbeitszeitmodelle (ressource_id, gueltig_ab, montag, dienstag, mittwoch, donnerstag, freitag, samstag)
SELECT id, '2025-01-01',
  '{"start": "07:00", "ende": "15:00"}'::jsonb,
  '{"start": "07:00", "ende": "15:00"}'::jsonb,
  '{"start": "07:00", "ende": "15:00"}'::jsonb,
  '{"start": "07:00", "ende": "15:00"}'::jsonb,
  '{"start": "07:00", "ende": "15:00"}'::jsonb,
  NULL
FROM public.ressourcen WHERE typ = 'monteur' AND name = 'Stefan';

-- Michael: bis Maerz Mo-Fr, ab April Mo-Do
INSERT INTO public.arbeitszeitmodelle (ressource_id, gueltig_ab, gueltig_bis, montag, dienstag, mittwoch, donnerstag, freitag, samstag)
SELECT id, '2025-01-01', '2026-03-31',
  '{"start": "07:00", "ende": "16:00"}'::jsonb,
  '{"start": "07:00", "ende": "16:00"}'::jsonb,
  '{"start": "07:00", "ende": "16:00"}'::jsonb,
  '{"start": "07:00", "ende": "16:00"}'::jsonb,
  '{"start": "07:00", "ende": "16:00"}'::jsonb,
  NULL
FROM public.ressourcen WHERE typ = 'monteur' AND name = 'Michael';

INSERT INTO public.arbeitszeitmodelle (ressource_id, gueltig_ab, montag, dienstag, mittwoch, donnerstag, freitag, samstag, notiz)
SELECT id, '2026-04-01',
  '{"start": "07:00", "ende": "16:00"}'::jsonb,
  '{"start": "07:00", "ende": "16:00"}'::jsonb,
  '{"start": "07:00", "ende": "16:00"}'::jsonb,
  '{"start": "07:00", "ende": "16:00"}'::jsonb,
  NULL,
  NULL,
  'Reduzierte Arbeitszeit ab April 2026: Mo-Do'
FROM public.ressourcen WHERE typ = 'monteur' AND name = 'Michael';
