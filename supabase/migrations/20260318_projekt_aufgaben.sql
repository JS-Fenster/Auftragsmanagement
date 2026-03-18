-- projekt_aufgaben: Aufgaben/Todos pro Projekt
-- Neue isolierte Tabelle → MCP deploy OK

CREATE TABLE IF NOT EXISTS public.projekt_aufgaben (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id UUID NOT NULL REFERENCES public.projekte(id) ON DELETE CASCADE,
  titel TEXT NOT NULL,
  beschreibung TEXT,
  zustaendig TEXT,
  faellig_am DATE,
  erledigt BOOLEAN NOT NULL DEFAULT false,
  erledigt_am TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projekt_aufgaben_projekt ON public.projekt_aufgaben(projekt_id);

ALTER TABLE public.projekt_aufgaben ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projekt_aufgaben_select" ON public.projekt_aufgaben FOR SELECT TO anon USING (true);
CREATE POLICY "projekt_aufgaben_insert" ON public.projekt_aufgaben FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "projekt_aufgaben_update" ON public.projekt_aufgaben FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "projekt_aufgaben_delete" ON public.projekt_aufgaben FOR DELETE TO anon USING (true);

COMMENT ON TABLE public.projekt_aufgaben IS 'Aufgaben/Todos pro Projekt mit Checkbox, Zustaendigem und Faelligkeit.';
