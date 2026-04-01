-- AM-133: Faehigkeiten/Skills (Handwerk)
CREATE TABLE IF NOT EXISTS public.mitarbeiter_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mitarbeiter_id UUID NOT NULL REFERENCES public.mitarbeiter(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  level TEXT DEFAULT 'standard' CHECK (level IN ('lehrling', 'junior', 'standard', 'senior', 'meister')),
  seit DATE,
  notiz TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(mitarbeiter_id, skill)
);

CREATE INDEX IF NOT EXISTS idx_mitarbeiter_skills_ma ON public.mitarbeiter_skills(mitarbeiter_id);
CREATE INDEX IF NOT EXISTS idx_mitarbeiter_skills_skill ON public.mitarbeiter_skills(skill);

-- RLS
ALTER TABLE public.mitarbeiter_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mitarbeiter_skills_anon_all" ON public.mitarbeiter_skills FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "mitarbeiter_skills_auth_all" ON public.mitarbeiter_skills FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed: Bestehende Skills aus ressourcen.eigenschaften migrieren
INSERT INTO mitarbeiter_skills (mitarbeiter_id, skill, level)
SELECT m.id, unnest(ARRAY(SELECT jsonb_array_elements_text(r.eigenschaften->'faehigkeiten'))), 'standard'
FROM mitarbeiter m
JOIN ressourcen r ON r.id = m.ressource_id
WHERE r.eigenschaften ? 'faehigkeiten'
ON CONFLICT (mitarbeiter_id, skill) DO NOTHING;
