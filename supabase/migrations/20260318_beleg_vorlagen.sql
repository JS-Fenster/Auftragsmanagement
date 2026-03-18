-- beleg_vorlagen: Vorlagen-Positionen fuer schnelles Einfuegen in Belege
-- Neue isolierte Tabelle → MCP deploy OK

CREATE TABLE IF NOT EXISTS public.beleg_vorlagen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bezeichnung TEXT NOT NULL,
  beschreibung TEXT,
  einheit TEXT NOT NULL DEFAULT 'Stk',
  menge NUMERIC(10,2) NOT NULL DEFAULT 1,
  einzelpreis NUMERIC(12,2) NOT NULL DEFAULT 0,
  kategorie TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.beleg_vorlagen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "beleg_vorlagen_select" ON public.beleg_vorlagen FOR SELECT TO anon USING (true);
CREATE POLICY "beleg_vorlagen_insert" ON public.beleg_vorlagen FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "beleg_vorlagen_update" ON public.beleg_vorlagen FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "beleg_vorlagen_delete" ON public.beleg_vorlagen FOR DELETE TO anon USING (true);

-- Seed: Haeufige Positionen fuer Fensterbau
INSERT INTO public.beleg_vorlagen (bezeichnung, beschreibung, einheit, menge, einzelpreis, kategorie, sort_order) VALUES
  ('Kunststoff-Fenster 2-fluegelig Dreh-Kipp', 'Weiss, 5-Kammer, Ug 0.7, inkl. Beschlag', 'Stk', 1, 0, 'Fenster', 1),
  ('Kunststoff-Fenster 1-fluegelig Dreh-Kipp', 'Weiss, 5-Kammer, Ug 0.7, inkl. Beschlag', 'Stk', 1, 0, 'Fenster', 2),
  ('Kunststoff-Fenster Festfeld', 'Weiss, 5-Kammer, Ug 0.7', 'Stk', 1, 0, 'Fenster', 3),
  ('Aluminium-Haustuer', 'Inkl. Beschlag, Zylinder, Druecker', 'Stk', 1, 0, 'Tueren', 10),
  ('Kunststoff-Haustuer', 'Inkl. Beschlag, Zylinder, Druecker', 'Stk', 1, 0, 'Tueren', 11),
  ('Rollladen Vorbau', 'Motorisch, inkl. Steuerung', 'Stk', 1, 0, 'Rollladen', 20),
  ('Rollladen Aufsatz', 'Motorisch, inkl. Steuerung', 'Stk', 1, 0, 'Rollladen', 21),
  ('Raffstore / Aussenjalousie', 'Motorisch, inkl. Steuerung', 'Stk', 1, 0, 'Rollladen', 22),
  ('Insektenschutz Spannrahmen', 'Alu-Rahmen, Fiberglas-Gewebe', 'Stk', 1, 0, 'Zubehoer', 30),
  ('Insektenschutz Rollo', 'Alu-Rahmen', 'Stk', 1, 0, 'Zubehoer', 31),
  ('Fensterbank innen', 'Kunststoff, weiss', 'lfm', 1, 0, 'Zubehoer', 32),
  ('Fensterbank aussen', 'Aluminium, RAL nach Wahl', 'lfm', 1, 0, 'Zubehoer', 33),
  ('Montage Fenster', 'Demontage alt, Montage neu, Abdichtung RAL', 'Stk', 1, 0, 'Montage', 40),
  ('Montage Haustuer', 'Demontage alt, Montage neu, Abdichtung', 'Stk', 1, 0, 'Montage', 41),
  ('Montage Rollladen', 'Montage inkl. Elektrik', 'Stk', 1, 0, 'Montage', 42),
  ('Anfahrtspauschale', NULL, 'pauschal', 1, 0, 'Montage', 43),
  ('Demontage + Entsorgung', 'Alte Elemente fachgerecht entsorgen', 'pauschal', 1, 0, 'Montage', 44),
  ('Nacharbeit Innenlaibung', 'Putz, Spachtel, Farbe', 'Stk', 1, 0, 'Nacharbeit', 50),
  ('Nacharbeit Aussenlaibung', 'Putz, Abdichtung', 'Stk', 1, 0, 'Nacharbeit', 51);

COMMENT ON TABLE public.beleg_vorlagen IS 'Vorlagen-Positionen fuer schnelles Einfuegen in Belege. Keine Artikelnummern, nur Bezeichnung + Standardwerte.';
